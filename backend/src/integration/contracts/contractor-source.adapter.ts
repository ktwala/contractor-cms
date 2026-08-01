import { SOURCE_SYSTEM_IDS, SourceSystemId } from './source-system.codes';
import type { HcmExtractBatchSummary } from '../../domain/contractor-migration/types/hcm-extract.types';
import type { IngestFileBatchDto } from '../../domain/contractor-migration/dto/ingest-file-batch.dto';

export type ContractorBootstrapOracleRestInput = {
  waveLabel?: string;
  dryRun?: boolean;
  since?: string;
};

/**
 * PR-CMS-INT-3 — contractor bootstrap ingest (HCM / migration staging only).
 * Must not promote to operational CMS or set contractor ACTIVE directly.
 */
export interface ContractorSourceAdapter {
  readonly sourceSystemId: SourceSystemId;

  bootstrapIngestFile(
    organizationId: string,
    input: IngestFileBatchDto,
  ): Promise<HcmExtractBatchSummary>;

  bootstrapIngestOracleRest(
    organizationId: string,
    input: ContractorBootstrapOracleRestInput,
  ): Promise<HcmExtractBatchSummary>;
}

export const ORACLE_HCM_BOOTSTRAP_ADAPTER_ID = SOURCE_SYSTEM_IDS.ORACLE_HCM;
