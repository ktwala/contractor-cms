import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { Country, Currency, PayFrequency } from '@prisma/client';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class PayGroupsPublisher extends BaseImportPublisher {
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

      const legalEntity = legalEntityByCode.get(payload.legal_entity_code as string);
      if (!legalEntity) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: legal_entity_code '${payload.legal_entity_code}' not found`,
        );
      }

      const country = (payload.country as string)?.toUpperCase?.();
      if (country !== 'LS' && country !== 'ZA') {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: country must be LS or ZA`,
        );
      }

      const currency = (payload.currency as string)?.toUpperCase?.();
      if (currency !== 'LSL' && currency !== 'ZAR') {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: currency must be LSL or ZAR`,
        );
      }

      const frequency = (payload.frequency as string)?.toUpperCase?.();
      if (!['WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(frequency)) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: frequency must be WEEKLY, BIWEEKLY, or MONTHLY`,
        );
      }

      const code = payload.code as string;
      const existing = await this.prisma.payGroup.findUnique({
        where: { code },
      });

      let payGroup: { id: string };
      let outcome: PublishOutcome;

      if (existing) {
        payGroup = await this.prisma.payGroup.update({
          where: { id: existing.id },
          data: {
            name: payload.name as string,
            country: country as Country,
            currency: currency as Currency,
            frequency: frequency as PayFrequency,
            legalEntityId: legalEntity.id,
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        payGroup = await this.prisma.payGroup.create({
          data: {
            code,
            name: payload.name as string,
            country: country as Country,
            currency: currency as Currency,
            frequency: frequency as PayFrequency,
            legalEntityId: legalEntity.id,
          },
        });
        outcome = 'created';
        summary.created += 1;
      }

      await this.markRowPublished(row.id, 'PayGroup', payGroup.id, outcome);
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
