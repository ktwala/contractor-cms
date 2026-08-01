import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class OrgUnitsPublisher extends BaseImportPublisher {
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

    const publishedOrgUnits = new Map<string, { id: string }>();

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

      let parentOrgUnitId: string | null = null;
      if (payload.parent_org_unit_code) {
        const parentKey = `${legalEntity.id}::${payload.parent_org_unit_code}`;
        let parent: { id: string } | undefined = publishedOrgUnits.get(parentKey);

        if (!parent) {
          const fromDb = await this.prisma.orgUnit.findFirst({
            where: {
              code: payload.parent_org_unit_code as string,
              legalEntityId: legalEntity.id,
            },
            select: { id: true },
          });
          parent = fromDb ?? undefined;
        }

        if (!parent) {
          throw new BadRequestException(
            `Cannot publish row ${row.rowNumber}: parent_org_unit_code '${payload.parent_org_unit_code}' not found`,
          );
        }

        parentOrgUnitId = parent.id;
      }

      const code = payload.org_unit_code as string;
      const existing = await this.prisma.orgUnit.findUnique({
        where: {
          legalEntityId_code: {
            legalEntityId: legalEntity.id,
            code,
          },
        },
      });

      let orgUnit: { id: string };
      let outcome: PublishOutcome;

      if (existing) {
        orgUnit = await this.prisma.orgUnit.update({
          where: { id: existing.id },
          data: {
            name: payload.org_unit_name as string,
            parentOrgUnitId,
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        orgUnit = await this.prisma.orgUnit.create({
          data: {
            code,
            name: payload.org_unit_name as string,
            legalEntityId: legalEntity.id,
            parentOrgUnitId,
          },
        });
        outcome = 'created';
        summary.created += 1;
      }

      publishedOrgUnits.set(`${legalEntity.id}::${code}`, orgUnit);
      await this.markRowPublished(row.id, 'OrgUnit', orgUnit.id, outcome);
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
