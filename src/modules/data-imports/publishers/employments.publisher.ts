import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { Country, EmploymentType } from '@prisma/client';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class EmploymentsPublisher extends BaseImportPublisher {
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

    const employees = await this.prisma.employee.findMany({
      select: { id: true, employeeNo: true },
    });
    const employeeByNo = new Map(employees.map((e) => [e.employeeNo, e]));

    const legalEntities = await this.prisma.legalEntity.findMany({
      select: { id: true, code: true, country: true },
    });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    const payGroups = await this.prisma.payGroup.findMany({
      select: { id: true, code: true, legalEntityId: true },
    });
    const payGroupByKey = new Map(payGroups.map((pg) => [`${pg.legalEntityId}::${pg.code}`, pg]));

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;
      const effectiveFromRaw =
        (payload.effective_from as string) || (payload.hire_date as string);
      const effectiveFrom = new Date(effectiveFromRaw);

      const employee = employeeByNo.get(payload.employee_no as string);
      if (!employee) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: employee_no '${payload.employee_no}' not found`,
        );
      }

      const legalEntity = legalEntityByCode.get(
        payload.legal_entity_code as string,
      );
      if (!legalEntity) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: legal_entity_code '${payload.legal_entity_code}' not found`,
        );
      }

      const payGroup = payGroupByKey.get(
        `${legalEntity.id}::${payload.pay_group_code}`,
      );
      if (!payGroup) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: pay_group_code '${payload.pay_group_code}' not found for legal entity`,
        );
      }

      const existing = await this.prisma.employment.findFirst({
        where: {
          employeeId: employee.id,
          legalEntityId: legalEntity.id,
          effectiveFrom,
        },
      });

      let employment: { id: string };
      let outcome: PublishOutcome;

      const data = {
        employeeId: employee.id,
        legalEntityId: legalEntity.id,
        payGroupId: payGroup.id,
        country: legalEntity.country as Country,
        effectiveFrom,
        effectiveTo: payload.termination_date
          ? new Date(payload.termination_date as string)
          : null,
        jobTitle: (payload.job_title as string) ?? null,
        employmentType: (['PERMANENT', 'CONTRACT', 'CASUAL'].includes(
          (payload.employment_type as string)?.toUpperCase?.() ?? '',
        )
          ? ((payload.employment_type as string).toUpperCase() as 'PERMANENT' | 'CONTRACT' | 'CASUAL')
          : 'PERMANENT') as EmploymentType,
      };

      if (existing) {
        employment = await this.prisma.employment.update({
          where: { id: existing.id },
          data: {
            effectiveTo: data.effectiveTo,
            jobTitle: data.jobTitle,
          },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        employment = await this.prisma.employment.create({
          data,
        });
        outcome = 'created';
        summary.created += 1;
      }

      await this.markRowPublished(row.id, 'Employment', employment.id, outcome);
    }

    // Backfill hireDate on employees from their earliest employment effectiveFrom
    const allEmployments = await this.prisma.employment.findMany({
      select: { employeeId: true, effectiveFrom: true },
      orderBy: { effectiveFrom: 'asc' },
    });
    const earliestByEmployee = new Map<string, Date>();
    for (const emp of allEmployments) {
      if (!earliestByEmployee.has(emp.employeeId)) {
        earliestByEmployee.set(emp.employeeId, emp.effectiveFrom);
      }
    }
    for (const [employeeId, earliest] of earliestByEmployee) {
      await this.prisma.employee.updateMany({
        where: { id: employeeId, hireDate: { not: earliest } },
        data: { hireDate: earliest },
      });
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
