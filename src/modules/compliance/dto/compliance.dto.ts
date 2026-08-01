import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsNumber } from 'class-validator';

// ============================================================================
// Enums
// ============================================================================

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SUBMIT = 'SUBMIT',
  CALCULATE = 'CALCULATE',
  FINALIZE = 'FINALIZE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN',
}

export enum EntityType {
  USER = 'USER',
  EMPLOYEE = 'EMPLOYEE',
  EMPLOYMENT = 'EMPLOYMENT',
  COMPENSATION = 'COMPENSATION',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  TAX_PROFILE = 'TAX_PROFILE',
  PAY_ITEM = 'PAY_ITEM',
  PAY_GROUP = 'PAY_GROUP',
  LEGAL_ENTITY = 'LEGAL_ENTITY',
  PAYRUN = 'PAYRUN',
  APPROVAL = 'APPROVAL',
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  REPORT = 'REPORT',
  EXPORT = 'EXPORT',
  SYSTEM = 'SYSTEM',
}

export enum ComplianceReportType {
  USER_ACCESS = 'USER_ACCESS',
  DATA_CHANGES = 'DATA_CHANGES',
  PAYRUN_HISTORY = 'PAYRUN_HISTORY',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  FAILED_LOGINS = 'FAILED_LOGINS',
  APPROVAL_AUDIT = 'APPROVAL_AUDIT',
  EXPORT_LOG = 'EXPORT_LOG',
  RETENTION_STATUS = 'RETENTION_STATUS',
}

export enum RetentionPeriod {
  DAYS_30 = 'DAYS_30',
  DAYS_90 = 'DAYS_90',
  YEAR_1 = 'YEAR_1',
  YEARS_3 = 'YEARS_3',
  YEARS_5 = 'YEARS_5',
  YEARS_7 = 'YEARS_7',
  PERMANENT = 'PERMANENT',
}

// ============================================================================
// Query DTOs
// ============================================================================

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsEnum(EntityType)
  entity_type?: EntityType;

  @IsOptional()
  @IsString()
  entity_id?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class ChangeHistoryQueryDto {
  @IsEnum(EntityType)
  entity_type: EntityType;

  @IsString()
  entity_id: string;

  @IsOptional()
  @IsString()
  field?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;
}

export class ComplianceReportQueryDto {
  @IsEnum(ComplianceReportType)
  report_type: ComplianceReportType;

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class AuditLogEntryDto {
  id: string;
  timestamp: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  entity_description?: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  changes?: FieldChangeDto[];
  ip_address?: string;
  user_agent?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export class FieldChangeDto {
  field: string;
  field_label: string;
  old_value: any;
  new_value: any;
  change_type: 'added' | 'modified' | 'removed';
}

export class AuditLogListResponseDto {
  logs: AuditLogEntryDto[];
  total: number;
  has_more: boolean;
}

export class ChangeHistoryResponseDto {
  entity_type: EntityType;
  entity_id: string;
  entity_description: string;
  created_at: string;
  created_by?: string;
  last_modified_at: string;
  last_modified_by?: string;
  total_changes: number;
  changes: AuditLogEntryDto[];
}

// ============================================================================
// Compliance Report DTOs
// ============================================================================

export class UserAccessReportDto {
  report_type: 'USER_ACCESS';
  generated_at: string;
  period_start: string;
  period_end: string;
  total_users: number;
  active_users: number;
  total_logins: number;
  failed_logins: number;
  users: {
    user_id: string;
    email: string;
    name: string;
    roles: string[];
    last_login?: string;
    login_count: number;
    failed_login_count: number;
    permissions: string[];
  }[];
}

export class DataChangesReportDto {
  report_type: 'DATA_CHANGES';
  generated_at: string;
  period_start: string;
  period_end: string;
  total_changes: number;
  by_entity_type: {
    entity_type: EntityType;
    count: number;
    creates: number;
    updates: number;
    deletes: number;
  }[];
  by_user: {
    user_id: string;
    user_name: string;
    total_changes: number;
  }[];
  sensitive_changes: AuditLogEntryDto[];
}

export class PayrunHistoryReportDto {
  report_type: 'PAYRUN_HISTORY';
  generated_at: string;
  period_start: string;
  period_end: string;
  total_payruns: number;
  payruns: {
    payrun_id: string;
    pay_group_name: string;
    period: string;
    status: string;
    created_at: string;
    created_by?: string;
    calculated_at?: string;
    calculated_by?: string;
    approved_at?: string;
    approved_by?: string;
    finalized_at?: string;
    finalized_by?: string;
    total_gross: number;
    total_net: number;
    employee_count: number;
    state_changes: {
      from_status: string;
      to_status: string;
      changed_at: string;
      changed_by?: string;
      reason?: string;
    }[];
  }[];
}

export class SensitiveDataAccessReportDto {
  report_type: 'SENSITIVE_DATA_ACCESS';
  generated_at: string;
  period_start: string;
  period_end: string;
  total_accesses: number;
  by_data_type: {
    data_type: string;
    access_count: number;
    export_count: number;
  }[];
  accesses: {
    timestamp: string;
    user_id: string;
    user_name: string;
    data_type: string;
    action: string;
    entity_id?: string;
    ip_address?: string;
  }[];
}

export class ApprovalAuditReportDto {
  report_type: 'APPROVAL_AUDIT';
  generated_at: string;
  period_start: string;
  period_end: string;
  total_approvals: number;
  approved: number;
  rejected: number;
  pending: number;
  average_approval_time_hours: number;
  by_approver: {
    user_id: string;
    user_name: string;
    approved: number;
    rejected: number;
    avg_time_hours: number;
  }[];
  approvals: {
    entity_type: string;
    entity_id: string;
    submitted_at: string;
    submitted_by: string;
    status: string;
    completed_at?: string;
    levels: {
      level: number;
      approver: string;
      action: string;
      acted_at?: string;
      comment?: string;
    }[];
  }[];
}

export class RetentionStatusReportDto {
  report_type: 'RETENTION_STATUS';
  generated_at: string;
  policies: RetentionPolicyDto[];
  data_summary: {
    entity_type: EntityType;
    total_records: number;
    oldest_record: string;
    newest_record: string;
    records_due_for_deletion: number;
    retention_policy: RetentionPeriod;
  }[];
  upcoming_deletions: {
    entity_type: EntityType;
    count: number;
    scheduled_date: string;
  }[];
}

// ============================================================================
// Retention Policy DTOs
// ============================================================================

export class RetentionPolicyDto {
  id: string;
  entity_type: EntityType;
  retention_period: RetentionPeriod;
  description: string;
  is_active: boolean;
  legal_requirement?: string;
  created_at: string;
  updated_at: string;
}

export class CreateRetentionPolicyDto {
  @IsEnum(EntityType)
  entity_type: EntityType;

  @IsEnum(RetentionPeriod)
  retention_period: RetentionPeriod;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  legal_requirement?: string;
}

export class UpdateRetentionPolicyDto {
  @IsOptional()
  @IsEnum(RetentionPeriod)
  retention_period?: RetentionPeriod;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ============================================================================
// Data Export/Deletion DTOs
// ============================================================================

export class DataExportRequestDto {
  @IsString()
  employee_id: string;

  @IsOptional()
  @IsArray()
  @IsEnum(EntityType, { each: true })
  include_types?: EntityType[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DataDeletionRequestDto {
  @IsString()
  employee_id: string;

  @IsOptional()
  @IsArray()
  @IsEnum(EntityType, { each: true })
  delete_types?: EntityType[];

  @IsString()
  reason: string;

  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class DataExportResultDto {
  request_id: string;
  employee_id: string;
  employee_name: string;
  requested_at: string;
  requested_by: string;
  status: string;
  download_url?: string;
  expires_at?: string;
  included_data: {
    type: EntityType;
    record_count: number;
  }[];
}

// ============================================================================
// Field Labels for Human-Readable Output
// ============================================================================

export const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  dateOfBirth: 'Date of Birth',
  idNumber: 'ID Number',
  nationalId: 'National ID',
  taxReference: 'Tax Reference',
  bankName: 'Bank Name',
  accountNumber: 'Account Number',
  branchCode: 'Branch Code',
  salary: 'Salary',
  hourlyRate: 'Hourly Rate',
  status: 'Status',
  effectiveFrom: 'Effective From',
  effectiveTo: 'Effective To',
  jobTitle: 'Job Title',
  department: 'Department',
  costCenter: 'Cost Center',
  grossRemuneration: 'Gross Remuneration',
  paye: 'PAYE',
  net: 'Net Pay',
};

// Sensitive fields that require extra audit logging
export const SENSITIVE_FIELDS = [
  'idNumber',
  'nationalId',
  'taxReference',
  'accountNumber',
  'passwordHash',
  'salary',
  'hourlyRate',
  'bankName',
  'branchCode',
];
