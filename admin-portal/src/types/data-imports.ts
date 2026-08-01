export type ImportDatasetType =
  | 'LEGAL_ENTITIES'
  | 'ORG_UNITS'
  | 'COST_CENTERS'
  | 'EMPLOYEES'
  | 'EMPLOYMENTS'
  | 'EMPLOYMENT_ASSIGNMENTS'
  | 'POSITIONS'
  | 'MANAGER_RELATIONSHIPS'
  | 'PAY_GROUPS';

export type ImportStatus =
  | 'UPLOADED'
  | 'PARSED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'HAS_ERRORS'
  | 'APPROVED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'FAILED';

export type ImportRowStatus =
  | 'PENDING'
  | 'VALID'
  | 'INVALID'
  | 'PUBLISHED'
  | 'SKIPPED';

export type DataImportJob = {
  id: string;
  datasetType: ImportDatasetType;
  fileName: string;
  status: ImportStatus;
  uploadedByUserId: string;
  uploadedAt: string;
  validatedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  summaryJson?: {
    total_rows?: number;
    valid_rows?: number;
    invalid_rows?: number;
    warnings?: number;
    errors?: number;
  } | null;
  publishSummaryJson?: {
    created?: number;
    updated?: number;
    skipped?: number;
    failed?: number;
  } | null;
};

export type DataImportRow = {
  id: string;
  rowNumber: number;
  externalKey?: string | null;
  payloadJson: Record<string, unknown>;
  mappedJson?: Record<string, unknown> | null;
  status: ImportRowStatus;
  errorsCount: number;
  warningsCount: number;
  publishedEntityType?: string | null;
  publishedEntityId?: string | null;
  errors?: Array<{
    id: string;
    fieldName?: string | null;
    errorCode: string;
    message: string;
    severity: 'ERROR' | 'WARNING' | string;
  }>;
};
