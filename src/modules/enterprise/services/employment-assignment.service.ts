import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * EmploymentAssignment links Employment → Org Unit (required) + Cost Center (optional)
 * with effective dates. Critical for IGA/JML feeds, reporting hierarchy, manager chains.
 *
 * Validation: no overlapping assignments per employment.
 */
@Injectable()
export class EmploymentAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    employment_id: string;
    org_unit_id: string;
    cost_center_id?: string | null;
    position_id?: string | null;
    effective_from: string;
    effective_to?: string | null;
  }): Promise<string> {
    const effectiveFrom = new Date(data.effective_from);
    effectiveFrom.setHours(0, 0, 0, 0);
    const effectiveTo = data.effective_to
      ? (() => {
          const d = new Date(data.effective_to!);
          d.setHours(0, 0, 0, 0);
          return d;
        })()
      : null;

    // Verify employment exists
    const employment = await this.prisma.employment.findUnique({
      where: { id: data.employment_id },
      include: { legalEntity: true },
    });
    if (!employment) {
      throw new NotFoundException('Employment not found.');
    }

    // Verify org unit exists and belongs to same legal entity
    const orgUnit = await this.prisma.orgUnit.findUnique({
      where: { id: data.org_unit_id },
    });
    if (!orgUnit) {
      throw new NotFoundException('Org unit not found.');
    }
    if (orgUnit.legalEntityId !== employment.legalEntityId) {
      throw new BadRequestException(
        'Org unit must belong to the same legal entity as the employment.',
      );
    }

    // Verify cost center if provided
    if (data.cost_center_id) {
      const costCenter = await this.prisma.costCenter.findUnique({
        where: { id: data.cost_center_id },
      });
      if (!costCenter) {
        throw new NotFoundException('Cost center not found.');
      }
      if (costCenter.legalEntityId !== employment.legalEntityId) {
        throw new BadRequestException(
          'Cost center must belong to the same legal entity as the employment.',
        );
      }
    }

    // Verify position if provided: must match legal entity and org unit
    if (data.position_id) {
      const position = await this.prisma.position.findUnique({
        where: { id: data.position_id },
      });
      if (!position) {
        throw new NotFoundException('Position not found.');
      }
      if (position.legalEntityId !== employment.legalEntityId) {
        throw new BadRequestException(
          'Position must belong to the same legal entity as the employment.',
        );
      }
      if (position.orgUnitId !== data.org_unit_id) {
        throw new BadRequestException(
          'Position must belong to the same org unit as the assignment.',
        );
      }
    }

    // No overlapping assignments per employment: (from1, to1) must not overlap (from2, to2)
    const existing = await this.prisma.employmentAssignment.findMany({
      where: { employmentId: data.employment_id },
    });
    const newTo = effectiveTo ?? new Date('9999-12-31');
    const overlaps = existing.filter((a) => {
      const aTo = a.effectiveTo ?? new Date('9999-12-31');
      return effectiveFrom <= aTo && newTo >= a.effectiveFrom;
    });

    if (overlaps.length > 0) {
      throw new BadRequestException(
        `Assignment dates overlap with existing assignment(s). Effective dates must not overlap per employment.`,
      );
    }

    // No overlapping occupants per position: at most one assignment per position at any time
    if (data.position_id) {
      const positionOverlaps = await this.prisma.employmentAssignment.findMany({
        where: {
          positionId: data.position_id,
          effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31') },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: effectiveFrom } },
          ],
        },
      });
      if (positionOverlaps.length > 0) {
        throw new BadRequestException(
          'Another employee already occupies this position for the given effective dates. Only one occupant per position at a time.',
        );
      }
    }

    const created = await this.prisma.employmentAssignment.create({
      data: {
        employmentId: data.employment_id,
        orgUnitId: data.org_unit_id,
        costCenterId: data.cost_center_id ?? null,
        positionId: data.position_id ?? null,
        effectiveFrom,
        effectiveTo,
      },
    });
    return created.id;
  }

  /**
   * List employments with their assignments for a legal entity.
   * Used by the Employment Assignments overview page.
   */
  async listByLegalEntity(legalEntityId: string) {
    const employments = await this.prisma.employment.findMany({
      where: { legalEntityId },
      orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'desc' }],
      include: {
        employee: { select: { id: true, employeeNo: true, firstName: true, lastName: true } },
        legalEntity: { select: { id: true, code: true, name: true } },
        payGroup: { select: { id: true, code: true, name: true } },
        employmentAssignments: {
          orderBy: { effectiveFrom: 'desc' },
          include: {
            orgUnit: { select: { id: true, code: true, name: true } },
            costCenter: { select: { id: true, costCenterCode: true, costCenterName: true } },
            position: { select: { id: true, positionCode: true, title: true } },
          },
        },
      },
    });
    return employments.map((e) => ({
      id: e.id,
      employee_id: e.employeeId,
      employee: e.employee
        ? {
            id: e.employee.id,
            employee_no: e.employee.employeeNo,
            first_name: e.employee.firstName,
            last_name: e.employee.lastName,
          }
        : null,
      legal_entity: e.legalEntity ? { id: e.legalEntity.id, code: e.legalEntity.code, name: e.legalEntity.name } : null,
      pay_group: e.payGroup ? { id: e.payGroup.id, code: e.payGroup.code, name: e.payGroup.name } : null,
      job_title: e.jobTitle,
      effective_from: e.effectiveFrom.toISOString().split('T')[0],
      effective_to: e.effectiveTo?.toISOString().split('T')[0] ?? null,
      assignments: e.employmentAssignments.map((a) => ({
        id: a.id,
        org_unit_id: a.orgUnitId,
        org_unit: { code: a.orgUnit.code, name: a.orgUnit.name },
        cost_center_id: a.costCenterId,
        cost_center: a.costCenter
          ? { code: a.costCenter.costCenterCode, name: a.costCenter.costCenterName }
          : null,
        position_id: a.positionId ?? null,
        position: a.position
          ? { id: a.position.id, code: a.position.positionCode, title: a.position.title }
          : null,
        effective_from: a.effectiveFrom.toISOString().split('T')[0],
        effective_to: a.effectiveTo?.toISOString().split('T')[0] ?? null,
      })),
    }));
  }

  async update(
    assignmentId: string,
    data: {
      org_unit_id?: string;
      cost_center_id?: string | null;
      position_id?: string | null;
      effective_from?: string;
      effective_to?: string | null;
    },
  ) {
    const assignment = await this.prisma.employmentAssignment.findUnique({
      where: { id: assignmentId },
      include: { employment: { select: { legalEntityId: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found.');
    }

    const legalEntityId = assignment.employment.legalEntityId;
    const orgUnitId = data.org_unit_id ?? assignment.orgUnitId;
    const effectiveFrom = data.effective_from
      ? (() => { const d = new Date(data.effective_from!); d.setHours(0, 0, 0, 0); return d; })()
      : assignment.effectiveFrom;
    const effectiveTo = data.effective_to !== undefined
      ? (data.effective_to ? (() => { const d = new Date(data.effective_to!); d.setHours(0, 0, 0, 0); return d; })() : null)
      : assignment.effectiveTo;

    if (data.org_unit_id) {
      const orgUnit = await this.prisma.orgUnit.findUnique({ where: { id: data.org_unit_id } });
      if (!orgUnit) throw new NotFoundException('Org unit not found.');
      if (orgUnit.legalEntityId !== legalEntityId) {
        throw new BadRequestException('Org unit must belong to the same legal entity as the employment.');
      }
    }

    if (data.cost_center_id) {
      const cc = await this.prisma.costCenter.findUnique({ where: { id: data.cost_center_id } });
      if (!cc) throw new NotFoundException('Cost center not found.');
      if (cc.legalEntityId !== legalEntityId) {
        throw new BadRequestException('Cost center must belong to the same legal entity as the employment.');
      }
    }

    const positionId = data.position_id !== undefined ? (data.position_id || null) : assignment.positionId;
    if (positionId) {
      const pos = await this.prisma.position.findUnique({ where: { id: positionId } });
      if (!pos) throw new NotFoundException('Position not found.');
      if (pos.legalEntityId !== legalEntityId) {
        throw new BadRequestException('Position must belong to the same legal entity as the employment.');
      }
      if (pos.orgUnitId !== orgUnitId) {
        throw new BadRequestException('Position must belong to the same org unit as the assignment.');
      }
    }

    const newTo = effectiveTo ?? new Date('9999-12-31');
    const existing = await this.prisma.employmentAssignment.findMany({
      where: { employmentId: assignment.employmentId, id: { not: assignmentId } },
    });
    const overlaps = existing.filter((a) => {
      const aTo = a.effectiveTo ?? new Date('9999-12-31');
      return effectiveFrom <= aTo && newTo >= a.effectiveFrom;
    });
    if (overlaps.length > 0) {
      throw new BadRequestException('Assignment dates overlap with existing assignment(s).');
    }

    if (positionId) {
      const posOverlaps = await this.prisma.employmentAssignment.findMany({
        where: {
          positionId,
          id: { not: assignmentId },
          effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31') },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
      });
      if (posOverlaps.length > 0) {
        throw new BadRequestException('Another employee already occupies this position for the given effective dates.');
      }
    }

    await this.prisma.employmentAssignment.update({
      where: { id: assignmentId },
      data: {
        orgUnitId,
        costCenterId: data.cost_center_id !== undefined ? (data.cost_center_id || null) : undefined,
        positionId,
        effectiveFrom,
        effectiveTo,
      },
    });
    return assignmentId;
  }

  async listForEmployment(employmentId: string) {
    const items = await this.prisma.employmentAssignment.findMany({
      where: { employmentId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        orgUnit: { select: { id: true, code: true, name: true, legalEntityId: true } },
        costCenter: { select: { id: true, costCenterCode: true, costCenterName: true } },
        position: { select: { id: true, positionCode: true, title: true } },
      },
    });
    return items.map((a) => ({
      id: a.id,
      employment_id: a.employmentId,
      org_unit_id: a.orgUnitId,
      org_unit: { code: a.orgUnit.code, name: a.orgUnit.name },
      cost_center_id: a.costCenterId,
      cost_center: a.costCenter
        ? { code: a.costCenter.costCenterCode, name: a.costCenter.costCenterName }
        : null,
      position_id: a.positionId ?? null,
      position: a.position
        ? { code: a.position.positionCode, title: a.position.title }
        : null,
      effective_from: a.effectiveFrom.toISOString().split('T')[0],
      effective_to: a.effectiveTo?.toISOString().split('T')[0] ?? null,
    }));
  }
}
