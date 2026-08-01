import { IsString, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';

// ============================================================================
// Enums
// ============================================================================

export enum ExportFormat {
  CSV = 'CSV',
  XLSX = 'XLSX',
  PDF = 'PDF',
  TXT = 'TXT',
  XML = 'XML',
}

export enum GLExportType {
  JOURNAL = 'JOURNAL',
  SUMMARY = 'SUMMARY',
  DETAILED = 'DETAILED',
}

export enum BankFileFormat {
  ACB = 'ACB',           // Standard SA ACB format
  BANKSERV = 'BANKSERV', // BankServ EFT
  STANDARD = 'STANDARD', // Standard Bank format
  FNB = 'FNB',           // FNB format
  ABSA = 'ABSA',         // ABSA format
  NEDBANK = 'NEDBANK',   // Nedbank format
  CSV = 'CSV',           // Generic CSV for upload
}

export enum StatutoryReportType {
  EMP201 = 'EMP201',     // Monthly PAYE reconciliation
  EMP501 = 'EMP501',     // Interim reconciliation
  EMP601 = 'EMP601',     // Manual IRP5 submission
  IRP5_BATCH = 'IRP5_BATCH', // Batch IRP5 generation
  UI19 = 'UI19',         // UIF declaration
  SDL = 'SDL',           // Skills Development Levy
}

// ============================================================================
// GL Export DTOs
// ============================================================================

export class GLExportQueryDto {
  @IsString()
  payrun_id: string;

  @IsOptional()
  @IsEnum(GLExportType)
  type?: GLExportType;

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @IsOptional()
  @IsBoolean()
  include_employee_detail?: boolean;

  @IsOptional()
  @IsString()
  gl_account_mapping_id?: string;
}

export class GLJournalLineDto {
  account_code: string;
  account_name: string;
  department?: string;
  cost_center?: string;
  debit: number;
  credit: number;
  description: string;
  reference: string;
  employee_id?: string;
  employee_name?: string;
}

export class GLJournalExportDto {
  payrun_id: string;
  pay_group_name: string;
  legal_entity_name: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  journal_date: string;
  journal_reference: string;
  currency: string;
  lines: GLJournalLineDto[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

export class GLAccountMappingDto {
  @IsString()
  pay_item_code: string;

  @IsString()
  gl_account_code: string;

  @IsOptional()
  @IsString()
  gl_account_name?: string;

  @IsOptional()
  @IsString()
  cost_center?: string;

  @IsOptional()
  @IsBoolean()
  is_debit?: boolean;
}

export class CreateGLMappingDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsArray()
  mappings: GLAccountMappingDto[];
}

// ============================================================================
// Bank File DTOs
// ============================================================================

export class BankFileQueryDto {
  @IsString()
  payrun_id: string;

  @IsOptional()
  @IsEnum(BankFileFormat)
  format?: BankFileFormat;

  @IsOptional()
  @IsString()
  bank_account_id?: string;

  @IsOptional()
  @IsBoolean()
  test_mode?: boolean;
}

export class BankFilePaymentDto {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  bank_name: string;
  branch_code: string;
  account_number: string;
  account_type: string;
  amount: number;
  reference: string;
}

export class BankFileExportDto {
  payrun_id: string;
  file_format: BankFileFormat;
  generation_date: string;
  payment_date: string;
  total_payments: number;
  total_amount: number;
  currency: string;
  file_content: string;
  file_name: string;
  payments: BankFilePaymentDto[];

  // Header info for bank file
  company_name: string;
  company_account_number: string;
  company_branch_code: string;
  sequence_number?: string;
}

export class SourceBankAccountDto {
  @IsString()
  bank_name: string;

  @IsString()
  branch_code: string;

  @IsString()
  account_number: string;

  @IsString()
  account_name: string;

  @IsOptional()
  @IsString()
  account_type?: string;
}

// ============================================================================
// Statutory Report DTOs
// ============================================================================

export class StatutoryReportQueryDto {
  @IsEnum(StatutoryReportType)
  report_type: StatutoryReportType;

  @IsString()
  legal_entity_id: string;

  @IsOptional()
  @IsString()
  tax_year?: string;

  @IsOptional()
  @IsString()
  tax_month?: string; // YYYY-MM format

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}

export class EMP201LineDto {
  employee_id: string;
  employee_number: string;
  id_number: string;
  surname: string;
  first_names: string;
  gross_remuneration: number;
  paye: number;
  sdl: number;
  uif: number;
  periods: number;
}

export class EMP201ReportDto {
  report_type: 'EMP201';
  legal_entity_name: string;
  paye_reference: string;
  sdl_reference?: string;
  uif_reference?: string;
  tax_period: string;
  tax_year: string;

  // Summary totals
  total_employees: number;
  total_gross_remuneration: number;
  total_paye: number;
  total_sdl: number;
  total_uif_employee: number;
  total_uif_employer: number;
  total_payable: number;

  // Payment details
  payment_due_date: string;
  payment_reference?: string;

  // Line items
  employees: EMP201LineDto[];

  // Generation info
  generated_at: string;
  generated_by?: string;
}

export class IRP5DataDto {
  employee_id: string;
  certificate_number: string;

  // Employee details
  employee_number: string;
  id_number: string;
  surname: string;
  first_names: string;
  date_of_birth: string;
  tax_reference?: string;

  // Employment details
  employment_start: string;
  employment_end?: string;
  nature_of_person: string; // A (individual), B (company), etc.

  // Income sources (3600 codes)
  source_codes: {
    code: string;
    description: string;
    amount: number;
  }[];

  // Deductions (4000 codes)
  deduction_codes: {
    code: string;
    description: string;
    amount: number;
  }[];

  // Tax credits (4500 codes)
  tax_credit_codes: {
    code: string;
    description: string;
    amount: number;
  }[];

  // Totals
  gross_remuneration: number;
  taxable_income: number;
  paye_deducted: number;
  non_taxable_income: number;
}

export class IRP5BatchExportDto {
  legal_entity_name: string;
  paye_reference: string;
  tax_year: string;
  total_certificates: number;
  generated_at: string;
  certificates: IRP5DataDto[];
  file_content?: string; // For e@syFile format
}

export class UI19ReportDto {
  report_type: 'UI19';
  legal_entity_name: string;
  uif_reference: string;
  period_start: string;
  period_end: string;

  total_employees: number;
  total_remuneration: number;
  total_uif_employee: number;
  total_uif_employer: number;
  total_contribution: number;

  declaration_date: string;
  generated_at: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class ExportResultDto {
  success: boolean;
  export_type: string;
  format: string;
  file_name: string;
  file_size?: number;
  record_count: number;
  generated_at: string;
  download_url?: string;
  content?: string; // Base64 or raw content for small files
  warnings?: string[];
  errors?: string[];
}

// ============================================================================
// Mapping Presets
// ============================================================================

export const DEFAULT_GL_MAPPINGS: Record<string, { account: string; name: string; isDebit: boolean }> = {
  // Earnings (Debit - Expense)
  'BASIC': { account: '5000', name: 'Salaries & Wages', isDebit: true },
  'OVERTIME': { account: '5010', name: 'Overtime', isDebit: true },
  'BONUS': { account: '5020', name: 'Bonuses', isDebit: true },
  'COMMISSION': { account: '5030', name: 'Commissions', isDebit: true },
  'ALLOWANCE': { account: '5040', name: 'Allowances', isDebit: true },
  'TRAVEL': { account: '5050', name: 'Travel Allowance', isDebit: true },

  // Employer contributions (Debit - Expense)
  'UIF_ER': { account: '5100', name: 'UIF Employer', isDebit: true },
  'SDL': { account: '5110', name: 'Skills Development Levy', isDebit: true },
  'PENSION_ER': { account: '5120', name: 'Pension Employer', isDebit: true },
  'MEDICAL_ER': { account: '5130', name: 'Medical Aid Employer', isDebit: true },

  // Deductions (Credit - Liability)
  'PAYE': { account: '2100', name: 'PAYE Payable', isDebit: false },
  'UIF': { account: '2110', name: 'UIF Payable', isDebit: false },
  'UIF_EE': { account: '2110', name: 'UIF Payable', isDebit: false },
  'PENSION': { account: '2120', name: 'Pension Payable', isDebit: false },
  'PENSION_EE': { account: '2120', name: 'Pension Payable', isDebit: false },
  'MEDICAL': { account: '2130', name: 'Medical Aid Payable', isDebit: false },
  'MEDICAL_EE': { account: '2130', name: 'Medical Aid Payable', isDebit: false },

  // Net pay (Credit - Liability then cleared on payment)
  'NET_PAY': { account: '2200', name: 'Net Salaries Payable', isDebit: false },
};

// IRP5 Source Codes (3600 series)
export const IRP5_SOURCE_CODES: Record<string, { code: string; description: string }> = {
  'BASIC': { code: '3601', description: 'Income from salaries, wages' },
  'BONUS': { code: '3605', description: 'Annual payment' },
  'COMMISSION': { code: '3606', description: 'Commission' },
  'OVERTIME': { code: '3607', description: 'Overtime payments' },
  'TRAVEL': { code: '3701', description: 'Travel allowance' },
  'ALLOWANCE': { code: '3713', description: 'Other allowances' },
  'FRINGE': { code: '3801', description: 'Fringe benefits' },
};

// IRP5 Deduction Codes (4000 series)
export const IRP5_DEDUCTION_CODES: Record<string, { code: string; description: string }> = {
  'PENSION': { code: '4001', description: 'Pension fund contributions' },
  'PENSION_EE': { code: '4001', description: 'Pension fund contributions' },
  'PROVIDENT': { code: '4003', description: 'Provident fund contributions' },
  'MEDICAL': { code: '4005', description: 'Medical scheme fees' },
  'MEDICAL_EE': { code: '4005', description: 'Medical scheme fees' },
  'RA': { code: '4006', description: 'Retirement annuity contributions' },
  'PAYE': { code: '4102', description: 'Employees tax deducted' },
  'UIF': { code: '4141', description: 'UIF contributions' },
  'UIF_EE': { code: '4141', description: 'UIF contributions' },
};
