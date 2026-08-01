import { IsString, IsOptional, IsEnum, IsIn } from 'class-validator';

// ============================================================================
// Query DTOs
// ============================================================================

export class PayslipQueryDto {
  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;
}

export class TaxCertificateQueryDto {
  @IsOptional()
  @IsString()
  tax_year?: string;
}

// ============================================================================
// Payslip Response DTOs
// ============================================================================

export class PayslipEarningDto {
  code: string;
  name: string;
  units?: number;
  rate?: number;
  amount: number;
}

export class PayslipDeductionDto {
  code: string;
  name: string;
  amount: number;
  is_statutory: boolean;
}

export class PayslipEmployerContributionDto {
  code: string;
  name: string;
  amount: number;
}

export class PayslipSummaryDto {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  gross: number;
  net: number;
  status: string;
}

export class PayslipDetailDto {
  id: string;
  employee_id: string;
  employee_number: string;
  employee_name: string;

  // Company info
  company_name: string;
  company_address?: string;
  company_registration?: string;
  company_tax_reference?: string;

  // Period info
  period_start: string;
  period_end: string;
  pay_date: string;
  pay_frequency: string;

  // Employment info
  job_title?: string;
  department?: string;
  cost_center?: string;
  date_engaged?: string;
  id_number?: string;
  date_of_birth?: string;
  address?: string;

  // Tax info
  tax_reference?: string;
  tax_status?: string;

  // Earnings
  earnings: PayslipEarningDto[];
  total_earnings: number;

  // Deductions
  deductions: PayslipDeductionDto[];
  total_deductions: number;

  // Employer contributions (for information)
  employer_contributions: PayslipEmployerContributionDto[];
  total_employer_contributions: number;

  // Totals
  gross: number;
  paye: number;
  net: number;

  // YTD figures
  ytd_gross: number;
  ytd_paye: number;
  ytd_net: number;

  // Banking
  bank_name?: string;
  branch?: string;
  branch_code?: string;
  account_number_masked?: string;

  // Currency
  currency: string;
}

export class PayslipListResponseDto {
  payslips: PayslipSummaryDto[];
  total: number;
}

// ============================================================================
// Tax Certificate DTOs
// ============================================================================

export class TaxCertificateSummaryDto {
  id: string;
  tax_year: string;
  certificate_type: string;
  issue_date: string;
  status: string;
}

export class TaxCertificateDetailDto {
  id: string;
  employee_id: string;

  // Employee info
  employee_number: string;
  employee_name: string;
  id_number?: string;
  tax_reference?: string;

  // Employer info
  employer_name: string;
  employer_paye_reference?: string;
  employer_sdl_reference?: string;
  employer_uif_reference?: string;

  // Certificate info
  tax_year: string;
  certificate_number?: string;
  certificate_type: string; // IRP5, IT3(a), etc.
  issue_date: string;

  // Employment period
  employment_start: string;
  employment_end?: string;
  periods_worked: number;

  // Income
  gross_remuneration: number;
  gross_non_taxable: number;
  taxable_income: number;

  // Tax
  paye_deducted: number;

  // Statutory deductions
  uif_employee: number;
  pension_fund?: number;
  retirement_annuity?: number;
  medical_aid?: number;

  // Travel allowance
  travel_allowance?: number;
  travel_reimbursive?: number;

  // Other
  other_deductions: number;

  // Totals
  total_income: number;
  total_deductions: number;

  // Status
  status: string;
  submitted_to_sars?: boolean;
  sars_submission_date?: string;
}

export class TaxCertificateListResponseDto {
  certificates: TaxCertificateSummaryDto[];
  total: number;
}

// ============================================================================
// Employee Profile DTOs
// ============================================================================

export class EmployeeProfileDto {
  id: string;
  employee_number: string;

  // Personal info
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;

  // ID
  id_type?: string;
  id_number_masked?: string;

  // Employment
  hire_date: string;
  job_title?: string;
  department?: string;
  cost_center?: string;
  manager_name?: string;
  employment_type: string;
  employment_status: string;

  // Pay info (limited)
  pay_frequency: string;
  currency: string;

  // Leave balances
  leave_balances: LeaveBalanceDto[];

  // Bank account (masked)
  bank_accounts: BankAccountMaskedDto[];
}

export class LeaveBalanceDto {
  leave_type: string;
  entitled: number;
  taken: number;
  pending: number;
  available: number;
  unit: string; // 'days' or 'hours'
}

export class BankAccountMaskedDto {
  id: string;
  bank_name: string;
  account_type: string;
  account_number_masked: string;
  is_primary: boolean;
}

// ============================================================================
// Update Request DTOs
// ============================================================================

export class UpdateContactInfoDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;
}

export class BankAccountUpdateRequestDto {
  @IsString()
  bank_name: string;

  @IsString()
  branch_code: string;

  @IsString()
  account_number: string;

  @IsString()
  account_type: string;

  @IsOptional()
  @IsString()
  account_holder_name?: string;
}

// ============================================================================
// Download DTOs
// ============================================================================

export enum DocumentFormat {
  PDF = 'PDF',
  HTML = 'HTML',
}

/** Payslip template variant: 'schedule' (new) or 'legacy' (old) */
export type PayslipTemplateVariant = 'schedule' | 'legacy';

export class DownloadPayslipDto {
  @IsOptional()
  @IsEnum(DocumentFormat)
  format?: DocumentFormat;

  /** Template variant: 'schedule' (default) or 'legacy' */
  @IsOptional()
  @IsIn(['schedule', 'legacy'])
  template?: PayslipTemplateVariant;
}

export class DownloadTaxCertificateDto {
  @IsOptional()
  @IsEnum(DocumentFormat)
  format?: DocumentFormat;
}
