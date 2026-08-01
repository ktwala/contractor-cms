/**
 * PR-CTR-2B — migration pipeline & validation contracts (no implementation in PR-CTR-2).
 */

export const HCM_PIPELINE_STATUSES = [
  'EXTRACTED',
  'NORMALIZED',
  'VALIDATED',
  'QUARANTINED',
  'APPROVED',
  'CTR_ISSUED',
  'PROMOTED',
  'IGA_PUBLISHED',
] as const;

export type HcmMigrationPipelineStatus =
  (typeof HCM_PIPELINE_STATUSES)[number];

export const HCM_VALIDATION_STATUSES = [
  'PENDING',
  'PASSED',
  'FAILED',
  'QUARANTINED',
  'PROMOTED',
] as const;

export type HcmStagingValidationStatus =
  (typeof HCM_VALIDATION_STATUSES)[number];

export const HCM_SPONSOR_VALIDATION_STATUSES = [
  'VALID',
  'MISSING',
  'INACTIVE',
  'UNKNOWN',
  'MISMATCH',
  'MULTIPLE',
] as const;

export type HcmResponsibleManagerValidationStatus =
  (typeof HCM_SPONSOR_VALIDATION_STATUSES)[number];

export interface ValidationErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ValidateHcmStagingRowInput {
  stagingId: string;
  organizationId: string;
  dryRun?: boolean;
}

export interface ValidateHcmStagingRowResult {
  validationStatus: HcmStagingValidationStatus;
  pipelineStatus: HcmMigrationPipelineStatus;
  responsibleManagerValidationStatus: HcmResponsibleManagerValidationStatus | null;
  errors: ValidationErrorDetail[];
  quarantineReasonCodes: string[];
}

/** PR-CTR-2B — implemented in PR-CTR-4. */
export interface HcmStagingValidationService {
  normalize(stagingId: string): Promise<HcmMigrationPipelineStatus>;
  validate(
    input: ValidateHcmStagingRowInput,
  ): Promise<ValidateHcmStagingRowResult>;
}
