import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EffectiveDatedService } from '../employees/effective-dated.service';
import {
  GLExportQueryDto,
  GLJournalExportDto,
  GLJournalLineDto,
  GLExportType,
  BankFileQueryDto,
  BankFileExportDto,
  BankFileFormat,
  BankFilePaymentDto,
  StatutoryReportQueryDto,
  StatutoryReportType,
  EMP201ReportDto,
  EMP201LineDto,
  IRP5BatchExportDto,
  IRP5DataDto,
  UI19ReportDto,
  ExportResultDto,
  ExportFormat,
  DEFAULT_GL_MAPPINGS,
  IRP5_SOURCE_CODES,
  IRP5_DEDUCTION_CODES,
} from './dto/exports.dto';
import { format, addDays, endOfMonth } from 'date-fns';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly effectiveDatedService: EffectiveDatedService,
  ) {}

  // ============================================================================
  // GL Journal Export
  // ============================================================================

  async generateGLExport(query: GLExportQueryDto): Promise<GLJournalExportDto> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: query.payrun_id },
      include: {
        payGroup: { include: { legalEntity: true } },
        employeeResults: {
          include: {
            employee: {
              include: {
                employments: true,
                bankAccounts: true,
              },
            },
            payLines: {
              include: {
                payItem: true,
              },
            },
          },
        },
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${query.payrun_id} not found`);
    }

    const lines: GLJournalLineDto[] = [];
    const periodEnd = payrun.periodEnd || payrun.periodStart || new Date();
    const journalRef = `PR-${format(periodEnd, 'yyyyMM')}-${payrun.id.slice(0, 8)}`;

    // Aggregate by GL account
    const accountTotals = new Map<string, { debit: number; credit: number; description: string; name: string }>();

    for (const result of payrun.employeeResults) {
      for (const line of result.payLines) {
        const code = (line.payItem as any)?.code || (line as any).code || 'UNKNOWN';
        const mapping = DEFAULT_GL_MAPPINGS[code.toUpperCase()] || {
          account: '5999',
          name: 'Miscellaneous',
          isDebit: line.type === 'EARNING' || line.type === 'EMPLOYER_CONTRIB',
        };

        const amount = Math.abs(Number(line.amount));
        const key = `${mapping.account}-${mapping.isDebit ? 'D' : 'C'}`;

        const current = accountTotals.get(key) || {
          debit: 0,
          credit: 0,
          description: mapping.name,
          name: mapping.name,
        };

        if (mapping.isDebit) {
          current.debit += amount;
        } else {
          current.credit += amount;
        }

        accountTotals.set(key, current);

        // Add employee detail if requested
        if (query.include_employee_detail && amount > 0) {
          lines.push({
            account_code: mapping.account,
            account_name: mapping.name,
            department: result.employee.employments?.[0]?.costCenter || 'Unassigned',
            cost_center: result.employee.employments?.[0]?.costCenter || undefined,
            debit: mapping.isDebit ? amount : 0,
            credit: mapping.isDebit ? 0 : amount,
            description: `${code} - ${result.employee.firstName} ${result.employee.lastName}`,
            reference: journalRef,
            employee_id: result.employeeId,
            employee_name: `${result.employee.firstName} ${result.employee.lastName}`,
          });
        }
      }

      // Add net pay entry
      const netPay = Number(result.net);
      const netMapping = DEFAULT_GL_MAPPINGS['NET_PAY'];
      const netKey = `${netMapping.account}-C`;
      const netCurrent = accountTotals.get(netKey) || { debit: 0, credit: 0, description: netMapping.name, name: netMapping.name };
      netCurrent.credit += netPay;
      accountTotals.set(netKey, netCurrent);
    }

    // If not detailed, create summary lines
    if (!query.include_employee_detail) {
      for (const [key, value] of accountTotals.entries()) {
        const [account] = key.split('-');
        if (value.debit > 0 || value.credit > 0) {
          lines.push({
            account_code: account,
            account_name: value.name,
            debit: Math.round(value.debit * 100) / 100,
            credit: Math.round(value.credit * 100) / 100,
            description: value.description,
            reference: journalRef,
          });
        }
      }
    }

    const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

    return {
      payrun_id: payrun.id,
      pay_group_name: payrun.payGroup?.name || '',
      legal_entity_name: payrun.payGroup?.legalEntity?.name || '',
      period_start: payrun.periodStart ? format(payrun.periodStart, 'yyyy-MM-dd') : '',
      period_end: payrun.periodEnd ? format(payrun.periodEnd, 'yyyy-MM-dd') : '',
      pay_date: payrun.payDate ? format(payrun.payDate, 'yyyy-MM-dd') : '',
      journal_date: payrun.payDate ? format(payrun.payDate, 'yyyy-MM-dd') : '',
      journal_reference: journalRef,
      currency: payrun.payGroup?.currency || 'ZAR',
      lines: lines.sort((a, b) => a.account_code.localeCompare(b.account_code)),
      total_debits: Math.round(totalDebits * 100) / 100,
      total_credits: Math.round(totalCredits * 100) / 100,
      is_balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  // ============================================================================
  // Bank File Generation
  // ============================================================================

  async generateBankFile(userId: string, query: BankFileQueryDto): Promise<BankFileExportDto> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: query.payrun_id },
      include: {
        payGroup: { include: { legalEntity: true } },
        employeeResults: {
          where: { net: { gt: 0 } },
          include: {
            employee: {
              include: {
                bankAccounts: { take: 1 },
              },
            },
            payLines: {
              include: {
                payItem: true,
              },
            },
          },
        },
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${query.payrun_id} not found`);
    }

    const fileFormat = query.format || BankFileFormat.CSV;
    const payments: BankFilePaymentDto[] = [];
    const warnings: string[] = [];

    for (const result of payrun.employeeResults) {
      const bankAccount = result.employee.bankAccounts?.[0];

      if (!bankAccount) {
        warnings.push(`Employee ${result.employee.employeeNo} has no bank account`);
        continue;
      }

      // CRITICAL: Decrypt account number for bank file generation (audit logged)
      const decryptedAccountNumber = await this.effectiveDatedService.getDecryptedAccountNumber(
        bankAccount.id,
        userId,
        `Generating bank export file for payrun ${payrun.id}`,
      );

      payments.push({
        employee_id: result.employeeId,
        employee_number: result.employee.employeeNo,
        employee_name: `${result.employee.firstName} ${result.employee.lastName}`,
        bank_name: bankAccount.bankName,
        branch_code: bankAccount.branchCode || '',
        account_number: decryptedAccountNumber,
        account_type: bankAccount.accountType || 'CHECKING',
        amount: Number(result.net),
        reference: `SAL-${payrun.periodEnd ? format(payrun.periodEnd, 'yyyyMM') : 'UNKNOWN'}`,
      });
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Generate file content based on format
    const fileContent = this.generateBankFileContent(fileFormat, payments, payrun, query.test_mode);
    const payDate = payrun.payDate || payrun.periodEnd || new Date();
    const fileName = `bank-${fileFormat.toLowerCase()}-${format(payDate, 'yyyyMMdd')}.${this.getFileExtension(fileFormat)}`;

    return {
      payrun_id: payrun.id,
      file_format: fileFormat,
      generation_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      payment_date: payrun.payDate ? format(payrun.payDate, 'yyyy-MM-dd') : '',
      total_payments: payments.length,
      total_amount: Math.round(totalAmount * 100) / 100,
      currency: payrun.payGroup?.currency || 'ZAR',
      file_content: fileContent,
      file_name: fileName,
      payments,
      company_name: payrun.payGroup?.legalEntity?.name || '',
      company_account_number: '', // Would come from configuration
      company_branch_code: '',
    };
  }

  private generateBankFileContent(
    format: BankFileFormat,
    payments: BankFilePaymentDto[],
    payrun: any,
    testMode?: boolean,
  ): string {
    switch (format) {
      case BankFileFormat.CSV:
        return this.generateCSVBankFile(payments, payrun);
      case BankFileFormat.ACB:
        return this.generateACBFile(payments, payrun, testMode);
      case BankFileFormat.BANKSERV:
        return this.generateBankServFile(payments, payrun, testMode);
      default:
        return this.generateCSVBankFile(payments, payrun);
    }
  }

  private generateCSVBankFile(payments: BankFilePaymentDto[], payrun: any): string {
    const headers = ['Employee Number', 'Employee Name', 'Bank', 'Branch Code', 'Account Number', 'Account Type', 'Amount', 'Reference'];
    const rows = payments.map((p) => [
      p.employee_number,
      `"${p.employee_name}"`,
      p.bank_name,
      p.branch_code,
      p.account_number,
      p.account_type,
      p.amount.toFixed(2),
      p.reference,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  private generateACBFile(payments: BankFilePaymentDto[], payrun: any, testMode?: boolean): string {
    // ACB (Automated Clearing Bureau) format
    const lines: string[] = [];
    const actionDate = payrun.payDate ? format(payrun.payDate, 'yyMMdd') : format(new Date(), 'yyMMdd');
    const generationNumber = '0001'; // Should be sequential

    // Header record (Record Type 1)
    lines.push(
      '1' + // Record identifier
      actionDate + // Action date
      'SALARIES'.padEnd(10) + // User code
      generationNumber + // Generation number
      (payrun.payGroup?.legalEntity?.name || '').substring(0, 30).padEnd(30) + // User name
      '000000' + // User branch
      '0000000000000'.padStart(13, '0') + // User account
      (testMode ? 'T' : 'L'), // Live or Test
    );

    // Transaction records (Record Type 2)
    let sequenceNumber = 1;
    for (const payment of payments) {
      const amountCents = Math.round(payment.amount * 100).toString().padStart(11, '0');

      lines.push(
        '2' + // Record identifier
        payment.branch_code.padStart(6, '0') + // Branch code
        payment.account_number.padStart(11, '0') + // Account number
        '0' + // Account type qualifier
        amountCents + // Amount in cents
        actionDate + // Action date
        payment.employee_name.substring(0, 30).padEnd(30) + // Beneficiary name
        payment.reference.substring(0, 30).padEnd(30) + // Reference
        sequenceNumber.toString().padStart(6, '0'), // Sequence number
      );
      sequenceNumber++;
    }

    // Trailer record (Record Type 3)
    const totalCents = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100);
    lines.push(
      '3' + // Record identifier
      payments.length.toString().padStart(6, '0') + // Number of transactions
      totalCents.toString().padStart(12, '0') + // Total value
      '000000000000', // Hash total (simplified)
    );

    return lines.join('\n');
  }

  private generateBankServFile(payments: BankFilePaymentDto[], payrun: any, testMode?: boolean): string {
    // Simplified BankServ EFT format
    const lines: string[] = [];
    const actionDate = payrun.payDate ? format(payrun.payDate, 'yyMMdd') : format(new Date(), 'yyMMdd');

    // Header
    lines.push(`H,${actionDate},${payrun.payGroup?.legalEntity?.name || ''},SALARY,${testMode ? 'TEST' : 'LIVE'}`);

    // Detail records
    for (const payment of payments) {
      lines.push(
        `D,${payment.branch_code},${payment.account_number},${payment.amount.toFixed(2)},${payment.employee_name},${payment.reference}`,
      );
    }

    // Trailer
    const total = payments.reduce((s, p) => s + p.amount, 0);
    lines.push(`T,${payments.length},${total.toFixed(2)}`);

    return lines.join('\n');
  }

  private getFileExtension(format: BankFileFormat): string {
    switch (format) {
      case BankFileFormat.CSV:
        return 'csv';
      case BankFileFormat.ACB:
      case BankFileFormat.BANKSERV:
        return 'txt';
      default:
        return 'txt';
    }
  }

  // ============================================================================
  // Statutory Reports
  // ============================================================================

  async generateStatutoryReport(query: StatutoryReportQueryDto): Promise<any> {
    switch (query.report_type) {
      case StatutoryReportType.EMP201:
        return this.generateEMP201(query);
      case StatutoryReportType.IRP5_BATCH:
        return this.generateIRP5Batch(query);
      case StatutoryReportType.UI19:
        return this.generateUI19(query);
      default:
        throw new BadRequestException(`Unsupported report type: ${query.report_type}`);
    }
  }

  async generateEMP201(query: StatutoryReportQueryDto): Promise<EMP201ReportDto> {
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: query.legal_entity_id },
    });

    if (!legalEntity) {
      throw new NotFoundException(`Legal entity ${query.legal_entity_id} not found`);
    }

    // Parse tax month
    const [year, month] = (query.tax_month || format(new Date(), 'yyyy-MM')).split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = endOfMonth(periodStart);

    // Get all finalized payruns for the period
    const payruns = await this.prisma.payRun.findMany({
      where: {
        payGroup: { legalEntityId: query.legal_entity_id },
        status: { in: ['PAID', 'POSTED', 'FINALIZED'] },
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      include: {
        employeeResults: {
          include: {
            employee: {
              include: { taxProfiles: { where: { effectiveTo: null }, take: 1 } },
            },
            payLines: {
              include: { payItem: true },
            },
          },
        },
      },
    });

    // Aggregate by employee
    const employeeData = new Map<string, EMP201LineDto>();

    for (const payrun of payruns) {
      for (const result of payrun.employeeResults) {
        const empId = result.employeeId;
        const existing = employeeData.get(empId) || {
          employee_id: empId,
          employee_number: result.employee.employeeNo,
          id_number: result.employee.nationalId || result.employee.idNumber || '',
          surname: result.employee.lastName,
          first_names: result.employee.firstName,
          gross_remuneration: 0,
          paye: 0,
          sdl: 0,
          uif: 0,
          periods: 0,
        };

        existing.gross_remuneration += Number(result.gross);
        existing.paye += Number(result.paye);
        existing.periods += 1;

        // Extract SDL and UIF from pay lines
        for (const line of result.payLines) {
          const code = (line.payItem?.code || '').toUpperCase();
          if (code === 'SDL') {
            existing.sdl += Number(line.amount);
          } else if (code === 'UIF' || code === 'UIF_EE') {
            existing.uif += Number(line.amount);
          }
        }

        employeeData.set(empId, existing);
      }
    }

    const employees = Array.from(employeeData.values());
    const totalGross = employees.reduce((s, e) => s + e.gross_remuneration, 0);
    const totalPaye = employees.reduce((s, e) => s + e.paye, 0);
    const totalSdl = employees.reduce((s, e) => s + e.sdl, 0);
    const totalUif = employees.reduce((s, e) => s + e.uif, 0);

    // Calculate SDL (1% of total remuneration)
    const calculatedSdl = totalGross * 0.01;
    // UIF employer = UIF employee
    const uifEmployer = totalUif;

    return {
      report_type: 'EMP201',
      legal_entity_name: legalEntity.name,
      paye_reference: legalEntity.taxReference || '',
      sdl_reference: legalEntity.taxReference || '',
      uif_reference: legalEntity.taxReference || '',
      tax_period: format(periodStart, 'MMMM yyyy'),
      tax_year: this.getTaxYear(periodStart),

      total_employees: employees.length,
      total_gross_remuneration: Math.round(totalGross * 100) / 100,
      total_paye: Math.round(totalPaye * 100) / 100,
      total_sdl: Math.round(calculatedSdl * 100) / 100,
      total_uif_employee: Math.round(totalUif * 100) / 100,
      total_uif_employer: Math.round(uifEmployer * 100) / 100,
      total_payable: Math.round((totalPaye + calculatedSdl + totalUif + uifEmployer) * 100) / 100,

      payment_due_date: format(addDays(endOfMonth(periodStart), 7), 'yyyy-MM-dd'),

      employees: employees.map((e) => ({
        ...e,
        gross_remuneration: Math.round(e.gross_remuneration * 100) / 100,
        paye: Math.round(e.paye * 100) / 100,
        sdl: Math.round(e.sdl * 100) / 100,
        uif: Math.round(e.uif * 100) / 100,
      })),

      generated_at: new Date().toISOString(),
    };
  }

  async generateIRP5Batch(query: StatutoryReportQueryDto): Promise<IRP5BatchExportDto> {
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: query.legal_entity_id },
    });

    if (!legalEntity) {
      throw new NotFoundException(`Legal entity ${query.legal_entity_id} not found`);
    }

    const taxYear = query.tax_year || this.getTaxYear(new Date());
    const [startYear] = taxYear.split('/').map(Number);
    const taxYearStart = new Date(startYear - 1, 2, 1); // March 1
    const taxYearEnd = new Date(startYear, 1, 28); // Feb 28

    // Get all employees with results in the tax year
    const employeeResults = await this.prisma.employeeResult.findMany({
      where: {
        payrun: {
          payGroup: { legalEntityId: query.legal_entity_id },
          status: { in: ['PAID', 'POSTED', 'FINALIZED'] },
          periodStart: { gte: taxYearStart },
          periodEnd: { lte: taxYearEnd },
        },
      },
      include: {
        employee: {
          include: {
            taxProfiles: { where: { effectiveTo: null }, take: 1 },
            employments: { where: { effectiveTo: null }, take: 1 },
          },
        },
        payLines: { include: { payItem: true } },
        payrun: true,
      },
    });

    // Aggregate by employee
    const employeeData = new Map<string, {
      employee: any;
      results: any[];
      sourceCodes: Map<string, number>;
      deductionCodes: Map<string, number>;
    }>();

    for (const result of employeeResults) {
      const empId = result.employeeId;
      const existing = employeeData.get(empId) || {
        employee: result.employee,
        results: [] as any[],
        sourceCodes: new Map<string, number>(),
        deductionCodes: new Map<string, number>(),
      };

      existing.results.push(result);

      for (const line of result.payLines) {
        const code = (line.payItem?.code || '').toUpperCase();
        const amount = Number(line.amount);

        if (line.type === 'EARNING') {
          const irp5Code = IRP5_SOURCE_CODES[code]?.code || '3699';
          existing.sourceCodes.set(irp5Code, (existing.sourceCodes.get(irp5Code) || 0) + amount);
        } else if (line.type === 'DEDUCTION' || line.type === 'TAX') {
          const irp5Code = IRP5_DEDUCTION_CODES[code]?.code || '4199';
          existing.deductionCodes.set(irp5Code, (existing.deductionCodes.get(irp5Code) || 0) + amount);
        }
      }

      employeeData.set(empId, existing);
    }

    // Generate certificates
    const certificates: IRP5DataDto[] = [];
    let certNumber = 1;

    for (const [empId, data] of employeeData.entries()) {
      const emp = data.employee;
      const taxProfile = emp.taxProfiles[0];
      const employment = emp.employments[0];

      const totalGross = data.results.reduce((s: number, r: any) => s + Number(r.gross), 0);
      const totalPaye = data.results.reduce((s: number, r: any) => s + Number(r.paye), 0);

      const sourceCodes = Array.from(data.sourceCodes.entries()).map(([code, amount]) => ({
        code,
        description: Object.values(IRP5_SOURCE_CODES).find((c) => c.code === code)?.description || 'Other income',
        amount: Math.round(amount * 100) / 100,
      }));

      const deductionCodes = Array.from(data.deductionCodes.entries()).map(([code, amount]) => ({
        code,
        description: Object.values(IRP5_DEDUCTION_CODES).find((c) => c.code === code)?.description || 'Other deduction',
        amount: Math.round(amount * 100) / 100,
      }));

      certificates.push({
        employee_id: empId,
        certificate_number: `IRP5-${taxYear.replace('/', '')}-${certNumber.toString().padStart(6, '0')}`,
        employee_number: emp.employeeNo,
        id_number: emp.nationalId || emp.idNumber || '',
        surname: emp.lastName,
        first_names: emp.firstName,
        date_of_birth: emp.dateOfBirth ? format(emp.dateOfBirth, 'yyyy-MM-dd') : '',
        tax_reference: taxProfile?.taxReference || '',
        employment_start: employment?.effectiveFrom ? format(employment.effectiveFrom, 'yyyy-MM-dd') : format(emp.hireDate, 'yyyy-MM-dd'),
        nature_of_person: 'A', // Individual
        source_codes: sourceCodes,
        deduction_codes: deductionCodes,
        tax_credit_codes: [],
        gross_remuneration: Math.round(totalGross * 100) / 100,
        taxable_income: Math.round(totalGross * 100) / 100,
        paye_deducted: Math.round(totalPaye * 100) / 100,
        non_taxable_income: 0,
      });

      certNumber++;
    }

    return {
      legal_entity_name: legalEntity.name,
      paye_reference: legalEntity.taxReference || '',
      tax_year: taxYear,
      total_certificates: certificates.length,
      generated_at: new Date().toISOString(),
      certificates,
    };
  }

  async generateUI19(query: StatutoryReportQueryDto): Promise<UI19ReportDto> {
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: query.legal_entity_id },
    });

    if (!legalEntity) {
      throw new NotFoundException(`Legal entity ${query.legal_entity_id} not found`);
    }

    const periodStart = query.from_date ? new Date(query.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const periodEnd = query.to_date ? new Date(query.to_date) : new Date();

    const results = await this.prisma.employeeResult.findMany({
      where: {
        payrun: {
          payGroup: { legalEntityId: query.legal_entity_id },
          status: { in: ['PAID', 'POSTED', 'FINALIZED'] },
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
      },
      include: {
        payLines: { include: { payItem: true } },
      },
    });

    let totalRemuneration = 0;
    let totalUifEmployee = 0;
    const employeeIds = new Set<string>();

    for (const result of results) {
      totalRemuneration += Number(result.gross);
      employeeIds.add(result.employeeId);

      for (const line of result.payLines) {
        const code = (line.payItem?.code || '').toUpperCase();
        if (code === 'UIF' || code === 'UIF_EE') {
          totalUifEmployee += Number(line.amount);
        }
      }
    }

    const uifEmployer = totalUifEmployee; // Employer matches employee

    return {
      report_type: 'UI19',
      legal_entity_name: legalEntity.name,
      uif_reference: legalEntity.taxReference || '',
      period_start: format(periodStart, 'yyyy-MM-dd'),
      period_end: format(periodEnd, 'yyyy-MM-dd'),
      total_employees: employeeIds.size,
      total_remuneration: Math.round(totalRemuneration * 100) / 100,
      total_uif_employee: Math.round(totalUifEmployee * 100) / 100,
      total_uif_employer: Math.round(uifEmployer * 100) / 100,
      total_contribution: Math.round((totalUifEmployee + uifEmployer) * 100) / 100,
      declaration_date: format(new Date(), 'yyyy-MM-dd'),
      generated_at: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Export to File
  // ============================================================================

  async exportToFormat(data: any, format: ExportFormat, fileName: string): Promise<ExportResultDto> {
    let content: string;
    let extension: string;

    switch (format) {
      case ExportFormat.CSV:
        content = this.toCSV(data);
        extension = 'csv';
        break;
      case ExportFormat.XML:
        content = this.toXML(data);
        extension = 'xml';
        break;
      default:
        content = JSON.stringify(data, null, 2);
        extension = 'json';
    }

    return {
      success: true,
      export_type: data.report_type || 'EXPORT',
      format: format,
      file_name: `${fileName}.${extension}`,
      record_count: data.employees?.length || data.certificates?.length || data.lines?.length || 1,
      generated_at: new Date().toISOString(),
      content,
    };
  }

  private toCSV(data: any): string {
    if (data.employees) {
      const headers = Object.keys(data.employees[0] || {});
      const rows = data.employees.map((e: any) => headers.map((h) => `"${e[h]}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    if (data.lines) {
      const headers = Object.keys(data.lines[0] || {});
      const rows = data.lines.map((l: any) => headers.map((h) => `"${l[h]}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(data);
  }

  private toXML(data: any): string {
    const toXmlElement = (obj: any, name: string): string => {
      if (Array.isArray(obj)) {
        return obj.map((item) => toXmlElement(item, name.replace(/s$/, ''))).join('\n');
      }
      if (typeof obj === 'object' && obj !== null) {
        const children = Object.entries(obj)
          .map(([key, value]) => toXmlElement(value, key))
          .join('\n');
        return `<${name}>\n${children}\n</${name}>`;
      }
      return `<${name}>${obj}</${name}>`;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n${toXmlElement(data, 'export')}`;
  }

  private getTaxYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    // Tax year runs March to February
    if (month >= 2) {
      return `${year + 1}/${(year + 1).toString().slice(-2)}`;
    }
    return `${year}/${year.toString().slice(-2)}`;
  }
}
