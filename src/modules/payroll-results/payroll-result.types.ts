export type PayrollResultLineBucket =
  | 'earning'
  | 'employee_deduction'
  | 'employer_contribution'
  | 'employer_levy'
  | 'informational';

export type PayrollResultLineCategory =
  | 'base_pay'
  | 'allowance'
  | 'bonus'
  | 'overtime'
  | 'tax'
  | 'social_security'
  | 'levy'
  | 'pension'
  | 'medical'
  | 'loan'
  | 'garnishee'
  | 'benefit'
  | 'adjustment'
  | 'other';

export type PayrollLineVisibility = 'summary' | 'detail' | 'hidden';

export interface PayrollResultLine {
  code: string;
  label: string;
  amount: number;
  currency: string;
  bucket: PayrollResultLineBucket;
  category: PayrollResultLineCategory;
  is_statutory: boolean;
  statutory_group?: string;
  affects_net_pay: boolean;
  affects_employer_cost: boolean;
  visibility: PayrollLineVisibility;
  sort_order: number;
  period_amount: number;
  ytd_amount?: number;
  metadata?: Record<string, unknown>;
}

export interface PayrollEmployeeResult {
  employee_id: string;
  employee_code?: string;
  employee_number?: string;
  employee_name?: string;
  country_code: string;
  currency: string;
  gross: number;
  taxable_income?: number;
  earnings_total: number;
  employee_deductions_total: number;
  employer_contributions_total: number;
  employer_levies_total: number;
  net_pay: number;
  employer_cost: number;
  lines: PayrollResultLine[];
  summary_line_amounts: Record<string, number>;
  display_schema_key: string;
}

export interface StatutoryLineSummary {
  code: string;
  label: string;
  total: number;
  statutory_group?: string;
  side: 'employee' | 'employer';
}

export interface PayrollPayrunResultsResponse {
  payrun_id: string;
  pay_group_id: string;
  country_code: string;
  currency: string;
  display_schema: CountryPayrollDisplaySchema;
  employee_results: PayrollEmployeeResult[];
  totals: {
    gross: number;
    earnings_total: number;
    employee_deductions_total: number;
    employer_contributions_total: number;
    employer_levies_total: number;
    net_pay: number;
    employer_cost: number;
    summary_line_totals: Record<string, number>;
  };
  statutory_totals: StatutoryLineSummary[];
}

// --- Display schema types ---

export type PayrollSummaryColumnSource = 'employee_identity' | 'core_field' | 'summary_line';

export interface PayrollSummaryColumn {
  key: string;
  label: string;
  source: PayrollSummaryColumnSource;
  core_field?: keyof Pick<
    PayrollEmployeeResult,
    | 'gross'
    | 'taxable_income'
    | 'earnings_total'
    | 'employee_deductions_total'
    | 'employer_contributions_total'
    | 'employer_levies_total'
    | 'net_pay'
    | 'employer_cost'
  >;
  line_code?: string;
  order: number;
  visible: boolean;
  format: 'text' | 'currency' | 'number';
  align: 'left' | 'right' | 'center';
}

export interface PayrollDetailGroup {
  key: string;
  label: string;
  include_buckets?: PayrollResultLineBucket[];
  include_line_codes?: string[];
  exclude_line_codes?: string[];
  order: number;
}

export interface CountryPayrollDisplaySchema {
  schema_key: string;
  country_code: string;
  version: number;
  summary_columns: PayrollSummaryColumn[];
  detail_groups: PayrollDetailGroup[];
  totals_panel: {
    show_employee_deductions_total: boolean;
    show_employer_contributions_total: boolean;
    show_employer_levies_total: boolean;
    show_employer_cost: boolean;
    show_taxable_income: boolean;
  };
  exports: {
    include_hidden_lines: boolean;
    include_employer_items: boolean;
  };
  payslip: {
    show_employer_section: boolean;
    show_taxable_income: boolean;
  };
}
