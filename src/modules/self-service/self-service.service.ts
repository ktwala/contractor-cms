import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  PayslipQueryDto,
  PayslipDetailDto,
  PayslipSummaryDto,
  PayslipListResponseDto,
  PayslipEarningDto,
  PayslipDeductionDto,
  PayslipEmployerContributionDto,
  TaxCertificateQueryDto,
  TaxCertificateDetailDto,
  TaxCertificateSummaryDto,
  TaxCertificateListResponseDto,
  EmployeeProfileDto,
  LeaveBalanceDto,
  BankAccountMaskedDto,
  UpdateContactInfoDto,
  BankAccountUpdateRequestDto,
} from './dto/self-service.dto';
import { format, startOfYear, endOfYear, subYears } from 'date-fns';

@Injectable()
export class SelfServiceService {
  private readonly logger = new Logger(SelfServiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // Employee Lookup
  // ============================================================================

  /**
   * Get employee ID from user ID (via linked user account)
   */
  async getEmployeeIdForUser(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException({
        code: 'NO_EMPLOYEE_LINKED',
        message: 'No employee record linked to this user account',
      });
    }

    return employee.id;
  }

  // ============================================================================
  // Payslips
  // ============================================================================

  async listPayslips(employeeId: string, query: PayslipQueryDto): Promise<PayslipListResponseDto> {
    const where: any = {
      employeeId,
      payrun: {
        status: { in: ['APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
      },
    };

    // Filter by year
    if (query.year) {
      const year = parseInt(query.year, 10);
      where.payrun = {
        ...where.payrun,
        periodStart: { gte: new Date(year, 0, 1) },
        periodEnd: { lte: new Date(year, 11, 31) },
      };
    }

    // Filter by date range
    if (query.from_date) {
      where.payrun = {
        ...where.payrun,
        periodStart: { gte: new Date(query.from_date) },
      };
    }
    if (query.to_date) {
      where.payrun = {
        ...where.payrun,
        periodEnd: { lte: new Date(query.to_date) },
      };
    }

    const [results, total] = await Promise.all([
      this.prisma.employeeResult.findMany({
        where,
        include: {
          payrun: {
            select: {
              periodStart: true,
              periodEnd: true,
              payDate: true,
              status: true,
            },
          },
        },
        orderBy: { payrun: { periodEnd: 'desc' } },
        take: query.limit || 12,
        skip: query.offset || 0,
      }),
      this.prisma.employeeResult.count({ where }),
    ]);

    const payslips: PayslipSummaryDto[] = results.map((r: any) => ({
      id: r.id,
      period_start: format(r.payrun.periodStart, 'yyyy-MM-dd'),
      period_end: format(r.payrun.periodEnd, 'yyyy-MM-dd'),
      pay_date: format(r.payrun.payDate, 'yyyy-MM-dd'),
      gross: Number(r.gross),
      net: Number(r.net),
      status: r.payrun.status,
    }));

    return { payslips, total };
  }

  async getPayslip(employeeId: string, payslipId: string): Promise<PayslipDetailDto> {
    const result = await this.prisma.employeeResult.findFirst({
      where: {
        id: payslipId,
        employeeId,
        payrun: {
          status: { in: ['APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
        },
      },
      include: {
        employee: {
          include: {
            employments: {
              where: { effectiveTo: null },
              take: 1,
            },
            taxProfiles: {
              where: { effectiveTo: null },
              take: 1,
            },
            bankAccounts: {
              take: 1,
            },
          },
        },
        payrun: {
          include: {
            payGroup: {
              include: {
                legalEntity: true,
              },
            },
          },
        },
        payLines: {
          include: {
            payItem: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException({
        code: 'PAYSLIP_NOT_FOUND',
        message: `Payslip ${payslipId} not found`,
      });
    }

    // Get YTD figures
    const ytdTotals = await this.getYtdTotals(employeeId, result.payrun?.periodEnd || new Date());

    // Process pay lines
    const earnings: PayslipEarningDto[] = [];
    const deductions: PayslipDeductionDto[] = [];
    const employerContributions: PayslipEmployerContributionDto[] = [];

    for (const line of result.payLines) {
      const lineData = {
        code: line.payItem?.code || '',
        name: line.payItem?.name || '',
        amount: Number(line.amount),
      };

      switch (line.type) {
        case 'EARNING':
          earnings.push({
            ...lineData,
            units: (line.meta as any)?.units ? Number((line.meta as any).units) : undefined,
            rate: (line.meta as any)?.rate ? Number((line.meta as any).rate) : undefined,
          });
          break;
        case 'DEDUCTION':
        case 'TAX':
          deductions.push({
            ...lineData,
            is_statutory: line.type === 'TAX' || this.isStatutoryDeduction(line.payItem?.code),
          });
          break;
        case 'EMPLOYER_CONTRIB':
          employerContributions.push(lineData);
          break;
      }
    }

    const employment = result.employee?.employments?.[0];
    const taxProfile = result.employee?.taxProfiles?.[0];
    const bankAccount = result.employee?.bankAccounts?.[0];
    const legalEntity = result.payrun?.payGroup?.legalEntity;
    const employee = result.employee;

    const companyAddress = legalEntity?.address
      ? typeof legalEntity.address === 'string'
        ? (legalEntity.address as string)
        : typeof legalEntity.address === 'object' && legalEntity.address !== null
          ? Object.values(legalEntity.address as Record<string, unknown>).filter(Boolean).join(', ')
          : undefined
      : undefined;

    return {
      id: result.id,
      employee_id: result.employeeId,
      employee_number: employee?.employeeNo || '',
      employee_name: employee ? `${employee.firstName} ${employee.lastName}` : '',

      // Company
      company_name: legalEntity.name,
      company_address: companyAddress,
      company_registration: legalEntity.registrationNo || undefined,
      company_tax_reference: legalEntity.taxReference || undefined,

      // Period
      period_start: result.payrun?.periodStart ? format(result.payrun.periodStart, 'yyyy-MM-dd') : '',
      period_end: result.payrun?.periodEnd ? format(result.payrun.periodEnd, 'yyyy-MM-dd') : '',
      pay_date: result.payrun?.payDate ? format(result.payrun.payDate, 'yyyy-MM-dd') : '',
      pay_frequency: result.payrun?.payGroup?.frequency || 'MONTHLY',

      // Employment
      job_title: employment?.jobTitle || undefined,
      department: 'Consulting',
      cost_center: employment?.costCenter || undefined,
      date_engaged: employee?.hireDate ? format(employee.hireDate, 'yyyy/MM/dd') : undefined,
      id_number: employee?.idNumber || employee?.nationalId || undefined,
      date_of_birth: employee?.dateOfBirth ? format(employee.dateOfBirth, 'yyyy/MM/dd') : undefined,
      address: undefined,

      // Tax
      tax_reference: taxProfile?.tin || undefined,
      tax_status: taxProfile?.residencyStatus || undefined,

      // Earnings
      earnings,
      total_earnings: earnings.reduce((sum, e) => sum + e.amount, 0),

      // Deductions
      deductions,
      total_deductions: deductions.reduce((sum, d) => sum + d.amount, 0),

      // Employer contributions
      employer_contributions: employerContributions,
      total_employer_contributions: employerContributions.reduce((sum, c) => sum + c.amount, 0),

      // Totals
      gross: Number(result.gross),
      paye: Number(result.paye),
      net: Number(result.net),

      // YTD
      ytd_gross: ytdTotals.gross,
      ytd_paye: ytdTotals.paye,
      ytd_net: ytdTotals.net,

      // Banking
      bank_name: bankAccount?.bankName ? (bankAccount.bankName.includes(' - ') ? bankAccount.bankName.split(' - ')[0] : bankAccount.bankName) : undefined,
      branch: bankAccount?.bankName ? (bankAccount.bankName.includes(' - ') ? bankAccount.bankName.split(' - ')[1] : undefined) : undefined,
      branch_code: bankAccount?.branchCode || undefined,
      account_number_masked: bankAccount?.maskedAccountNumber || undefined,

      // Currency
      currency: result.payrun?.payGroup?.currency || 'ZAR',
    };
  }

  // ============================================================================
  // Tax Certificates
  // ============================================================================

  async listTaxCertificates(
    employeeId: string,
    query: TaxCertificateQueryDto,
  ): Promise<TaxCertificateListResponseDto> {
    const where: any = { employeeId };

    if (query.tax_year) {
      where.taxYear = query.tax_year;
    }

    const certificates = await this.prisma.taxCertificate.findMany({
      where,
      orderBy: { taxYear: 'desc' },
    });

    const summaries: TaxCertificateSummaryDto[] = certificates.map((cert: any) => ({
      id: cert.id,
      tax_year: cert.taxYear,
      certificate_type: cert.certificateType,
      issue_date: format(cert.issueDate, 'yyyy-MM-dd'),
      status: cert.status,
    }));

    return { certificates: summaries, total: summaries.length };
  }

  async getTaxCertificate(employeeId: string, certificateId: string): Promise<TaxCertificateDetailDto> {
    const cert = await this.prisma.taxCertificate.findFirst({
      where: { id: certificateId, employeeId },
      include: {
        employee: {
          include: {
            employments: { take: 1 },
            taxProfiles: { take: 1 },
          },
        },
      },
    });

    if (!cert) {
      throw new NotFoundException({
        code: 'TAX_CERTIFICATE_NOT_FOUND',
        message: `Tax certificate ${certificateId} not found`,
      });
    }

    // Get legal entity for employer info
    const employment = await this.prisma.employment.findFirst({
      where: { employeeId, effectiveTo: null },
      include: { legalEntity: true },
    });

    return {
      id: cert.id,
      employee_id: cert.employeeId,
      employee_number: (cert as any).employee.employeeNo,
      employee_name: `${(cert as any).employee.firstName} ${(cert as any).employee.lastName}`,
      id_number: (cert as any).employee.idNumber ? this.maskIdNumber((cert as any).employee.idNumber) : undefined,
      tax_reference: (cert as any).employee.taxProfiles[0]?.taxReference,

      employer_name: employment?.legalEntity.name || '',
      employer_paye_reference: employment?.legalEntity.taxReference || undefined,

      tax_year: (cert as any).taxYear,
      certificate_number: (cert as any).certificateNumber,
      certificate_type: (cert as any).certificateType,
      issue_date: format((cert as any).issueDate, 'yyyy-MM-dd'),

      employment_start: format((cert as any).employmentStart, 'yyyy-MM-dd'),
      employment_end: (cert as any).employmentEnd ? format((cert as any).employmentEnd, 'yyyy-MM-dd') : undefined,
      periods_worked: (cert as any).periodsWorked,

      gross_remuneration: Number((cert as any).grossRemuneration),
      gross_non_taxable: Number((cert as any).grossNonTaxable || 0),
      taxable_income: Number((cert as any).taxableIncome),

      paye_deducted: Number((cert as any).payeDeducted),

      uif_employee: Number((cert as any).uifEmployee || 0),
      pension_fund: (cert as any).pensionFund ? Number((cert as any).pensionFund) : undefined,
      retirement_annuity: (cert as any).retirementAnnuity ? Number((cert as any).retirementAnnuity) : undefined,
      medical_aid: (cert as any).medicalAid ? Number((cert as any).medicalAid) : undefined,

      travel_allowance: (cert as any).travelAllowance ? Number((cert as any).travelAllowance) : undefined,

      other_deductions: Number((cert as any).otherDeductions || 0),

      total_income: Number((cert as any).totalIncome),
      total_deductions: Number((cert as any).totalDeductions),

      status: (cert as any).status,
      submitted_to_sars: (cert as any).submittedToSars,
      sars_submission_date: (cert as any).sarsSubmissionDate
        ? format((cert as any).sarsSubmissionDate, 'yyyy-MM-dd')
        : undefined,
    };
  }

  /**
   * Generate tax certificate for a specific tax year
   * This aggregates all payslip data for the year
   */
  async generateTaxCertificate(employeeId: string, taxYear: string): Promise<TaxCertificateDetailDto> {
    // Check if certificate already exists
    const existing = await this.prisma.taxCertificate.findFirst({
      where: { employeeId, taxYear },
    });

    if (existing) {
      return this.getTaxCertificate(employeeId, existing.id);
    }

    // Get employee data
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employments: { where: { effectiveTo: null }, take: 1, include: { legalEntity: true } },
        taxProfiles: { where: { effectiveTo: null }, take: 1 },
      },
    });

    if (!employee) {
      throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' });
    }

    // Calculate tax year dates (March to February for ZA)
    const yearNum = parseInt(taxYear.split('/')[0], 10);
    const taxYearStart = new Date(yearNum - 1, 2, 1); // March 1st of previous year
    const taxYearEnd = new Date(yearNum, 1, 28); // Feb 28th of current year

    // Get all finalized payslips for the tax year
    const results = await this.prisma.employeeResult.findMany({
      where: {
        employeeId,
        payrun: {
          status: { in: ['PAID', 'POSTED', 'FINALIZED'] },
          periodStart: { gte: taxYearStart },
          periodEnd: { lte: taxYearEnd },
        },
      },
      include: {
        payLines: { include: { payItem: true } },
        payrun: true,
      },
    });

    // Aggregate totals
    let grossRemuneration = 0;
    let payeDeducted = 0;
    let uifEmployee = 0;
    let pensionFund = 0;
    let medicalAid = 0;
    let otherDeductions = 0;

    for (const result of results) {
      grossRemuneration += Number(result.gross);
      payeDeducted += Number(result.paye);

      for (const line of result.payLines || []) {
        const code = line.payItem?.code?.toUpperCase() || '';
        const amount = Number(line.amount);

        if (code === 'UIF' || code === 'UIF_EE') {
          uifEmployee += amount;
        } else if (code.includes('PENSION') || code.includes('PROVIDENT')) {
          pensionFund += amount;
        } else if (code.includes('MEDICAL')) {
          medicalAid += amount;
        } else if (line.type === 'DEDUCTION' && !this.isStatutoryDeduction(code)) {
          otherDeductions += amount;
        }
      }
    }

    const employment = employee.employments[0];

    // Create tax certificate
    const cert = await this.prisma.taxCertificate.create({
      data: {
        employeeId,
        taxYear,
        certificateType: 'IRP5',
        issueDate: new Date(),
        employmentStart: employment?.effectiveFrom || employee.hireDate,
        periodsWorked: results.length,
        grossRemuneration,
        taxableIncome: grossRemuneration - pensionFund - medicalAid,
        payeDeducted,
        uifEmployee,
        pensionFund: pensionFund || null,
        medicalAid: medicalAid || null,
        otherDeductions,
        totalIncome: grossRemuneration,
        totalDeductions: payeDeducted + uifEmployee + pensionFund + medicalAid + otherDeductions,
        status: 'DRAFT',
      },
    });

    return this.getTaxCertificate(employeeId, cert.id);
  }

  // ============================================================================
  // Employee Profile
  // ============================================================================

  async getProfile(employeeId: string): Promise<EmployeeProfileDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employments: {
          where: { effectiveTo: null },
          take: 1,
          include: {
            payGroup: true,
          },
        },
        bankAccounts: true,
      },
    });

    if (!employee) {
      throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' });
    }

    const employment = employee.employments[0];

    // Get manager name if exists
    let managerName: string | undefined;
    if ((employment as any)?.managerId) {
      const manager = await this.prisma.employee.findUnique({
        where: { id: (employment as any).managerId },
        select: { firstName: true, lastName: true },
      });
      if (manager) {
        managerName = `${manager.firstName} ${manager.lastName}`;
      }
    }

    // Get leave balances (placeholder - would need leave module)
    const leaveBalances: LeaveBalanceDto[] = [
      { leave_type: 'Annual', entitled: 15, taken: 5, pending: 2, available: 8, unit: 'days' },
      { leave_type: 'Sick', entitled: 10, taken: 2, pending: 0, available: 8, unit: 'days' },
      { leave_type: 'Family', entitled: 3, taken: 0, pending: 0, available: 3, unit: 'days' },
    ];

    // Mask bank accounts
    const bankAccounts: BankAccountMaskedDto[] = employee.bankAccounts.map((ba: any) => ({
      id: ba.id,
      bank_name: ba.bankName,
      account_type: ba.accountType,
      account_number_masked: ba.maskedAccountNumber,
      is_primary: ba.isPrimary,
    }));

    return {
      id: employee.id,
      employee_number: employee.employeeNo,

      first_name: employee.firstName,
      last_name: employee.lastName,
      email: employee.email || undefined,
      phone: employee.phone || undefined,
      date_of_birth: employee.dateOfBirth ? format(employee.dateOfBirth, 'yyyy-MM-dd') : undefined,

      id_type: employee.idType || undefined,
      id_number_masked: employee.idNumber ? this.maskIdNumber(employee.idNumber) : undefined,

      hire_date: format(employee.hireDate, 'yyyy-MM-dd'),
      job_title: employment?.jobTitle || undefined,
      department: undefined,
      cost_center: employment?.costCenter || undefined,
      manager_name: managerName,
      employment_type: employment?.employmentType || 'PERMANENT',
      employment_status: employee.status,

      pay_frequency: employment?.payGroup?.frequency || 'MONTHLY',
      currency: employment?.payGroup?.currency || 'ZAR',

      leave_balances: leaveBalances,
      bank_accounts: bankAccounts,
    };
  }

  /**
   * Submit contact info update request
   * Creates a change request for approval
   */
  async requestContactUpdate(
    employeeId: string,
    dto: UpdateContactInfoDto,
    userId: string,
  ): Promise<{ request_id: string; message: string }> {
    const changeRequest = await this.prisma.changeRequest.create({
      data: {
        kind: 'OTHER',
        employee: { connect: { id: employeeId } },
        createdBy: userId,
        status: 'SUBMITTED',
        payload: dto as any,
      } as any,
    });

    return {
      request_id: changeRequest.id,
      message: 'Contact update request submitted for approval',
    };
  }

  /**
   * Submit bank account update request
   * Creates a change request for approval (sensitive data)
   */
  async requestBankAccountUpdate(
    employeeId: string,
    dto: BankAccountUpdateRequestDto,
    userId: string,
  ): Promise<{ request_id: string; message: string }> {
    const changeRequest = await this.prisma.changeRequest.create({
      data: {
        kind: 'EMPLOYEE_BANK_ACCOUNT',
        employee: { connect: { id: employeeId } },
        createdBy: userId,
        status: 'SUBMITTED',
        payload: {
          ...dto,
          // Mask sensitive data in the request
          account_number_masked: this.maskAccountNumber(dto.account_number),
          note: 'Self-service bank account update request',
        },
      } as any,
    });

    return {
      request_id: changeRequest.id,
      message: 'Bank account update request submitted for approval. This requires manager approval for security.',
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async getYtdTotals(
    employeeId: string,
    asOfDate: Date,
  ): Promise<{ gross: number; paye: number; net: number }> {
    const yearStart = startOfYear(asOfDate);

    const results = await this.prisma.employeeResult.findMany({
      where: {
        employeeId,
        payrun: {
          status: { in: ['APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
          periodStart: { gte: yearStart },
          periodEnd: { lte: asOfDate },
        },
      },
      select: { gross: true, paye: true, net: true },
    });

    return results.reduce(
      (acc: { gross: number; paye: number; net: number }, r: { gross: any; paye: any; net: any }) => ({
        gross: acc.gross + Number(r.gross),
        paye: acc.paye + Number(r.paye),
        net: acc.net + Number(r.net),
      }),
      { gross: 0, paye: 0, net: 0 },
    );
  }

  private isStatutoryDeduction(code?: string): boolean {
    if (!code) return false;
    const statutory = ['PAYE', 'UIF', 'UIF_EE', 'SDL', 'TAX'];
    return statutory.includes(code.toUpperCase());
  }

  private maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) return '****';
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  }

  private maskIdNumber(idNumber: string): string {
    if (!idNumber || idNumber.length < 4) return '****';
    return idNumber.slice(0, 4) + '*'.repeat(idNumber.length - 8) + idNumber.slice(-4);
  }
}
