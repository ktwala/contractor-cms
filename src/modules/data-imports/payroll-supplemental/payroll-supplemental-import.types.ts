export interface ValidationIssue {
  sheet: string;
  rowNumber: number;
  businessKey?: string;
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  fieldName?: string;
  /** Raw cell / parsed value that failed validation (for customer exports) */
  currentValue?: string;
  suggestedFix?: string;
  referenceSource?: string;
  /** Shown in suggested_fix / Reference Values context for invalid code fields */
  allowedValuesHint?: string[];
}

export interface PreviewSection {
  rows: number;
  toInsert: number;
  toUpdate: number;
  toSkip: number;
  failed: number;
}

export interface SupplementalPreviewResponse {
  importJobId: string;
  status: 'READY_TO_IMPORT' | 'FAILED';
  sections: {
    compensation: PreviewSection;
    bankAccounts: PreviewSection;
    recurringDeductions: PreviewSection;
    payrollEligibility: PreviewSection;
  };
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

export interface ImportExecutionResult {
  importJobId: string;
  status: 'COMPLETED' | 'FAILED';
  results: {
    insertedRows: number;
    updatedRows: number;
    skippedRows: number;
    failedRows: number;
  };
}

export const SUPPLEMENTAL_SHEETS = {
  COMPENSATION: 'compensation',
  BANK_ACCOUNTS: 'bankaccounts',
  RECURRING_DEDUCTIONS: 'recurringdeductions',
  PAYROLL_ELIGIBILITY: 'payrolleligibility',
} as const;

export const REQUIRED_SHEETS = [
  SUPPLEMENTAL_SHEETS.COMPENSATION,
  SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS,
  SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS,
  SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY,
];

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  [SUPPLEMENTAL_SHEETS.COMPENSATION]: [
    'employee_no', 'effective_from', 'component_code', 'component_type', 'amount', 'frequency', 'currency',
  ],
  [SUPPLEMENTAL_SHEETS.BANK_ACCOUNTS]: [
    'employee_no', 'bank_name', 'account_number', 'account_type', 'verified',
  ],
  [SUPPLEMENTAL_SHEETS.RECURRING_DEDUCTIONS]: [
    'employee_no', 'deduction_code', 'amount', 'frequency', 'effective_from',
  ],
  [SUPPLEMENTAL_SHEETS.PAYROLL_ELIGIBILITY]: [
    'employee_no', 'pay_group_code', 'payroll_status', 'effective_from',
  ],
};
