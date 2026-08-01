import { Injectable } from '@nestjs/common';
import {
  ContractorMigrationAuditAction,
  ContractorMigrationBatchStatus,
  HcmMigrationPipelineStatus,
  HcmStagingRecordAction,
  HcmStagingValidationStatus,
  MigrationSourceSystem,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { HcmExtractBatchSummary } from '../types/hcm-extract.types';
import type { HcmExtractRecord } from '../types/hcm-extract.types';
import { computeHcmSourceHash } from '../utils/source-hash.util';

export interface StagingWriteContext {
  organizationId: string;
  migrationBatchId: string;
  sourceSystem: MigrationSourceSystem;
  dryRun: boolean;
  extractMode: 'FILE' | 'ORACLE_REST';
  fileName?: string;
}

/**
 * PR-CTR-3 — persists extract rows to `hcm_contractor_staging` only.
 */
@Injectable()
export class HcmContractorStagingWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(
    organizationId: string,
    options: {
      waveLabel?: string;
      sourceSystem?: MigrationSourceSystem;
      dryRun?: boolean;
    },
  ): Promise<{ id: string }> {
    if (options.dryRun) {
      return { id: `dry-run-batch-${organizationId}` };
    }

    const batch = await this.prisma.contractorMigrationBatch.create({
      data: {
        organizationId,
        sourceSystem: options.sourceSystem ?? MigrationSourceSystem.ORACLE_HCM,
        waveLabel: options.waveLabel,
        status: ContractorMigrationBatchStatus.OPEN,
      },
    });

    await this.prisma.contractorMigrationAudit.create({
      data: {
        organizationId,
        migrationBatchId: batch.id,
        action: ContractorMigrationAuditAction.BATCH_STARTED,
        detailsJson: {
          waveLabel: options.waveLabel ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { id: batch.id };
  }

  async writeRecords(
    ctx: StagingWriteContext,
    records: HcmExtractRecord[],
  ): Promise<HcmExtractBatchSummary> {
    const summary: HcmExtractBatchSummary = {
      migrationBatchId: ctx.migrationBatchId,
      organizationId: ctx.organizationId,
      extractMode: ctx.extractMode,
      dryRun: ctx.dryRun,
      totalRows: records.length,
      inserted: 0,
      skippedDuplicateHash: 0,
      skippedInvalid: 0,
      errors: [],
      fileName: ctx.fileName,
    };

    if (ctx.dryRun) {
      for (const record of records) {
        try {
          computeHcmSourceHash(record.sourcePayload);
          summary.inserted++;
        } catch (err) {
          summary.skippedInvalid++;
          summary.errors.push({
            sourcePersonId: record.sourcePersonId,
            message: err instanceof Error ? err.message : 'Invalid row',
          });
        }
      }
      return summary;
    }

    await this.prisma.contractorMigrationBatch.update({
      where: { id: ctx.migrationBatchId },
      data: { status: ContractorMigrationBatchStatus.PROCESSING },
    });

    for (const record of records) {
      try {
        const sourceHash = computeHcmSourceHash(record.sourcePayload);
        const existing =
          await this.prisma.hcmContractorStaging.findUnique({
            where: {
              migrationBatchId_sourcePersonId_sourceHash: {
                migrationBatchId: ctx.migrationBatchId,
                sourcePersonId: record.sourcePersonId,
                sourceHash,
              },
            },
          });

        if (existing) {
          summary.skippedDuplicateHash++;
          continue;
        }

        const staging = await this.prisma.hcmContractorStaging.create({
          data: {
            organizationId: ctx.organizationId,
            migrationBatchId: ctx.migrationBatchId,
            sourceSystem: ctx.sourceSystem,
            sourcePersonId: record.sourcePersonId,
            sourcePersonNumber: record.sourcePersonNumber,
            sourcePayloadJson: record.sourcePayload as unknown as Prisma.InputJsonValue,
            sourceHash,
            extractTimestamp: record.extractTimestamp ?? new Date(),
            recordAction: record.recordAction ?? HcmStagingRecordAction.SNAPSHOT,
            pipelineStatus: HcmMigrationPipelineStatus.EXTRACTED,
            validationStatus: HcmStagingValidationStatus.PENDING,
          },
        });

        await this.prisma.contractorMigrationAudit.create({
          data: {
            organizationId: ctx.organizationId,
            migrationBatchId: ctx.migrationBatchId,
            stagingId: staging.id,
            action: ContractorMigrationAuditAction.EXTRACTED,
            detailsJson: {
              sourcePersonId: record.sourcePersonId,
              sourceHash,
              extractMode: ctx.extractMode,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        summary.inserted++;
      } catch (err) {
        summary.skippedInvalid++;
        summary.errors.push({
          sourcePersonId: record.sourcePersonId,
          message: err instanceof Error ? err.message : 'Write failed',
        });
      }
    }

    await this.prisma.contractorMigrationBatch.update({
      where: { id: ctx.migrationBatchId },
      data: {
        status: ContractorMigrationBatchStatus.COMPLETED,
        completedAt: new Date(),
        statsJson: summary as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.contractorMigrationAudit.create({
      data: {
        organizationId: ctx.organizationId,
        migrationBatchId: ctx.migrationBatchId,
        action: ContractorMigrationAuditAction.BATCH_COMPLETED,
        detailsJson: {
          inserted: summary.inserted,
          skippedDuplicateHash: summary.skippedDuplicateHash,
          skippedInvalid: summary.skippedInvalid,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return summary;
  }
}
