export enum Country {
  LS = 'LS',
  ZA = 'ZA',
}

export enum Currency {
  LSL = 'LSL',
  ZAR = 'ZAR',
}

export enum PayFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  TERMINATED = 'TERMINATED',
  ON_LEAVE = 'ON_LEAVE',
}

export enum EmploymentType {
  PERMANENT = 'PERMANENT',
  CONTRACT = 'CONTRACT',
  CASUAL = 'CASUAL',
}

export enum PayItemType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
  TAX = 'TAX',
  EMPLOYER_CONTRIB = 'EMPLOYER_CONTRIB',
}

export enum PayRunStatus {
  DRAFT = 'DRAFT',
  SNAPSHOT = 'SNAPSHOT',
  CALCULATING = 'CALCULATING',
  CALCULATED = 'CALCULATED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  POSTED = 'POSTED',
  FINALIZED = 'FINALIZED',
  CANCELLED = 'CANCELLED',
}

export enum PayRunType {
  REGULAR = 'REGULAR',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum AdjustmentMode {
  DELTA_ONLY = 'DELTA_ONLY',
  FULL_RECALC = 'FULL_RECALC',
}

export enum ChangeRequestKind {
  EMPLOYEE_BANK_ACCOUNT = 'EMPLOYEE_BANK_ACCOUNT',
  EMPLOYEE_COMPENSATION = 'EMPLOYEE_COMPENSATION',
  EMPLOYEE_TAX_PROFILE = 'EMPLOYEE_TAX_PROFILE',
  PAY_ITEM_MAPPING = 'PAY_ITEM_MAPPING',
  OTHER = 'OTHER',
}

export enum ChangeRequestStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum ImportKind {
  VARIABLE_PAY = 'VARIABLE_PAY',
  TAX_TABLES = 'TAX_TABLES',
}

export enum ArtifactKind {
  BANK_FILE = 'BANK_FILE',
  PAYSLIP_BUNDLE = 'PAYSLIP_BUNDLE',
  GL_JOURNAL = 'GL_JOURNAL',
  STATUTORY_EXPORT = 'STATUTORY_EXPORT',
}

export enum ResidencyStatus {
  RESIDENT = 'RESIDENT',
  NON_RESIDENT = 'NON_RESIDENT',
}

export enum AccountType {
  CHEQUE = 'CHEQUE',
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
}

export enum RoundingMode {
  HALF_UP = 'HALF_UP',
  HALF_EVEN = 'HALF_EVEN',
  DOWN = 'DOWN',
  UP = 'UP',
}

export enum RoleName {
  PAYROLL_CLERK = 'PAYROLL_CLERK',
  PAYROLL_MANAGER = 'PAYROLL_MANAGER',
  APPROVER = 'APPROVER',
  AUDITOR = 'AUDITOR',
  HR_ADMIN = 'HR_ADMIN',
}

// Country-Currency mapping
export const COUNTRY_CURRENCY_MAP: Record<Country, Currency> = {
  [Country.LS]: Currency.LSL,
  [Country.ZA]: Currency.ZAR,
};

// Valid state transitions for PayRun
export const PAYRUN_STATE_TRANSITIONS: Record<PayRunStatus, PayRunStatus[]> = {
  [PayRunStatus.DRAFT]: [PayRunStatus.SNAPSHOT, PayRunStatus.CANCELLED],
  [PayRunStatus.SNAPSHOT]: [PayRunStatus.CALCULATING, PayRunStatus.DRAFT, PayRunStatus.CANCELLED],
  [PayRunStatus.CALCULATING]: [PayRunStatus.CALCULATED, PayRunStatus.SNAPSHOT],
  [PayRunStatus.CALCULATED]: [PayRunStatus.IN_REVIEW, PayRunStatus.CALCULATING, PayRunStatus.DRAFT, PayRunStatus.CANCELLED],
  [PayRunStatus.IN_REVIEW]: [PayRunStatus.APPROVED, PayRunStatus.DRAFT, PayRunStatus.CANCELLED],
  [PayRunStatus.APPROVED]: [PayRunStatus.PAID, PayRunStatus.POSTED],
  [PayRunStatus.PAID]: [PayRunStatus.POSTED, PayRunStatus.FINALIZED],
  [PayRunStatus.POSTED]: [PayRunStatus.PAID, PayRunStatus.FINALIZED],
  [PayRunStatus.FINALIZED]: [],
  [PayRunStatus.CANCELLED]: [],
};
