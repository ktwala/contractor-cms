export interface ValidationIssue {
  sheet: string;
  rowNumber: number;
  businessKey?: string;
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  fieldName?: string;
  currentValue?: string;
  suggestedFix?: string;
  referenceSource?: string;
  allowedValuesHint?: string[];
}

export interface PreviewSection {
  rows: number;
  toInsert: number;
  toUpdate: number;
  toSkip: number;
  failed: number;
}

export interface OpeningBalancesTotals {
  ytdGross: number;
  ytdTaxable: number;
  ytdPaye: number;
  ytdNet: number;
}

/** File-level YTD rollups for precheck / UI financial control (valid payroll opening balance rows only). */
export interface OpeningBalancesFinancialControl extends OpeningBalancesTotals {
  countryCode: string;
  taxYear: number;
  asOfDate: string | null;
  /** Distinct employee_no on valid payroll opening balance rows */
  employeeCount: number;
  /** Cross-row sanity checks on summed YTDs (do not duplicate row-level validation errors). */
  alerts: Array<{ code: string; severity: 'WARNING' | 'INFO'; message: string }>;
}

export interface OpeningBalancesPrecheckResponse {
  ready: boolean;
  summary: {
    errors: number;
    warnings: number;
    totalRows: number;
    sheetsDetected: number;
  };
  financialControl: OpeningBalancesFinancialControl;
  issues: ValidationIssue[];
}

export interface OpeningBalancesPreviewResponse {
  importJobId: string;
  status: 'READY_TO_IMPORT' | 'FAILED';
  sections: {
    payrollOpeningBalances: PreviewSection;
    leaveBalances?: PreviewSection;
    loanBalances?: PreviewSection;
  };
  totals: OpeningBalancesTotals;
  /** Same rollups and aggregate alerts as precheck, derived from validated import rows. */
  financialControl: OpeningBalancesFinancialControl;
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

export const OB_SHEETS = {
  PAYROLL_OPENING_BALANCES: 'payrollopeningbalances',
  LEAVE_BALANCES: 'leavebalances',
  LOAN_BALANCES: 'loanbalances',
} as const;

export const REQUIRED_OB_COLUMNS: Record<string, string[]> = {
  [OB_SHEETS.PAYROLL_OPENING_BALANCES]: [
    'employee_no', 'tax_year', 'ytd_gross', 'ytd_taxable', 'ytd_paye', 'ytd_net',
  ],
  [OB_SHEETS.LEAVE_BALANCES]: [
    'employee_no', 'leave_type', 'balance', 'as_of_date',
  ],
  [OB_SHEETS.LOAN_BALANCES]: [
    'employee_no', 'deduction_code', 'remaining_balance', 'as_of_date',
  ],
};

export const OB_COLUMN_ALIASES: Record<string, string> = {
  balance_date: 'as_of_date',
  balance_days: 'balance',
  instalment_amount: 'installment_amount',
};
