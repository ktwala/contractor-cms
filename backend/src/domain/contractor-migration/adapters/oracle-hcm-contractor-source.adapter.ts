import { Injectable } from '@nestjs/common';
import {
  ContractorBootstrapOracleRestInput,
  ContractorSourceAdapter,
  ORACLE_HCM_BOOTSTRAP_ADAPTER_ID,
} from '../../../integration/contracts/contractor-source.adapter';
import type { IngestFileBatchDto } from '../dto/ingest-file-batch.dto';
import type { HcmExtractBatchSummary } from '../types/hcm-extract.types';
import { HcmContractorExtractAdapter } from './hcm-contractor-extract.adapter';

/**
 * PR-CMS-INT-3 — Oracle HCM bootstrap boundary (staging-only ingest).
 */
@Injectable()
export class OracleHcmContractorSourceAdapter implements ContractorSourceAdapter {
  readonly sourceSystemId = ORACLE_HCM_BOOTSTRAP_ADAPTER_ID;

  constructor(private readonly extract: HcmContractorExtractAdapter) {}

  bootstrapIngestFile(
    organizationId: string,
    input: IngestFileBatchDto,
  ): Promise<HcmExtractBatchSummary> {
    return this.extract.ingestFile({
      organizationId,
      format: input.format,
      content: input.content,
      fileName: input.fileName,
      waveLabel: input.waveLabel,
      dryRun: input.dryRun,
    });
  }

  bootstrapIngestOracleRest(
    organizationId: string,
    input: ContractorBootstrapOracleRestInput,
  ): Promise<HcmExtractBatchSummary> {
    return this.extract.ingestOracleRest({
      organizationId,
      waveLabel: input.waveLabel,
      dryRun: input.dryRun,
      since: input.since,
    });
  }
}
