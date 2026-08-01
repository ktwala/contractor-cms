import { Injectable, NotFoundException } from '@nestjs/common';
import { HcmStagingValidationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { HcmContractorExtractAdapter } from '../adapters/hcm-contractor-extract.adapter';
import { PromoteHcmContractorToCmsService } from './promote-hcm-contractor-to-cms.service';
import { HcmStagingValidationService } from './hcm-staging-validation.service';
import type { HcmExtractBatchSummary, HcmFileExtractInput } from '../types/hcm-extract.types';

export interface WorkshopPipelineOptions {
  validateAfterIngest?: boolean;
  promotePassed?: boolean;
  publishToIga?: boolean;
}

export interface WorkshopPipelineResult {
  ingest: HcmExtractBatchSummary;
  validation: Array<{
    stagingId: string;
    sourcePersonId: string;
    validationStatus: string;
    errorCount: number;
  }>;
  promotion: Array<{
    stagingId: string;
    success: boolean;
    contractorBusinessId?: string;
    errorCode?: string;
  }>;
}

/**
 * PR-CTR-3 workshop — file ingest → validate (2B) → promote (5) in one call.
 */
@Injectable()
export class HcmMigrationWorkshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extract: HcmContractorExtractAdapter,
    private readonly validation: HcmStagingValidationService,
    private readonly promote: PromoteHcmContractorToCmsService,
  ) {}

  async runFilePipeline(
    input: HcmFileExtractInput,
    options: WorkshopPipelineOptions = {},
  ): Promise<WorkshopPipelineResult> {
    const ingest = await this.extract.ingestFile(input);

    const result: WorkshopPipelineResult = {
      ingest,
      validation: [],
      promotion: [],
    };

    if (input.dryRun || ingest.dryRun) {
      return result;
    }

    const stagingRows = await this.prisma.hcmContractorStaging.findMany({
      where: { migrationBatchId: ingest.migrationBatchId },
      select: { id: true, sourcePersonId: true },
      orderBy: { extractTimestamp: 'asc' },
    });

    if (options.validateAfterIngest !== false) {
      for (const row of stagingRows) {
        const v = await this.validation.validate({
          stagingId: row.id,
          organizationId: input.organizationId,
        });
        result.validation.push({
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          validationStatus: v.validationStatus,
          errorCount: v.errors.length,
        });
      }
    }

    if (options.promotePassed) {
      const publishToIga = options.publishToIga ?? true;
      const passed = await this.prisma.hcmContractorStaging.findMany({
        where: {
          migrationBatchId: ingest.migrationBatchId,
          validationStatus: HcmStagingValidationStatus.PASSED,
        },
        select: { id: true },
      });

      for (const row of passed) {
        const p = await this.promote.execute(row.id, {
          publishToIga,
        });
        result.promotion.push({
          stagingId: row.id,
          success: p.success,
          contractorBusinessId: p.contractorBusinessId,
          errorCode: p.errorCode,
        });
      }
    }

    return result;
  }

  /** Validate all non-promoted staging rows in an existing batch (no re-ingest). */
  async validateBatch(
    organizationId: string,
    migrationBatchId: string,
  ): Promise<WorkshopPipelineResult['validation']> {
    await this.requireBatch(organizationId, migrationBatchId);

    const stagingRows = await this.prisma.hcmContractorStaging.findMany({
      where: {
        migrationBatchId,
        organizationId,
        validationStatus: { not: HcmStagingValidationStatus.PROMOTED },
      },
      select: { id: true, sourcePersonId: true },
      orderBy: { extractTimestamp: 'asc' },
    });

    const validation: WorkshopPipelineResult['validation'] = [];
    for (const row of stagingRows) {
      const v = await this.validation.validate({
        stagingId: row.id,
        organizationId,
      });
      validation.push({
        stagingId: row.id,
        sourcePersonId: row.sourcePersonId,
        validationStatus: v.validationStatus,
        errorCount: v.errors.length,
      });
    }
    return validation;
  }

  /** Promote PASSED staging rows in an existing batch (no re-ingest). */
  async promoteBatch(
    organizationId: string,
    migrationBatchId: string,
    options: { publishToIga?: boolean; dryRun?: boolean } = {},
  ): Promise<WorkshopPipelineResult['promotion']> {
    await this.requireBatch(organizationId, migrationBatchId);

    const publishToIga = options.publishToIga ?? true;
    const passed = await this.prisma.hcmContractorStaging.findMany({
      where: {
        migrationBatchId,
        organizationId,
        validationStatus: HcmStagingValidationStatus.PASSED,
        promotedContractorId: null,
      },
      select: { id: true },
    });

    const promotion: WorkshopPipelineResult['promotion'] = [];
    for (const row of passed) {
      const p = await this.promote.execute(row.id, {
        publishToIga,
        dryRun: options.dryRun,
      });
      promotion.push({
        stagingId: row.id,
        success: p.success,
        contractorBusinessId: p.contractorBusinessId,
        errorCode: p.errorCode,
      });
    }
    return promotion;
  }

  private async requireBatch(organizationId: string, migrationBatchId: string) {
    const batch = await this.prisma.contractorMigrationBatch.findFirst({
      where: { id: migrationBatchId, organizationId },
    });
    if (!batch) {
      throw new NotFoundException(
        `Migration batch ${migrationBatchId} not found for organization`,
      );
    }
    return batch;
  }
}
