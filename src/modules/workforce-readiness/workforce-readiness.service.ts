import { Injectable, Logger } from '@nestjs/common';
import { ReadinessStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';

const TENANT_ID = 'default';

interface ReadinessDimensions {
  managerCompletenessPercent: number;
  orgAssignmentPercent: number;
  costCenterCoveragePercent: number;
  employmentCompletenessPercent: number;
  identityCompletenessPercent: number;
}

interface ReadinessResult extends ReadinessDimensions {
  readinessPercent: number;
  readinessStatus: ReadinessStatus;
  blockersCount: number;
  warningsCount: number;
}

@Injectable()
export class WorkforceReadinessService {
  private readonly logger = new Logger(WorkforceReadinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  computeScore(dims: ReadinessDimensions, blockersCount: number): ReadinessResult {
    const readinessPercent = Math.round(
      dims.managerCompletenessPercent * 0.30 +
      dims.orgAssignmentPercent * 0.25 +
      dims.costCenterCoveragePercent * 0.15 +
      dims.employmentCompletenessPercent * 0.20 +
      dims.identityCompletenessPercent * 0.10,
    );

    let readinessStatus: ReadinessStatus;
    if (blockersCount > 0 && readinessPercent < 70) readinessStatus = 'BLOCKED';
    else if (readinessPercent >= 90) readinessStatus = 'READY';
    else if (readinessPercent >= 70) readinessStatus = 'WARNING';
    else readinessStatus = 'INCOMPLETE';

    return {
      ...dims,
      readinessPercent,
      readinessStatus,
      blockersCount,
      warningsCount: 0,
    };
  }

  async computeOverviewReadiness(): Promise<ReadinessResult> {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        managerId: true,
        email: true,
        nationalId: true,
        employments: {
          where: { effectiveTo: null },
          select: { id: true },
        },
      },
    });
    const total = employees.length || 1;

    const withAssignment = await this.prisma.employmentAssignment.findMany({
      where: { effectiveTo: null },
      select: { employment: { select: { employeeId: true } } },
    });
    const assignedSet = new Set(withAssignment.map((a) => a.employment.employeeId));

    const withCostCenter = await this.prisma.employmentAssignment.findMany({
      where: { effectiveTo: null, costCenterId: { not: null } },
      select: { employment: { select: { employeeId: true } } },
    });
    const ccSet = new Set(withCostCenter.map((a) => a.employment.employeeId));

    const withManager = employees.filter((e) => e.managerId).length;
    const withEmployment = employees.filter((e) => e.employments.length > 0).length;
    const withAssigned = employees.filter((e) => assignedSet.has(e.id)).length;
    const withCC = employees.filter((e) => ccSet.has(e.id)).length;
    const withIdentity = employees.filter((e) => e.email && (e.nationalId)).length;

    const blockersCount = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true },
    });

    return this.computeScore(
      {
        managerCompletenessPercent: Math.round((withManager / total) * 100),
        orgAssignmentPercent: Math.round((withAssigned / total) * 100),
        costCenterCoveragePercent: Math.round((withCC / total) * 100),
        employmentCompletenessPercent: Math.round((withEmployment / total) * 100),
        identityCompletenessPercent: Math.round((withIdentity / total) * 100),
      },
      blockersCount,
    );
  }

  async computeLegalEntityReadiness(legalEntityId: string): Promise<ReadinessResult> {
    const directEmployees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', legalEntityId },
      select: {
        id: true,
        managerId: true,
        email: true,
        nationalId: true,
        employments: {
          where: { effectiveTo: null, legalEntityId },
          select: { id: true },
        },
      },
    });

    const employeesViaEmployment = await this.prisma.employment.findMany({
      where: { legalEntityId, effectiveTo: null },
      select: {
        employeeId: true,
        employee: {
          select: { id: true, status: true, managerId: true, email: true, nationalId: true },
        },
      },
      distinct: ['employeeId'],
    });

    const employeeMap = new Map<string, { id: string; managerId: string | null; email: string | null; nationalId: string | null; hasEmployment: boolean }>();
    for (const e of directEmployees) {
      employeeMap.set(e.id, { id: e.id, managerId: e.managerId, email: e.email, nationalId: e.nationalId, hasEmployment: e.employments.length > 0 });
    }
    for (const emp of employeesViaEmployment) {
      if (emp.employee.status === 'ACTIVE' && !employeeMap.has(emp.employeeId)) {
        employeeMap.set(emp.employeeId, {
          id: emp.employeeId,
          managerId: emp.employee.managerId,
          email: emp.employee.email,
          nationalId: emp.employee.nationalId,
          hasEmployment: true,
        });
      } else if (employeeMap.has(emp.employeeId)) {
        employeeMap.get(emp.employeeId)!.hasEmployment = true;
      }
    }

    const employees = Array.from(employeeMap.values());
    const total = employees.length || 1;

    const withAssignment = await this.prisma.employmentAssignment.findMany({
      where: {
        effectiveTo: null,
        employment: { legalEntityId },
      },
      select: { employment: { select: { employeeId: true } } },
    });
    const assignedSet = new Set(withAssignment.map((a) => a.employment.employeeId));

    const withCostCenter = await this.prisma.employmentAssignment.findMany({
      where: {
        effectiveTo: null,
        costCenterId: { not: null },
        employment: { legalEntityId },
      },
      select: { employment: { select: { employeeId: true } } },
    });
    const ccSet = new Set(withCostCenter.map((a) => a.employment.employeeId));

    const withManager = employees.filter((e) => e.managerId).length;
    const withEmployment = employees.filter((e) => e.hasEmployment).length;
    const withAssigned = employees.filter((e) => assignedSet.has(e.id)).length;
    const withCC = employees.filter((e) => ccSet.has(e.id)).length;
    const withIdentity = employees.filter((e) => e.email && e.nationalId).length;

    const blockersCount = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true, legalEntityId },
    });

    return this.computeScore(
      {
        managerCompletenessPercent: Math.round((withManager / total) * 100),
        orgAssignmentPercent: Math.round((withAssigned / total) * 100),
        costCenterCoveragePercent: Math.round((withCC / total) * 100),
        employmentCompletenessPercent: Math.round((withEmployment / total) * 100),
        identityCompletenessPercent: Math.round((withIdentity / total) * 100),
      },
      blockersCount,
    );
  }

  async refreshReadinessSnapshot(entityType: string, entityId: string, legalEntityId?: string) {
    let result: ReadinessResult;
    if (entityType === 'OVERVIEW') {
      result = await this.computeOverviewReadiness();
    } else if (entityType === 'LEGAL_ENTITY') {
      result = await this.computeLegalEntityReadiness(entityId);
    } else {
      result = await this.computeOverviewReadiness();
    }

    await this.prisma.readinessSnapshot.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId: TENANT_ID,
          entityType: entityType as any,
          entityId,
        },
      },
      update: {
        ...result,
        legalEntityId: legalEntityId || null,
        asOf: new Date(),
      },
      create: {
        tenantId: TENANT_ID,
        entityType: entityType as any,
        entityId,
        legalEntityId: legalEntityId || null,
        ...result,
      },
    });

    return result;
  }
}
