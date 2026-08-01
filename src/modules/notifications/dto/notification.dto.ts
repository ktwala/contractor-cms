import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Enums
// ============================================================================

export enum NotificationType {
  // PayRun Events
  PAYRUN_CREATED = 'PAYRUN_CREATED',
  PAYRUN_CALCULATED = 'PAYRUN_CALCULATED',
  PAYRUN_SUBMITTED = 'PAYRUN_SUBMITTED',
  PAYRUN_APPROVED = 'PAYRUN_APPROVED',
  PAYRUN_REJECTED = 'PAYRUN_REJECTED',
  PAYRUN_FINALIZED = 'PAYRUN_FINALIZED',
  PAYRUN_PAID = 'PAYRUN_PAID',

  // Approval Events
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  APPROVAL_REMINDER = 'APPROVAL_REMINDER',
  APPROVAL_DELEGATED = 'APPROVAL_DELEGATED',

  // Reminders
  PAY_DATE_REMINDER = 'PAY_DATE_REMINDER',
  SUBMISSION_DEADLINE = 'SUBMISSION_DEADLINE',

  // Employee Events
  PAYSLIP_AVAILABLE = 'PAYSLIP_AVAILABLE',
  TAX_CERTIFICATE_AVAILABLE = 'TAX_CERTIFICATE_AVAILABLE',

  // System Events
  IMPORT_COMPLETED = 'IMPORT_COMPLETED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  REPORT_READY = 'REPORT_READY',
}

export enum DeliveryChannel {
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
  IN_APP = 'IN_APP',
  SMS = 'SMS',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ============================================================================
// Notification Preference DTOs
// ============================================================================

export class ChannelPreferenceDto {
  @IsEnum(DeliveryChannel)
  channel: DeliveryChannel;

  @IsBoolean()
  enabled: boolean;
}

export class NotificationPreferenceDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPreferenceDto)
  channels: ChannelPreferenceDto[];
}

export class UpdatePreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferences: NotificationPreferenceDto[];
}

// ============================================================================
// Webhook Configuration DTOs
// ============================================================================

export class WebhookConfigDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  events?: NotificationType[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class CreateWebhookDto extends WebhookConfigDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  events?: NotificationType[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ============================================================================
// Send Notification DTOs
// ============================================================================

export class SendNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsOptional()
  user_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  user_ids?: string[];

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsOptional()
  @IsString()
  pay_group_id?: string;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsArray()
  @IsEnum(DeliveryChannel, { each: true })
  channels?: DeliveryChannel[];
}

// ============================================================================
// Response DTOs
// ============================================================================

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  status: NotificationStatus;
  priority: NotificationPriority;
  channel: DeliveryChannel;
  user_id: string;
  read_at?: string;
  sent_at?: string;
  created_at: string;
}

export class NotificationListResponseDto {
  notifications: NotificationResponseDto[];
  total: number;
  unread_count: number;
}

export class WebhookResponseDto {
  id: string;
  name: string;
  description?: string;
  url: string;
  events: NotificationType[];
  active: boolean;
  created_at: string;
  last_triggered_at?: string;
}

export class PreferencesResponseDto {
  user_id: string;
  preferences: NotificationPreferenceDto[];
  updated_at: string;
}

// ============================================================================
// Query DTOs
// ============================================================================

export class ListNotificationsDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  unread_only?: boolean;

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

// ============================================================================
// Template Configuration
// ============================================================================

export interface NotificationTemplate {
  type: NotificationType;
  title: string;
  emailSubject: string;
  emailBody: string;
  inAppMessage: string;
  webhookPayload: (data: Record<string, any>) => Record<string, any>;
}

// Default templates for each notification type
export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  [NotificationType.PAYRUN_CREATED]: {
    type: NotificationType.PAYRUN_CREATED,
    title: 'Pay Run Created',
    emailSubject: 'New Pay Run Created: {{pay_group_name}}',
    emailBody: `
      <h2>New Pay Run Created</h2>
      <p>A new pay run has been created for <strong>{{pay_group_name}}</strong>.</p>
      <ul>
        <li><strong>Period:</strong> {{period_start}} to {{period_end}}</li>
        <li><strong>Pay Date:</strong> {{pay_date}}</li>
        <li><strong>Employees:</strong> {{employee_count}}</li>
      </ul>
      <p><a href="{{payrun_url}}">View Pay Run</a></p>
    `,
    inAppMessage: 'Pay run created for {{pay_group_name}} ({{period_start}} - {{period_end}})',
    webhookPayload: (data) => ({
      event: 'payrun.created',
      payrun_id: data.payrun_id,
      pay_group_id: data.pay_group_id,
      pay_group_name: data.pay_group_name,
      period_start: data.period_start,
      period_end: data.period_end,
      pay_date: data.pay_date,
      employee_count: data.employee_count,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYRUN_CALCULATED]: {
    type: NotificationType.PAYRUN_CALCULATED,
    title: 'Pay Run Calculated',
    emailSubject: 'Pay Run Calculated: {{pay_group_name}}',
    emailBody: `
      <h2>Pay Run Calculation Complete</h2>
      <p>The pay run for <strong>{{pay_group_name}}</strong> has been calculated.</p>
      <ul>
        <li><strong>Total Gross:</strong> {{currency}} {{total_gross}}</li>
        <li><strong>Total Net:</strong> {{currency}} {{total_net}}</li>
        <li><strong>Employees Processed:</strong> {{employee_count}}</li>
      </ul>
      <p><a href="{{payrun_url}}">Review Results</a></p>
    `,
    inAppMessage: 'Pay run calculated: {{total_gross}} gross for {{employee_count}} employees',
    webhookPayload: (data) => ({
      event: 'payrun.calculated',
      payrun_id: data.payrun_id,
      total_gross: data.total_gross,
      total_net: data.total_net,
      employee_count: data.employee_count,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYRUN_SUBMITTED]: {
    type: NotificationType.PAYRUN_SUBMITTED,
    title: 'Pay Run Submitted for Approval',
    emailSubject: 'Pay Run Pending Approval: {{pay_group_name}}',
    emailBody: `
      <h2>Pay Run Submitted for Approval</h2>
      <p>A pay run for <strong>{{pay_group_name}}</strong> requires your approval.</p>
      <ul>
        <li><strong>Submitted By:</strong> {{submitter_name}}</li>
        <li><strong>Total Amount:</strong> {{currency}} {{total_gross}}</li>
        <li><strong>Pay Date:</strong> {{pay_date}}</li>
      </ul>
      <p><a href="{{approval_url}}">Review & Approve</a></p>
    `,
    inAppMessage: 'Pay run submitted for approval by {{submitter_name}}',
    webhookPayload: (data) => ({
      event: 'payrun.submitted',
      payrun_id: data.payrun_id,
      submitter_id: data.submitter_id,
      total_gross: data.total_gross,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYRUN_APPROVED]: {
    type: NotificationType.PAYRUN_APPROVED,
    title: 'Pay Run Approved',
    emailSubject: 'Pay Run Approved: {{pay_group_name}}',
    emailBody: `
      <h2>Pay Run Approved</h2>
      <p>The pay run for <strong>{{pay_group_name}}</strong> has been approved.</p>
      <ul>
        <li><strong>Approved By:</strong> {{approver_name}}</li>
        <li><strong>Approval Level:</strong> {{approval_level}}</li>
      </ul>
      <p><a href="{{payrun_url}}">View Pay Run</a></p>
    `,
    inAppMessage: 'Pay run approved by {{approver_name}}',
    webhookPayload: (data) => ({
      event: 'payrun.approved',
      payrun_id: data.payrun_id,
      approver_id: data.approver_id,
      approval_level: data.approval_level,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYRUN_REJECTED]: {
    type: NotificationType.PAYRUN_REJECTED,
    title: 'Pay Run Rejected',
    emailSubject: 'Pay Run Rejected: {{pay_group_name}}',
    emailBody: `
      <h2>Pay Run Rejected</h2>
      <p>The pay run for <strong>{{pay_group_name}}</strong> has been rejected.</p>
      <ul>
        <li><strong>Rejected By:</strong> {{rejector_name}}</li>
        <li><strong>Reason:</strong> {{rejection_reason}}</li>
      </ul>
      <p><a href="{{payrun_url}}">Review & Resubmit</a></p>
    `,
    inAppMessage: 'Pay run rejected: {{rejection_reason}}',
    webhookPayload: (data) => ({
      event: 'payrun.rejected',
      payrun_id: data.payrun_id,
      rejector_id: data.rejector_id,
      reason: data.rejection_reason,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYRUN_FINALIZED]: {
    type: NotificationType.PAYRUN_FINALIZED,
    title: 'Pay Run Finalized',
    emailSubject: 'Pay Run Finalized: {{pay_group_name}}',
    emailBody: `
      <h2>Pay Run Finalized</h2>
      <p>The pay run for <strong>{{pay_group_name}}</strong> has been finalized and is ready for payment.</p>
      <ul>
        <li><strong>Total Net Payable:</strong> {{currency}} {{total_net}}</li>
        <li><strong>Pay Date:</strong> {{pay_date}}</li>
      </ul>
      <p><a href="{{payrun_url}}">View Pay Run</a></p>
    `,
    inAppMessage: 'Pay run finalized and ready for payment',
    webhookPayload: (data) => ({
      event: 'payrun.finalized',
      payrun_id: data.payrun_id,
      total_net: data.total_net,
      pay_date: data.pay_date,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYRUN_PAID]: {
    type: NotificationType.PAYRUN_PAID,
    title: 'Pay Run Paid',
    emailSubject: 'Payment Processed: {{pay_group_name}}',
    emailBody: `
      <h2>Payment Processed</h2>
      <p>The payment for <strong>{{pay_group_name}}</strong> has been processed.</p>
      <ul>
        <li><strong>Payment Reference:</strong> {{payment_reference}}</li>
        <li><strong>Total Paid:</strong> {{currency}} {{total_net}}</li>
        <li><strong>Employees Paid:</strong> {{employee_count}}</li>
      </ul>
    `,
    inAppMessage: 'Payment processed: {{currency}} {{total_net}} to {{employee_count}} employees',
    webhookPayload: (data) => ({
      event: 'payrun.paid',
      payrun_id: data.payrun_id,
      payment_reference: data.payment_reference,
      total_net: data.total_net,
      employee_count: data.employee_count,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.APPROVAL_REQUIRED]: {
    type: NotificationType.APPROVAL_REQUIRED,
    title: 'Approval Required',
    emailSubject: 'Action Required: Approval Pending',
    emailBody: `
      <h2>Approval Required</h2>
      <p>You have a pending approval request for <strong>{{entity_type}}</strong>.</p>
      <ul>
        <li><strong>Description:</strong> {{description}}</li>
        <li><strong>Submitted By:</strong> {{submitter_name}}</li>
        <li><strong>Submitted At:</strong> {{submitted_at}}</li>
      </ul>
      <p><a href="{{approval_url}}">Review & Approve</a></p>
    `,
    inAppMessage: 'Approval required: {{description}}',
    webhookPayload: (data) => ({
      event: 'approval.required',
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      assignee_id: data.assignee_id,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.APPROVAL_REMINDER]: {
    type: NotificationType.APPROVAL_REMINDER,
    title: 'Approval Reminder',
    emailSubject: 'Reminder: Approval Pending for {{days_pending}} days',
    emailBody: `
      <h2>Approval Reminder</h2>
      <p>You have an approval pending for <strong>{{days_pending}} days</strong>.</p>
      <ul>
        <li><strong>Description:</strong> {{description}}</li>
        <li><strong>Submitted By:</strong> {{submitter_name}}</li>
      </ul>
      <p><a href="{{approval_url}}">Review Now</a></p>
    `,
    inAppMessage: 'Reminder: Approval pending for {{days_pending}} days',
    webhookPayload: (data) => ({
      event: 'approval.reminder',
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      days_pending: data.days_pending,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.APPROVAL_DELEGATED]: {
    type: NotificationType.APPROVAL_DELEGATED,
    title: 'Approval Delegated',
    emailSubject: 'Approval Delegated to You',
    emailBody: `
      <h2>Approval Delegated</h2>
      <p><strong>{{delegator_name}}</strong> has delegated their approval authority to you.</p>
      <ul>
        <li><strong>Period:</strong> {{from_date}} to {{to_date}}</li>
        <li><strong>Reason:</strong> {{reason}}</li>
      </ul>
    `,
    inAppMessage: '{{delegator_name}} delegated approval authority to you',
    webhookPayload: (data) => ({
      event: 'approval.delegated',
      delegator_id: data.delegator_id,
      delegate_id: data.delegate_id,
      from_date: data.from_date,
      to_date: data.to_date,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAY_DATE_REMINDER]: {
    type: NotificationType.PAY_DATE_REMINDER,
    title: 'Pay Date Reminder',
    emailSubject: 'Upcoming Pay Date: {{pay_group_name}}',
    emailBody: `
      <h2>Pay Date Reminder</h2>
      <p>Pay date for <strong>{{pay_group_name}}</strong> is in <strong>{{days_until}} days</strong>.</p>
      <ul>
        <li><strong>Pay Date:</strong> {{pay_date}}</li>
        <li><strong>Status:</strong> {{payrun_status}}</li>
      </ul>
      <p>Please ensure all inputs are submitted and the pay run is approved before the pay date.</p>
    `,
    inAppMessage: 'Pay date in {{days_until}} days for {{pay_group_name}}',
    webhookPayload: (data) => ({
      event: 'reminder.paydate',
      pay_group_id: data.pay_group_id,
      pay_date: data.pay_date,
      days_until: data.days_until,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.SUBMISSION_DEADLINE]: {
    type: NotificationType.SUBMISSION_DEADLINE,
    title: 'Submission Deadline',
    emailSubject: 'Submission Deadline: {{days_until}} days remaining',
    emailBody: `
      <h2>Submission Deadline Approaching</h2>
      <p>The submission deadline for <strong>{{pay_group_name}}</strong> is in <strong>{{days_until}} days</strong>.</p>
      <p>Please ensure all employee inputs are submitted before the deadline.</p>
    `,
    inAppMessage: 'Submission deadline in {{days_until}} days',
    webhookPayload: (data) => ({
      event: 'reminder.deadline',
      pay_group_id: data.pay_group_id,
      deadline: data.deadline,
      days_until: data.days_until,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.PAYSLIP_AVAILABLE]: {
    type: NotificationType.PAYSLIP_AVAILABLE,
    title: 'Payslip Available',
    emailSubject: 'Your Payslip is Ready',
    emailBody: `
      <h2>Payslip Available</h2>
      <p>Your payslip for the period <strong>{{period_start}} - {{period_end}}</strong> is now available.</p>
      <p><a href="{{payslip_url}}">View Payslip</a></p>
    `,
    inAppMessage: 'Payslip available for {{period_start}} - {{period_end}}',
    webhookPayload: (data) => ({
      event: 'employee.payslip',
      employee_id: data.employee_id,
      period_start: data.period_start,
      period_end: data.period_end,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.TAX_CERTIFICATE_AVAILABLE]: {
    type: NotificationType.TAX_CERTIFICATE_AVAILABLE,
    title: 'Tax Certificate Available',
    emailSubject: 'Your Tax Certificate is Ready',
    emailBody: `
      <h2>Tax Certificate Available</h2>
      <p>Your tax certificate for the <strong>{{tax_year}}</strong> tax year is now available.</p>
      <p><a href="{{certificate_url}}">Download Certificate</a></p>
    `,
    inAppMessage: 'Tax certificate available for {{tax_year}}',
    webhookPayload: (data) => ({
      event: 'employee.taxcert',
      employee_id: data.employee_id,
      tax_year: data.tax_year,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.IMPORT_COMPLETED]: {
    type: NotificationType.IMPORT_COMPLETED,
    title: 'Import Completed',
    emailSubject: 'Import Completed Successfully',
    emailBody: `
      <h2>Import Completed</h2>
      <p>Your data import has completed successfully.</p>
      <ul>
        <li><strong>Type:</strong> {{import_type}}</li>
        <li><strong>Records Processed:</strong> {{records_processed}}</li>
        <li><strong>Records Created:</strong> {{records_created}}</li>
        <li><strong>Records Updated:</strong> {{records_updated}}</li>
      </ul>
    `,
    inAppMessage: 'Import completed: {{records_processed}} records processed',
    webhookPayload: (data) => ({
      event: 'import.completed',
      import_type: data.import_type,
      records_processed: data.records_processed,
      records_created: data.records_created,
      records_updated: data.records_updated,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.IMPORT_FAILED]: {
    type: NotificationType.IMPORT_FAILED,
    title: 'Import Failed',
    emailSubject: 'Import Failed',
    emailBody: `
      <h2>Import Failed</h2>
      <p>Your data import encountered errors.</p>
      <ul>
        <li><strong>Type:</strong> {{import_type}}</li>
        <li><strong>Errors:</strong> {{error_count}}</li>
      </ul>
      <p>Please review the errors and try again.</p>
    `,
    inAppMessage: 'Import failed: {{error_count}} errors',
    webhookPayload: (data) => ({
      event: 'import.failed',
      import_type: data.import_type,
      error_count: data.error_count,
      errors: data.errors,
      timestamp: new Date().toISOString(),
    }),
  },

  [NotificationType.REPORT_READY]: {
    type: NotificationType.REPORT_READY,
    title: 'Report Ready',
    emailSubject: 'Your Report is Ready',
    emailBody: `
      <h2>Report Ready</h2>
      <p>Your <strong>{{report_name}}</strong> report is ready for download.</p>
      <p><a href="{{report_url}}">Download Report</a></p>
    `,
    inAppMessage: '{{report_name}} report is ready',
    webhookPayload: (data) => ({
      event: 'report.ready',
      report_id: data.report_id,
      report_name: data.report_name,
      timestamp: new Date().toISOString(),
    }),
  },
};
