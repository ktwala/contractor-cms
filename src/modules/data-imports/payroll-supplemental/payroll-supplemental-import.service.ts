import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import {
  parseWorkbook,
  findSheet,
  parseNumeric,
  parseDate,
  parseBoolean,
  ParsedWorkbook,
  ParsedSheet,
} from '../utils/workbook-parser';
import {
  ValidationIssue,
  PreviewSection,
  SupplementalPreviewResponse,
  ImportExecutionResult,
  SUPPLEMENTAL_SHEETS,
  REQUIRED_SHEETS,
  REQUIRED_COLUMNS,
} from './payroll-supplemental-import.types';
import {
  hasLegacySupplementalWorkbookTab,
  LEGACY_SUPPLEMENTAL_WORKBOOK_TAB,
} from './payroll-supplemental-legacy-sheet-names';
import {
  DataImportErrorDetails,
  ReferenceValueRow,
  dbValidationErrorToGroupedRow,
  groupedErrorsToCsv,
  legacySheetFromFieldName,
  validationIssuesToGroupedRows,
  validationWorkbookToXlsx,
} from '../utils/export-errors';

const TENANT_ID = 'default';

interface ValidatedRow {
  sheet: string;
  rowNumber: number;
  sheetRowNumber: number;
  businessKey: string;
  data: Record<string, unknown>;
  action: 'INSERT' | 'UPDATE' | 'SKIP';
  issues: ValidationIssue[];
}

@Injectable()
export class PayrollSupplementalImportService {
  private readonly logger = new Logger(PayrollSupplementalImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async precheck(buffer: Buffer) {
    let workbook: ParsedWorkbook;
    try {
      workbook = parseWorkbook(buffer);
    } catch (err) {
      throw new BadRequestException(`Failed to parse workbook: ${(err as Error).message}`);
    }

    const structureIssues = this.validateStructure(workbook);
    const hasStructureErrors = structureIssues.some((i) => i.severity === 'ERROR');

    const issues: ValidationIssue[] = [...structureIssues];
    
    if (hasLegacySupplementalWorkbookTab(workbook.sheetNames)) {
      issues.push({
        sheet: LEGACY_SUPPLEMENTAL_WORKBOOK_TAB,
        rowNumber: 0,
        code: 'DEPRECATED_SHEET',
        severity: 'WARNING',
        message:
          'A legacy spreadsheet tab is present that supplemental payroll import does not read. Employee tax parameters belong in core employee and statutory flows.',
        suggestedFix:
          'Remove that legacy tab from the workbook to avoid confusion. Configure tax withholding via the main payroll template and statutory returns instead.',
        referenceSource: 'Supplemental payroll import specification',
      });
    }

    if (hasStructureErrors) {
      return {
        ready: false,
        summary: {
          employeesChecked: 0,
          errors: issues.filter((i) => i.severity === 'ERROR').length,
          warnings: issues.filter((i) => i.severity === 'WARNING').length,
        },
        checks: {
          payGroups: 'error',
          payItems: 'error',
          currencies: 'error',
          frequencies: 'error',
          payrollStatuses: 'error',
          eligibleEmployees: 'error',
          duplicateRows: 'error',
        },
        issues,
      };
    }

    const { validatedRows, issues: refIssues } = await this.validateReferences(workbook);
    issues.push(...refIssues);

    const errorIssues = issues.filter((i) => i.severity === 'ERROR');
    const warnIssues = issues.filter((i) => i.severity === 'WARNING');
    const totalEmployees = new Set(validatedRows.filter(r => r.data.employee_no).map((r) => r.data.employee_no)).size;

    const checks = {
      payGroups: issues.some((i) => i.code === 'PAY_GROUP_NOT_FOUND' || i.message.includes('Pay group')) ? 'error' : 'ok',
      payItems: issues.some((i) => i.code === 'INVALID_DEDUCTION_CODE' || i.message.includes('component_code')) ? 'error' : 'ok',
      currencies: issues.some((i) => i.message.includes('currency')) ? 'error' : 'ok',
      frequencies: issues.some((i) => i.message.includes('frequency')) ? 'error' : 'ok',
      payrollStatuses: issues.some((i) => i.code === 'INVALID_PAYROLL_STATUS') ? 'error' : 'ok',
      eligibleEmployees: issues.some((i) => i.code === 'EMPLOYEE_NOT_FOUND') ? 'warning' : 'ok',
      duplicateRows: issues.some((i) => i.code === 'DUPLICATE_ROW_IN_FILE') ? 'error' : 'ok',
    };

    return {
      ready: errorIssues.length === 0,
      summary: {
        employeesChecked: totalEmployees,
        errors: errorIssues.length,
        warnings: warnIssues.length,
      },
      checks,
      issues,
    };
  }

  async uploadAndValidate(buffer: Buffer, fileName: string, userId: string) {
    let workbook: ParsedWorkbook;
    try {
      workbook = parseWorkbook(buffer);
    } catch (err) {
      throw new BadRequestException(`Failed to parse workbook: ${(err as Error).message}`);
    }

    const structureIssues = this.validateStructure(workbook);
    const hasStructureErrors = structureIssues.some((i) => i.severity === 'ERROR');

    const job = await this.prisma.dataImportJob.create({
      data: {
        tenantId: TENANT_ID,
        datasetType: 'PAYROLL_SUPPLEMENTAL',
        fileName,
        uploadedByUserId: userId,
        status: hasStructureErrors ? 'HAS_ERRORS' : 'UPLOADED',
        rowsTotal: this.countTotalRows(workbook),
      },
    });

    if (hasStructureErrors) {
      const errorCount = structureIssues.filter((i) => i.severity === 'ERROR').length;
      await this.storeValidationIssues(job.id, structureIssues);
      await this.prisma.dataImportJob.update({
        where: { id: job.id },
        data: {
          status: 'HAS_ERRORS',
          validatedAt: new Date(),
          summaryJson: {
            sheetsDetected: workbook.sheetNames.length,
            totalRows: this.countTotalRows(workbook),
            validRows: 0,
            warningRows: 0,
            failedRows: errorCount,
            detectedHeaders: workbook.detectedHeaders,
            structureErrors: structureIssues as unknown as object[],
          } as object,
        },
      });
      await this.emitAudit(userId, 'PAYROLL_SUPPLEMENTAL_IMPORT_UPLOADED', job.id, { fileName, status: 'HAS_ERRORS' });
      return {
        importJobId: job.id,
        status: 'HAS_ERRORS',
        summary: {
          sheetsDetected: workbook.sheetNames.length,
          totalRows: this.countTotalRows(workbook),
          validRows: 0,
          warningRows: 0,
          failedRows: errorCount,
        },
        structureErrors: structureIssues,
      };
    }

    const { validatedRows, issues } = await this.validateReferences(workbook);

    const totalRows = validatedRows.length;
    const errorIssues = issues.filter((i) => i.severity === 'ERROR');
    const warnIssues = issues.filter((i) => i.severity === 'WARNING');
    const validRows = totalRows - new Set(errorIssues.map((e) => `${e.sheet}:${e.rowNumber}`)).size;

    await this.storeValidationIssues(job.id, issues);
    await this.storeValidatedRows(job.id, validatedRows);

    const status = errorIssues.length > 0 ? 'HAS_ERRORS' : 'VALIDATED';
    await this.prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status,
        validatedAt: new Date(),
        summaryJson: {
          sheetsDetected: workbook.sheetNames.length,
          totalRows,
          validRows,
          warningRows: warnIssues.length,
          failedRows: errorIssues.length,
          detectedHeaders: workbook.detectedHeaders,
        },
        contextJson: { workbookSheets: workbook.sheetNames },
      },
    });

    await this.emitAudit(userId, 'PAYROLL_SUPPLEMENTAL_IMPORT_UPLOADED', job.id, {
      fileName, totalRows, validRows, failedRows: errorIssues.length,
    });
    await this.emitAudit(userId, 'PAYROLL_SUPPLEMENTAL_IMPORT_VALIDATED', job.id, {
      totalRows, validRows, warningRows: warnIssues.length, failedRows: errorIssues.length,
    });

    return {
      importJobId: job.id,
      status,
      summary: {
        sheetsDetected: workbook.sheetNames.length,
        totalRows,
        validRows,
        warningRows: warnIssues.length,
        failedRows: errorIssues.length,
      },
    };
  }

  async getPreview(importJobId: string, userId: string): Promise<SupplementalPreviewResponse> {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: importJobId, tenantId: TENANT_ID },
    });
    if (!job) throw new NotFoundException('Import job not found');
    if (!['VALIDATED', 'HAS_ERRORS', 'APPROVED'].includes(job.status)) {
      throw new BadRequestException('Job must be validated before preview is available');
    }

    const rows = await this.prisma.dataImportRow.findMany({
      where: { jobId: importJobId },
      select: { payloadJson: true, mappedJson: true, status: true },
    });

    const sections: Record<string, PreviewSection> = {};
    for (const sheetKey of Object.values(SUPPLEMENTAL_SHEETS)) {
      sections[sheetKey] = { rows: 0, toInsert: 0, toUpdate: 0, toSkip: 0, failed: 0 };
    }

    for (const row of rows) {
      const mapped = (row.mappedJson ?? row.payloadJson) as Record<string, unknown>;
      const sheet = (mapped._sheet as string) ?? '';
      const action = mapped._action as string;
      const section = sections[sheet];
      if (!section) continue;

      section.rows++;
      if (row.status === 'INVALID') section.failed++;
      else if (action === 'INSERT') section.toInsert++;
      else if (action === 'UPDATE') section.toUpdate++;
      else if (action === 'SKIP') section.toSkip++;
    }

    const errors = await this.prisma.dataImportError.findMany({
      where: { jobId: importJobId, severity: 'ERROR' },
      take: 200,
      orderBy: { rowNumber: 'asc' },
      select: {
        rowNumber: true,
        sheetName: true,
        fieldName: true,
        errorCode: true,
        message: true,
        detailsJson: true,
      },
    });
    const warnings = await this.prisma.dataImportError.findMany({
      where: { jobId: importJobId, severity: 'WARNING' },
      take: 200,
      orderBy: { rowNumber: 'asc' },
      select: {
        rowNumber: true,
        sheetName: true,
        fieldName: true,
        errorCode: true,
        message: true,
        detailsJson: true,
      },
    });

    const hasErrors = errors.length > 0;

    return {
      importJobId,
      status: hasErrors ? 'FAILED' : 'READY_TO_IMPORT',
      sections: {
        compensation: sections[SUPPLEMENTAL_SHEETS.COMPENSATION],
        bankAccounts: sections[SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS],
        recurringDeductions: sections[SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS],
        payrollEligibility: sections[SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY],
      },
      warnings: warnings.map((w) => {
        const det = (w.detailsJson as Record<string, unknown>) ?? {};
        return {
          sheet: w.sheetName ?? legacySheetFromFieldName(w.fieldName) ?? '',
          rowNumber: w.rowNumber ?? 0,
          fieldName: w.fieldName ?? undefined,
          code: w.errorCode,
          severity: 'WARNING' as const,
          message: w.message,
          currentValue: det.currentValue != null ? String(det.currentValue) : undefined,
        };
      }),
      errors: errors.map((e) => {
        const det = (e.detailsJson as Record<string, unknown>) ?? {};
        return {
          sheet: e.sheetName ?? legacySheetFromFieldName(e.fieldName) ?? '',
          rowNumber: e.rowNumber ?? 0,
          fieldName: e.fieldName ?? undefined,
          code: e.errorCode,
          severity: 'ERROR' as const,
          message: e.message,
          currentValue: det.currentValue != null ? String(det.currentValue) : undefined,
        };
      }),
    };
  }

  async execute(importJobId: string, userId: string): Promise<ImportExecutionResult> {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: importJobId, tenantId: TENANT_ID },
    });
    if (!job) throw new NotFoundException('Import job not found');
    if (!['VALIDATED', 'APPROVED'].includes(job.status)) {
      throw new BadRequestException('Job must be validated before execution');
    }

    await this.prisma.dataImportJob.update({
      where: { id: importJobId },
      data: { status: 'PUBLISHING' },
    });

    const rows = await this.prisma.dataImportRow.findMany({
      where: { jobId: importJobId, status: 'VALID' },
      orderBy: { rowNumber: 'asc' },
    });

    const sheetOrder = [
      SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS,
      SUPPLEMENTAL_SHEETS.COMPENSATION,
      SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS,
      SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY,
    ];

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const sheetKey of sheetOrder) {
      const sheetRows = rows.filter((r) => {
        const mapped = (r.mappedJson ?? r.payloadJson) as Record<string, unknown>;
        return mapped._sheet === sheetKey;
      });

      for (const row of sheetRows) {
        const mapped = (row.mappedJson ?? row.payloadJson) as Record<string, unknown>;
        const action = mapped._action as string;
        try {
          switch (sheetKey) {
            case SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS:
              await this.persistBankAccount(mapped);
              break;
            case SUPPLEMENTAL_SHEETS.COMPENSATION:
              await this.persistCompensation(mapped);
              break;
            case SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS:
              await this.persistRecurringDeduction(mapped);
              break;
            case SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY:
              await this.persistPayrollEligibility(mapped);
              break;
          }
          if (action === 'INSERT') inserted++;
          else if (action === 'UPDATE') updated++;
          else skipped++;

          await this.prisma.dataImportRow.update({
            where: { id: row.id },
            data: { status: 'PUBLISHED' },
          });
        } catch (err) {
          failed++;
          this.logger.warn(`Row ${row.rowNumber} failed: ${(err as Error).message}`);
          await this.prisma.dataImportRow.update({
            where: { id: row.id },
            data: { status: 'SKIPPED' },
          });
        }
      }
    }

    const finalStatus = failed > 0 && inserted === 0 && updated === 0 ? 'FAILED' : 'PUBLISHED';
    await this.prisma.dataImportJob.update({
      where: { id: importJobId },
      data: {
        status: finalStatus,
        publishedAt: new Date(),
        publishedByUserId: userId,
        rowsProcessed: inserted + updated + skipped + failed,
        rowsValid: inserted + updated,
        rowsInvalid: failed,
        publishSummaryJson: { insertedRows: inserted, updatedRows: updated, skippedRows: skipped, failedRows: failed },
      },
    });

    await this.emitAudit(userId, 'PAYROLL_SUPPLEMENTAL_IMPORT_EXECUTED', importJobId, {
      insertedRows: inserted, updatedRows: updated, skippedRows: skipped, failedRows: failed,
    });

    return {
      importJobId,
      status: finalStatus === 'FAILED' ? 'FAILED' : 'COMPLETED',
      results: { insertedRows: inserted, updatedRows: updated, skippedRows: skipped, failedRows: failed },
    };
  }

  async getJob(importJobId: string) {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: importJobId, tenantId: TENANT_ID, datasetType: 'PAYROLL_SUPPLEMENTAL' },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async exportErrors(importJobId: string, format: 'csv' | 'xlsx'): Promise<Buffer> {
    const job = await this.getJob(importJobId);

    const errors = await this.prisma.dataImportError.findMany({
      where: { jobId: importJobId },
      orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }],
    });

    const importRows = await this.prisma.dataImportRow.findMany({
      where: { jobId: importJobId },
      select: { rowNumber: true, sheetName: true, sheetRowNumber: true, externalKey: true },
    });
    const rowByGlobalNumber = new Map(importRows.map((r) => [r.rowNumber, r]));
    const rowBySheetAndLine = new Map(
      importRows.map((r) => [`${r.sheetName ?? ''}|${r.sheetRowNumber ?? ''}`, r] as const),
    );

    const grouped = errors.map((e) => {
      const legacySheet = legacySheetFromFieldName(e.fieldName);
      const sheetKey = e.sheetName ?? legacySheet ?? '';
      let matched = e.rowNumber != null ? rowByGlobalNumber.get(e.rowNumber) : undefined;
      if (!matched && e.rowNumber != null && sheetKey) {
        matched = rowBySheetAndLine.get(`${sheetKey}|${e.rowNumber}`);
      }
      if (!matched && e.rowNumber != null) {
        matched = importRows.find((r) => r.sheetRowNumber === e.rowNumber && (!sheetKey || r.sheetName === sheetKey));
      }
      return dbValidationErrorToGroupedRow({
        sheetName: e.sheetName ?? legacySheet ?? null,
        fieldName: e.fieldName,
        rowNumber: e.rowNumber,
        errorCode: e.errorCode,
        message: e.message,
        severity: e.severity,
        detailsJson: e.detailsJson,
        matchedSheetName: matched?.sheetName,
        matchedSheetRowNumber: matched?.sheetRowNumber,
      });
    });

    const referenceValues = await this.buildSupplementalReferenceValueRows();
    const meta = {
      import_job_id: job.id,
      file_name: job.fileName,
      dataset: 'PAYROLL_SUPPLEMENTAL',
      job_status: job.status,
      generated_at_utc: new Date().toISOString(),
      error_rows: grouped.filter((r) => r.severity === 'ERROR').length,
      warning_rows: grouped.filter((r) => r.severity !== 'ERROR').length,
    };

    return format === 'xlsx'
      ? validationWorkbookToXlsx({ groupedRows: grouped, referenceValues, meta })
      : groupedErrorsToCsv(grouped);
  }

  /** Same workbook layout as `exportErrors` for a dry-run file before creating an import job */
  async exportPrecheckErrors(buffer: Buffer, format: 'csv' | 'xlsx', fileName: string): Promise<Buffer> {
    let workbook: ParsedWorkbook;
    try {
      workbook = parseWorkbook(buffer);
    } catch (err) {
      throw new BadRequestException(`Failed to parse workbook: ${(err as Error).message}`);
    }

    const structureIssues = this.validateStructure(workbook);
    const hasStructureErrors = structureIssues.some((i) => i.severity === 'ERROR');
    const issues: ValidationIssue[] = [...structureIssues];

    if (hasLegacySupplementalWorkbookTab(workbook.sheetNames)) {
      issues.push({
        sheet: LEGACY_SUPPLEMENTAL_WORKBOOK_TAB,
        rowNumber: 0,
        code: 'DEPRECATED_SHEET',
        severity: 'WARNING',
        message:
          'A legacy spreadsheet tab is present that supplemental payroll import does not read. Employee tax parameters belong in core employee and statutory flows.',
        suggestedFix:
          'Remove that legacy tab from the workbook to avoid confusion. Configure tax withholding via the main payroll template and statutory returns instead.',
        referenceSource: 'Supplemental payroll import specification',
      });
    }

    if (!hasStructureErrors) {
      const { issues: refIssues } = await this.validateReferences(workbook);
      issues.push(...refIssues);
    }

    const grouped = validationIssuesToGroupedRows(issues);
    const referenceValues = await this.buildSupplementalReferenceValueRows();
    const meta = {
      source: 'precheck',
      file_name: fileName,
      generated_at_utc: new Date().toISOString(),
      error_rows: grouped.filter((r) => r.severity === 'ERROR').length,
      warning_rows: grouped.filter((r) => r.severity !== 'ERROR').length,
    };

    return format === 'xlsx'
      ? validationWorkbookToXlsx({ groupedRows: grouped, referenceValues, meta })
      : groupedErrorsToCsv(grouped);
  }

  private async buildSupplementalReferenceValueRows(): Promise<ReferenceValueRow[]> {
    const [payGroups, payItems] = await Promise.all([
      this.prisma.payGroup.findMany({ select: { code: true } }),
      this.prisma.payItem.findMany({ select: { code: true, type: true } }),
    ]);

    const rows: ReferenceValueRow[] = [];
    for (const pg of [...payGroups].sort((a, b) => a.code.localeCompare(b.code))) {
      rows.push({ reference_domain: 'pay_group_code', code: pg.code, description: 'Configured pay group for this tenant' });
    }
    for (const pi of [...payItems].filter((p) => p.type === 'DEDUCTION').sort((a, b) => a.code.localeCompare(b.code))) {
      rows.push({
        reference_domain: 'deduction_code',
        code: pi.code,
        description: `Pay item configured as ${pi.type}`,
      });
    }

    rows.push(
      { reference_domain: 'payroll_status', code: 'ELIGIBLE', description: 'payrolleligibility.payroll_status' },
      { reference_domain: 'payroll_status', code: 'HOLD', description: 'payrolleligibility.payroll_status' },
      { reference_domain: 'payroll_status', code: 'EXCLUDED', description: 'payrolleligibility.payroll_status' },
      { reference_domain: 'component_type', code: 'EARNING', description: 'compensation.component_type' },
      { reference_domain: 'component_type', code: 'ALLOWANCE', description: 'compensation.component_type' },
      { reference_domain: 'account_type', code: 'CHEQUE', description: 'bankaccounts.account_type' },
      { reference_domain: 'account_type', code: 'SAVINGS', description: 'bankaccounts.account_type' },
      { reference_domain: 'account_type', code: 'CURRENT', description: 'bankaccounts.account_type' },
      { reference_domain: 'currency', code: 'ZAR', description: 'compensation.currency' },
      { reference_domain: 'currency', code: 'LSL', description: 'compensation.currency' },
    );

    return rows;
  }

  // ─── Structure validation ─────────────────────────────────────────

  private validateStructure(workbook: ParsedWorkbook): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const requiredSheet of REQUIRED_SHEETS) {
      const sheet = findSheet(workbook, requiredSheet);
      if (!sheet) {
        issues.push({
          sheet: requiredSheet,
          rowNumber: 0,
          code: 'MISSING_REQUIRED_SHEET',
          severity: 'ERROR',
          message: `Missing required sheet: ${requiredSheet}`,
          suggestedFix: `Add a worksheet tab named exactly "${requiredSheet}" using the latest supplemental import template.`,
          referenceSource: 'Supplemental import template',
        });
        continue;
      }

      const requiredCols = REQUIRED_COLUMNS[requiredSheet] ?? [];
      for (const col of requiredCols) {
        if (!sheet.headers.includes(col)) {
          issues.push({
            sheet: requiredSheet,
            rowNumber: 0,
            code: 'MISSING_REQUIRED_COLUMN',
            severity: 'ERROR',
            message: `Missing required column '${col}' in sheet ${requiredSheet}`,
            fieldName: col,
            suggestedFix: `Insert column header ${col} in row 1 of the ${requiredSheet} sheet (match spelling and underscores).`,
            referenceSource: 'Supplemental import template',
          });
        }
      }
    }

    return issues;
  }

  // ─── Reference validation ─────────────────────────────────────────

  private async validateReferences(workbook: ParsedWorkbook): Promise<{
    validatedRows: ValidatedRow[];
    issues: ValidationIssue[];
  }> {
    const employees = await this.prisma.employee.findMany({ select: { id: true, employeeNo: true, country: true, legalEntityId: true } });
    const employeeMap = new Map(employees.map((e) => [e.employeeNo, e]));

    const payGroups = await this.prisma.payGroup.findMany({ select: { id: true, code: true, country: true, legalEntityId: true } });
    const payGroupMap = new Map(payGroups.map((pg) => [pg.code, pg]));

    const payItems = await this.prisma.payItem.findMany({ select: { id: true, code: true, type: true } });
    const payItemMap = new Map(payItems.map((pi) => [pi.code, pi]));
    const deductionCodeHints = payItems
      .filter((pi) => pi.type === 'DEDUCTION')
      .map((pi) => pi.code)
      .sort((a, b) => a.localeCompare(b));
    const payGroupCodeHints = [...payGroupMap.keys()].sort((a, b) => a.localeCompare(b));

    const existingCompensations = await this.prisma.compensation.findMany({
      select: { employeeId: true, effectiveFrom: true },
    });
    const existingCompKeys = new Set(existingCompensations.map(
      (c) => `${c.employeeId}|${c.effectiveFrom.toISOString().slice(0, 10)}`,
    ));

    const existingBankAccounts = await this.prisma.bankAccount.findMany({
      select: { employeeId: true, maskedAccountNumber: true },
    });
    const existingBankKeys = new Set(existingBankAccounts.map(
      (b) => `${b.employeeId}|${b.maskedAccountNumber}`,
    ));

    const allIssues: ValidationIssue[] = [];
    const allRows: ValidatedRow[] = [];
    let globalRowCounter = 0;

    const validateSheet = (
      sheetKey: string,
      validateRow: (row: Record<string, unknown>, rowNum: number) => { issues: ValidationIssue[]; data: Record<string, unknown>; action: string; businessKey: string },
    ) => {
      const sheet = findSheet(workbook, sheetKey);
      if (!sheet) return;

      const seenKeys = new Set<string>();

      for (let i = 0; i < sheet.rows.length; i++) {
        globalRowCounter++;
        const sheetRowNum = i + 2;
        const result = validateRow(sheet.rows[i], sheetRowNum);

        if (result.businessKey && seenKeys.has(result.businessKey)) {
          result.issues.push({
            sheet: sheetKey,
            rowNumber: sheetRowNum,
            businessKey: result.businessKey,
            code: 'DUPLICATE_ROW_IN_FILE',
            severity: 'ERROR',
            message: `Duplicate row in file: the business key "${result.businessKey}" was already used on an earlier row in ${sheetKey}.`,
            suggestedFix: `Delete or edit this row so the key "${result.businessKey}" is unique within ${sheetKey}.`,
            referenceSource: 'Import file uniqueness rules',
          });
        }
        if (result.businessKey) seenKeys.add(result.businessKey);

        const hasErrors = result.issues.some((i) => i.severity === 'ERROR');
        allIssues.push(...result.issues);
        allRows.push({
          sheet: sheetKey,
          rowNumber: globalRowCounter,
          sheetRowNumber: sheetRowNum,
          businessKey: result.businessKey,
          data: { ...result.data, _sheet: sheetKey, _sheetRow: sheetRowNum, _action: hasErrors ? 'FAIL' : result.action },
          action: hasErrors ? 'SKIP' : (result.action as 'INSERT' | 'UPDATE' | 'SKIP'),
          issues: result.issues,
        });
      }
    };

    // Compensation
    validateSheet(SUPPLEMENTAL_SHEETS.COMPENSATION, (row, rowNum) => {
      const issues: ValidationIssue[] = [];
      const empNo = String(row.employee_no ?? '').trim();
      const effectiveFrom = parseDate(row.effective_from);
      const componentCode = String(row.component_code ?? '').trim();
      const componentType = String(row.component_type ?? '').trim().toUpperCase();
      const amount = parseNumeric(row.amount);
      const frequency = String(row.frequency ?? '').trim().toUpperCase();
      const currency = String(row.currency ?? '').trim().toUpperCase();
      const businessKey = `${empNo}|${effectiveFrom}|${componentCode}`;

      if (!empNo) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.COMPENSATION, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required', fieldName: 'employee_no' });
      }
      if (!effectiveFrom) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.COMPENSATION, rowNumber: rowNum, code: 'INVALID_DATE', severity: 'ERROR', message: 'effective_from is required and must be valid', fieldName: 'effective_from' });
      }
      if (!componentCode) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.COMPENSATION, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'component_code is required', fieldName: 'component_code' });
      }
      if (!['EARNING', 'ALLOWANCE'].includes(componentType)) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.COMPENSATION,
          rowNumber: rowNum,
          code: 'INVALID_COMPONENT_TYPE',
          severity: 'ERROR',
          message: `Invalid component_type: ${componentType}`,
          fieldName: 'component_type',
          currentValue: componentType || '(blank)',
          allowedValuesHint: ['EARNING', 'ALLOWANCE'],
        });
      }
      if (amount === null) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.COMPENSATION, rowNumber: rowNum, code: 'INVALID_NUMERIC_VALUE', severity: 'ERROR', message: 'amount must be numeric', fieldName: 'amount', currentValue: String(row.amount ?? '') });
      }

      const emp = empNo ? employeeMap.get(empNo) : undefined;
      if (empNo && !emp) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.COMPENSATION,
          rowNumber: rowNum,
          businessKey,
          code: 'EMPLOYEE_NOT_FOUND',
          severity: 'ERROR',
          message: `Employee ${empNo} not found in payroll.`,
          fieldName: 'employee_no',
          currentValue: empNo,
        });
      }

      const existsKey = emp && effectiveFrom ? `${emp.id}|${effectiveFrom}` : '';
      const action = existsKey && existingCompKeys.has(existsKey) ? 'UPDATE' : 'INSERT';

      return {
        issues, businessKey, action,
        data: { employee_no: empNo, employee_id: emp?.id, effective_from: effectiveFrom, component_code: componentCode, component_type: componentType, amount, frequency, currency },
      };
    });

    // BankAccounts
    validateSheet(SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS, (row, rowNum) => {
      const issues: ValidationIssue[] = [];
      const empNo = String(row.employee_no ?? '').trim();
      const bankName = String(row.bank_name ?? '').trim();
      const accountNumber = String(row.account_number ?? '').trim();
      const accountType = String(row.account_type ?? '').trim().toUpperCase();
      const verified = parseBoolean(row.verified);
      const effectiveFrom = parseDate(row.effective_from) ?? new Date().toISOString().slice(0, 10);
      const branchCode = row.branch_code ? String(row.branch_code).trim() : null;
      const businessKey = `${empNo}|${accountNumber}|${effectiveFrom}`;

      if (!empNo) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required', fieldName: 'employee_no' });
      }
      if (!bankName) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'bank_name is required', fieldName: 'bank_name' });
      }
      if (!accountNumber) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'account_number is required', fieldName: 'account_number' });
      }
      if (!['CHEQUE', 'SAVINGS', 'CURRENT'].includes(accountType)) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS,
          rowNumber: rowNum,
          code: 'INVALID_ACCOUNT_TYPE',
          severity: 'ERROR',
          message: `Invalid account_type: ${accountType}`,
          fieldName: 'account_type',
          currentValue: accountType || '(blank)',
          allowedValuesHint: ['CHEQUE', 'SAVINGS', 'CURRENT'],
        });
      }

      const emp = empNo ? employeeMap.get(empNo) : undefined;
      if (empNo && !emp) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS,
          rowNumber: rowNum,
          businessKey,
          code: 'EMPLOYEE_NOT_FOUND',
          severity: 'ERROR',
          message: `Employee ${empNo} not found in payroll.`,
          fieldName: 'employee_no',
          currentValue: empNo,
        });
      }

      if (verified === false) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS,
          rowNumber: rowNum,
          code: 'BANK_ACCOUNT_UNVERIFIED',
          severity: 'WARNING',
          message: 'Bank account imported as unverified',
          fieldName: 'verified',
          currentValue: 'FALSE',
        });
      }

      const masked = accountNumber ? `****${accountNumber.slice(-4)}` : '';
      const existsKey = emp ? `${emp.id}|${masked}` : '';
      const action = existsKey && existingBankKeys.has(existsKey) ? 'UPDATE' : 'INSERT';

      return {
        issues, businessKey, action,
        data: { employee_no: empNo, employee_id: emp?.id, bank_name: bankName, account_number: accountNumber, account_type: accountType, verified: verified ?? false, effective_from: effectiveFrom, branch_code: branchCode },
      };
    });

    // RecurringDeductions
    validateSheet(SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS, (row, rowNum) => {
      const issues: ValidationIssue[] = [];
      const empNo = String(row.employee_no ?? '').trim();
      const deductionCode = String(row.deduction_code ?? '').trim().toUpperCase();
      const amount = parseNumeric(row.amount);
      const frequency = String(row.frequency ?? '').trim().toUpperCase();
      const effectiveFrom = parseDate(row.effective_from);
      const endDate = parseDate(row.end_date);
      const employerContribution = parseNumeric(row.employer_contribution_amount);
      const businessKey = `${empNo}|${deductionCode}|${effectiveFrom}`;

      if (!empNo) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required', fieldName: 'employee_no' });
      }
      if (!deductionCode) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'deduction_code is required', fieldName: 'deduction_code' });
      }
      if (amount === null) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS,
          rowNumber: rowNum,
          code: 'INVALID_NUMERIC_VALUE',
          severity: 'ERROR',
          message: 'amount must be numeric',
          fieldName: 'amount',
          currentValue: String(row.amount ?? ''),
        });
      }
      if (amount !== null && amount < 0) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS,
          rowNumber: rowNum,
          code: 'NEGATIVE_AMOUNT_NOT_ALLOWED',
          severity: 'ERROR',
          message: 'Negative deduction amount not allowed',
          fieldName: 'amount',
          currentValue: String(amount),
        });
      }
      if (!effectiveFrom) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS, rowNumber: rowNum, code: 'INVALID_DATE', severity: 'ERROR', message: 'effective_from is required', fieldName: 'effective_from' });
      }

      const emp = empNo ? employeeMap.get(empNo) : undefined;
      if (empNo && !emp) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS,
          rowNumber: rowNum,
          businessKey,
          code: 'EMPLOYEE_NOT_FOUND',
          severity: 'ERROR',
          message: `Employee ${empNo} not found in payroll.`,
          fieldName: 'employee_no',
          currentValue: empNo,
        });
      }

      const payItem = deductionCode ? payItemMap.get(deductionCode) : undefined;
      if (deductionCode && !payItem) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS,
          rowNumber: rowNum,
          businessKey,
          code: 'INVALID_DEDUCTION_CODE',
          severity: 'ERROR',
          message: `Deduction code ${deductionCode} not found in pay items.`,
          fieldName: 'deduction_code',
          currentValue: deductionCode,
          allowedValuesHint: deductionCodeHints,
        });
      }

      return {
        issues, businessKey, action: 'INSERT',
        data: { employee_no: empNo, employee_id: emp?.id, deduction_code: deductionCode, pay_item_id: payItem?.id, amount, frequency, effective_from: effectiveFrom, end_date: endDate, employer_contribution_amount: employerContribution },
      };
    });

    // PayrollEligibility
    validateSheet(SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY, (row, rowNum) => {
      const issues: ValidationIssue[] = [];
      const empNo = String(row.employee_no ?? '').trim();
      const payGroupCode = String(row.pay_group_code ?? '').trim();
      const payrollStatus = String(row.payroll_status ?? '').trim().toUpperCase();
      const effectiveFrom = parseDate(row.effective_from);
      const paymentMethod = row.payment_method ? String(row.payment_method).trim().toUpperCase() : null;
      const reason = row.reason ? String(row.reason).trim() : null;
      const businessKey = `${empNo}|${payGroupCode}|${effectiveFrom}`;

      if (!empNo) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required', fieldName: 'employee_no' });
      }
      if (!payGroupCode) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY, rowNumber: rowNum, code: 'REQUIRED', severity: 'ERROR', message: 'pay_group_code is required', fieldName: 'pay_group_code' });
      }
      if (!['ELIGIBLE', 'HOLD', 'EXCLUDED'].includes(payrollStatus)) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY,
          rowNumber: rowNum,
          code: 'INVALID_PAYROLL_STATUS',
          severity: 'ERROR',
          message: `Invalid payroll_status: ${payrollStatus}`,
          fieldName: 'payroll_status',
          currentValue: payrollStatus || '(blank)',
          allowedValuesHint: ['ELIGIBLE', 'HOLD', 'EXCLUDED'],
        });
      }
      if (!effectiveFrom) {
        issues.push({ sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY, rowNumber: rowNum, code: 'INVALID_DATE', severity: 'ERROR', message: 'effective_from is required', fieldName: 'effective_from' });
      }

      const emp = empNo ? employeeMap.get(empNo) : undefined;
      if (empNo && !emp) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY,
          rowNumber: rowNum,
          businessKey,
          code: 'EMPLOYEE_NOT_FOUND',
          severity: 'ERROR',
          message: `Employee ${empNo} not found in payroll.`,
          fieldName: 'employee_no',
          currentValue: empNo,
        });
      }

      const pg = payGroupCode ? payGroupMap.get(payGroupCode) : undefined;
      if (payGroupCode && !pg) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY,
          rowNumber: rowNum,
          businessKey,
          code: 'PAY_GROUP_NOT_FOUND',
          severity: 'ERROR',
          message: `Pay group ${payGroupCode} not found.`,
          fieldName: 'pay_group_code',
          currentValue: payGroupCode,
          allowedValuesHint: payGroupCodeHints,
        });
      }

      if (['HOLD', 'EXCLUDED'].includes(payrollStatus) && !reason) {
        issues.push({
          sheet: SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY,
          rowNumber: rowNum,
          code: 'REASON_MISSING_FOR_HOLD_STATUS',
          severity: 'WARNING',
          message: `Reason recommended for ${payrollStatus} status`,
          fieldName: 'reason',
        });
      }

      return {
        issues, businessKey, action: 'INSERT',
        data: { employee_no: empNo, employee_id: emp?.id, pay_group_code: payGroupCode, pay_group_id: pg?.id, payroll_status: payrollStatus, effective_from: effectiveFrom, payment_method: paymentMethod, reason },
      };
    });

    return { validatedRows: allRows, issues: allIssues };
  }

  // ─── Persistence ──────────────────────────────────────────────────

  private async persistCompensation(data: Record<string, unknown>) {
    const employeeId = data.employee_id as string;
    const effectiveFrom = new Date(data.effective_from as string);
    const amount = Number(data.amount);
    const currency = (data.currency as string) === 'LSL' ? 'LSL' : 'ZAR';

    const existing = await this.prisma.compensation.findFirst({
      where: { employeeId, effectiveFrom },
    });

    if (existing) {
      await this.prisma.compensation.update({
        where: { id: existing.id },
        data: { baseSalary: amount, currency, notes: `Imported: ${data.component_code}` },
      });
    } else {
      await this.prisma.compensation.create({
        data: { employeeId, baseSalary: amount, currency, effectiveFrom, notes: `Imported: ${data.component_code}` },
      });
    }
  }

  private async persistBankAccount(data: Record<string, unknown>) {
    const employeeId = data.employee_id as string;
    const accountNumber = data.account_number as string;
    const masked = `****${accountNumber.slice(-4)}`;
    const effectiveFrom = new Date(data.effective_from as string);
    const accountType = (data.account_type as string) as any;

    const existing = await this.prisma.bankAccount.findFirst({
      where: { employeeId, maskedAccountNumber: masked },
    });

    if (existing) {
      await this.prisma.bankAccount.update({
        where: { id: existing.id },
        data: { bankName: data.bank_name as string, branchCode: data.branch_code as string | null, accountType, effectiveFrom },
      });
    } else {
      await this.prisma.bankAccount.create({
        data: {
          employeeId,
          bankName: data.bank_name as string,
          accountNumberEnc: accountNumber,
          maskedAccountNumber: masked,
          branchCode: data.branch_code as string | null,
          accountType,
          effectiveFrom,
        },
      });
    }
  }

  private async persistRecurringDeduction(data: Record<string, unknown>) {
    const employeeId = data.employee_id as string;
    const payItemId = data.pay_item_id as string;
    if (!payItemId) return;

    await this.prisma.recurringInput.create({
      data: {
        employeeId,
        payItemId,
        amount: Number(data.amount),
        currency: 'ZAR',
        startDate: new Date(data.effective_from as string),
        endDate: data.end_date ? new Date(data.end_date as string) : null,
        isActive: true,
      },
    });
  }

  private async persistPayrollEligibility(data: Record<string, unknown>) {
    // Payroll eligibility is tracked via employment/pay group assignment
    // For now, store as metadata on the employee or log it
    const employeeId = data.employee_id as string;
    const payGroupId = data.pay_group_id as string;
    if (!employeeId || !payGroupId) return;

    const employment = await this.prisma.employment.findFirst({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (employment) {
      await this.prisma.employment.update({
        where: { id: employment.id },
        data: { payGroupId },
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private countTotalRows(workbook: ParsedWorkbook): number {
    const relevantSheets = Object.values(SUPPLEMENTAL_SHEETS) as string[];
    return Object.entries(workbook.sheets)
      .filter(([name]) => relevantSheets.includes(name))
      .reduce((sum, [, s]) => sum + s.rows.length, 0);
  }

  private async storeValidationIssues(jobId: string, issues: ValidationIssue[]) {
    if (issues.length === 0) return;
    await this.prisma.dataImportError.createMany({
      data: issues.map((issue) => {
        const detailsJson: DataImportErrorDetails = {};
        if (issue.currentValue !== undefined) detailsJson.currentValue = issue.currentValue;
        if (issue.suggestedFix !== undefined) detailsJson.suggestedFix = issue.suggestedFix;
        if (issue.referenceSource !== undefined) detailsJson.referenceSource = issue.referenceSource;
        if (issue.allowedValuesHint?.length) detailsJson.allowedValues = issue.allowedValuesHint;
        if (issue.code === 'DUPLICATE_ROW_IN_FILE' && issue.businessKey) {
          detailsJson.duplicateKey = issue.businessKey;
        }
        return {
          jobId,
          rowNumber: issue.rowNumber,
          sheetName: issue.sheet,
          fieldName: issue.fieldName ?? null,
          errorCode: issue.code,
          message: issue.message,
          severity: issue.severity,
          detailsJson: Object.keys(detailsJson).length ? (detailsJson as object) : undefined,
        };
      }),
    });
  }

  private async storeValidatedRows(jobId: string, rows: ValidatedRow[]) {
    if (rows.length === 0) return;
    await this.prisma.dataImportRow.createMany({
      data: rows.map((row) => ({
        jobId,
        rowNumber: row.rowNumber,
        sheetName: row.sheet,
        sheetRowNumber: row.sheetRowNumber,
        externalKey: row.businessKey,
        payloadJson: row.data as object,
        mappedJson: row.data as object,
        status: row.issues.some((i) => i.severity === 'ERROR') ? 'INVALID' : 'VALID',
        errorsCount: row.issues.filter((i) => i.severity === 'ERROR').length,
        warningsCount: row.issues.filter((i) => i.severity === 'WARNING').length,
      })),
    });
  }

  private async emitAudit(userId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await this.auditService.log({
      userId,
      action,
      entityType: 'DataImportJob',
      entityId,
      newValue: { importType: 'PAYROLL_SUPPLEMENTAL', ...metadata },
    });
  }
}
