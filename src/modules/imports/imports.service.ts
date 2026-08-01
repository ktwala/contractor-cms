import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CryptoService } from '../../common/services/crypto.service';
import { JobStatus } from '@prisma/client';
import {
  ImportType,
  ImportStatus,
  ImportMode,
  CreateImportDto,
  ImportPreviewResponseDto,
  ImportPreviewRow,
  ImportValidationError,
  ImportResultDto,
  IMPORT_COLUMNS,
  ExportType,
  CreateExportDto,
} from './dto/import.dto';

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ============================================================================
  // CSV Parsing
  // ============================================================================

  parseCSV(content: string): ParsedRow[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'CSV file must have a header row and at least one data row',
      });
    }

    const headers = this.parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const data: Record<string, string> = {};

      headers.forEach((header, index) => {
        data[header] = values[index]?.trim() || '';
      });

      rows.push({ rowNumber: i + 1, data });
    }

    return rows;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  // ============================================================================
  // Import Preview & Validation
  // ============================================================================

  async previewImport(
    dto: CreateImportDto,
    csvContent: string,
    userId: string,
  ): Promise<ImportPreviewResponseDto> {
    const rows = this.parseCSV(csvContent);
    const columns = IMPORT_COLUMNS[dto.type];
    const mode = dto.mode || ImportMode.UPSERT;

    // Validate headers
    const headers = Object.keys(rows[0]?.data || {});
    const requiredColumns = columns.filter((c) => c.required).map((c) => c.name);
    const missingColumns = requiredColumns.filter((c) => !headers.includes(c));

    const globalErrors: ImportValidationError[] = [];
    if (missingColumns.length > 0) {
      globalErrors.push({
        row: 0,
        field: 'headers',
        value: headers.join(', '),
        message: `Missing required columns: ${missingColumns.join(', ')}`,
      });
    }

    // Create import record
    const importRecord = await this.prisma.import.create({
      data: {
        kind: this.mapImportTypeToKind(dto.type),
        status: JobStatus.QUEUED,
        payrunId: dto.payrun_id,
        filename: 'upload.csv',
        summary: { mode, pay_group_id: dto.pay_group_id, totalRows: rows.length },
      },
    });

    // Validate and preview rows
    const previewRows: ImportPreviewRow[] = [];
    let validRows = 0;
    let errorRows = 0;
    let toCreate = 0;
    let toUpdate = 0;
    let toSkip = 0;

    for (const row of rows.slice(0, 100)) {
      // Preview first 100 rows
      const { errors, warnings, action, existingId } = await this.validateRow(
        dto.type,
        row.data,
        row.rowNumber,
        mode,
        dto.pay_group_id,
      );

      if (errors.length > 0) {
        errorRows++;
      } else {
        validRows++;
      }

      if (action === 'CREATE') toCreate++;
      else if (action === 'UPDATE') toUpdate++;
      else toSkip++;

      previewRows.push({
        row_number: row.rowNumber,
        data: row.data,
        action,
        existing_id: existingId,
        errors,
        warnings,
      });
    }

    // Update import record
    await this.prisma.import.update({
      where: { id: importRecord.id },
      data: {
        status: globalErrors.length > 0 ? JobStatus.FAILED : JobStatus.SUCCEEDED,
        summary: { validRows, errorRows },
        errors: globalErrors.length > 0 ? (globalErrors as any) : null,
      },
    });

    return {
      import_id: importRecord.id,
      type: dto.type,
      total_rows: rows.length,
      valid_rows: validRows,
      error_rows: errorRows,
      to_create: toCreate,
      to_update: toUpdate,
      to_skip: toSkip,
      preview: previewRows,
      global_errors: globalErrors,
      can_proceed: globalErrors.length === 0 && (dto.skip_errors || errorRows === 0),
    };
  }

  private async validateRow(
    type: ImportType,
    data: Record<string, string>,
    rowNumber: number,
    mode: ImportMode,
    payGroupId?: string,
  ): Promise<{
    errors: ImportValidationError[];
    warnings: string[];
    action: 'CREATE' | 'UPDATE' | 'SKIP';
    existingId?: string;
  }> {
    const errors: ImportValidationError[] = [];
    const warnings: string[] = [];
    let action: 'CREATE' | 'UPDATE' | 'SKIP' = 'CREATE';
    let existingId: string | undefined;

    const columns = IMPORT_COLUMNS[type];

    // Required field validation
    for (const col of columns.filter((c) => c.required)) {
      if (!data[col.name] || data[col.name].trim() === '') {
        errors.push({
          row: rowNumber,
          field: col.name,
          value: data[col.name] || '',
          message: `${col.name} is required`,
        });
      }
    }

    // Type-specific validation
    switch (type) {
      case ImportType.EMPLOYEES:
        const existingEmp = await this.prisma.employee.findFirst({
          where: { employeeNo: data.employee_number },
        });

        if (existingEmp) {
          existingId = existingEmp.id;
          action = mode === ImportMode.CREATE_ONLY ? 'SKIP' : 'UPDATE';
          if (mode === ImportMode.CREATE_ONLY) {
            warnings.push('Employee already exists, will be skipped');
          }
        } else {
          action = mode === ImportMode.UPDATE_ONLY ? 'SKIP' : 'CREATE';
          if (mode === ImportMode.UPDATE_ONLY) {
            warnings.push('Employee not found, will be skipped');
          }
        }

        // Validate date format
        if (data.hire_date && !this.isValidDate(data.hire_date)) {
          errors.push({
            row: rowNumber,
            field: 'hire_date',
            value: data.hire_date,
            message: 'Invalid date format. Use YYYY-MM-DD',
          });
        }

        // Validate salary
        if (data.base_salary && isNaN(parseFloat(data.base_salary))) {
          errors.push({
            row: rowNumber,
            field: 'base_salary',
            value: data.base_salary,
            message: 'base_salary must be a number',
          });
        }

        // Validate employment type
        if (data.employment_type && !['PERMANENT', 'CONTRACT', 'CASUAL'].includes(data.employment_type.toUpperCase())) {
          errors.push({
            row: rowNumber,
            field: 'employment_type',
            value: data.employment_type,
            message: 'employment_type must be PERMANENT, CONTRACT, or CASUAL',
          });
        }
        break;

      case ImportType.RECURRING_INPUTS:
        // Validate employee exists
        const emp = await this.prisma.employee.findFirst({
          where: { employeeNo: data.employee_number },
        });
        if (!emp) {
          errors.push({
            row: rowNumber,
            field: 'employee_number',
            value: data.employee_number,
            message: 'Employee not found',
          });
        }

        // Validate pay item exists
        const payItem = await this.prisma.payItem.findFirst({
          where: { code: data.pay_item_code },
        });
        if (!payItem) {
          errors.push({
            row: rowNumber,
            field: 'pay_item_code',
            value: data.pay_item_code,
            message: 'Pay item not found',
          });
        }

        // Validate amount
        if (data.amount && isNaN(parseFloat(data.amount))) {
          errors.push({
            row: rowNumber,
            field: 'amount',
            value: data.amount,
            message: 'amount must be a number',
          });
        }

        // Check for existing recurring input
        if (emp && payItem) {
          const existing = await this.prisma.recurringInput.findFirst({
            where: {
              employeeId: emp.id,
              payItemId: payItem.id,
              endDate: null,
            },
          });
          if (existing) {
            existingId = existing.id;
            action = mode === ImportMode.CREATE_ONLY ? 'SKIP' : 'UPDATE';
          }
        }
        break;

      case ImportType.PAY_ITEMS:
        const existingPayItem = await this.prisma.payItem.findFirst({
          where: { code: data.code },
        });

        if (existingPayItem) {
          existingId = existingPayItem.id;
          action = mode === ImportMode.CREATE_ONLY ? 'SKIP' : 'UPDATE';
        } else {
          action = mode === ImportMode.UPDATE_ONLY ? 'SKIP' : 'CREATE';
        }

        // Validate type
        if (data.type && !['EARNING', 'DEDUCTION', 'TAX', 'EMPLOYER_CONTRIB'].includes(data.type.toUpperCase())) {
          errors.push({
            row: rowNumber,
            field: 'type',
            value: data.type,
            message: 'type must be EARNING, DEDUCTION, TAX, or EMPLOYER_CONTRIB',
          });
        }
        break;

      case ImportType.LINE_ITEM_INPUTS:
        // Similar validation as recurring inputs
        const lineEmp = await this.prisma.employee.findFirst({
          where: { employeeNo: data.employee_number },
        });
        if (!lineEmp) {
          errors.push({
            row: rowNumber,
            field: 'employee_number',
            value: data.employee_number,
            message: 'Employee not found',
          });
        }

        const linePayItem = await this.prisma.payItem.findFirst({
          where: { code: data.pay_item_code },
        });
        if (!linePayItem) {
          errors.push({
            row: rowNumber,
            field: 'pay_item_code',
            value: data.pay_item_code,
            message: 'Pay item not found',
          });
        }
        break;
    }

    return { errors, warnings, action, existingId };
  }

  // ============================================================================
  // Execute Import
  // ============================================================================

  async executeImport(
    importId: string,
    csvContent: string,
    skipErrors: boolean,
    userId: string,
  ): Promise<ImportResultDto> {
    const importRecord = await this.prisma.import.findUnique({
      where: { id: importId },
    });

    if (!importRecord) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Import ${importId} not found`,
      });
    }

    if (importRecord.status !== JobStatus.SUCCEEDED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Import must be validated before execution',
      });
    }

    await this.prisma.import.update({
      where: { id: importId },
      data: { status: JobStatus.RUNNING },
    });

    const rows = this.parseCSV(csvContent);
    const meta = (importRecord.summary as any) || {};
    const mode = meta.mode || ImportMode.UPSERT;
    const type = this.mapKindToImportType(importRecord.kind);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ImportValidationError[] = [];

    for (const row of rows) {
      try {
        const result = await this.processRow(type, row.data, mode, meta.pay_group_id, importRecord.payrunId || undefined);

        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      } catch (error) {
        if (skipErrors) {
          failed++;
          errors.push({
            row: row.rowNumber,
            field: 'general',
            value: '',
            message: error.message,
          });
        } else {
          await this.prisma.import.update({
            where: { id: importId },
            data: {
              status: JobStatus.FAILED,
              errors: [{ row: failed + 1, error: error.message }],
            },
          });
          throw error;
        }
      }
    }

    await this.prisma.import.update({
      where: { id: importId },
      data: {
        status: JobStatus.SUCCEEDED,
        summary: { validRows: created + updated, errorRows: failed },
        completedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      action: 'IMPORT_COMPLETE',
      entityType: 'Import',
      entityId: importId,
      newValue: { created, updated, skipped, failed },
    });

    return {
      import_id: importId,
      status: ImportStatus.COMPLETED,
      total_rows: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
      completed_at: new Date().toISOString(),
    };
  }

  private async processRow(
    type: ImportType,
    data: Record<string, string>,
    mode: ImportMode,
    payGroupId?: string,
    payrunId?: string,
  ): Promise<'created' | 'updated' | 'skipped'> {
    switch (type) {
      case ImportType.EMPLOYEES:
        return this.processEmployeeRow(data, mode, payGroupId);

      case ImportType.RECURRING_INPUTS:
        return this.processRecurringInputRow(data, mode);

      case ImportType.PAY_ITEMS:
        return this.processPayItemRow(data, mode);

      case ImportType.LINE_ITEM_INPUTS:
        return this.processLineItemInputRow(data, payrunId!);

      default:
        return 'skipped';
    }
  }

  private async processEmployeeRow(
    data: Record<string, string>,
    mode: ImportMode,
    payGroupId?: string,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const existing = await this.prisma.employee.findFirst({
      where: { employeeNo: data.employee_number },
    });

    if (existing && mode === ImportMode.CREATE_ONLY) return 'skipped';
    if (!existing && mode === ImportMode.UPDATE_ONLY) return 'skipped';

    const employeeData = {
      employeeNo: data.employee_number,
      firstName: data.first_name,
      lastName: data.last_name,
      nationalId: data.national_id,
      email: data.email || null,
      phone: data.phone || null,
      hireDate: new Date(data.hire_date),
      status: 'ACTIVE' as const,
    };

    if (existing) {
      await this.prisma.employee.update({
        where: { id: existing.id },
        data: employeeData,
      });

      // Update compensation if provided
      if (data.base_salary) {
        await this.prisma.compensation.updateMany({
          where: { employeeId: existing.id, effectiveTo: null },
          data: { baseSalary: parseFloat(data.base_salary) },
        });
      }

      return 'updated';
    } else {
      const employee = await this.prisma.employee.create({
        data: employeeData,
      });

      // Create compensation record
      if (data.base_salary) {
        await this.prisma.compensation.create({
          data: {
            employeeId: employee.id,
            baseSalary: parseFloat(data.base_salary),
            currency: 'ZAR',
            effectiveFrom: new Date(data.hire_date),
          },
        });
      }

      // Create employment record
      if (payGroupId) {
        const payGroup = await this.prisma.payGroup.findUnique({
          where: { id: payGroupId },
          include: { legalEntity: true },
        });
        if (payGroup) {
          await this.prisma.employment.create({
            data: {
              employeeId: employee.id,
              legalEntityId: payGroup.legalEntityId,
              payGroupId,
              country: payGroup.country,
              employmentType: (data.employment_type?.toUpperCase() as any) || 'PERMANENT',
              jobTitle: data.job_title || null,
              effectiveFrom: new Date(data.hire_date),
            },
          });
        }
      }

      // Create bank account if provided (with encryption)
      if (data.account_number && data.bank_name) {
        const accountNumberEnc = this.cryptoService.encrypt(data.account_number);
        const maskedAccountNumber = data.account_number.length >= 4
          ? '*'.repeat(data.account_number.length - 4) + data.account_number.slice(-4)
          : '****';

        await this.prisma.bankAccount.create({
          data: {
            employeeId: employee.id,
            bankName: data.bank_name,
            branchCode: data.bank_branch_code || null,
            accountNumberEnc,
            maskedAccountNumber,
            accountType: (data.account_type?.toUpperCase() as any) || 'CHEQUE',
            
            effectiveFrom: new Date(data.hire_date),
          },
        });
      }

      return 'created';
    }
  }

  private async processRecurringInputRow(
    data: Record<string, string>,
    mode: ImportMode,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const employee = await this.prisma.employee.findFirst({
      where: { employeeNo: data.employee_number },
    });
    const payItem = await this.prisma.payItem.findFirst({
      where: { code: data.pay_item_code },
    });

    if (!employee || !payItem) return 'skipped';

    const existing = await this.prisma.recurringInput.findFirst({
      where: {
        employeeId: employee.id,
        payItemId: payItem.id,
        endDate: null,
      },
    });

    if (existing && mode === ImportMode.CREATE_ONLY) return 'skipped';
    if (!existing && mode === ImportMode.UPDATE_ONLY) return 'skipped';

    const inputData = {
      employeeId: employee.id,
      payItemId: payItem.id,
      amount: parseFloat(data.amount),
      currency: 'ZAR' as const,
      startDate: new Date(data.start_date),
      endDate: data.end_date ? new Date(data.end_date) : null,
    };

    if (existing) {
      await this.prisma.recurringInput.update({
        where: { id: existing.id },
        data: inputData,
      });
      return 'updated';
    } else {
      await this.prisma.recurringInput.create({
        data: inputData,
      });
      return 'created';
    }
  }

  private async processPayItemRow(
    data: Record<string, string>,
    mode: ImportMode,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const existing = await this.prisma.payItem.findFirst({
      where: { code: data.code },
    });

    if (existing && mode === ImportMode.CREATE_ONLY) return 'skipped';
    if (!existing && mode === ImportMode.UPDATE_ONLY) return 'skipped';

    const payItemData = {
      code: data.code,
      name: data.name,
      type: data.type.toUpperCase() as any,
      taxable: data.taxable?.toLowerCase() === 'true',
      glAccount: data.gl_account || null,
      formula: data.formula || null,
      sortOrder: data.sort_order ? parseInt(data.sort_order) : 100,
    };

    if (existing) {
      await this.prisma.payItem.update({
        where: { id: existing.id },
        data: payItemData,
      });
      return 'updated';
    } else {
      await this.prisma.payItem.create({
        data: payItemData,
      });
      return 'created';
    }
  }

  private async processLineItemInputRow(
    data: Record<string, string>,
    payrunId: string,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const employee = await this.prisma.employee.findFirst({
      where: { employeeNo: data.employee_number },
    });
    const payItem = await this.prisma.payItem.findFirst({
      where: { code: data.pay_item_code },
    });

    if (!employee || !payItem) return 'skipped';

    // Check if line item already exists
    const existing = await this.prisma.lineItemInput.findFirst({
      where: {
        payrunId,
        employeeId: employee.id,
        payItemId: payItem.id,
      },
    });

    if (existing) {
      await this.prisma.lineItemInput.update({
        where: { id: existing.id },
        data: { amount: parseFloat(data.amount) },
      });
      return 'updated';
    } else {
      await this.prisma.lineItemInput.create({
        data: {
          payrunId,
          employeeId: employee.id,
          payItemId: payItem.id,
          amount: parseFloat(data.amount),
          currency: 'ZAR',
        },
      });
      return 'created';
    }
  }

  // ============================================================================
  // Export Functions
  // ============================================================================

  async exportToCSV(dto: CreateExportDto): Promise<string> {
    switch (dto.type) {
      case ExportType.EMPLOYEES:
        return this.exportEmployees(dto);

      case ExportType.PAY_ITEMS:
        return this.exportPayItems(dto);

      case ExportType.RECURRING_INPUTS:
        return this.exportRecurringInputs(dto);

      case ExportType.PAYRUN_RESULTS:
        return this.exportPayrunResults(dto);

      default:
        throw new BadRequestException({ code: 'INVALID_TYPE', message: 'Invalid export type' });
    }
  }

  private async exportEmployees(dto: CreateExportDto): Promise<string> {
    const where: any = {};
    if (!dto.include_inactive) {
      where.status = 'ACTIVE';
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        compensations: { where: { effectiveTo: null }, take: 1 },
        bankAccounts: { take: 1 }, // isPrimary not in BankAccount model
        employments: { where: { effectiveTo: null }, take: 1 },
        taxProfiles: { where: { effectiveTo: null }, take: 1 },
      },
      orderBy: { employeeNo: 'asc' },
    });

    const headers = IMPORT_COLUMNS[ImportType.EMPLOYEES].map((c) => c.name);
    const rows = employees.map((emp) => {
      const comp = emp.compensations?.[0];
      const bank = emp.bankAccounts?.[0];
      const employment = emp.employments?.[0];
      const tax = emp.taxProfiles[0];

      return [
        emp.employeeNo,
        emp.firstName,
        emp.lastName,
        emp.nationalId,
        emp.email || '',
        emp.phone || '',
        emp.hireDate.toISOString().split('T')[0],
        employment?.costCenter || '',
        employment?.jobTitle || '',
        employment?.employmentType || '',
        comp?.baseSalary?.toString() || '',
        bank?.bankName || '',
        bank?.branchCode || '',
        bank?.maskedAccountNumber || '',
        bank?.accountType || '',
        tax?.tin || '',
      ];
    });

    return this.generateCSV(headers, rows.map(r => r.map(v => v || '')));
  }

  private async exportPayItems(dto: CreateExportDto): Promise<string> {
    const where: any = {};
    if (!dto.include_inactive) {
      where.isActive = true;
    }

    const payItems = await this.prisma.payItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    const headers = IMPORT_COLUMNS[ImportType.PAY_ITEMS].map((c) => c.name);
    const rows = payItems.map((pi) => [
      pi.code,
      pi.name,
      pi.type,
      pi.taxable.toString(),
      pi.glAccount || '',
      pi.formula || '',
      pi.sortOrder.toString(),
    ]);

    return this.generateCSV(headers, rows.map(r => r.map(v => v || '')));
  }

  private async exportRecurringInputs(dto: CreateExportDto): Promise<string> {
    const where: any = { endDate: null };

    const inputs = await this.prisma.recurringInput.findMany({
      where,
      include: {
        employee: true,
        payItem: true,
      },
      orderBy: { employee: { employeeNo: 'asc' } },
    });

    const headers = IMPORT_COLUMNS[ImportType.RECURRING_INPUTS].map((c) => c.name);
    const rows = inputs.map((input) => [
      input.employee?.employeeNo || input.employeeId,
      input.payItem.code,
      input.amount.toString(),
      input.startDate.toISOString().split('T')[0],
      input.endDate?.toISOString().split('T')[0] || '',
    ]);

    return this.generateCSV(headers, rows.map(r => r.map(v => v || '')));
  }

  private async exportPayrunResults(dto: CreateExportDto): Promise<string> {
    if (!dto.payrun_id) {
      throw new BadRequestException({
        code: 'MISSING_PAYRUN',
        message: 'payrun_id is required for payrun results export',
      });
    }

    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId: dto.payrun_id },
      include: {
        employee: true,
        payLines: { include: { payItem: true } },
      },
      orderBy: { employee: { employeeNo: 'asc' } },
    });

    const headers = ['employee_number', 'employee_name', 'gross', 'taxable_income', 'paye', 'deductions', 'net'];
    const rows = results.map((r) => [
      r.employee.employeeNo,
      `${r.employee.firstName} ${r.employee.lastName}`,
      r.gross.toString(),
      r.taxableIncome.toString(),
      r.paye.toString(),
      r.deductionsTotal.toString(),
      r.net.toString(),
    ]);

    return this.generateCSV(headers, rows.map(r => r.map(v => v || '')));
  }

  // ============================================================================
  // Template Generation
  // ============================================================================

  generateTemplate(type: ImportType): string {
    const columns = IMPORT_COLUMNS[type];
    const headers = columns.map((c) => c.name);
    const descriptions = columns.map((c) => `# ${c.description}${c.required ? ' (required)' : ''}`);

    return `${headers.join(',')}\n${descriptions.join(',')}\n`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private generateCSV(headers: string[], rows: string[][]): string {
    const escapeValue = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headerLine = headers.map(escapeValue).join(',');
    const dataLines = rows.map((row) => row.map(escapeValue).join(','));

    return [headerLine, ...dataLines].join('\n');
  }

  private isValidDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  private mapImportTypeToKind(type: ImportType): any {
    const mapping: Record<ImportType, string> = {
      [ImportType.EMPLOYEES]: 'VARIABLE_PAY',
      [ImportType.RECURRING_INPUTS]: 'VARIABLE_PAY',
      [ImportType.PAY_ITEMS]: 'VARIABLE_PAY',
      [ImportType.LINE_ITEM_INPUTS]: 'VARIABLE_PAY',
    };
    return mapping[type];
  }

  private mapKindToImportType(kind: string): ImportType {
    // For now, we store the type in meta, so this is a fallback
    return ImportType.EMPLOYEES;
  }
}
