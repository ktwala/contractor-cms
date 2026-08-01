import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export abstract class BaseImportPublisher {
  constructor(protected readonly prisma: PrismaService) {}

  protected async markRowPublished(
    rowId: string,
    entityType: string,
    entityId: string,
    outcome: PublishOutcome,
  ) {
    await this.prisma.dataImportRow.update({
      where: { id: rowId },
      data: {
        status: outcome === 'failed' ? 'INVALID' : 'PUBLISHED',
        publishedEntityType: entityType,
        publishedEntityId: entityId,
      },
    });
  }

  protected async markRowSkipped(rowId: string) {
    await this.prisma.dataImportRow.update({
      where: { id: rowId },
      data: { status: 'SKIPPED' },
    });
  }

  protected async finalizeJobPublished(
    jobId: string,
    userId: string,
    summary: PublishSummary,
  ) {
    return this.prisma.dataImportJob.update({
      where: { id: jobId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByUserId: userId,
        publishSummaryJson: summary as object,
      },
    });
  }
}
