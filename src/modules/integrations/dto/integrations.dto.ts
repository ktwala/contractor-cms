import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ============================================================================
// Enums
// ============================================================================

export enum IntegrationType {
  ACCOUNTING = 'ACCOUNTING',
  BANKING = 'BANKING',
  TIME_ATTENDANCE = 'TIME_ATTENDANCE',
  HR_SYSTEM = 'HR_SYSTEM',
  CUSTOM_WEBHOOK = 'CUSTOM_WEBHOOK',
}

export enum AccountingSystem {
  XERO = 'XERO',
  QUICKBOOKS = 'QUICKBOOKS',
  SAGE = 'SAGE',
  PASTEL = 'PASTEL',
  SAP = 'SAP',
  CUSTOM = 'CUSTOM',
}

export enum WebhookEventType {
  // PayRun events
  PAYRUN_CREATED = 'payrun.created',
  PAYRUN_CALCULATED = 'payrun.calculated',
  PAYRUN_APPROVED = 'payrun.approved',
  PAYRUN_FINALIZED = 'payrun.finalized',
  PAYRUN_PAID = 'payrun.paid',

  // Employee events
  EMPLOYEE_CREATED = 'employee.created',
  EMPLOYEE_UPDATED = 'employee.updated',
  EMPLOYEE_TERMINATED = 'employee.terminated',

  // Approval events
  APPROVAL_REQUESTED = 'approval.requested',
  APPROVAL_COMPLETED = 'approval.completed',
  APPROVAL_REJECTED = 'approval.rejected',

  // Integration events
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
}

export enum SyncDirection {
  INBOUND = 'INBOUND',   // External -> Payroll
  OUTBOUND = 'OUTBOUND', // Payroll -> External
  BIDIRECTIONAL = 'BIDIRECTIONAL',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
}

// ============================================================================
// Integration Configuration DTOs
// ============================================================================

export class IntegrationConfigDto {
  @IsOptional()
  @IsString()
  api_url?: string;

  @IsOptional()
  @IsString()
  api_key?: string;

  @IsOptional()
  @IsString()
  api_secret?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  client_secret?: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsOptional()
  @IsObject()
  oauth_tokens?: {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  };

  @IsOptional()
  @IsObject()
  field_mappings?: Record<string, string>;

  @IsOptional()
  @IsObject()
  sync_settings?: {
    auto_sync: boolean;
    sync_frequency_minutes?: number;
    sync_direction: SyncDirection;
    entities_to_sync: string[];
  };
}

export class CreateIntegrationDto {
  @IsString()
  name: string;

  @IsEnum(IntegrationType)
  type: IntegrationType;

  @IsOptional()
  @IsEnum(AccountingSystem)
  accounting_system?: AccountingSystem;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsObject()
  config: IntegrationConfigDto;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Partial<IntegrationConfigDto>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class IntegrationResponseDto {
  id: string;
  name: string;
  type: IntegrationType;
  accounting_system?: AccountingSystem;
  description?: string;
  legal_entity_id?: string;
  is_active: boolean;
  last_sync_at?: string;
  last_sync_status?: SyncStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Webhook Configuration DTOs
// ============================================================================

export class CreateWebhookEndpointDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events?: WebhookEventType[];

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class WebhookEndpointResponseDto {
  id: string;
  name: string;
  url: string;
  description?: string;
  events: WebhookEventType[];
  is_active: boolean;
  legal_entity_id?: string;
  last_triggered_at?: string;
  failure_count: number;
  created_at: string;
}

export class WebhookDeliveryDto {
  id: string;
  endpoint_id: string;
  event_type: WebhookEventType;
  payload: Record<string, any>;
  response_status?: number;
  response_body?: string;
  delivered_at?: string;
  attempts: number;
  last_attempt_at: string;
  next_retry_at?: string;
  status: 'pending' | 'delivered' | 'failed';
}

// ============================================================================
// API Key DTOs
// ============================================================================

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsOptional()
  @IsString()
  expires_at?: string;
}

export class ApiKeyResponseDto {
  id: string;
  name: string;
  description?: string;
  key_prefix: string; // First 8 chars for identification
  scopes: string[];
  legal_entity_id?: string;
  status: ApiKeyStatus;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {
  api_key: string; // Full key - only shown once at creation
}

// ============================================================================
// Sync DTOs
// ============================================================================

export class TriggerSyncDto {
  @IsString()
  integration_id: string;

  @IsOptional()
  @IsEnum(SyncDirection)
  direction?: SyncDirection;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entity_types?: string[];

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsBoolean()
  full_sync?: boolean;
}

export class SyncResultDto {
  sync_id: string;
  integration_id: string;
  integration_name: string;
  direction: SyncDirection;
  status: SyncStatus;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  @ApiProperty({ type: () => [SyncErrorDto] })
  errors: SyncErrorDto[];
}

export class SyncErrorDto {
  entity_type: string;
  entity_id?: string;
  error_code: string;
  error_message: string;
  details?: Record<string, any>;
}

export class SyncHistoryQueryDto {
  @IsOptional()
  @IsString()
  integration_id?: string;

  @IsOptional()
  @IsEnum(SyncStatus)
  status?: SyncStatus;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

// ============================================================================
// Accounting Integration DTOs
// ============================================================================

export class AccountingJournalDto {
  journal_date: string;
  journal_number: string;
  description: string;
  lines: AccountingJournalLineDto[];
  reference?: string;
  currency: string;
}

export class AccountingJournalLineDto {
  account_code: string;
  account_name?: string;
  description: string;
  debit: number;
  credit: number;
  tax_code?: string;
  tracking_categories?: Record<string, string>;
}

export class AccountingContactDto {
  external_id?: string;
  name: string;
  email?: string;
  phone?: string;
  is_employee: boolean;
  employee_id?: string;
  tax_number?: string;
  bank_details?: {
    bank_name: string;
    account_number: string;
    branch_code: string;
  };
}

export class AccountingPaymentDto {
  external_id?: string;
  payment_date: string;
  amount: number;
  currency: string;
  reference: string;
  contact_id: string;
  account_code: string;
  description: string;
}

// ============================================================================
// Field Mapping DTOs
// ============================================================================

export class FieldMappingDto {
  @IsString()
  source_field: string;

  @IsString()
  target_field: string;

  @IsOptional()
  @IsString()
  transform?: string; // e.g., 'uppercase', 'date:YYYY-MM-DD', 'lookup:table'

  @IsOptional()
  @IsObject()
  default_value?: any;
}

export class EntityMappingDto {
  @IsString()
  entity_type: string;

  @IsArray()
  field_mappings: FieldMappingDto[];
}

// ============================================================================
// Webhook Payload Templates
// ============================================================================

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  webhook_id: string;
  data: Record<string, any>;
}

export const WEBHOOK_PAYLOAD_TEMPLATES: Record<WebhookEventType, (data: any) => WebhookPayload> = {
  [WebhookEventType.PAYRUN_CREATED]: (data) => ({
    event: WebhookEventType.PAYRUN_CREATED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      payrun_id: data.payrun_id,
      pay_group_id: data.pay_group_id,
      pay_group_name: data.pay_group_name,
      period_start: data.period_start,
      period_end: data.period_end,
      pay_date: data.pay_date,
      employee_count: data.employee_count,
    },
  }),

  [WebhookEventType.PAYRUN_CALCULATED]: (data) => ({
    event: WebhookEventType.PAYRUN_CALCULATED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      payrun_id: data.payrun_id,
      total_gross: data.total_gross,
      total_net: data.total_net,
      total_paye: data.total_paye,
      employee_count: data.employee_count,
    },
  }),

  [WebhookEventType.PAYRUN_APPROVED]: (data) => ({
    event: WebhookEventType.PAYRUN_APPROVED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      payrun_id: data.payrun_id,
      approved_by: data.approved_by,
      approved_at: data.approved_at,
    },
  }),

  [WebhookEventType.PAYRUN_FINALIZED]: (data) => ({
    event: WebhookEventType.PAYRUN_FINALIZED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      payrun_id: data.payrun_id,
      finalized_at: data.finalized_at,
      total_net: data.total_net,
    },
  }),

  [WebhookEventType.PAYRUN_PAID]: (data) => ({
    event: WebhookEventType.PAYRUN_PAID,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      payrun_id: data.payrun_id,
      payment_reference: data.payment_reference,
      paid_at: data.paid_at,
      total_amount: data.total_amount,
    },
  }),

  [WebhookEventType.EMPLOYEE_CREATED]: (data) => ({
    event: WebhookEventType.EMPLOYEE_CREATED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      employee_id: data.employee_id,
      employee_number: data.employee_number,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      hire_date: data.hire_date,
    },
  }),

  [WebhookEventType.EMPLOYEE_UPDATED]: (data) => ({
    event: WebhookEventType.EMPLOYEE_UPDATED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      employee_id: data.employee_id,
      employee_number: data.employee_number,
      changed_fields: data.changed_fields,
    },
  }),

  [WebhookEventType.EMPLOYEE_TERMINATED]: (data) => ({
    event: WebhookEventType.EMPLOYEE_TERMINATED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      employee_id: data.employee_id,
      employee_number: data.employee_number,
      termination_date: data.termination_date,
      reason: data.reason,
    },
  }),

  [WebhookEventType.APPROVAL_REQUESTED]: (data) => ({
    event: WebhookEventType.APPROVAL_REQUESTED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      approval_id: data.approval_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      submitted_by: data.submitted_by,
      approvers: data.approvers,
    },
  }),

  [WebhookEventType.APPROVAL_COMPLETED]: (data) => ({
    event: WebhookEventType.APPROVAL_COMPLETED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      approval_id: data.approval_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      approved_by: data.approved_by,
    },
  }),

  [WebhookEventType.APPROVAL_REJECTED]: (data) => ({
    event: WebhookEventType.APPROVAL_REJECTED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      approval_id: data.approval_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      rejected_by: data.rejected_by,
      reason: data.reason,
    },
  }),

  [WebhookEventType.SYNC_COMPLETED]: (data) => ({
    event: WebhookEventType.SYNC_COMPLETED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      sync_id: data.sync_id,
      integration_id: data.integration_id,
      records_processed: data.records_processed,
      duration_seconds: data.duration_seconds,
    },
  }),

  [WebhookEventType.SYNC_FAILED]: (data) => ({
    event: WebhookEventType.SYNC_FAILED,
    timestamp: new Date().toISOString(),
    webhook_id: data.webhook_id,
    data: {
      sync_id: data.sync_id,
      integration_id: data.integration_id,
      error_message: data.error_message,
    },
  }),
};

// ============================================================================
// API Scopes
// ============================================================================

export const API_SCOPES = {
  // Read scopes
  'employees:read': 'Read employee data',
  'payruns:read': 'Read payrun data',
  'reports:read': 'Read reports',
  'legal_entities:read': 'Read legal entity data',

  // Write scopes
  'employees:write': 'Create and update employees',
  'payruns:write': 'Create and manage payruns',
  'inputs:write': 'Submit payroll inputs',

  // Admin scopes
  'integrations:manage': 'Manage integrations',
  'webhooks:manage': 'Manage webhooks',
  'api_keys:manage': 'Manage API keys',
};
