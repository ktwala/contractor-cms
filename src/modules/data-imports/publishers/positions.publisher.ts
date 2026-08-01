import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class PositionsPublisher extends BaseImportPublisher {
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

    const orgUnits = await this.prisma.orgUnit.findMany({
      select: { id: true, code: true, legalEntityId: true },
    });
    const legalEntityIdToCode = new Map(legalEntities.map((le) => [le.id, le.code]));
    const orgUnitByKey = new Map(
      orgUnits.map((ou) => [`${legalEntityIdToCode.get(ou.legalEntityId)}::${ou.code}`, ou]),
    );

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;

      const legalEntity = legalEntityByCode.get(payload.legal_entity_code as string);
      if (!legalEntity) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: legal_entity_code '${payload.legal_entity_code}' not found`,
        );
      }

      const orgUnitKey = `${payload.legal_entity_code}::${payload.org_unit_code}`;
      const orgUnit = orgUnitByKey.get(orgUnitKey);
      if (!orgUnit) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: org_unit_code '${payload.org_unit_code}' not found for legal entity`,
        );
      }

      const positionCode = payload.position_code as string;
      const existing = await this.prisma.position.findFirst({
        where: {
          legalEntityId: legalEntity.id,
          positionCode,
        },
      });

      let position: { id: string };
      let outcome: PublishOutcome;

      if (existing) {
        position = await this.prisma.position.update({
          where: { id: existing.id },
          data: {
            title: payload.position_title as string,
            orgUnitId: orgUnit.id,
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        position = await this.prisma.position.create({
          data: {
            positionCode,
            title: payload.position_title as string,
            legalEntityId: legalEntity.id,
            orgUnitId: orgUnit.id,
          },
        });
        outcome = 'created';
        summary.created += 1;
      }

      await this.markRowPublished(row.id, 'Position', position.id, outcome);
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
