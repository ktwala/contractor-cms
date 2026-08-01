import {
  PayrollResultLineBucket,
  PayrollResultLineCategory,
  PayrollLineVisibility,
} from './payroll-result.types';

export interface LineCodeDefinition {
  code: string;
  label: string;
  bucket: PayrollResultLineBucket;
  category: PayrollResultLineCategory;
  is_statutory: boolean;
  statutory_group?: string;
  affects_net_pay: boolean;
  affects_employer_cost: boolean;
  visibility: PayrollLineVisibility;
  sort_order: number;
}

export const LINE_CODES: Record<string, LineCodeDefinition> = {
  // --- Earnings (non-statutory) ---
  BASIC:             { code: 'BASIC',             label: 'Basic Salary',       bucket: 'earning', category: 'base_pay',   is_statutory: false,                               affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 10 },
  OVERTIME:          { code: 'OVERTIME',           label: 'Overtime',           bucket: 'earning', category: 'overtime',   is_statutory: false,                               affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 20 },
  BONUS:             { code: 'BONUS',              label: 'Bonus',              bucket: 'earning', category: 'bonus',      is_statutory: false,                               affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 30 },
  COMMISSION:        { code: 'COMMISSION',         label: 'Commission',         bucket: 'earning', category: 'bonus',      is_statutory: false,                               affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 35 },
  ALLOWANCE:         { code: 'ALLOWANCE',          label: 'Allowance',          bucket: 'earning', category: 'allowance',  is_statutory: false,                               affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 40 },
  BACKPAY:           { code: 'BACKPAY',            label: 'Back Pay',           bucket: 'earning', category: 'other',      is_statutory: false,                               affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 50 },

  // --- Employee statutory deductions ---
  PAYE:              { code: 'PAYE',               label: 'PAYE',               bucket: 'employee_deduction', category: 'tax',             is_statutory: true, statutory_group: 'EMP201', affects_net_pay: true, affects_employer_cost: false, visibility: 'summary', sort_order: 100 },
  UIF_EMPLOYEE:      { code: 'UIF_EMPLOYEE',       label: 'UIF',                bucket: 'employee_deduction', category: 'social_security', is_statutory: true, statutory_group: 'EMP201', affects_net_pay: true, affects_employer_cost: false, visibility: 'summary', sort_order: 110 },

  // --- Other employee deductions (non-statutory) ---
  PENSION_EMPLOYEE:  { code: 'PENSION_EMPLOYEE',   label: 'Pension Fund',       bucket: 'employee_deduction', category: 'pension',  is_statutory: false, affects_net_pay: true, affects_employer_cost: false, visibility: 'detail', sort_order: 200 },
  MEDICAL_EMPLOYEE:  { code: 'MEDICAL_EMPLOYEE',   label: 'Medical Aid',        bucket: 'employee_deduction', category: 'medical',  is_statutory: false, affects_net_pay: true, affects_employer_cost: false, visibility: 'detail', sort_order: 210 },
  LOAN:              { code: 'LOAN',               label: 'Loan Repayment',     bucket: 'employee_deduction', category: 'loan',     is_statutory: false, affects_net_pay: true, affects_employer_cost: false, visibility: 'detail', sort_order: 220 },
  GARNISHEE:         { code: 'GARNISHEE',          label: 'Garnishee Order',    bucket: 'employee_deduction', category: 'garnishee', is_statutory: false, affects_net_pay: true, affects_employer_cost: false, visibility: 'detail', sort_order: 230 },
  UNION_FEE:         { code: 'UNION_FEE',          label: 'Union Fee',          bucket: 'employee_deduction', category: 'other',    is_statutory: false, affects_net_pay: true, affects_employer_cost: false, visibility: 'detail', sort_order: 240 },

  // --- Employer statutory contributions ---
  UIF_EMPLOYER:      { code: 'UIF_EMPLOYER',       label: 'UIF Employer',       bucket: 'employer_contribution', category: 'social_security', is_statutory: true, statutory_group: 'EMP201', affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 300 },
  PENSION_EMPLOYER:  { code: 'PENSION_EMPLOYER',   label: 'Pension Employer',   bucket: 'employer_contribution', category: 'pension',         is_statutory: false,                            affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 310 },
  MEDICAL_EMPLOYER:  { code: 'MEDICAL_EMPLOYER',   label: 'Medical Employer',   bucket: 'employer_contribution', category: 'medical',         is_statutory: false,                            affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 320 },

  // --- Employer statutory levies ---
  SDL:               { code: 'SDL',                label: 'Skills Development Levy', bucket: 'employer_levy', category: 'levy', is_statutory: true, statutory_group: 'EMP201', affects_net_pay: false, affects_employer_cost: true, visibility: 'detail', sort_order: 400 },
};

/**
 * Maps raw engine line codes to stable normalized codes.
 * Key = raw code from compute pack, Value = stable code.
 */
export const RAW_CODE_MAP: Record<string, string> = {
  // ZA raw codes
  'PAYE': 'PAYE',
  'UIF_EMP': 'UIF_EMPLOYEE',
  'UIF_ER': 'UIF_EMPLOYER',
  'SDL_ER': 'SDL',
  'RETIREMENT': 'PENSION_EMPLOYEE',
  'MEDICAL_AID': 'MEDICAL_EMPLOYEE',
  // LS raw codes
  'LS_PAYE': 'PAYE',
  // Universal
  'BASIC': 'BASIC',
  'OVERTIME': 'OVERTIME',
  'BONUS': 'BONUS',
  'COMMISSION': 'COMMISSION',
  'LOAN_REPAYMENT': 'LOAN',
  'ALLOWANCE_TRAVEL': 'ALLOWANCE',
  'ALLOWANCE_CELL': 'ALLOWANCE',
};

/**
 * Earnings classification from raw pay item codes/types.
 * Used when a raw code has no explicit mapping.
 */
export const EARNING_CLASSIFICATION: Record<string, string> = {
  BASIC_SALARY: 'BASIC',
  OVERTIME: 'OVERTIME',
  COMMISSION: 'COMMISSION',
  BONUS: 'BONUS',
  ALLOWANCE_TAXABLE: 'ALLOWANCE',
  ALLOWANCE_EXEMPT: 'ALLOWANCE',
  OTHER: 'ALLOWANCE',
};

export const SYNTHETIC_CODES = {
  OTHER_DEDUCTIONS_TOTAL: 'OTHER_DEDUCTIONS_TOTAL',
  STATUTORY_DEDUCTIONS_TOTAL: 'STATUTORY_DEDUCTIONS_TOTAL',
  EMPLOYER_CONTRIBUTIONS_TOTAL: 'EMPLOYER_CONTRIBUTIONS_TOTAL',
} as const;
