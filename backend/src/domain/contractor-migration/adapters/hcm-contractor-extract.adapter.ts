import { Injectable } from '@nestjs/common';
import { MigrationSourceSystem } from '@prisma/client';
import { HcmContractorFileExtractParser } from '../parsers/hcm-contractor-file-extract.parser';
import { HcmOracleRestExtractProvider } from '../providers/hcm-oracle-rest-extract.provider';
import { HcmContractorStagingWriterService } from '../services/hcm-contractor-staging-writer.service';
import type {
  HcmExtractBatchSummary,
  HcmFileExtractInput,
  HcmOracleRestExtractInput,
} from '../types/hcm-extract.types';

/**
 * PR-CTR-3 — staging-only HCM ingest (file first, Oracle REST second).
 * Does not validate, promote, or touch operational workforce tables.
 */
@Injectable()
export class HcmContractorExtractAdapter {
  constructor(
    private readonly fileParser: HcmContractorFileExtractParser,
    private readonly stagingWriter: HcmContractorStagingWriterService,
    private readonly oracleRest: HcmOracleRestExtractProvider,
  ) {}

  async ingestFile(input: HcmFileExtractInput): Promise<HcmExtractBatchSummary> {
    const content =
      typeof input.content === 'string'
        ? input.content
        : input.content.toString('utf8');

    const records =
      input.format === 'csv'
        ? this.fileParser.parseCsv(content)
        : this.fileParser.parseJson(content);

    const batch = await this.stagingWriter.createBatch(input.organizationId, {
      waveLabel: input.waveLabel ?? `FILE_${input.fileName ?? 'extract'}`,
      sourceSystem: input.sourceSystem ?? MigrationSourceSystem.ORACLE_HCM,
      dryRun: input.dryRun,
    });

    return this.stagingWriter.writeRecords(
      {
        organizationId: input.organizationId,
        migrationBatchId: batch.id,
        sourceSystem: input.sourceSystem ?? MigrationSourceSystem.ORACLE_HCM,
        dryRun: input.dryRun ?? false,
        extractMode: 'FILE',
        fileName: input.fileName,
      },
      records,
    );
  }

  async ingestOracleRest(
    input: HcmOracleRestExtractInput,
  ): Promise<HcmExtractBatchSummary> {
    const records = await this.oracleRest.fetchContractors(input);

    const batch = await this.stagingWriter.createBatch(input.organizationId, {
      waveLabel: input.waveLabel ?? 'ORACLE_REST',
      dryRun: input.dryRun,
    });

    return this.stagingWriter.writeRecords(
      {
        organizationId: input.organizationId,
        migrationBatchId: batch.id,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        dryRun: input.dryRun ?? false,
        extractMode: 'ORACLE_REST',
      },
      records,
    );
  }
}
