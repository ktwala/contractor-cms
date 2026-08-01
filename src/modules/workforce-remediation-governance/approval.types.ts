export interface ApprovalRequestDto {
  actionType: string;
  issueType: string;
  recordsAffected: number;
  fixPayload: Record<string, unknown>;
  previewSummary?: Record<string, unknown>;
  filters?: {
    legalEntityId?: string;
    orgUnitId?: string;
  };
}

export interface ApprovalRejectDto {
  reason?: string;
}

export const GOVERNANCE_AUDIT_EVENTS = {
  APPROVAL_REQUESTED: 'REMEDIATION_APPROVAL_REQUESTED',
  APPROVED: 'REMEDIATION_APPROVED',
  REJECTED: 'REMEDIATION_REJECTED',
  EXECUTED: 'REMEDIATION_EXECUTED',
  EXPIRED: 'REMEDIATION_EXPIRED',
  ISSUE_ASSIGNED: 'ISSUE_ASSIGNED',
  ISSUE_UNASSIGNED: 'ISSUE_UNASSIGNED',
  ISSUE_DISMISSED: 'ISSUE_DISMISSED',
  ISSUE_REOPENED: 'ISSUE_REOPENED',
} as const;
