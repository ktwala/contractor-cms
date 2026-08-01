import {
  BadRequestException,
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
  ParsedWorkbook,
} from '../utils/workbook-parser';
import {
  ValidationIssue,
  PreviewSection,
  OpeningBalancesPreviewResponse,
  OpeningBalancesPrecheckResponse,
  OpeningBalancesFinancialControl,
  ImportExecutionResult,
  OB_SHEETS,
  REQUIRED_OB_COLUMNS,
  OB_COLUMN_ALIASES,
} from './payroll-opening-balances-import.types';
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
export class PayrollOpeningBalancesImportService {
  private readonly logger = new Logger(PayrollOpeningBalancesImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async precheck(
    buffer: Buffer,
    context: { countryCode: string; taxYear: number; asOfDate?: string },
  ): Promise<OpeningBalancesPrecheckResponse> {
    const pf = await this.runPreflightValidation(buffer, context);
    const errorCount = pf.issues.filter((i) => i.severity === 'ERROR').length;
    const warnCount = pf.issues.filter((i) => i.severity === 'WARNING').length;
    return {
      ready: errorCount === 0,
      summary: {
        errors: errorCount,
        warnings: warnCount,
        totalRows: pf.totalRows,
        sheetsDetected: pf.sheetNames.length,
      },
      financialControl: pf.financialControl,
      issues: pf.issues,
    };
  }

  async exportPrecheckErrors(
    buffer: Buffer,
    format: 'csv' | 'xlsx',
    fileName: string,
    context: { countryCode: string; taxYear: number; asOfDate?: string },
  ): Promise<Buffer> {
    const pf = await this.runPreflightValidation(buffer, context);
    const grouped = validationIssuesToGroupedRows(pf.issues);
    const referenceValues = await this.buildOpeningBalancesReferenceValueRows();
    const meta = {
      source: 'precheck',
      file_name: fileName,
      country: context.countryCode,
      tax_year: context.taxYear,
      generated_at_utc: new Date().toISOString(),
      error_rows: grouped.filter((r) => r.severity === 'ERROR').length,
      warning_rows: grouped.filter((r) => r.severity !== 'ERROR').length,
    };
    return format === 'xlsx'
      ? validationWorkbookToXlsx({ groupedRows: grouped, referenceValues, meta })
      : groupedErrorsToCsv(grouped);
  }

  async uploadAndValidate(
    buffer: Buffer,
    fileName: string,
    userId: string,
    context: { countryCode: string; taxYear: number; asOfDate?: string },
  ) {
    let workbook: ParsedWorkbook;
    try {
      workbook = parseWorkbook(buffer, {
        headerDetectionMode: 'auto',
        columnAliases: OB_COLUMN_ALIASES,
      });
    } catch (err) {
      throw new BadRequestException(`Failed to parse workbook: ${(err as Error).message}`);
    }

    const structureIssues = this.validateStructure(workbook);
    const hasStructureErrors = structureIssues.some((i) => i.severity === 'ERROR');
    const totalRows = this.countTotalRows(workbook);

    const job = await this.prisma.dataImportJob.create({
      data: {
        tenantId: TENANT_ID,
        datasetType: 'PAYROLL_OPENING_BALANCES',
        fileName,
        uploadedByUserId: userId,
        status: hasStructureErrors ? 'HAS_ERRORS' : 'UPLOADED',
        rowsTotal: totalRows,
        contextJson: context as object,
      },
    });

    if (hasStructureErrors) {
      await this.storeValidationIssues(job.id, structureIssues);
      await this.prisma.dataImportJob.update({
        where: { id: job.id },
        data: {
          status: 'HAS_ERRORS',
          validatedAt: new Date(),
          summaryJson: { sheetsDetected: workbook.sheetNames.length, totalRows, validRows: 0, warningRows: 0, failedRows: structureIssues.length, detectedHeaders: workbook.detectedHeaders, structureErrors: structureIssues as unknown as object[] } as object,
        },
      });
      await this.emitAudit(userId, 'PAYROLL_OPENING_BALANCES_IMPORT_UPLOADED', job.id, { fileName, status: 'HAS_ERRORS', ...context });
      return { importJobId: job.id, status: 'HAS_ERRORS', summary: { sheetsDetected: workbook.sheetNames.length, totalRows, validRows: 0, warningRows: 0, failedRows: structureIssues.length }, structureErrors: structureIssues };
    }

    const { validatedRows, issues } = await this.validateBalances(workbook, context);
    const errorIssues = issues.filter((i) => i.severity === 'ERROR');
    const warnIssues = issues.filter((i) => i.severity === 'WARNING');
    const validRows = validatedRows.length - new Set(errorIssues.map((e) => `${e.sheet}:${e.rowNumber}`)).size;

    await this.storeValidationIssues(job.id, issues);
    await this.storeValidatedRows(job.id, validatedRows);

    const status = errorIssues.length > 0 ? 'HAS_ERRORS' : 'VALIDATED';
    await this.prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status,
        validatedAt: new Date(),
        summaryJson: { sheetsDetected: workbook.sheetNames.length, totalRows: validatedRows.length, validRows, warningRows: warnIssues.length, failedRows: errorIssues.length, detectedHeaders: workbook.detectedHeaders },
      },
    });

    await this.emitAudit(userId, 'PAYROLL_OPENING_BALANCES_IMPORT_UPLOADED', job.id, { fileName, ...context });
    await this.emitAudit(userId, 'PAYROLL_OPENING_BALANCES_IMPORT_VALIDATED', job.id, { totalRows: validatedRows.length, validRows, failedRows: errorIssues.length, ...context });

    return { importJobId: job.id, status, summary: { sheetsDetected: workbook.sheetNames.length, totalRows: validatedRows.length, validRows, warningRows: warnIssues.length, failedRows: errorIssues.length } };
  }

  async getPreview(importJobId: string): Promise<OpeningBalancesPreviewResponse> {
    const job = await this.prisma.dataImportJob.findFirst({ where: { id: importJobId, tenantId: TENANT_ID } });
    if (!job) throw new NotFoundException('Import job not found');

    const rows = await this.prisma.dataImportRow.findMany({
      where: { jobId: importJobId },
      select: { payloadJson: true, mappedJson: true, status: true },
    });

    const sections: Record<string, PreviewSection> = {};
    for (const key of Object.values(OB_SHEETS)) {
      sections[key] = { rows: 0, toInsert: 0, toUpdate: 0, toSkip: 0, failed: 0 };
    }

    let ytdGross = 0;
    let ytdTaxable = 0;
    let ytdPaye = 0;
    let ytdNet = 0;
    const openingBalanceEmployees = new Set<string>();

    for (const row of rows) {
      const mapped = (row.mappedJson ?? row.payloadJson) as Record<string, unknown>;
      const sheet = mapped._sheet as string;
      const action = mapped._action as string;
      const section = sections[sheet];
      if (!section) continue;

      section.rows++;
      if (row.status === 'INVALID') section.failed++;
      else if (action === 'INSERT') section.toInsert++;
      else if (action === 'UPDATE') section.toUpdate++;
      else if (action === 'SKIP') section.toSkip++;

      if (sheet === OB_SHEETS.PAYROLL_OPENING_BALANCES && row.status !== 'INVALID') {
        const eno = String(mapped.employee_no ?? '').trim();
        if (eno) openingBalanceEmployees.add(eno);
        ytdGross += Number(mapped.ytd_gross ?? 0);
        ytdTaxable += Number(mapped.ytd_taxable ?? 0);
        ytdPaye += Number(mapped.ytd_paye ?? 0);
        ytdNet += Number(mapped.ytd_net ?? 0);
      }
    }

    const ctx = (job.contextJson ?? {}) as { countryCode?: string; taxYear?: number; asOfDate?: string };
    const financialControl: OpeningBalancesFinancialControl = {
      countryCode: String(ctx.countryCode ?? 'ZA').toUpperCase(),
      taxYear: Number(ctx.taxYear ?? new Date().getFullYear()),
      asOfDate: ctx.asOfDate != null ? String(ctx.asOfDate) : null,
      employeeCount: openingBalanceEmployees.size,
      ytdGross,
      ytdTaxable,
      ytdPaye,
      ytdNet,
      alerts: this.buildAggregateYtdAlerts(ytdGross, ytdTaxable, ytdPaye, ytdNet),
    };

    const errors = await this.prisma.dataImportError.findMany({
      where: { jobId: importJobId, severity: 'ERROR' },
      take: 200,
      select: { rowNumber: true, sheetName: true, fieldName: true, errorCode: true, message: true, detailsJson: true },
    });
    const warnings = await this.prisma.dataImportError.findMany({
      where: { jobId: importJobId, severity: 'WARNING' },
      take: 200,
      select: { rowNumber: true, sheetName: true, fieldName: true, errorCode: true, message: true, detailsJson: true },
    });

    const mapIssue = (w: (typeof errors)[0], severity: 'ERROR' | 'WARNING') => {
      const det = (w.detailsJson as Record<string, unknown>) ?? {};
      return {
        sheet: w.sheetName ?? legacySheetFromFieldName(w.fieldName) ?? '',
        rowNumber: w.rowNumber ?? 0,
        fieldName: w.fieldName ?? undefined,
        code: w.errorCode,
        severity,
        message: w.message,
        currentValue: det.currentValue != null ? String(det.currentValue) : undefined,
      };
    };

    return {
      importJobId,
      status: errors.length > 0 ? 'FAILED' : 'READY_TO_IMPORT',
      sections: {
        payrollOpeningBalances: sections[OB_SHEETS.PAYROLL_OPENING_BALANCES],
        leaveBalances: sections[OB_SHEETS.LEAVE_BALANCES]?.rows > 0 ? sections[OB_SHEETS.LEAVE_BALANCES] : undefined,
        loanBalances: sections[OB_SHEETS.LOAN_BALANCES]?.rows > 0 ? sections[OB_SHEETS.LOAN_BALANCES] : undefined,
      },
      totals: { ytdGross, ytdTaxable, ytdPaye, ytdNet },
      financialControl,
      warnings: warnings.map((w) => mapIssue(w, 'WARNING')),
      errors: errors.map((e) => mapIssue(e, 'ERROR')),
    };
  }

  async execute(importJobId: string, userId: string): Promise<ImportExecutionResult> {
    const job = await this.prisma.dataImportJob.findFirst({ where: { id: importJobId, tenantId: TENANT_ID } });
    if (!job) throw new NotFoundException('Import job not found');
    if (!['VALIDATED', 'APPROVED'].includes(job.status)) throw new BadRequestException('Job must be validated before execution');

    await this.prisma.dataImportJob.update({ where: { id: importJobId }, data: { status: 'PUBLISHING' } });

    const rows = await this.prisma.dataImportRow.findMany({ where: { jobId: importJobId, status: 'VALID' }, orderBy: { rowNumber: 'asc' } });
    const context = (job.contextJson ?? {}) as Record<string, unknown>;

    const sheetOrder = [OB_SHEETS.PAYROLL_OPENING_BALANCES, OB_SHEETS.LEAVE_BALANCES, OB_SHEETS.LOAN_BALANCES];
    let inserted = 0, updated = 0, skipped = 0, failed = 0;

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
            case OB_SHEETS.PAYROLL_OPENING_BALANCES:
              await this.persistOpeningBalance(mapped, context);
              break;
            case OB_SHEETS.LEAVE_BALANCES:
              await this.persistLeaveBalance(mapped);
              break;
            case OB_SHEETS.LOAN_BALANCES:
              await this.persistLoanBalance(mapped);
              break;
          }
          if (action === 'UPDATE') updated++;
          else inserted++;
          await this.prisma.dataImportRow.update({ where: { id: row.id }, data: { status: 'PUBLISHED' } });
        } catch (err) {
          failed++;
          this.logger.warn(`Row ${row.rowNumber} failed: ${(err as Error).message}`);
          await this.prisma.dataImportRow.update({ where: { id: row.id }, data: { status: 'SKIPPED' } });
        }
      }
    }

    const finalStatus = failed > 0 && inserted === 0 && updated === 0 ? 'FAILED' : 'PUBLISHED';
    await this.prisma.dataImportJob.update({
      where: { id: importJobId },
      data: {
        status: finalStatus, publishedAt: new Date(), publishedByUserId: userId,
        rowsProcessed: inserted + updated + skipped + failed, rowsValid: inserted + updated, rowsInvalid: failed,
        publishSummaryJson: { insertedRows: inserted, updatedRows: updated, skippedRows: skipped, failedRows: failed },
      },
    });

    await this.emitAudit(userId, 'PAYROLL_OPENING_BALANCES_IMPORT_EXECUTED', importJobId, { insertedRows: inserted, updatedRows: updated, failedRows: failed, ...context });

    return { importJobId, status: finalStatus === 'FAILED' ? 'FAILED' : 'COMPLETED', results: { insertedRows: inserted, updatedRows: updated, skippedRows: skipped, failedRows: failed } };
  }

  async getJob(importJobId: string) {
    const job = await this.prisma.dataImportJob.findFirst({ where: { id: importJobId, tenantId: TENANT_ID, datasetType: 'PAYROLL_OPENING_BALANCES' } });
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

    const referenceValues = await this.buildOpeningBalancesReferenceValueRows();
    const meta = {
      import_job_id: job.id,
      file_name: job.fileName,
      dataset: 'PAYROLL_OPENING_BALANCES',
      job_status: job.status,
      generated_at_utc: new Date().toISOString(),
      error_rows: grouped.filter((r) => r.severity === 'ERROR').length,
      warning_rows: grouped.filter((r) => r.severity !== 'ERROR').length,
    };

    return format === 'xlsx'
      ? validationWorkbookToXlsx({ groupedRows: grouped, referenceValues, meta })
      : groupedErrorsToCsv(grouped);
  }

  // ─── Precheck (shared with export) ───────────────────────────────

  private async runPreflightValidation(
    buffer: Buffer,
    context: { countryCode: string; taxYear: number; asOfDate?: string },
  ): Promise<{
    issues: ValidationIssue[];
    validatedRows: ValidatedRow[];
    financialControl: OpeningBalancesFinancialControl;
    totalRows: number;
    sheetNames: string[];
  }> {
    let workbook: ParsedWorkbook;
    try {
      workbook = parseWorkbook(buffer, {
        headerDetectionMode: 'auto',
        columnAliases: OB_COLUMN_ALIASES,
      });
    } catch (err) {
      throw new BadRequestException(`Failed to parse workbook: ${(err as Error).message}`);
    }
    const sheetNames = workbook.sheetNames;
    const structureIssues = this.validateStructure(workbook);
    const hasStructureErrors = structureIssues.some((i) => i.severity === 'ERROR');
    const issues: ValidationIssue[] = [...structureIssues];
    let validatedRows: ValidatedRow[] = [];
    if (!hasStructureErrors) {
      const { validatedRows: vr, issues: vi } = await this.validateBalances(workbook, context);
      validatedRows = vr;
      issues.push(...vi);
    }
    const financialControl = this.buildFinancialControlFromRows(validatedRows, context);
    return {
      issues,
      validatedRows,
      financialControl,
      totalRows: this.countTotalRows(workbook),
      sheetNames,
    };
  }

  private buildAggregateYtdAlerts(
    ytdGross: number,
    ytdTaxable: number,
    ytdPaye: number,
    ytdNet: number,
  ): OpeningBalancesFinancialControl['alerts'] {
    const alerts: OpeningBalancesFinancialControl['alerts'] = [];
    const eps = 0.0005;
    if (ytdNet > ytdGross + eps) {
      alerts.push({
        code: 'AGG_NET_EXCEEDS_GROSS',
        severity: 'WARNING',
        message: `File total ytd_net (${ytdNet.toFixed(2)}) exceeds total ytd_gross (${ytdGross.toFixed(2)}). Review for data entry errors.`,
      });
    }
    if (ytdTaxable > ytdGross + eps) {
      alerts.push({
        code: 'AGG_TAXABLE_EXCEEDS_GROSS',
        severity: 'WARNING',
        message: `File total ytd_taxable (${ytdTaxable.toFixed(2)}) exceeds total ytd_gross (${ytdGross.toFixed(2)}).`,
      });
    }
    if (ytdPaye > ytdTaxable + eps) {
      alerts.push({
        code: 'AGG_PAYE_EXCEEDS_TAXABLE',
        severity: 'WARNING',
        message: `File total ytd_paye (${ytdPaye.toFixed(2)}) exceeds total ytd_taxable (${ytdTaxable.toFixed(2)}).`,
      });
    }
    return alerts;
  }

  private buildFinancialControlFromRows(
    validatedRows: ValidatedRow[],
    context: { countryCode: string; taxYear: number; asOfDate?: string },
  ): OpeningBalancesFinancialControl {
    let ytdGross = 0;
    let ytdTaxable = 0;
    let ytdPaye = 0;
    let ytdNet = 0;
    const employees = new Set<string>();

    for (const vr of validatedRows) {
      if (vr.sheet !== OB_SHEETS.PAYROLL_OPENING_BALANCES) continue;
      if (vr.issues.some((i) => i.severity === 'ERROR')) continue;
      const d = vr.data;
      const eno = String(d.employee_no ?? '').trim();
      if (eno) employees.add(eno);
      ytdGross += Number(d.ytd_gross ?? 0);
      ytdTaxable += Number(d.ytd_taxable ?? 0);
      ytdPaye += Number(d.ytd_paye ?? 0);
      ytdNet += Number(d.ytd_net ?? 0);
    }

    const alerts = this.buildAggregateYtdAlerts(ytdGross, ytdTaxable, ytdPaye, ytdNet);

    return {
      countryCode: context.countryCode,
      taxYear: context.taxYear,
      asOfDate: context.asOfDate ?? null,
      employeeCount: employees.size,
      ytdGross,
      ytdTaxable,
      ytdPaye,
      ytdNet,
      alerts,
    };
  }

  // ─── Validation ───────────────────────────────────────────────────

  private validateStructure(workbook: ParsedWorkbook): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const mainSheet = findSheet(workbook, OB_SHEETS.PAYROLL_OPENING_BALANCES);
    if (!mainSheet) {
      issues.push({
        sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES,
        rowNumber: 0,
        code: 'MISSING_REQUIRED_SHEET',
        severity: 'ERROR',
        message: 'Missing required sheet: payrollopeningbalances',
        suggestedFix: `Add the worksheet tab "${OB_SHEETS.PAYROLL_OPENING_BALANCES}" from the opening balances template.`,
        referenceSource: 'Opening balances import template',
      });
      return issues;
    }
    const requiredCols = REQUIRED_OB_COLUMNS[OB_SHEETS.PAYROLL_OPENING_BALANCES];
    for (const col of requiredCols) {
      if (!mainSheet.headers.includes(col)) {
        issues.push({
          sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES,
          rowNumber: 0,
          code: 'MISSING_REQUIRED_COLUMN',
          severity: 'ERROR',
          message: `Missing required column: ${col}`,
          fieldName: col,
          suggestedFix: `Add column ${col} to row 1 of ${OB_SHEETS.PAYROLL_OPENING_BALANCES}.`,
          referenceSource: 'Opening balances import template',
        });
      }
    }

    for (const optionalSheet of [OB_SHEETS.LEAVE_BALANCES, OB_SHEETS.LOAN_BALANCES]) {
      const sheet = findSheet(workbook, optionalSheet);
      if (!sheet) continue;
      const cols = REQUIRED_OB_COLUMNS[optionalSheet] ?? [];
      for (const col of cols) {
        if (!sheet.headers.includes(col)) {
          issues.push({
            sheet: optionalSheet,
            rowNumber: 0,
            code: 'MISSING_REQUIRED_COLUMN',
            severity: 'ERROR',
            message: `Missing required column: ${col}`,
            fieldName: col,
            suggestedFix: `Add column ${col} to row 1 of ${optionalSheet}.`,
            referenceSource: 'Opening balances import template',
          });
        }
      }
    }
    return issues;
  }

  private async validateBalances(workbook: ParsedWorkbook, context: { countryCode: string; taxYear: number }) {
    const employees = await this.prisma.employee.findMany({ select: { id: true, employeeNo: true, country: true } });
    const employeeMap = new Map(employees.map((e) => [e.employeeNo, e]));

    const validLeaveTypes = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'FAMILY', 'STUDY', 'UNPAID'];

    const existingBalances = await this.prisma.employeePayrollOpeningBalance.findMany({
      select: { employeeId: true, taxYear: true },
    });
    const existingBalKeys = new Set(existingBalances.map((b) => `${b.employeeId}|${b.taxYear}`));

    const allIssues: ValidationIssue[] = [];
    const allRows: ValidatedRow[] = [];
    let globalRowCounter = 0;

    // PayrollOpeningBalances
    const balSheet = findSheet(workbook, OB_SHEETS.PAYROLL_OPENING_BALANCES);
    if (balSheet) {
      const seenKeys = new Set<string>();
      for (let i = 0; i < balSheet.rows.length; i++) {
        globalRowCounter++;
        const sheetRowNum = i + 2;
        const row = balSheet.rows[i];
        const issues: ValidationIssue[] = [];

        const empNo = String(row.employee_no ?? '').trim();
        const taxYear = parseNumeric(row.tax_year) ?? context.taxYear;
        const ytdGross = parseNumeric(row.ytd_gross);
        const ytdTaxable = parseNumeric(row.ytd_taxable);
        const ytdPaye = parseNumeric(row.ytd_paye);
        const ytdNet = parseNumeric(row.ytd_net);
        const ytdUifEmp = parseNumeric(row.ytd_uif_employee);
        const ytdUifEr = parseNumeric(row.ytd_uif_employer);
        const ytdSdl = parseNumeric(row.ytd_sdl);
        const ytdEmployerCost = parseNumeric(row.ytd_employer_cost);
        const businessKey = `${empNo}|${taxYear}`;

        if (!empNo) issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required' });
        if (ytdGross === null) issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_NUMERIC_VALUE', severity: 'ERROR', message: 'ytd_gross must be numeric' });
        if (ytdTaxable === null) issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_NUMERIC_VALUE', severity: 'ERROR', message: 'ytd_taxable must be numeric' });
        if (ytdPaye === null) issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_NUMERIC_VALUE', severity: 'ERROR', message: 'ytd_paye must be numeric' });
        if (ytdNet === null) issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_NUMERIC_VALUE', severity: 'ERROR', message: 'ytd_net must be numeric' });

        if (ytdTaxable !== null && ytdGross !== null && ytdTaxable > ytdGross) {
          issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, businessKey, code: 'YTD_TAXABLE_EXCEEDS_GROSS', severity: 'ERROR', message: 'YTD taxable cannot exceed YTD gross' });
        }
        if (ytdNet !== null && ytdGross !== null && ytdNet > ytdGross) {
          issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, businessKey, code: 'YTD_NET_EXCEEDS_GROSS', severity: 'ERROR', message: 'YTD net cannot exceed YTD gross' });
        }
        if (ytdPaye !== null && ytdPaye < 0) {
          issues.push({ sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: sheetRowNum, code: 'NEGATIVE_YTD_VALUE_NOT_ALLOWED', severity: 'ERROR', message: 'YTD PAYE cannot be negative' });
        }

        const emp = empNo ? employeeMap.get(empNo) : undefined;
        if (empNo && !emp) {
          issues.push({
            sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES,
            rowNumber: sheetRowNum,
            businessKey,
            code: 'EMPLOYEE_NOT_FOUND',
            severity: 'ERROR',
            message: `Employee ${empNo} not found in payroll.`,
            fieldName: 'employee_no',
            currentValue: empNo,
          });
        }

        if (seenKeys.has(businessKey)) {
          issues.push({
            sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES,
            rowNumber: sheetRowNum,
            businessKey,
            code: 'DUPLICATE_ROW_IN_FILE',
            severity: 'ERROR',
            message: `Duplicate opening balance row: key "${businessKey}" already appears earlier in this sheet.`,
            suggestedFix: `Keep a single row per employee and tax year. Remove or edit duplicates for key "${businessKey}".`,
            referenceSource: 'Import file uniqueness rules',
          });
        }
        seenKeys.add(businessKey);

        const existsKey = emp ? `${emp.id}|${taxYear}` : '';
        const action = existsKey && existingBalKeys.has(existsKey) ? 'UPDATE' : 'INSERT';
        const hasErrors = issues.some((i) => i.severity === 'ERROR');

        allIssues.push(...issues);
        allRows.push({
          sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, rowNumber: globalRowCounter, sheetRowNumber: sheetRowNum, businessKey,
          data: { _sheet: OB_SHEETS.PAYROLL_OPENING_BALANCES, _sheetRow: sheetRowNum, _action: hasErrors ? 'FAIL' : action, employee_no: empNo, employee_id: emp?.id, tax_year: taxYear, ytd_gross: ytdGross, ytd_taxable: ytdTaxable, ytd_paye: ytdPaye, ytd_net: ytdNet, ytd_uif_employee: ytdUifEmp, ytd_uif_employer: ytdUifEr, ytd_sdl: ytdSdl, ytd_employer_cost: ytdEmployerCost, country_code: context.countryCode },
          action: hasErrors ? 'SKIP' : (action as any), issues,
        });
      }
    }

    // LeaveBalances
    const leaveSheet = findSheet(workbook, OB_SHEETS.LEAVE_BALANCES);
    if (leaveSheet) {
      const seenKeys = new Set<string>();
      for (let i = 0; i < leaveSheet.rows.length; i++) {
        globalRowCounter++;
        const sheetRowNum = i + 2;
        const row = leaveSheet.rows[i];
        const issues: ValidationIssue[] = [];

        const empNo = String(row.employee_no ?? '').trim();
        const leaveType = String(row.leave_type ?? '').trim().toUpperCase();
        const balance = parseNumeric(row.balance);
        const asOfDate = parseDate(row.as_of_date);
        const businessKey = `${empNo}|${leaveType}|${asOfDate}`;

        if (!empNo) issues.push({ sheet: OB_SHEETS.LEAVE_BALANCES, rowNumber: sheetRowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required' });
        if (!leaveType) issues.push({ sheet: OB_SHEETS.LEAVE_BALANCES, rowNumber: sheetRowNum, code: 'REQUIRED', severity: 'ERROR', message: 'leave_type is required' });
        if (balance === null) issues.push({ sheet: OB_SHEETS.LEAVE_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_LEAVE_BALANCE', severity: 'ERROR', message: 'balance must be numeric' });
        if (!asOfDate) issues.push({ sheet: OB_SHEETS.LEAVE_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_DATE', severity: 'ERROR', message: 'as_of_date is required' });

        if (leaveType && !validLeaveTypes.includes(leaveType)) {
          issues.push({
            sheet: OB_SHEETS.LEAVE_BALANCES,
            rowNumber: sheetRowNum,
            code: 'INVALID_LEAVE_TYPE',
            severity: 'ERROR',
            message: `Invalid leave type: ${leaveType}`,
            fieldName: 'leave_type',
            currentValue: leaveType,
            allowedValuesHint: validLeaveTypes,
          });
        }
        if (balance !== null && balance < 0) issues.push({ sheet: OB_SHEETS.LEAVE_BALANCES, rowNumber: sheetRowNum, code: 'NEGATIVE_LEAVE_WARNING', severity: 'WARNING', message: 'Negative leave balance imported for review' });

        const emp = empNo ? employeeMap.get(empNo) : undefined;
        if (empNo && !emp) {
          issues.push({
            sheet: OB_SHEETS.LEAVE_BALANCES,
            rowNumber: sheetRowNum,
            businessKey,
            code: 'EMPLOYEE_NOT_FOUND',
            severity: 'ERROR',
            message: `Employee ${empNo} not found in payroll.`,
            fieldName: 'employee_no',
            currentValue: empNo,
          });
        }

        if (seenKeys.has(businessKey)) {
          issues.push({
            sheet: OB_SHEETS.LEAVE_BALANCES,
            rowNumber: sheetRowNum,
            businessKey,
            code: 'DUPLICATE_ROW_IN_FILE',
            severity: 'ERROR',
            message: `Duplicate leave balance row: key "${businessKey}" already appears earlier in this sheet.`,
            suggestedFix: `Keep one row per employee, leave type, and as-of date. Adjust duplicates for key "${businessKey}".`,
            referenceSource: 'Import file uniqueness rules',
          });
        }
        seenKeys.add(businessKey);

        const hasErrors = issues.some((i) => i.severity === 'ERROR');
        allIssues.push(...issues);
        allRows.push({ sheet: OB_SHEETS.LEAVE_BALANCES, rowNumber: globalRowCounter, sheetRowNumber: sheetRowNum, businessKey, data: { _sheet: OB_SHEETS.LEAVE_BALANCES, _sheetRow: sheetRowNum, _action: hasErrors ? 'FAIL' : 'INSERT', employee_no: empNo, employee_id: emp?.id, leave_type: leaveType, balance, as_of_date: asOfDate, unit: row.unit ? String(row.unit).trim() : 'DAYS' }, action: hasErrors ? 'SKIP' : 'INSERT', issues });
      }
    }

    // LoanBalances
    const loanSheet = findSheet(workbook, OB_SHEETS.LOAN_BALANCES);
    if (loanSheet) {
      const seenKeys = new Set<string>();
      for (let i = 0; i < loanSheet.rows.length; i++) {
        globalRowCounter++;
        const sheetRowNum = i + 2;
        const row = loanSheet.rows[i];
        const issues: ValidationIssue[] = [];

        const empNo = String(row.employee_no ?? '').trim();
        const deductionCode = String(row.deduction_code ?? '').trim().toUpperCase();
        const remainingBalance = parseNumeric(row.remaining_balance);
        const installmentAmount = parseNumeric(row.installment_amount);
        const asOfDate = parseDate(row.as_of_date);
        const businessKey = `${empNo}|${deductionCode}|${asOfDate}`;

        if (!empNo) issues.push({ sheet: OB_SHEETS.LOAN_BALANCES, rowNumber: sheetRowNum, code: 'REQUIRED', severity: 'ERROR', message: 'employee_no is required' });
        if (!deductionCode) issues.push({ sheet: OB_SHEETS.LOAN_BALANCES, rowNumber: sheetRowNum, code: 'REQUIRED', severity: 'ERROR', message: 'deduction_code is required' });
        if (remainingBalance === null) issues.push({ sheet: OB_SHEETS.LOAN_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_REMAINING_BALANCE', severity: 'ERROR', message: 'remaining_balance must be numeric' });
        if (!asOfDate) issues.push({ sheet: OB_SHEETS.LOAN_BALANCES, rowNumber: sheetRowNum, code: 'INVALID_DATE', severity: 'ERROR', message: 'as_of_date is required' });
        if (installmentAmount === null && remainingBalance !== null) issues.push({ sheet: OB_SHEETS.LOAN_BALANCES, rowNumber: sheetRowNum, code: 'INSTALLMENT_AMOUNT_MISSING', severity: 'WARNING', message: 'Loan imported without installment amount' });

        const emp = empNo ? employeeMap.get(empNo) : undefined;
        if (empNo && !emp) {
          issues.push({
            sheet: OB_SHEETS.LOAN_BALANCES,
            rowNumber: sheetRowNum,
            businessKey,
            code: 'EMPLOYEE_NOT_FOUND',
            severity: 'ERROR',
            message: `Employee ${empNo} not found in payroll.`,
            fieldName: 'employee_no',
            currentValue: empNo,
          });
        }

        if (seenKeys.has(businessKey)) {
          issues.push({
            sheet: OB_SHEETS.LOAN_BALANCES,
            rowNumber: sheetRowNum,
            businessKey,
            code: 'DUPLICATE_ROW_IN_FILE',
            severity: 'ERROR',
            message: `Duplicate loan balance row: key "${businessKey}" already appears earlier in this sheet.`,
            suggestedFix: `Keep one row per employee, deduction code, and as-of date. Adjust duplicates for key "${businessKey}".`,
            referenceSource: 'Import file uniqueness rules',
          });
        }
        seenKeys.add(businessKey);

        const hasErrors = issues.some((i) => i.severity === 'ERROR');
        allIssues.push(...issues);
        allRows.push({ sheet: OB_SHEETS.LOAN_BALANCES, rowNumber: globalRowCounter, sheetRowNumber: sheetRowNum, businessKey, data: { _sheet: OB_SHEETS.LOAN_BALANCES, _sheetRow: sheetRowNum, _action: hasErrors ? 'FAIL' : 'INSERT', employee_no: empNo, employee_id: emp?.id, deduction_code: deductionCode, remaining_balance: remainingBalance, installment_amount: installmentAmount, original_balance: parseNumeric(row.original_balance), as_of_date: asOfDate, reference_no: row.reference_no ? String(row.reference_no).trim() : null }, action: hasErrors ? 'SKIP' : 'INSERT', issues });
      }
    }

    return { validatedRows: allRows, issues: allIssues };
  }

  // ─── Persistence ──────────────────────────────────────────────────

  private async persistOpeningBalance(data: Record<string, unknown>, context: Record<string, unknown>) {
    const employeeId = data.employee_id as string;
    const taxYear = data.tax_year as number;
    const countryCode = (data.country_code ?? context.countryCode ?? 'ZA') as string;

    await this.prisma.employeePayrollOpeningBalance.upsert({
      where: { employeeId_taxYear: { employeeId, taxYear } },
      update: {
        ytdGross: Number(data.ytd_gross), ytdTaxable: Number(data.ytd_taxable), ytdPaye: Number(data.ytd_paye), ytdNet: Number(data.ytd_net),
        ytdUifEmployee: data.ytd_uif_employee != null ? Number(data.ytd_uif_employee) : null,
        ytdUifEmployer: data.ytd_uif_employer != null ? Number(data.ytd_uif_employer) : null,
        ytdSdl: data.ytd_sdl != null ? Number(data.ytd_sdl) : null,
        ytdEmployerCost: data.ytd_employer_cost != null ? Number(data.ytd_employer_cost) : null,
        countryCode,
      },
      create: {
        employeeId, countryCode, taxYear,
        ytdGross: Number(data.ytd_gross), ytdTaxable: Number(data.ytd_taxable), ytdPaye: Number(data.ytd_paye), ytdNet: Number(data.ytd_net),
        ytdUifEmployee: data.ytd_uif_employee != null ? Number(data.ytd_uif_employee) : null,
        ytdUifEmployer: data.ytd_uif_employer != null ? Number(data.ytd_uif_employer) : null,
        ytdSdl: data.ytd_sdl != null ? Number(data.ytd_sdl) : null,
        ytdEmployerCost: data.ytd_employer_cost != null ? Number(data.ytd_employer_cost) : null,
      },
    });
  }

  private async persistLeaveBalance(data: Record<string, unknown>) {
    const employeeId = data.employee_id as string;
    const leaveType = data.leave_type as string;
    const asOfDate = new Date(data.as_of_date as string);

    await this.prisma.employeeLeaveOpeningBalance.upsert({
      where: { employeeId_leaveType_asOfDate: { employeeId, leaveType, asOfDate } },
      update: { balance: Number(data.balance), unit: (data.unit as string) ?? 'DAYS' },
      create: { employeeId, leaveType, balance: Number(data.balance), asOfDate, unit: (data.unit as string) ?? 'DAYS' },
    });
  }

  private async persistLoanBalance(data: Record<string, unknown>) {
    const employeeId = data.employee_id as string;
    const deductionCode = data.deduction_code as string;
    const asOfDate = new Date(data.as_of_date as string);

    await this.prisma.employeeLoanOpeningBalance.upsert({
      where: { employeeId_deductionCode_asOfDate: { employeeId, deductionCode, asOfDate } },
      update: {
        remainingBalance: Number(data.remaining_balance),
        installmentAmount: data.installment_amount != null ? Number(data.installment_amount) : null,
        originalBalance: data.original_balance != null ? Number(data.original_balance) : null,
        referenceNo: data.reference_no as string | null,
      },
      create: {
        employeeId, deductionCode, asOfDate,
        remainingBalance: Number(data.remaining_balance),
        installmentAmount: data.installment_amount != null ? Number(data.installment_amount) : null,
        originalBalance: data.original_balance != null ? Number(data.original_balance) : null,
        referenceNo: data.reference_no as string | null,
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private countTotalRows(workbook: ParsedWorkbook): number {
    const relevantSheets = Object.values(OB_SHEETS) as string[];
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

  private async buildOpeningBalancesReferenceValueRows(): Promise<ReferenceValueRow[]> {
    const payItems = await this.prisma.payItem.findMany({ select: { code: true, type: true } });
    const rows: ReferenceValueRow[] = [];
    const leaveTypes = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'FAMILY', 'STUDY', 'UNPAID'];
    for (const lt of leaveTypes) {
      rows.push({ reference_domain: 'leave_type', code: lt, description: 'leavebalances.leave_type' });
    }
    for (const pi of [...payItems].filter((p) => p.type === 'DEDUCTION').sort((a, b) => a.code.localeCompare(b.code))) {
      rows.push({
        reference_domain: 'deduction_code',
        code: pi.code,
        description: 'loanbalances.deduction_code (deduction pay items)',
      });
    }
    return rows;
  }

  private async storeValidatedRows(jobId: string, rows: ValidatedRow[]) {
    if (rows.length === 0) return;
    await this.prisma.dataImportRow.createMany({
      data: rows.map((row) => ({
        jobId, rowNumber: row.rowNumber,
        sheetName: row.sheet, sheetRowNumber: row.sheetRowNumber,
        externalKey: row.businessKey,
        payloadJson: row.data as object, mappedJson: row.data as object,
        status: row.issues.some((i) => i.severity === 'ERROR') ? 'INVALID' : 'VALID',
        errorsCount: row.issues.filter((i) => i.severity === 'ERROR').length,
        warningsCount: row.issues.filter((i) => i.severity === 'WARNING').length,
      })),
    });
  }

  private async emitAudit(userId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await this.auditService.log({ userId, action, entityType: 'DataImportJob', entityId, newValue: { importType: 'PAYROLL_OPENING_BALANCES', ...metadata } });
  }
}
