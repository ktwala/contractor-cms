import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';
import { PublishOutcome, PublishSummary } from '../types/publish-result';

@Injectable()
export class EmploymentAssignmentsPublisher extends BaseImportPublisher {
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
      select: { id: true, code: true },
    });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    const orgUnits = await this.prisma.orgUnit.findMany({
      select: { id: true, code: true, legalEntityId: true },
    });
    const orgUnitByKey = new Map(
      orgUnits.map((ou) => [`${ou.legalEntityId}::${ou.code}`, ou]),
    );

    const costCenters = await this.prisma.costCenter.findMany({
      select: { id: true, costCenterCode: true, legalEntityId: true },
    });
    const costCenterByKey = new Map(
      costCenters.map((cc) => [`${cc.legalEntityId}::${cc.costCenterCode}`, cc]),
    );

    const positions = await this.prisma.position.findMany({
      select: {
        id: true,
        positionCode: true,
        legalEntityId: true,
        orgUnitId: true,
      },
    });
    const positionByKey = new Map(
      positions.map((p) => [`${p.legalEntityId}::${p.positionCode}`, p]),
    );

    const employments = await this.prisma.employment.findMany({
      select: {
        id: true,
        employeeId: true,
        legalEntityId: true,
      },
    });

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;
      const effectiveFrom = new Date(payload.effective_from as string);

      const employee = employeeByNo.get(payload.employee_no as string);
      if (!employee) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: employee_no '${payload.employee_no}' not found`,
        );
      }

      let legalEntity = payload.legal_entity_code
        ? legalEntityByCode.get(payload.legal_entity_code as string) ?? null
        : null;

      // Infer from employment when legal_entity_code is absent
      if (!legalEntity) {
        const empEmployments = employments.filter((e) => e.employeeId === employee.id);
        if (empEmployments.length === 1) {
          legalEntity = legalEntities.find((l) => l.id === empEmployments[0].legalEntityId) ?? null;
        } else if (legalEntities.length === 1) {
          legalEntity = legalEntities[0];
        }
      }
      if (!legalEntity) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: could not determine legal entity for employee '${payload.employee_no}'`,
        );
      }

      const employmentMatches = employments.filter(
        (e) =>
          e.employeeId === employee.id && e.legalEntityId === legalEntity!.id,
      );

      if (employmentMatches.length !== 1) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: expected exactly one employment for employee '${payload.employee_no}' in legal entity '${legalEntity.code}'`,
        );
      }

      const employment = employmentMatches[0];

      const orgUnit = orgUnitByKey.get(
        `${legalEntity.id}::${payload.org_unit_code}`,
      );
      if (!orgUnit) {
        throw new BadRequestException(
          `Cannot publish row ${row.rowNumber}: org_unit_code '${payload.org_unit_code}' not found`,
        );
      }

      let costCenterId: string | null = null;
      if (payload.cost_center_code) {
        const costCenter = costCenterByKey.get(
          `${legalEntity.id}::${payload.cost_center_code}`,
        );
        if (!costCenter) {
          throw new BadRequestException(
            `Cannot publish row ${row.rowNumber}: cost_center_code '${payload.cost_center_code}' not found`,
          );
        }
        costCenterId = costCenter.id;
      }

      let positionId: string | null = null;
      if (payload.position_code) {
        const position = positionByKey.get(
          `${legalEntity.id}::${payload.position_code}`,
        );
        if (!position) {
          throw new BadRequestException(
            `Cannot publish row ${row.rowNumber}: position_code '${payload.position_code}' not found`,
          );
        }

        if (position.orgUnitId !== orgUnit.id) {
          throw new BadRequestException(
            `Cannot publish row ${row.rowNumber}: position '${payload.position_code}' does not belong to org_unit '${payload.org_unit_code}'`,
          );
        }

        positionId = position.id;
      }

      const effectiveTo = payload.effective_to
        ? new Date(payload.effective_to as string)
        : null;

      const existing = await this.prisma.employmentAssignment.findFirst({
        where: {
          employmentId: employment.id,
          orgUnitId: orgUnit.id,
          effectiveFrom,
        },
      });

      let assignment: { id: string };
      let outcome: PublishOutcome;

      const data = {
        employmentId: employment.id,
        orgUnitId: orgUnit.id,
        costCenterId,
        positionId,
        effectiveFrom,
        effectiveTo,
      };

      if (existing) {
        assignment = await this.prisma.employmentAssignment.update({
          where: { id: existing.id },
          data: { effectiveTo, costCenterId, positionId },
        });
        outcome = 'updated';
        summary.updated += 1;
      } else {
        assignment = await this.prisma.employmentAssignment.create({
          data,
        });
        outcome = 'created';
        summary.created += 1;
      }

      await this.markRowPublished(
        row.id,
        'EmploymentAssignment',
        assignment.id,
        outcome,
      );
    }

    return this.finalizeJobPublished(job.id, user.id, summary);
  }
}
