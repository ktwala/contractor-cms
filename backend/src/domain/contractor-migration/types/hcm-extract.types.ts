import { HcmStagingRecordAction, MigrationSourceSystem } from '@prisma/client';

/** One HCM person row ready for staging (pre-hash). */
export interface HcmExtractRecord {
  sourcePersonId: string;
  sourcePersonNumber?: string | null;
  sourcePayload: Record<string, unknown>;
  recordAction?: HcmStagingRecordAction;
  extractTimestamp?: Date;
}

export type HcmExtractFileFormat = 'json' | 'csv';

export interface HcmFileExtractInput {
  organizationId: string;
  content: string | Buffer;
  format: HcmExtractFileFormat;
  waveLabel?: string;
  fileName?: string;
  dryRun?: boolean;
  sourceSystem?: MigrationSourceSystem;
}

export interface HcmOracleRestExtractInput {
  organizationId: string;
  waveLabel?: string;
  dryRun?: boolean;
  /** Oracle REST cursor / effective date — wired in a later PR. */
  since?: string;
}

export interface HcmExtractBatchSummary {
  migrationBatchId: string;
  organizationId: string;
  extractMode: 'FILE' | 'ORACLE_REST';
  dryRun: boolean;
  totalRows: number;
  inserted: number;
  skippedDuplicateHash: number;
  skippedInvalid: number;
  errors: Array<{ row?: number; sourcePersonId?: string; message: string }>;
  fileName?: string;
}
