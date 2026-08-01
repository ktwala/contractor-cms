import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { Country } from '@prisma/client';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class LegalEntitiesPublisher extends BaseImportPublisher {
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

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;

      const country = (payload.country as string)?.toUpperCase?.();
      if (country !== 'ZA' && country !== 'LS') {
        summary.failed += 1;
        continue;
      }

      const code = payload.code as string;
      const existing = await this.prisma.legalEntity.findUnique({
        where: { code },
      });

      let entity: { id: string };
      let outcome: PublishOutcome;

      if (existing) {
        entity = await this.prisma.legalEntity.update({
          where: { id: existing.id },
          data: {
            name: payload.name as string,
            country: country as Country,
            registrationNo: (payload.registration_no as string) ?? null,
            taxReference: (payload.tax_reference as string) ?? null,
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        entity = await this.prisma.legalEntity.create({
          data: {
            code,
            name: payload.name as string,
            country: country as Country,
            registrationNo: (payload.registration_no as string) ?? null,
            taxReference: (payload.tax_reference as string) ?? null,
          },
        });
        outcome = 'created';
        summary.created += 1;
      }

      await this.markRowPublished(row.id, 'LegalEntity', entity.id, outcome);
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
