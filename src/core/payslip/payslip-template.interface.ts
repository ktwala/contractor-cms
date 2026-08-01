/**
 * Unified interface for payslip template rendering.
 * Used by self-service, reports, and artifacts modules.
 */
export interface PayslipTemplateInput {
  // Company
  company_name: string;
  company_address?: string;

  // Employee
  employee_name: string;
  employee_number: string;
  job_title?: string;
  date_engaged?: string;
  id_number?: string;
  date_of_birth?: string;
  tax_reference?: string;
  address?: string;

  // Banking (separate from Payment & Period)
  bank_name?: string;
  branch?: string;
  branch_code?: string;
  account_number?: string;

  // Payment & Period
  pay_method?: string;
  pay_date: string;
  payrun_period_start: string;
  payrun_period_end: string;
  working_hours_per_week?: string;
  annual_salary_package?: string;

  // Earnings & Deductions
  earnings: Array<{ description: string; amount: number }>;
  deductions: Array<{ description: string; amount: number }>;
  gross: number;
  total_deductions: number;
  net: number;

  // Display
  currency: string;
  period_label?: string; // e.g. "January 2026"
  logo_url?: string;

  // Optional for legacy template
  ytd_gross?: number;
  ytd_paye?: number;
  ytd_net?: number;
  department?: string;
  tax_status?: string;
}

/** Template variant: 'schedule' (new) or 'legacy' (old) */
export type PayslipTemplateVariant = 'schedule' | 'legacy';
