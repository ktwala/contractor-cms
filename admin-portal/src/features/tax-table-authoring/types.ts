export type AuthoringStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
export type SourceType = 'TEMPLATE' | 'COPY' | 'IMPORT' | 'MANUAL';

export interface AuthoringBracket {
  id: string;
  seqNo: number;
  bracketFrom: number;
  bracketTo: number | null;
  marginalRate: number;
  baseTax: number;
  derivedBaseTax: number | null;
  isOpenEnded: boolean;
  baseTaxOverrideReason: string | null;
}

export interface AuthoringField {
  id: string;
  fieldCode: string;
  fieldValue: unknown;
}

export interface AuthoringVersion {
  id: string;
  countryCode: string;
  tableType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: AuthoringStatus;
  sourceType: SourceType;
  sourceReference: string | null;
  sourceChecksum: string | null;
  templateId: string | null;
  templateCode: string | null;
  templateVersion: string | null;
  copiedFromAuthoringId: string | null;
  publishedTaxTableSetId: string | null;
  publishReason: string | null;
  createdByUserId: string;
  reviewedByUserId: string | null;
  publishedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  brackets: AuthoringBracket[];
  fields: AuthoringField[];
}

export interface TemplateDefinition {
  templateId: string;
  countryCode: string;
  tableType: string;
  taxYear: string;
  compatiblePackCodes: string[];
  sourceReference: string;
  brackets: Array<{
    seqNo: number;
    bracketFrom: number;
    bracketTo: number | null;
    marginalRate: number;
    baseTax: number;
    isOpenEnded: boolean;
  }>;
  supplemental: Record<string, unknown>;
}

export interface TaxTableTemplateCardDto {
  templateId: string;
  templateCode: string;
  title: string;
  description?: string;
  countryCode: 'LS' | 'ZA';
  tableType: 'PAYE';
  taxYear: string;
  version: string;
  sourceReference: string;
  defaultEffectiveFrom: string;
  bracketCount: number;
  includedFieldLabels: string[];
  recommended: boolean;
  status: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  field?: string;
}

export interface SimulationResult {
  authoringVersionId: string;
  countryCode: string;
  taxYear: string;
  results: Array<{
    annualIncome: number;
    annualTax: number;
    effectiveRate: number;
    monthlyTax: number;
    bracketUsed: number;
  }>;
}

export interface DiffResult {
  metadataChanges: Array<{ field: string; previous: unknown; current: unknown }>;
  bracketChanges: Array<{ seqNo: number; field: string; previous: unknown; current: unknown }>;
  fieldChanges: Array<{ fieldCode: string; previous: unknown; current: unknown }>;
  bracketsAdded: number;
  bracketsRemoved: number;
}

export interface AuditEvent {
  id: string;
  authoringVersionId: string;
  eventType: string;
  actorUserId: string;
  payloadJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface PublishResult {
  authoringVersionId: string;
  runtimeTaxTableSetId: string;
  supersededRuntimeId: string | null;
  checksum: string;
}

export interface PublishPolicy {
  requireApprovalBeforePublish: boolean;
  disallowSelfApproval: boolean;
}

export interface TtaApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export const ERROR_LABELS: Record<string, string> = {
  TTA_INVALID_STATUS: 'Invalid status for this action',
  TTA_OVERLAP_CONFLICT: 'An active runtime table already exists for this scope and effective date',
  TTA_ALREADY_PUBLISHED: 'This version has already been published',
  TTA_PUBLISH_APPROVAL_REQUIRED: 'Approval is required before publishing',
  TTA_SELF_APPROVAL_BLOCKED: 'You cannot approve your own draft',
  TTA_VALIDATION_FAILED: 'Draft has validation errors',
  TTA_NOT_FOUND: 'Version not found',
  TTA_BASE_TAX_MISMATCH: 'Base tax does not match derived value',
  TTA_REQUIRED_FIELD_MISSING: 'A required field is missing',
  TTA_IMPACT_COUNTRY_MISMATCH: 'Draft country does not match the selected analysis country',
  TTA_IMPACT_NO_CLOSED_PAYRUN: 'No closed payrun found for the selected pay group',
  TTA_IMPACT_INVALID_STATUS: 'Impact analysis is only available for drafts, pending, or approved versions',
  TTA_IMPACT_UNSUPPORTED_COUNTRY: 'Impact analysis is not supported for this country',
  TTA_IMPACT_MISSING_PAYRUN: 'A payrun ID is required for this basis mode',
  TTA_IMPACT_MISSING_PAYGROUP: 'A pay group is required for last-closed-payrun mode',
  TTA_IMPACT_PAYRUN_NOT_FOUND: 'The specified payrun was not found',
  TTA_IMPACT_RUN_NOT_FOUND: 'Impact analysis run not found',
  TTA_IMPACT_EXPORT_UNSUPPORTED: 'Export format is not supported',
  TTA_IMPACT_REVIEW_INVALID_STATUS: 'Invalid review status',
  TTA_IMPACT_REVIEW_FOR_STALE_RUN: 'Cannot accept a stale impact analysis run — re-run the analysis first',
  TTA_IMPACT_PUBLISH_REQUIRES_RUN: 'Run impact analysis before publishing',
  TTA_IMPACT_PUBLISH_REQUIRES_ACCEPTED_REVIEW: 'An accepted impact review is required before publishing',
  TTA_IMPACT_PUBLISH_RUN_STALE: 'The latest impact analysis is outdated — re-run analysis before publishing',
};

export const STATUS_COLORS: Record<AuthoringStatus, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  PENDING_APPROVAL: { bg: '#fef3c7', text: '#92400e' },
  APPROVED: { bg: '#d1fae5', text: '#065f46' },
  PUBLISHED: { bg: '#dbeafe', text: '#1e40af' },
  ARCHIVED: { bg: '#f3f4f6', text: '#6b7280' },
};

export const SOURCE_COLORS: Record<SourceType, { bg: string; text: string }> = {
  TEMPLATE: { bg: '#ede9fe', text: '#5b21b6' },
  COPY: { bg: '#e0f2fe', text: '#0369a1' },
  IMPORT: { bg: '#fef3c7', text: '#92400e' },
  MANUAL: { bg: '#f3f4f6', text: '#374151' },
};
