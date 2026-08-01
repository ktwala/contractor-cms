import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';

/** Stored on `DataImportError.detailsJson` and used when building grouped export rows */
export type DataImportErrorDetails = {
  currentValue?: string;
  suggestedFix?: string;
  referenceSource?: string;
  duplicateKey?: string;
  /** Sample of allowed reference codes / enum values */
  allowedValues?: string[];
};

export type GroupedExportErrorRow = {
  sheet: string;
  row: number | string;
  field: string;
  code: string;
  current_value: string;
  message: string;
  suggested_fix: string;
  severity: string;
  reference_source: string;
};

export type ReferenceValueRow = {
  reference_domain: string;
  code: string;
  description: string;
};

export type ValidationSummary = {
  job_id: string;
  dataset_type: string;
  file_name: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: number;
  warnings: number;
  validated_at?: string;
};

export const GROUPED_ERROR_COLUMNS = [
  'sheet',
  'row',
  'field',
  'code',
  'current_value',
  'message',
  'suggested_fix',
  'severity',
  'reference_source',
] as const;

/** Legacy flat shape (still accepted by CSV path mappers) */
export type ExportErrorRow = {
  sheet_name?: string;
  sheet_row_number?: number;
  row_number: number;
  business_key?: string;
  error_code: string;
  message: string;
  field_name?: string;
  severity: string;
};

const KNOWN_IMPORT_SHEET_KEYS = new Set([
  'compensation',
  'bankaccounts',
  'recurringdeductions',
  'payrolleligibility',
  'payrollopeningbalances',
  'leavebalances',
  'loanbalances',
]);

export const ERROR_CODE_CUSTOMER_GUIDANCE: Record<
  string,
  { suggested_fix: string; reference_source: string }
> = {
  DEPRECATED_SHEET: {
    suggested_fix:
      'Delete the deprecated sheet from the workbook. Supplemental import does not read legacy withholding tabs; configure withholding via the main payroll template and statutory returns instead.',
    reference_source: 'Supplemental payroll import specification',
  },
  EMPLOYEE_NOT_FOUND: {
    suggested_fix:
      'Verify employee_no matches an active employee in payroll. If the person is new, import them first using the Bootstrap (organisation) employee import, then rerun this file.',
    reference_source: 'Employee master (Bootstrap organisation import)',
  },
  DUPLICATE_ROW_IN_FILE: {
    suggested_fix:
      'Locate the other row(s) with the same business key and remove or change duplicates so each key appears only once in this sheet.',
    reference_source: 'Import file uniqueness rules',
  },
  PAY_GROUP_NOT_FOUND: {
    suggested_fix:
      'Set pay_group_code to one of the configured pay groups for your tenant (see Reference Values).',
    reference_source: 'Pay group catalog',
  },
  INVALID_DEDUCTION_CODE: {
    suggested_fix:
      'Set deduction_code to a configured pay item code of type deduction (see Reference Values).',
    reference_source: 'Pay items catalog',
  },
  INVALID_PAYROLL_STATUS: {
    suggested_fix: 'Use ELIGIBLE, HOLD, or EXCLUDED (see Reference Values).',
    reference_source: 'Payroll eligibility enumeration',
  },
  INVALID_COMPONENT_TYPE: {
    suggested_fix: 'Use EARNING or ALLOWANCE.',
    reference_source: 'Compensation component enumeration',
  },
  INVALID_ACCOUNT_TYPE: {
    suggested_fix: 'Use CHEQUE, SAVINGS, or CURRENT.',
    reference_source: 'Bank account type enumeration',
  },
  MISSING_REQUIRED_SHEET: {
    suggested_fix:
      'Add the missing sheet using the official supplemental template so all required tabs are present.',
    reference_source: 'Supplemental import template',
  },
  MISSING_REQUIRED_COLUMN: {
    suggested_fix:
      'Add the missing column header on that sheet exactly as named in the template (lowercase, underscores).',
    reference_source: 'Supplemental import template',
  },
  REQUIRED: {
    suggested_fix: 'Enter a value for this required field.',
    reference_source: 'Column requirements',
  },
  INVALID_DATE: {
    suggested_fix: 'Use a recognizable date format (ISO yyyy-mm-dd recommended).',
    reference_source: 'Date parsing rules',
  },
  INVALID_NUMERIC_VALUE: {
    suggested_fix: 'Enter a plain number without currency symbols or thousands separators.',
    reference_source: 'Numeric field rules',
  },
  NEGATIVE_AMOUNT_NOT_ALLOWED: {
    suggested_fix: 'Use a zero or positive amount for recurring deductions.',
    reference_source: 'Recurring deduction rules',
  },
  BANK_ACCOUNT_UNVERIFIED: {
    suggested_fix:
      'Confirm bank details with the employee and set verified to TRUE before production payroll, or accept the warning if you intend to import as unverified.',
    reference_source: 'Bank account verification policy',
  },
  REASON_MISSING_FOR_HOLD_STATUS: {
    suggested_fix:
      'Add a short reason in the reason column so payroll and audit teams understand why the employee is on HOLD or EXCLUDED.',
    reference_source: 'Payroll eligibility best practice',
  },
  INVALID_LEAVE_TYPE: {
    suggested_fix: 'Use one of the supported leave_type codes (see Reference Values).',
    reference_source: 'Leave balance import enumeration',
  },
  YTD_TAXABLE_EXCEEDS_GROSS: {
    suggested_fix: 'Ensure ytd_taxable is less than or equal to ytd_gross for the same employee and tax year.',
    reference_source: 'Opening balance consistency checks',
  },
  YTD_NET_EXCEEDS_GROSS: {
    suggested_fix: 'Ensure ytd_net is less than or equal to ytd_gross for the same employee and tax year.',
    reference_source: 'Opening balance consistency checks',
  },
  NEGATIVE_YTD_VALUE_NOT_ALLOWED: {
    suggested_fix: 'YTD PAYE should be zero or positive unless your statutory profile explicitly allows negatives.',
    reference_source: 'Opening balance rules',
  },
  INVALID_LEAVE_BALANCE: {
    suggested_fix: 'Enter balance as a number (days or hours depending on unit).',
    reference_source: 'Leave balance column rules',
  },
  INVALID_REMAINING_BALANCE: {
    suggested_fix: 'Enter remaining_balance as a number.',
    reference_source: 'Loan balance column rules',
  },
  INSTALLMENT_AMOUNT_MISSING: {
    suggested_fix: 'Provide installment_amount when possible so payroll can schedule recoveries.',
    reference_source: 'Loan balance best practice',
  },
  NEGATIVE_LEAVE_WARNING: {
    suggested_fix: 'Confirm the negative balance is intentional (e.g. advance leave) before importing.',
    reference_source: 'Leave policy',
  },
};

function joinAllowed(values: string[] | undefined, max = 80): string {
  if (!values?.length) return '';
  const shown = values.slice(0, max);
  const extra = values.length > max ? ` … (+${values.length - max} more)` : '';
  return `${shown.join(', ')}${extra}`;
}

export function mergeSuggestedFix(
  primary: string | undefined,
  code: string,
  details: DataImportErrorDetails,
): string {
  const fromAllowed = details.allowedValues?.length
    ? ` Valid values include: ${joinAllowed(details.allowedValues)}.`
    : '';
  const dup = details.duplicateKey
    ? ` Duplicate key: ${details.duplicateKey}.`
    : '';
  const base = primary || ERROR_CODE_CUSTOMER_GUIDANCE[code]?.suggested_fix || '';
  return `${base}${fromAllowed}${dup}`.trim();
}

export function mergeReferenceSource(primary: string | undefined, code: string): string {
  return (
    primary ||
    ERROR_CODE_CUSTOMER_GUIDANCE[code]?.reference_source ||
    'Data import validation'
  );
}

/** Map in-memory validation issues (precheck or live validation) to grouped export rows */
export function validationIssuesToGroupedRows(
  issues: Array<{
    sheet: string;
    rowNumber: number;
    fieldName?: string;
    code: string;
    severity: string;
    message: string;
    currentValue?: string;
    suggestedFix?: string;
    referenceSource?: string;
    allowedValuesHint?: string[];
    businessKey?: string;
  }>,
): GroupedExportErrorRow[] {
  return issues.map((issue) => {
    const details: DataImportErrorDetails = {
      currentValue: issue.currentValue,
      suggestedFix: issue.suggestedFix,
      referenceSource: issue.referenceSource,
      allowedValues: issue.allowedValuesHint,
      duplicateKey: issue.code === 'DUPLICATE_ROW_IN_FILE' ? issue.businessKey : undefined,
    };
    return {
      sheet: issue.sheet,
      row: issue.rowNumber,
      field: issue.fieldName ?? '',
      code: issue.code,
      current_value: issue.currentValue ?? '',
      message: issue.message,
      suggested_fix: mergeSuggestedFix(issue.suggestedFix, issue.code, details),
      severity: issue.severity,
      reference_source: mergeReferenceSource(issue.referenceSource, issue.code),
    };
  });
}

function parseDetails(raw: unknown): DataImportErrorDetails {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.map((x) => String(x)) : undefined;
  return {
    currentValue: o.currentValue != null ? String(o.currentValue) : o.current_value != null ? String(o.current_value) : undefined,
    suggestedFix: o.suggestedFix != null ? String(o.suggestedFix) : o.suggested_fix != null ? String(o.suggested_fix) : undefined,
    referenceSource:
      o.referenceSource != null ? String(o.referenceSource) : o.reference_source != null ? String(o.reference_source) : undefined,
    duplicateKey: o.duplicateKey != null ? String(o.duplicateKey) : o.duplicate_key != null ? String(o.duplicate_key) : undefined,
    allowedValues: arr(o.allowedValues ?? o.allowed_values),
  };
}

/**
 * Legacy rows stored `sheet` in `field_name`. Prefer `sheet_name` + `field_name` when present.
 */
export function legacySheetFromFieldName(fieldName: string | null | undefined): string | undefined {
  if (!fieldName) return undefined;
  const lower = fieldName.toLowerCase();
  if (KNOWN_IMPORT_SHEET_KEYS.has(lower)) return lower;
  return undefined;
}

export type DbErrorExportInput = {
  sheetName: string | null;
  fieldName: string | null;
  rowNumber: number | null;
  errorCode: string;
  message: string;
  severity: string;
  detailsJson: unknown;
  matchedSheetName?: string | null;
  matchedSheetRowNumber?: number | null;
};

export function dbValidationErrorToGroupedRow(e: DbErrorExportInput): GroupedExportErrorRow {
  const details = parseDetails(e.detailsJson);
  const legacySheet = legacySheetFromFieldName(e.fieldName);
  const sheet = e.sheetName ?? e.matchedSheetName ?? legacySheet ?? '';
  /** Before sheet_name existed, `field_name` often held the worksheet key instead of the column. */
  const storedFieldWasSheet =
    !e.sheetName && !!legacySheet && (e.fieldName ?? '').toLowerCase() === legacySheet;
  const field = storedFieldWasSheet ? '' : e.fieldName ?? '';

  const row = e.matchedSheetRowNumber ?? e.rowNumber ?? '';

  return {
    sheet,
    row,
    field,
    code: e.errorCode,
    current_value: details.currentValue ?? '',
    message: e.message,
    suggested_fix: mergeSuggestedFix(details.suggestedFix, e.errorCode, details),
    severity: e.severity,
    reference_source: mergeReferenceSource(details.referenceSource, e.errorCode),
  };
}

export function buildSummarySheetRows(
  grouped: GroupedExportErrorRow[],
  meta: Record<string, string | number | undefined>,
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];

  rows.push({
    category: 'OVERVIEW',
    item: 'title',
    errors: '',
    warnings: '',
    detail: 'Payroll data validation summary (share this workbook with data owners)',
  });
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) {
      rows.push({ category: 'OVERVIEW', item: k, errors: '', warnings: '', detail: String(v) });
    }
  }
  rows.push({ category: '', item: '', errors: '', warnings: '', detail: '' });

  const sheetMap = new Map<string, { errors: number; warnings: number }>();
  const codeMap = new Map<string, { errors: number; warnings: number }>();
  const sevMap = new Map<string, number>();

  for (const g of grouped) {
    const s = g.sheet || '(workbook)';
    if (!sheetMap.has(s)) sheetMap.set(s, { errors: 0, warnings: 0 });
    const se = sheetMap.get(s)!;
    if (g.severity === 'ERROR') se.errors += 1;
    else se.warnings += 1;

    if (!codeMap.has(g.code)) codeMap.set(g.code, { errors: 0, warnings: 0 });
    const ce = codeMap.get(g.code)!;
    if (g.severity === 'ERROR') ce.errors += 1;
    else ce.warnings += 1;

    sevMap.set(g.severity, (sevMap.get(g.severity) ?? 0) + 1);
  }

  rows.push({
    category: 'BY_SHEET',
    item: '_header',
    errors: 'error_rows',
    warnings: 'warning_rows',
    detail: 'Counts of validation rows by source sheet',
  });
  for (const [sheet, c] of [...sheetMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ category: 'BY_SHEET', item: sheet, errors: c.errors, warnings: c.warnings, detail: '' });
  }
  rows.push({ category: '', item: '', errors: '', warnings: '', detail: '' });

  rows.push({
    category: 'BY_SEVERITY',
    item: '_header',
    errors: 'row_count',
    warnings: '',
    detail: 'All messages (errors + warnings) by severity label',
  });
  for (const [sev, n] of [...sevMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ category: 'BY_SEVERITY', item: sev, errors: n, warnings: '', detail: '' });
  }
  rows.push({ category: '', item: '', errors: '', warnings: '', detail: '' });

  rows.push({
    category: 'BY_CODE',
    item: '_header',
    errors: 'error_rows',
    warnings: 'warning_rows',
    detail: 'Counts by validation error_code',
  });
  for (const [code, c] of [...codeMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ category: 'BY_CODE', item: code, errors: c.errors, warnings: c.warnings, detail: '' });
  }

  return rows;
}

export function buildHowToFixRows(codes: Iterable<string>): Record<string, string>[] {
  const unique = [...new Set(codes)].sort();
  const rows: Record<string, string>[] = [];
  for (const code of unique) {
    const g = ERROR_CODE_CUSTOMER_GUIDANCE[code];
    rows.push({
      error_code: code,
      what_it_means: g?.reference_source ?? 'Validation rule triggered for this import.',
      what_to_do: g?.suggested_fix ?? 'Review the Errors sheet row for this code, correct the source cell, and re-upload.',
    });
  }
  if (rows.length === 0) {
    rows.push({
      error_code: '(none)',
      what_it_means: 'No validation messages.',
      what_to_do: 'No action required.',
    });
  }
  return rows;
}

export function groupedErrorsToCsv(rows: GroupedExportErrorRow[]): Buffer {
  const csv = Papa.unparse(rows, {
    columns: [...GROUPED_ERROR_COLUMNS],
    header: true,
  });
  return Buffer.from(csv, 'utf-8');
}

/** @deprecated Use groupedErrorsToCsv(validationIssuesToGroupedRows(...)) */
export function errorsToCsv(rows: ExportErrorRow[]): Buffer {
  const grouped: GroupedExportErrorRow[] = rows.map((r) => ({
    sheet: r.sheet_name ?? '',
    row: r.sheet_row_number ?? r.row_number,
    field: r.field_name ?? '',
    code: r.error_code,
    current_value: '',
    message: r.message,
    suggested_fix: r.business_key ? `Related key: ${r.business_key}` : '',
    severity: r.severity,
    reference_source: '',
  }));
  return groupedErrorsToCsv(grouped);
}

export type ValidationWorkbookInput = {
  groupedRows: GroupedExportErrorRow[];
  referenceValues: ReferenceValueRow[];
  meta?: Record<string, string | number | undefined>;
};

export function validationWorkbookToXlsx(input: ValidationWorkbookInput): Buffer {
  const { groupedRows, referenceValues, meta = {} } = input;
  const wb = XLSX.utils.book_new();

  const summaryRows = buildSummarySheetRows(groupedRows, meta);
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const errorsOnly = groupedRows.filter((r) => r.severity === 'ERROR');
  const warningsOnly = groupedRows.filter((r) => r.severity !== 'ERROR');

  const mk = (data: GroupedExportErrorRow[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [Object.fromEntries([...GROUPED_ERROR_COLUMNS].map((c) => [c, '']))], {
      header: [...GROUPED_ERROR_COLUMNS],
    });
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  mk(errorsOnly, 'Errors');
  mk(warningsOnly, 'Warnings');

  const refSheet = XLSX.utils.json_to_sheet(
    referenceValues.length
      ? referenceValues
      : [{ reference_domain: '(none)', code: '', description: 'No reference snapshot for this export.' }],
  );
  XLSX.utils.book_append_sheet(wb, refSheet, 'Reference Values');

  const how = buildHowToFixRows(groupedRows.map((r) => r.code));
  const howSheet = XLSX.utils.json_to_sheet(how);
  XLSX.utils.book_append_sheet(wb, howSheet, 'How to Fix');

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** @deprecated Use validationWorkbookToXlsx */
export function errorsToXlsx(rows: ExportErrorRow[]): Buffer {
  return validationWorkbookToXlsx({
    groupedRows: rows.map((r) => ({
      sheet: r.sheet_name ?? '',
      row: r.sheet_row_number ?? r.row_number,
      field: r.field_name ?? '',
      code: r.error_code,
      current_value: '',
      message: r.message,
      suggested_fix: r.business_key ? `Related key: ${r.business_key}` : '',
      severity: r.severity,
      reference_source: '',
    })),
    referenceValues: [],
    meta: { source: 'legacy_export_adapter' },
  });
}

export function validationReportToXlsx(summary: ValidationSummary, grouped: GroupedExportErrorRow[]): Buffer {
  const meta: Record<string, string | number | undefined> = {
    job_id: summary.job_id,
    dataset_type: summary.dataset_type,
    file_name: summary.file_name,
    status: summary.status,
    total_rows: summary.total_rows,
    valid_rows: summary.valid_rows,
    invalid_rows: summary.invalid_rows,
    errors: summary.errors,
    warnings: summary.warnings,
    validated_at: summary.validated_at,
  };
  return validationWorkbookToXlsx({
    groupedRows: grouped,
    referenceValues: [],
    meta,
  });
}
