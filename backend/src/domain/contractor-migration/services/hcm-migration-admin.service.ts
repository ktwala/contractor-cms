import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AccessContext } from '../../../core/auth/interfaces/access-context.interface';
import { SourceIntegrationService } from '../../../integration/source-integration.service';
import type { IngestFileBatchDto } from '../dto/ingest-file-batch.dto';
import type { ListBatchRowsDto } from '../dto/list-batch-rows.dto';
import type { ListMigrationBatchesDto } from '../dto/list-migration-batches.dto';
import type { PromoteBatchDto } from '../dto/promote-batch.dto';
import { HcmMigrationWorkshopService } from './hcm-migration-workshop.service';

/**
 * PR-CTR-6 — governed admin surface for migration batches (no direct ETL to CMS).
 * PR-CMS-INT-3 — bootstrap ingest routes through contractor source adapter boundary.
 */
@Injectable()
export class HcmMigrationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceIntegration: SourceIntegrationService,
    private readonly workshop: HcmMigrationWorkshopService,
  ) {}

  ingestFile(accessContext: AccessContext, organizationId: string, dto: IngestFileBatchDto) {
    return this.sourceIntegration.bootstrapContractorsFromFile(
      accessContext,
      organizationId,
      dto,
    );
  }

  ingestOracleRest(
    accessContext: AccessContext,
    organizationId: string,
    input: { waveLabel?: string; dryRun?: boolean; since?: string },
  ) {
    return this.sourceIntegration.bootstrapContractorsFromOracleRest(
      accessContext,
      organizationId,
      input,
    );
  }

  async listBatches(organizationId: string, query: ListMigrationBatchesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ContractorMigrationBatchWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.contractorMigrationBatch.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contractorMigrationBatch.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getBatch(organizationId: string, batchId: string) {
    const batch = await this.requireBatch(organizationId, batchId);
    const stagingCounts = await this.prisma.hcmContractorStaging.groupBy({
      by: ['validationStatus'],
      where: { migrationBatchId: batchId, organizationId },
      _count: { _all: true },
    });
    const quarantineCount = await this.prisma.hcmContractorQuarantine.count({
      where: {
        organizationId,
        staging: { migrationBatchId: batchId },
        resolvedAt: null,
      },
    });

    return {
      ...batch,
      stagingCounts: stagingCounts.map((row) => ({
        validationStatus: row.validationStatus,
        count: row._count._all,
      })),
      openQuarantineCount: quarantineCount,
    };
  }

  async listStaging(
    organizationId: string,
    batchId: string,
    query: ListBatchRowsDto,
  ) {
    await this.requireBatch(organizationId, batchId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.HcmContractorStagingWhereInput = {
      migrationBatchId: batchId,
      organizationId,
      ...(query.validationStatus
        ? { validationStatus: query.validationStatus }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.hcmContractorStaging.findMany({
        where,
        orderBy: { extractTimestamp: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sourcePersonId: true,
          sourcePersonNumber: true,
          extractTimestamp: true,
          recordAction: true,
          pipelineStatus: true,
          validationStatus: true,
          responsibleManagerValidationStatus: true,
          validationErrorsJson: true,
          promotedContractorId: true,
          promotedAt: true,
          issuedContractorBusinessId: true,
        },
      }),
      this.prisma.hcmContractorStaging.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async listQuarantine(
    organizationId: string,
    batchId: string,
    query: ListBatchRowsDto,
  ) {
    await this.requireBatch(organizationId, batchId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.HcmContractorQuarantineWhereInput = {
      organizationId,
      staging: {
        migrationBatchId: batchId,
        ...(query.validationStatus
          ? { validationStatus: query.validationStatus }
          : {}),
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.hcmContractorQuarantine.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          staging: {
            select: {
              id: true,
              sourcePersonId: true,
              sourcePersonNumber: true,
              validationStatus: true,
              pipelineStatus: true,
            },
          },
        },
      }),
      this.prisma.hcmContractorQuarantine.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async validateBatch(organizationId: string, batchId: string) {
    const results = await this.workshop.validateBatch(organizationId, batchId);
    return {
      migrationBatchId: batchId,
      validated: results.length,
      results,
    };
  }

  async promoteBatch(
    organizationId: string,
    batchId: string,
    dto: PromoteBatchDto = {},
  ) {
    const results = await this.workshop.promoteBatch(organizationId, batchId, {
      publishToIga: dto.publishToIga,
      dryRun: dto.dryRun,
    });
    return {
      migrationBatchId: batchId,
      attempted: results.length,
      results,
    };
  }

  private async requireBatch(organizationId: string, batchId: string) {
    const batch = await this.prisma.contractorMigrationBatch.findFirst({
      where: { id: batchId, organizationId },
    });
    if (!batch) {
      throw new NotFoundException(
        `Migration batch ${batchId} not found for organization`,
      );
    }
    return batch;
  }
}
