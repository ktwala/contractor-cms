export type StatutoryReturnStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'submitted'
  | 'acknowledged'
  | 'amended'
  | 'cancelled';

export interface StatutoryReturnItemDto {
  id: string;
  item_code: string;
  item_label: string;
  amount: number;
  currency: string;
  source_line_codes: string[];
  employee_count?: number;
  sort_order: number;
  metadata?: Record<string, unknown>;
}

export interface StatutoryReturnDto {
  id: string;
  country_code: string;
  legal_entity_id: string;
  pay_group_id?: string;
  return_code: string;
  return_label: string;
  period_key: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: StatutoryReturnStatus;
  total_due: number;
  employee_count: number;
  source_payrun_ids: string[];
  display_schema_key?: string;
  statutory_profile_key: string;
  country_pack_version?: string;
  generated_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  submitted_at?: string;
  acknowledged_at?: string;
  evidence_bundle_id?: string;
  // Filing calendar
  filing_due_date?: string;
  filing_authority?: string;
  days_until_due?: number;
  is_overdue?: boolean;
  // Amendment chain
  amends_return_id?: string;
  amended_by_return_id?: string;
  version_number: number;
  items: StatutoryReturnItemDto[];
  workflow_events?: StatutoryWorkflowEventDto[];
  metadata?: Record<string, unknown>;
}

export interface ComplianceDashboardDto {
  filing_calendar: FilingCalendarEntry[];
  exposure: ExposureSummary;
  workflow_alerts: WorkflowAlert[];
}

export interface FilingCalendarEntry {
  return_id?: string;
  country_code: string;
  return_code: string;
  return_label: string;
  period_key: string;
  status: StatutoryReturnStatus | 'not_generated';
  total_due: number;
  currency: string;
  filing_due_date: string;
  filing_authority: string;
  days_until_due: number;
  is_overdue: boolean;
}

export interface ExposureSummary {
  total_statutory_liability: number;
  currency: string;
  by_item: Array<{ item_code: string; item_label: string; total: number }>;
  by_country: Array<{ country_code: string; total: number; currency: string }>;
}

export interface WorkflowAlert {
  type: 'awaiting_review' | 'awaiting_approval' | 'approaching_due' | 'overdue' | 'awaiting_acknowledgement';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  return_id: string;
  return_code: string;
  country_code: string;
  period_key: string;
  days_until_due?: number;
}

export interface StatutoryEvidenceBundleDto {
  id: string;
  statutory_return_id: string;
  country_code: string;
  return_code: string;
  period_key: string;
  legal_entity_id: string;
  artifacts: StatutoryArtifactDto[];
  created_at: string;
  created_by_user_id?: string;
  metadata?: Record<string, unknown>;
}

export interface StatutoryArtifactDto {
  type: 'summary_json' | 'employee_schedule_csv' | 'review_xlsx' | 'review_pdf';
  name: string;
  mime_type: string;
  size_bytes?: number;
  content?: string;
  url?: string;
}

export interface StatutoryWorkflowEventDto {
  id: string;
  event_type: string;
  from_status: StatutoryReturnStatus | null;
  to_status: StatutoryReturnStatus;
  performed_by_user_id?: string;
  performed_at: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}
