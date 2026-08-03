import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class EmployeesPublisher extends BaseImportPublisher {
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

    const legalEntities = await this.prisma.legalEntity.findMany({ select: { id: true, code: true, country: true } });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;

      const hireDate = payload.hire_date
        ? new Date(payload.hire_date as string)
        : new Date('2000-01-01');

      const employeeNo = payload.employee_no as string;
      const legalEntityCode = payload.legal_entity_code as string;
      const legalEntity = legalEntityByCode.get(legalEntityCode);
      const taxNumber = (payload.tax_number as string) || null;
      const residencyStatus = (payload.residency_status as string) || 'RESIDENT';

      const existing = await this.prisma.employee.findUnique({
        where: { employeeNo },
      });

      let employee: { id: string };
      let outcome: PublishOutcome;

      if (existing) {
        employee = await this.prisma.employee.update({
          where: { id: existing.id },
          data: {
            firstName: payload.first_name as string,
            lastName: payload.last_name as string,
            email: (payload.email as string) ?? null,
            phone: (payload.phone as string) ?? null,
            dateOfBirth: payload.date_of_birth
              ? new Date(payload.date_of_birth as string)
              : null,
            nationalId: (payload.national_id as string) ?? null,
            legalEntityId: legalEntity?.id,
            country: legalEntity?.country,
            hireDate,
            status: payload.status as 'ACTIVE' | 'TERMINATED' | 'ON_LEAVE',
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        employee = await this.prisma.employee.create({
          data: {
            employeeNo,
            firstName: payload.first_name as string,
            lastName: payload.last_name as string,
            email: (payload.email as string) ?? null,
            phone: (payload.phone as string) ?? null,
            dateOfBirth: payload.date_of_birth
              ? new Date(payload.date_of_birth as string)
              : null,
            nationalId: (payload.national_id as string) ?? null,
            hireDate,
            legalEntityId: legalEntity?.id,
            country: legalEntity?.country,
            status: payload.status as 'ACTIVE' | 'TERMINATED' | 'ON_LEAVE',
          },
        });
        outcome = 'created';
        summary.created += 1;
      }

      if (legalEntity?.country) {
        const existingTaxProfile = await this.prisma.taxProfile.findFirst({
          where: { employeeId: employee.id, country: legalEntity.country as any },
        });

        if (existingTaxProfile) {
          await this.prisma.taxProfile.update({
            where: { id: existingTaxProfile.id },
            data: { tin: taxNumber, residencyStatus: residencyStatus as any },
          });
        } else {
          await this.prisma.taxProfile.create({
            data: {
              employeeId: employee.id,
              country: legalEntity.country as any,
              residencyStatus: residencyStatus as any,
              tin: taxNumber,
              effectiveFrom: hireDate,
            },
          });
        }
      }

      await this.markRowPublished(row.id, 'Employee', employee.id, outcome);
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
