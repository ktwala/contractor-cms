export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

export interface PayslipSummary {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  gross: number;
  net: number;
  status: string;
}

export interface EmployeeProfile {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  hire_date: string;
  job_title?: string;
  department?: string;
  employment_status: string;
  pay_frequency: string;
  currency: string;
  leave_balances: LeaveBalance[];
  bank_accounts: BankAccountMasked[];
}

export interface LeaveBalance {
  leave_type: string;
  entitled: number;
  taken: number;
  pending: number;
  available: number;
  unit: string;
}

export interface BankAccountMasked {
  id: string;
  bank_name: string;
  account_type: string;
  account_number_masked: string;
  is_primary: boolean;
}

export interface TaxCertificateSummary {
  id: string;
  tax_year: string;
  certificate_type: string;
  issue_date: string;
  status: string;
}
