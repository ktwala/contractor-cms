import { Decimal } from 'decimal.js';

/**
 * Country Pack Compute Contract (LS + ZA)
 *
 * A Country Pack is a deterministic, versioned computation module that:
 * - Knows how to compute statutory payroll values for a country
 * - Does NOT manage payruns, approvals, or persistence
 * - Receives a fully snapshotted context
 * - Produces results + trace + statutory artifacts
 */

// ============================================================================
// INPUT: PayrollComputeContext (immutable)
// ============================================================================

export interface PayrollComputeContext {
  payrun: PayrunContext;
  tax_tables: TaxTableContext;
  employees: EmployeeComputeInput[];
  rules: RulesContext;
  rounding_policy: RoundingPolicy;
}

export interface PayrunContext {
  payrun_id: string;
  payrun_type: 'REGULAR' | 'SUPPLEMENTAL' | 'ADJUSTMENT' | 'BONUS' | 'FINAL';
  base_payrun_id?: string; // For adjustments
  country: 'LS' | 'ZA';
  currency: 'LSL' | 'ZAR';
  legal_entity_id: string;
  period: {
    start: string; // ISO date
    end: string;
    pay_date: string;
    period_type: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
  };
}

export interface TaxTableContext {
  effective_from: string;
  brackets: TaxBracket[];
  meta: Record<string, any>; // Country-specific: rebates (ZA), credits (LS)
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  base_amount: number;
}

export interface EmployeeComputeInput {
  employee_id: string;
  employment: {
    employment_type: 'PERMANENT' | 'CONTRACTOR' | 'TEMPORARY';
    cost_center?: string;
    department?: string;
    job_title?: string;
    start_date: string;
    end_date?: string;
  };
  tax_profile: {
    residency_status: 'RESIDENT' | 'NON_RESIDENT';
    tax_number?: string;
    tax_status?: string;
    age?: number;
    meta?: Record<string, any>; // medical_aid_members, disability, etc.
  };
  inputs: {
    base_salary: number;
    pay_items: PayItemInput[];
  };
  prior_results?: {
    ytd_gross?: number;
    ytd_taxable?: number;
    ytd_paye?: number;
    previous_net?: number;
  };
}

export interface PayItemInput {
  code: string;
  name?: string;
  type: 'EARNING' | 'DEDUCTION' | 'BENEFIT' | 'REIMBURSEMENT';
  amount: number;
  is_taxable?: boolean;
  /**
   * Classification for tax treatment (v1.1+)
   */
  classification?: PayItemClassification;
  meta?: Record<string, any>;
}

/**
 * Pay Item Classification (v1.1)
 *
 * Explicit classification for tax treatment:
 * - BASIC_SALARY: Regular salary, fully taxable
 * - OVERTIME: Overtime earnings, fully taxable
 * - COMMISSION: Commission earnings, fully taxable
 * - BONUS: Bonus payment, fully taxable
 * - ALLOWANCE_TAXABLE: Taxable allowances (car, phone, etc.)
 * - ALLOWANCE_EXEMPT: Exempt allowances (subsistence, uniform)
 * - RETIREMENT_CONTRIBUTION: Pre-tax retirement fund contribution (reduces taxable)
 * - MEDICAL_AID_CONTRIBUTION: Medical aid contribution
 * - FRINGE_BENEFIT_COMPANY_CAR: Company car fringe benefit (taxable)
 * - FRINGE_BENEFIT_HOUSING: Housing fringe benefit (taxable)
 * - FRINGE_BENEFIT_OTHER: Other taxable fringe benefits
 * - REIMBURSEMENT: Non-taxable reimbursement
 * - OTHER: Unclassified (uses is_taxable flag)
 */
export type PayItemClassification =
  | 'BASIC_SALARY'
  | 'OVERTIME'
  | 'COMMISSION'
  | 'BONUS'
  | 'ALLOWANCE_TAXABLE'
  | 'ALLOWANCE_EXEMPT'
  | 'RETIREMENT_CONTRIBUTION'
  | 'MEDICAL_AID_CONTRIBUTION'
  | 'FRINGE_BENEFIT_COMPANY_CAR'
  | 'FRINGE_BENEFIT_HOUSING'
  | 'FRINGE_BENEFIT_OTHER'
  | 'REIMBURSEMENT'
  | 'OTHER';

export interface RulesContext {
  ordered: string[]; // Ordered rule codes to execute
}

export interface RoundingPolicy {
  mode: 'HALF_UP' | 'HALF_DOWN' | 'FLOOR' | 'CEILING';
  decimals: number;
}

// ============================================================================
// STEP 1: Validation Contract
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  employee_id?: string;
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  employee_id?: string;
  code: string;
  message: string;
}

// ============================================================================
// STEP 2: Compute Contract (core logic)
// ============================================================================

export interface ComputeResult {
  employee_results: EmployeeComputeResult[];
  employer_totals: EmployerTotals;
}

export interface EmployeeComputeResult {
  employee_id: string;
  totals: EmployeeTotals;
  lines: PayLine[];
  trace: TraceEntry[];
}

export interface EmployeeTotals {
  gross: number;
  taxable_income: number;
  paye: number;
  statutory_deductions: number;
  other_deductions: number;
  employer_contributions: number;
  net: number;
  /**
   * v1.1: Pre-tax deductions breakdown
   */
  pre_tax_deductions?: {
    retirement_contribution?: number;
    medical_aid_contribution?: number;
    total: number;
  };
  /**
   * v1.1: Fringe benefits included in taxable income
   */
  fringe_benefits_taxable?: number;
}

export interface PayLine {
  code: string;
  name?: string;
  type: 'EARNING' | 'DEDUCTION' | 'TAX' | 'STATUTORY' | 'EMPLOYER_CONTRIBUTION';
  amount: number;
  is_taxable?: boolean;
  trace?: Record<string, any>;
}

export interface EmployerTotals {
  [code: string]: number; // e.g., { SDL: 475, UIF_EMPLOYER: 148.50 }
}

export interface TraceEntry {
  step: string;
  description?: string;
  inputs?: Record<string, any>;
  formula?: string;
  output?: any;
}

// ============================================================================
// STEP 3: Post-processing Contract
// ============================================================================

export interface PostProcessResult {
  statutory_payloads: StatutoryPayloads;
  summary?: PayrunSummary;
}

export interface StatutoryPayloads {
  [countryCode: string]: {
    [exportType: string]: Record<string, any>;
  };
}

export interface PayrunSummary {
  total_employees: number;
  total_gross: number;
  total_paye: number;
  total_statutory: number;
  total_net: number;
  total_employer_cost: number;
}

// ============================================================================
// Country Pack Interface
// ============================================================================

export interface ICountryPayrollPack {
  readonly pack_id: 'LS' | 'ZA';
  readonly pack_version: string;

  /**
   * Validate the compute context before calculation
   * Fail fast if required data is missing or invalid
   */
  validate(ctx: PayrollComputeContext): Promise<ValidationResult>;

  /**
   * Perform the core payroll calculation
   * Pure function: same input → same output
   */
  compute(ctx: PayrollComputeContext): Promise<ComputeResult>;

  /**
   * Post-process results for statutory reporting
   * Generate structured payloads for exports (EMP201, IRP5, etc.)
   */
  post_process(
    ctx: PayrollComputeContext,
    result: ComputeResult,
  ): Promise<PostProcessResult>;
}
