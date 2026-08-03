import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { EmploymentAssignmentService } from '../enterprise/services/employment-assignment.service';
import { CreateEmploymentDto } from './dto/create-employment.dto';
import { Country } from '../../common/dto/enums.dto';

@Injectable()
export class EmploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly employmentAssignmentService: EmploymentAssignmentService,
  ) {}

  async create(employeeId: string, dto: CreateEmploymentDto, userId?: string, reason?: string) {
    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    // Verify legal entity exists and matches country
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: dto.legal_entity_id },
    });

    if (!legalEntity) {
      throw new NotFoundException({
        code: 'LEGAL_ENTITY_NOT_FOUND',
        message: `Legal entity with id '${dto.legal_entity_id}' not found`,
      });
    }

    if (legalEntity.country !== dto.country) {
      throw new BadRequestException({
        code: 'COUNTRY_MISMATCH',
        message: `Employment country (${dto.country}) must match legal entity country (${legalEntity.country})`,
      });
    }

    // Payroll assignment is optional for HCM-only employments. When supplied,
    // the pay group must exist and belong to the employing legal entity.
    if (dto.pay_group_id) {
      const payGroup = await this.prisma.payGroup.findUnique({
        where: { id: dto.pay_group_id },
      });

      if (!payGroup) {
        throw new NotFoundException({
          code: 'PAY_GROUP_NOT_FOUND',
          message: `Pay group with id '${dto.pay_group_id}' not found`,
        });
      }

      if (payGroup.legalEntityId !== dto.legal_entity_id) {
        throw new BadRequestException({
          code: 'PAY_GROUP_ENTITY_MISMATCH',
          message: 'Pay group does not belong to the specified legal entity',
        });
      }
    }

    const effectiveFrom = new Date(dto.effective_from);
    effectiveFrom.setHours(0, 0, 0, 0);

    // Prevent overlapping employments: new effective_from must be after the last closed employment's effective_to
    const lastEmployment = await this.prisma.employment.findFirst({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (lastEmployment?.effectiveTo) {
      const lastTo = new Date(lastEmployment.effectiveTo);
      lastTo.setHours(0, 0, 0, 0);
      if (effectiveFrom <= lastTo) {
        throw new BadRequestException({
          code: 'OVERLAPPING_EMPLOYMENT',
          message: `Rehire/employment effective_from (${dto.effective_from}) must be after the previous employment end date (${lastEmployment.effectiveTo.toISOString().split('T')[0]})`,
        });
      }
    }

    // Close any open employment before the new one (effectiveTo: null)
    const overlapping = await this.prisma.employment.findFirst({
      where: {
        employeeId,
        effectiveTo: null,
      },
    });
    if (overlapping) {
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);
      await this.prisma.employment.update({
        where: { id: overlapping.id },
        data: { effectiveTo: dayBefore },
      });
    }

    const employment = await this.prisma.employment.create({
      data: {
        employeeId,
        legalEntityId: dto.legal_entity_id,
        payGroupId: dto.pay_group_id ?? null,
        country: dto.country,
        jobTitle: dto.job_title,
        costCenter: dto.cost_center,
        employmentType: dto.employment_type,
        effectiveFrom,
        effectiveTo: dto.effective_to ? new Date(dto.effective_to) : null,
        notes: dto.notes,
      },
    });

    // Create EmploymentAssignment (org_unit required; cost_center and position optional)
    await this.employmentAssignmentService.create({
      employment_id: employment.id,
      org_unit_id: dto.org_unit_id,
      cost_center_id: dto.cost_center_id ?? null,
      position_id: dto.position_id ?? null,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to ?? null,
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Employment',
      entityId: employment.id,
      newValue: employment as any,
      reason,
    });

    // Refetch with assignments so response includes current_assignment
    const created = await this.prisma.employment.findUnique({
      where: { id: employment.id },
      include: {
        legalEntity: true,
        payGroup: true,
        employmentAssignments: {
          include: { orgUnit: true, costCenter: true, position: true },
        },
      },
    });
    return this.mapToResponse(created!, new Date(), { includeAssignments: false });
  }

  async listForEmployee(employeeId: string, options?: { include_assignments?: boolean; as_of?: Date }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    const employments = await this.prisma.employment.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        legalEntity: true,
        payGroup: true,
        employmentAssignments: {
          include: {
            orgUnit: true,
            costCenter: true,
            position: true,
          },
        },
      },
    });

    const asOfDate = options?.as_of ?? new Date();
    asOfDate.setHours(0, 0, 0, 0);

    return {
      items: employments.map((e) => {
        // For past employments, resolve assignment as of when that employment was active
        const dateForAssignment =
          e.effectiveTo && new Date(e.effectiveTo) < asOfDate
            ? new Date(e.effectiveFrom)
            : asOfDate;
        return this.mapToResponse(e, dateForAssignment, {
          includeAssignments: options?.include_assignments === true,
        });
      }),
    };
  }

  /**
   * Enriched current employment with current_assignment and next_assignment.
   * Used by HR export and IGA integrations.
   */
  async getCurrentEmploymentEnriched(employeeId: string, asOfDate?: Date) {
    const employments = await this.prisma.employment.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        legalEntity: true,
        payGroup: true,
        employmentAssignments: {
          include: { orgUnit: true, costCenter: true, position: true },
        },
      },
    });

    const today = asOfDate ?? new Date();
    today.setHours(0, 0, 0, 0);

    const current = employments.find((e) => {
      const from = new Date(e.effectiveFrom);
      from.setHours(0, 0, 0, 0);
      const to = e.effectiveTo ? new Date(e.effectiveTo) : new Date('9999-12-31');
      to.setHours(23, 59, 59, 999);
      return from <= today && to >= today;
    });

    return current ? this.mapToResponse(current, today, { includeAssignments: false }) : null;
  }

  async getCurrentEmployment(employeeId: string, asOfDate?: Date) {
    const date = asOfDate || new Date();

    return this.prisma.employment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        legalEntity: true,
        payGroup: true,
      },
    });
  }

  private mapToResponse(
    employment: any,
    asOfDate?: Date,
    options?: { includeAssignments?: boolean },
  ) {
    const today = asOfDate ?? new Date();
    today.setHours(0, 0, 0, 0);

    const assignmentDto = (a: any) =>
      a?.orgUnit
        ? {
            org_unit_id: a.orgUnitId,
            org_unit: { id: a.orgUnit.id, code: a.orgUnit.code, name: a.orgUnit.name },
            cost_center_id: a.costCenterId,
            cost_center: a.costCenter
              ? {
                  id: a.costCenter.id,
                  code: a.costCenter.costCenterCode,
                  name: a.costCenter.costCenterName,
                }
              : null,
            position_id: a.positionId ?? null,
            position: a.position
              ? {
                  id: a.position.id,
                  code: a.position.positionCode,
                  title: a.position.title,
                }
              : null,
            effective_from: a.effectiveFrom.toISOString().split('T')[0],
            effective_to: a.effectiveTo?.toISOString().split('T')[0] ?? null,
          }
        : null;

    type AssignmentDto = {
      org_unit_id: string;
      org_unit: { id: string; code: string; name: string };
      cost_center_id: string | null;
      cost_center: { id: string; code: string; name: string } | null;
      position_id: string | null;
      position: { id: string; code: string; title: string } | null;
      effective_from: string;
      effective_to: string | null;
    } | null;

    let current_assignment: AssignmentDto = null;
    let next_assignment: AssignmentDto = null;

    const assignments = employment.employmentAssignments ?? [];

    // Current: effective_from <= today AND (effective_to null OR effective_to >= today)
    const current = assignments.find((a: any) => {
      const from = new Date(a.effectiveFrom);
      from.setHours(0, 0, 0, 0);
      const to = a.effectiveTo ? new Date(a.effectiveTo) : new Date('9999-12-31');
      to.setHours(23, 59, 59, 999);
      return from <= today && to >= today;
    });

    // Next: earliest assignment with effective_from > today
    const future = assignments
      .filter((a: any) => {
        const from = new Date(a.effectiveFrom);
        from.setHours(0, 0, 0, 0);
        return from > today;
      })
      .sort((a: any, b: any) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
    const next = future[0] ?? null;

    current_assignment = assignmentDto(current);
    next_assignment = assignmentDto(next);

    const base = {
      id: employment.id,
      employee_id: employment.employeeId,
      legal_entity_id: employment.legalEntityId,
      pay_group_id: employment.payGroupId,
      country: employment.country as Country,
      job_title: employment.jobTitle,
      cost_center: employment.costCenter,
      employment_type: employment.employmentType,
      effective_from: employment.effectiveFrom.toISOString().split('T')[0],
      effective_to: employment.effectiveTo?.toISOString().split('T')[0] || null,
      notes: employment.notes,
      created_at: employment.createdAt.toISOString(),
      updated_at: employment.updatedAt?.toISOString() ?? employment.createdAt.toISOString(),
      current_assignment,
      next_assignment,
    };

    if (options?.includeAssignments) {
      const assignmentHistory = assignments.map((a: any) => ({
        id: a.id,
        org_unit_id: a.orgUnitId,
        org_unit: a.orgUnit
          ? { id: a.orgUnit.id, code: a.orgUnit.code, name: a.orgUnit.name }
          : null,
        cost_center_id: a.costCenterId,
        cost_center: a.costCenter
          ? {
              id: a.costCenter.id,
              code: a.costCenter.costCenterCode,
              name: a.costCenter.costCenterName,
            }
          : null,
        position_id: a.positionId ?? null,
        position: a.position
          ? { id: a.position.id, code: a.position.positionCode, title: a.position.title }
          : null,
        effective_from: a.effectiveFrom.toISOString().split('T')[0],
        effective_to: a.effectiveTo?.toISOString().split('T')[0] ?? null,
      }));
      return { ...base, assignments: assignmentHistory };
    }

    return base;
  }
}
