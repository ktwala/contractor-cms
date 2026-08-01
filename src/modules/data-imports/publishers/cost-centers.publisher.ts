import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class CostCentersPublisher extends BaseImportPublisher {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async publish(
    job: {
      id: string;
      rows: Array<{
        id: string;
        rowNumber: number;
        status: string;
        mappedJson: unknown;
      }>;
    },
    user: { id: string },
  ) {
    const validRows = job.rows.filter((r) => r.status === 'VALID');
    const summary: PublishSummary = { created: 0, updated: 0, skipped: 0, failed: 0 };

    const legalEntities = await this.prisma.legalEntity.findMany({
      select: { id: true, code: true },
    });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;

      const legalEntity = legalEntityByCode.get(
        payload.legal_entity_code as string,
      );
      if (!legalEntity) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: legal_entity_code '${payload.legal_entity_code}' not found`,
        );
      }

      const costCenterCode = payload.cost_center_code as string;
      const existing = await this.prisma.costCenter.findUnique({
        where: { costCenterCode },
      });

      let costCenter: { id: string };
      let outcome: PublishOutcome;

      if (existing) {
        costCenter = await this.prisma.costCenter.update({
          where: { id: existing.id },
          data: {
            costCenterName: payload.cost_center_name as string,
            legalEntityId: legalEntity.id,
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        costCenter = await this.prisma.costCenter.create({
          data: {
            costCenterCode,
            costCenterName: payload.cost_center_name as string,
            legalEntityId: legalEntity.id,
            createdBy: user.id,
          },
        });
        outcome = 'created';
        summary.created += 1;
      }

      await this.markRowPublished(row.id, 'CostCenter', costCenter.id, outcome);
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
