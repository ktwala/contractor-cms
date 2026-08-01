import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { PositionStatus } from '@prisma/client';

/**
 * Position = slot in org (e.g. PAY-001 Payroll Officer).
 * Vacant = ACTIVE position with no current EmploymentAssignment referencing it.
 */
@Injectable()
export class PositionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    legal_entity_id?: string;
    org_unit_id?: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.legal_entity_id) where.legalEntityId = params.legal_entity_id;
    if (params.org_unit_id) where.orgUnitId = params.org_unit_id;
    if (params.status) {
      const s = params.status.toUpperCase();
      if (['ACTIVE', 'FROZEN', 'CLOSED'].includes(s)) {
        where.status = s as PositionStatus;
      }
    }

    const positions = await this.prisma.position.findMany({
      where,
      orderBy: [{ orgUnit: { code: 'asc' } }, { positionCode: 'asc' }],
      include: {
        orgUnit: { select: { id: true, code: true, name: true, legalEntityId: true } },
        defaultCostCenter: {
          select: { id: true, costCenterCode: true, costCenterName: true },
        },
        assignments: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date() } },
            ],
          },
          include: {
            employment: {
              include: {
                employee: {
                  select: { id: true, employeeNo: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return positions.map((p) => {
      const currentAssignment = p.assignments.find((a) => {
        const from = new Date(a.effectiveFrom);
        from.setHours(0, 0, 0, 0);
        const to = a.effectiveTo ? new Date(a.effectiveTo) : new Date('9999-12-31');
        to.setHours(23, 59, 59, 999);
        return from <= today && to >= today;
      });

      return {
        id: p.id,
        position_code: p.positionCode,
        title: p.title,
        status: p.status,
        legal_entity_id: p.legalEntityId,
        org_unit_id: p.orgUnitId,
        org_unit: p.orgUnit
          ? { id: p.orgUnit.id, code: p.orgUnit.code, name: p.orgUnit.name }
          : null,
        default_cost_center_id: p.defaultCostCenterId,
        default_cost_center: p.defaultCostCenter
          ? {
              id: p.defaultCostCenter.id,
              code: p.defaultCostCenter.costCenterCode,
              name: p.defaultCostCenter.costCenterName,
            }
          : null,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
        current_occupant: currentAssignment?.employment?.employee
          ? {
              employee_id: currentAssignment.employment.employee.id,
              employee_no: currentAssignment.employment.employee.employeeNo,
              employee_name: `${currentAssignment.employment.employee.firstName} ${currentAssignment.employment.employee.lastName}`,
            }
          : null,
      };
    });
  }

  async getById(id: string) {
    const p = await this.prisma.position.findUnique({
      where: { id },
      include: {
        legalEntity: { select: { id: true, code: true, name: true } },
        orgUnit: { select: { id: true, code: true, name: true } },
        defaultCostCenter: {
          select: { id: true, costCenterCode: true, costCenterName: true },
        },
        assignments: {
          orderBy: { effectiveFrom: 'desc' },
          include: {
            employment: {
              include: {
                employee: {
                  select: { id: true, employeeNo: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Position not found.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentAssignment = p.assignments.find((a) => {
      const from = new Date(a.effectiveFrom);
      from.setHours(0, 0, 0, 0);
      const to = a.effectiveTo ? new Date(a.effectiveTo) : new Date('9999-12-31');
      to.setHours(23, 59, 59, 999);
      return from <= today && to >= today;
    });

    return {
      id: p.id,
      position_code: p.positionCode,
      title: p.title,
      status: p.status,
      legal_entity_id: p.legalEntityId,
      legal_entity: p.legalEntity,
      org_unit_id: p.orgUnitId,
      org_unit: p.orgUnit,
      default_cost_center_id: p.defaultCostCenterId,
      default_cost_center: p.defaultCostCenter,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      current_occupant: currentAssignment?.employment?.employee
        ? {
            employee_id: currentAssignment.employment.employee.id,
            employee_no: currentAssignment.employment.employee.employeeNo,
            employee_name: `${currentAssignment.employment.employee.firstName} ${currentAssignment.employment.employee.lastName}`,
          }
        : null,
      assignments: p.assignments.map((a) => ({
        id: a.id,
        effective_from: a.effectiveFrom.toISOString().split('T')[0],
        effective_to: a.effectiveTo?.toISOString().split('T')[0] ?? null,
        employee: a.employment?.employee
          ? {
              id: a.employment.employee.id,
              employee_no: a.employment.employee.employeeNo,
              name: `${a.employment.employee.firstName} ${a.employment.employee.lastName}`,
            }
          : null,
      })),
    };
  }

  async create(data: {
    legal_entity_id: string;
    org_unit_id: string;
    position_code: string;
    title: string;
    default_cost_center_id?: string | null;
  }) {
    const orgUnit = await this.prisma.orgUnit.findUnique({
      where: { id: data.org_unit_id },
    });
    if (!orgUnit) throw new NotFoundException('Org unit not found.');
    if (orgUnit.legalEntityId !== data.legal_entity_id) {
      throw new BadRequestException(
        'Org unit must belong to the specified legal entity.',
      );
    }

    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: data.legal_entity_id },
    });
    if (!legalEntity) throw new NotFoundException('Legal entity not found.');

    if (data.default_cost_center_id) {
      const cc = await this.prisma.costCenter.findUnique({
        where: { id: data.default_cost_center_id },
      });
      if (!cc) throw new NotFoundException('Default cost center not found.');
      if (cc.legalEntityId !== data.legal_entity_id) {
        throw new BadRequestException(
          'Default cost center must belong to the specified legal entity.',
        );
      }
    }

    const existing = await this.prisma.position.findUnique({
      where: {
        legalEntityId_positionCode: {
          legalEntityId: data.legal_entity_id,
          positionCode: data.position_code,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Position code '${data.position_code}' already exists for this legal entity.`,
      );
    }

    const position = await this.prisma.position.create({
      data: {
        legalEntityId: data.legal_entity_id,
        orgUnitId: data.org_unit_id,
        positionCode: data.position_code.trim(),
        title: data.title.trim(),
        defaultCostCenterId: data.default_cost_center_id ?? null,
        status: 'ACTIVE',
      },
    });
    return position.id;
  }

  async update(id: string, data: { title?: string; default_cost_center_id?: string | null }) {
    const position = await this.prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundException('Position not found.');

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.default_cost_center_id !== undefined) {
      if (data.default_cost_center_id) {
        const cc = await this.prisma.costCenter.findUnique({
          where: { id: data.default_cost_center_id },
        });
        if (!cc) throw new NotFoundException('Cost center not found.');
        if (cc.legalEntityId !== position.legalEntityId) {
          throw new BadRequestException('Cost center must belong to the same legal entity.');
        }
      }
      updateData.defaultCostCenterId = data.default_cost_center_id;
    }

    await this.prisma.position.update({
      where: { id },
      data: updateData,
    });
    return { status: 'updated' };
  }

  async setStatus(id: string, status: 'FROZEN' | 'CLOSED') {
    const position = await this.prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundException('Position not found.');

    await this.prisma.position.update({
      where: { id },
      data: { status },
    });
    return { status };
  }

  async delete(id: string) {
    const position = await this.prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundException('Position not found.');

    const hasAssignments = await this.prisma.employmentAssignment.count({
      where: { positionId: id },
    });
    if (hasAssignments > 0) {
      throw new BadRequestException(
        'Cannot delete position with existing assignments. Close it instead.',
      );
    }

    await this.prisma.position.delete({ where: { id } });
    return { status: 'deleted' };
  }
}
