import { Injectable, Logger } from '@nestjs/common';
import { WorkforceIssueType, WorkforceIssueSeverity, WorkforceIssueEntityType } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

const TENANT_ID = 'default';

interface DetectedIssue {
  entityType: WorkforceIssueEntityType;
  entityId: string;
  legalEntityId?: string;
  orgUnitId?: string;
  costCenterId?: string;
  employeeId?: string;
  employmentId?: string;
  assignmentId?: string;
  issueType: WorkforceIssueType;
  severity: WorkforceIssueSeverity;
  title: string;
  details?: string;
  affectsReadiness?: boolean;
  blocksExport?: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WorkforceIssuesService {
  private readonly logger = new Logger(WorkforceIssuesService.name);
  private detectionRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async detectAllIssues(): Promise<{ created: number; resolved: number; total: number }> {
    if (this.detectionRunning) {
      this.logger.warn('Issue detection already in progress, skipping concurrent run');
      const total = await this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, resolvedAt: null },
      });
      return { created: 0, resolved: 0, total };
    }

    this.detectionRunning = true;
    try {
      return await this.runDetection();
    } finally {
      this.detectionRunning = false;
    }
  }

  private async runDetection(): Promise<{ created: number; resolved: number; total: number }> {
    const startTime = Date.now();
    const detected: DetectedIssue[] = [];

    detected.push(...(await this.detectEmployeeIssues()));
    detected.push(...(await this.detectOrgUnitIssues()));
    detected.push(...(await this.detectCostCenterIssues()));
    detected.push(...(await this.detectExportIssues()));

    // Build a set of manually dismissed issues so detection won't reopen them
    const dismissed = await this.prisma.workforceIssue.findMany({
      where: { tenantId: TENANT_ID, resolvedAt: { not: null }, resolvedByUserId: { not: null } },
      select: { entityType: true, entityId: true, issueType: true },
    });
    const dismissedKeys = new Set(
      dismissed.map((d) => `${d.entityType}:${d.entityId}:${d.issueType}`),
    );

    let created = 0;
    for (const issue of detected) {
      const key = `${issue.entityType}:${issue.entityId}:${issue.issueType}`;
      if (dismissedKeys.has(key)) continue;

      await this.prisma.workforceIssue.upsert({
        where: {
          tenantId_entityType_entityId_issueType: {
            tenantId: TENANT_ID,
            entityType: issue.entityType,
            entityId: issue.entityId,
            issueType: issue.issueType,
          },
        },
        update: {
          severity: issue.severity,
          title: issue.title,
          details: issue.details,
          legalEntityId: issue.legalEntityId,
          orgUnitId: issue.orgUnitId,
          costCenterId: issue.costCenterId,
          employeeId: issue.employeeId,
          employmentId: issue.employmentId,
          assignmentId: issue.assignmentId,
          affectsReadiness: issue.affectsReadiness ?? true,
          blocksExport: issue.blocksExport ?? false,
          metadata: issue.metadata as object ?? undefined,
          resolvedAt: null,
          resolvedByUserId: null,
          resolutionNote: null,
        },
        create: {
          tenantId: TENANT_ID,
          entityType: issue.entityType,
          entityId: issue.entityId,
          issueType: issue.issueType,
          severity: issue.severity,
          title: issue.title,
          details: issue.details,
          legalEntityId: issue.legalEntityId,
          orgUnitId: issue.orgUnitId,
          costCenterId: issue.costCenterId,
          employeeId: issue.employeeId,
          employmentId: issue.employmentId,
          assignmentId: issue.assignmentId,
          affectsReadiness: issue.affectsReadiness ?? true,
          blocksExport: issue.blocksExport ?? false,
          metadata: issue.metadata as object ?? undefined,
        },
      });
      created++;
    }

    // Auto-resolve issues no longer detected (but don't touch manually dismissed ones)
    const resolved = await this.prisma.workforceIssue.updateMany({
      where: {
        tenantId: TENANT_ID,
        resolvedAt: null,
        NOT: detected.length > 0
          ? { OR: detected.map((d) => ({ entityType: d.entityType, entityId: d.entityId, issueType: d.issueType })) }
          : undefined,
      },
      data: { resolvedAt: new Date() },
    });

    const total = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, resolvedAt: null },
    });

    const elapsed = Date.now() - startTime;
    this.logger.log(`Issue detection complete in ${elapsed}ms: ${created} upserted, ${resolved.count} auto-resolved, ${dismissedKeys.size} dismissed (skipped), ${total} active`);

    return { created, resolved: resolved.count, total };
  }

  // ─── Employee issues ──────────────────────────────────────────

  private async detectEmployeeIssues(): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        managerId: true,
        hierarchyRole: true,
        email: true,
        nationalId: true,
        hireDate: true,
        legalEntityId: true,
        employments: {
          select: { id: true, effectiveTo: true },
        },
      },
    });

    const employeesWithAssignment = new Set(
      (await this.prisma.employmentAssignment.findMany({
        where: { effectiveTo: null },
        select: { employment: { select: { employeeId: true } } },
      })).map((a) => a.employment.employeeId),
    );

    const employeesWithCostCenter = new Set(
      (await this.prisma.employmentAssignment.findMany({
        where: { effectiveTo: null, costCenterId: { not: null } },
        select: { employment: { select: { employeeId: true } } },
      })).map((a) => a.employment.employeeId),
    );

    for (const emp of employees) {
      const name = `${emp.firstName} ${emp.lastName}`;

      if (!emp.managerId && emp.hierarchyRole !== 'TOP_OF_CHAIN') {
        issues.push({
          entityType: 'EMPLOYEE',
          entityId: emp.id,
          employeeId: emp.id,
          legalEntityId: emp.legalEntityId ?? undefined,
          issueType: 'MISSING_MANAGER',
          severity: 'WARNING',
          title: `${name} (${emp.employeeNo}) has no manager assigned`,
          blocksExport: true,
          metadata: { employee_no: emp.employeeNo },
        });
      }

      const activeEmployments = emp.employments.filter((e) => !e.effectiveTo);
      if (activeEmployments.length === 0) {
        issues.push({
          entityType: 'EMPLOYEE',
          entityId: emp.id,
          employeeId: emp.id,
          legalEntityId: emp.legalEntityId ?? undefined,
          issueType: 'EMPLOYEE_WITHOUT_EMPLOYMENT',
          severity: 'ERROR',
          title: `${name} (${emp.employeeNo}) has no active employment`,
          blocksExport: true,
        });
      }

      if (!employeesWithAssignment.has(emp.id)) {
        issues.push({
          entityType: 'EMPLOYEE',
          entityId: emp.id,
          employeeId: emp.id,
          legalEntityId: emp.legalEntityId ?? undefined,
          issueType: 'MISSING_ORG_ASSIGNMENT',
          severity: 'WARNING',
          title: `${name} (${emp.employeeNo}) has no active org assignment`,
          blocksExport: true,
        });
      }

      if (!employeesWithCostCenter.has(emp.id)) {
        issues.push({
          entityType: 'EMPLOYEE',
          entityId: emp.id,
          employeeId: emp.id,
          legalEntityId: emp.legalEntityId ?? undefined,
          issueType: 'MISSING_COST_CENTER',
          severity: 'INFO',
          title: `${name} (${emp.employeeNo}) has no cost center assigned`,
        });
      }
    }

    return issues;
  }

  // ─── Org unit issues ──────────────────────────────────────────

  private async detectOrgUnitIssues(): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const orgUnits = await this.prisma.orgUnit.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        legalEntityId: true,
        managerEmployeeId: true,
        employmentAssignments: {
          where: { effectiveTo: null },
          select: { id: true },
        },
      },
    });

    for (const ou of orgUnits) {
      if (!ou.managerEmployeeId) {
        issues.push({
          entityType: 'ORG_UNIT',
          entityId: ou.id,
          orgUnitId: ou.id,
          legalEntityId: ou.legalEntityId,
          issueType: 'ORG_UNIT_WITHOUT_MANAGER',
          severity: 'WARNING',
          title: `Org unit "${ou.name}" (${ou.code}) has no manager`,
          affectsReadiness: true,
        });
      }

      if (ou.employmentAssignments.length === 0) {
        issues.push({
          entityType: 'ORG_UNIT',
          entityId: ou.id,
          orgUnitId: ou.id,
          legalEntityId: ou.legalEntityId,
          issueType: 'ORG_UNIT_WITHOUT_EMPLOYEES',
          severity: 'INFO',
          title: `Org unit "${ou.name}" (${ou.code}) has no employees assigned`,
        });
      }
    }

    return issues;
  }

  // ─── Cost center issues ───────────────────────────────────────

  private async detectCostCenterIssues(): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const costCenters = await this.prisma.costCenter.findMany({
      where: { isActive: true },
      select: {
        id: true,
        costCenterCode: true,
        costCenterName: true,
        legalEntityId: true,
        employmentAssignments: {
          where: { effectiveTo: null },
          select: { id: true },
        },
      },
    });

    for (const cc of costCenters) {
      if (cc.employmentAssignments.length === 0) {
        issues.push({
          entityType: 'COST_CENTER',
          entityId: cc.id,
          costCenterId: cc.id,
          legalEntityId: cc.legalEntityId,
          issueType: 'COST_CENTER_UNUSED',
          severity: 'INFO',
          title: `Cost center "${cc.costCenterName}" (${cc.costCenterCode}) has no assignments`,
        });
      }
    }

    return issues;
  }

  // ─── Export blocker issues ────────────────────────────────────

  private async detectExportIssues(): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    const blocked = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            managerId: null,
            hierarchyRole: { not: 'TOP_OF_CHAIN' },
          },
          { employments: { none: { effectiveTo: null } } },
        ],
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        managerId: true,
        hierarchyRole: true,
        legalEntityId: true,
        employments: { select: { id: true, effectiveTo: true } },
      },
    });

    for (const emp of blocked) {
      const reasons: string[] = [];
      if (!emp.managerId && emp.hierarchyRole !== 'TOP_OF_CHAIN') reasons.push('no manager');
      if (!emp.employments.some((e) => !e.effectiveTo)) reasons.push('no active employment');

      issues.push({
        entityType: 'HR_EXPORT',
        entityId: emp.id,
        employeeId: emp.id,
        legalEntityId: emp.legalEntityId ?? undefined,
        issueType: 'EMPLOYEE_EXPORT_BLOCKED',
        severity: 'ERROR',
        title: `${emp.firstName} ${emp.lastName} (${emp.employeeNo}) blocked for export: ${reasons.join(', ')}`,
        blocksExport: true,
        metadata: { reasons },
      });
    }

    return issues;
  }

  // ─── Remediation routing ───────────────────────────────────────

  private static readonly REMEDIATION_MAP: Record<string, { label: string; target: string }> = {
    MISSING_MANAGER: { label: 'Assign manager', target: 'manager_hierarchy' },
    MISSING_ORG_ASSIGNMENT: { label: 'Assign org unit', target: 'employment_assignments' },
    MISSING_COST_CENTER: { label: 'Set cost center', target: 'employment_assignments' },
    MISSING_LEGAL_ENTITY: { label: 'Fix employment', target: 'employments' },
    EMPLOYEE_WITHOUT_EMPLOYMENT: { label: 'Create employment', target: 'employments' },
    EMPLOYEE_WITHOUT_ASSIGNMENT: { label: 'Create assignment', target: 'employment_assignments' },
    EMPLOYEE_EXPORT_BLOCKED: { label: 'View export blockers', target: 'hr_export' },
    ORG_UNIT_WITHOUT_MANAGER: { label: 'Assign manager', target: 'org_structure' },
    COST_CENTER_UNUSED: { label: 'Review cost center', target: 'cost_centers' },
  };

  private buildRecommendedAction(issue: any) {
    const mapping = WorkforceIssuesService.REMEDIATION_MAP[issue.issueType];
    if (!mapping) return undefined;
    const params: Record<string, string> = {};
    if (issue.employeeId) params.employeeId = issue.employeeId;
    if (issue.employmentId) params.employmentId = issue.employmentId;
    if (issue.orgUnitId) params.orgUnitId = issue.orgUnitId;
    if (issue.legalEntityId) params.legalEntityId = issue.legalEntityId;
    if (issue.costCenterId) params.costCenterId = issue.costCenterId;
    params.issueType = issue.issueType;
    return { ...mapping, params };
  }

  private enrichIssueRow(issue: any) {
    return {
      ...issue,
      recommendedAction: this.buildRecommendedAction(issue),
    };
  }

  // ─── Grouped issues ───────────────────────────────────────────

  async getGroupedIssues(filters: {
    issueType?: WorkforceIssueType;
    groupBy: 'legalEntity' | 'orgUnit' | 'severity' | 'entityType' | 'issueType';
    legalEntityId?: string;
    resolved?: boolean;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters.issueType) where.issueType = filters.issueType;
    if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters.resolved === false || filters.resolved === undefined) where.resolvedAt = null;
    else if (filters.resolved === true) where.resolvedAt = { not: null };

    const groupByField = {
      legalEntity: 'legalEntityId' as const,
      orgUnit: 'orgUnitId' as const,
      severity: 'severity' as const,
      entityType: 'entityType' as const,
      issueType: 'issueType' as const,
    }[filters.groupBy];

    const groups = await this.prisma.workforceIssue.groupBy({
      by: [groupByField],
      where: where as any,
      _count: true,
    });

    const blockerGroups = await this.prisma.workforceIssue.groupBy({
      by: [groupByField],
      where: { ...(where as any), blocksExport: true },
      _count: true,
    });
    const blockerMap = new Map(blockerGroups.map((g) => [g[groupByField], g._count]));

    let labelMap = new Map<string | null, string>();
    if (filters.groupBy === 'legalEntity') {
      const les = await this.prisma.legalEntity.findMany({ select: { id: true, name: true, code: true } });
      labelMap = new Map(les.map((le) => [le.id, `${le.name} (${le.code})`]));
    } else if (filters.groupBy === 'orgUnit') {
      const ous = await this.prisma.orgUnit.findMany({ select: { id: true, name: true, code: true } });
      labelMap = new Map(ous.map((ou) => [ou.id, `${ou.name} (${ou.code})`]));
    }

    return groups
      .filter((g) => g[groupByField] != null)
      .map((g) => ({
        key: g[groupByField],
        label: labelMap.get(g[groupByField] as string) || g[groupByField],
        count: g._count,
        blockersCount: blockerMap.get(g[groupByField]) || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ─── Query APIs ───────────────────────────────────────────────

  async listIssues(filters: {
    entityType?: WorkforceIssueEntityType;
    issueType?: WorkforceIssueType;
    severity?: WorkforceIssueSeverity;
    legalEntityId?: string;
    orgUnitId?: string;
    employeeId?: string;
    blocksExport?: boolean;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.issueType) where.issueType = filters.issueType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters.orgUnitId) where.orgUnitId = filters.orgUnitId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.blocksExport !== undefined) where.blocksExport = filters.blocksExport;
    if (filters.resolved === false) where.resolvedAt = null;
    else if (filters.resolved === true) where.resolvedAt = { not: null };
    else where.resolvedAt = null;

    const [rawItems, total] = await Promise.all([
      this.prisma.workforceIssue.findMany({
        where: where as any,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
      }),
      this.prisma.workforceIssue.count({ where: where as any }),
    ]);

    const items = rawItems.map((i) => this.enrichIssueRow(i));
    return { items, total };
  }

  async resolveIssue(issueId: string, userId: string, note?: string) {
    const updated = await this.prisma.workforceIssue.update({
      where: { id: issueId },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: userId,
        resolutionNote: note ?? 'Dismissed by user',
      },
    });

    await this.auditService.log({
      userId,
      action: 'ISSUE_DISMISSED',
      entityType: 'WorkforceIssue',
      entityId: issueId,
      newValue: { issueType: updated.issueType, note: note ?? 'Dismissed by user' },
    });

    return updated;
  }

  async reopenIssue(issueId: string) {
    const issue = await this.prisma.workforceIssue.findUnique({
      where: { id: issueId },
      select: { resolvedByUserId: true, issueType: true },
    });

    const updated = await this.prisma.workforceIssue.update({
      where: { id: issueId },
      data: {
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      },
    });

    await this.auditService.log({
      userId: issue?.resolvedByUserId ?? 'system',
      action: 'ISSUE_REOPENED',
      entityType: 'WorkforceIssue',
      entityId: issueId,
      newValue: { issueType: issue?.issueType },
    });

    return updated;
  }

  // ─── Enriched queue ─────────────────────────────────────────

  async getRemediationQueue(filters: {
    issueType?: WorkforceIssueType;
    legalEntityId?: string;
    orgUnitId?: string;
    severity?: WorkforceIssueSeverity;
    assignedUserId?: string;
    blocksExport?: boolean;
    sortBy?: 'priority' | 'age' | 'severity';
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID, resolvedAt: null };
    if (filters.issueType) where.issueType = filters.issueType;
    if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters.orgUnitId) where.orgUnitId = filters.orgUnitId;
    if (filters.severity) where.severity = filters.severity;
    if (filters.assignedUserId === 'unassigned') where.assignedUserId = null;
    else if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.blocksExport !== undefined) where.blocksExport = filters.blocksExport;

    const [rawItems, total] = await Promise.all([
      this.prisma.workforceIssue.findMany({
        where: where as any,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'asc' }],
        take: filters.limit ?? 200,
        skip: filters.offset ?? 0,
      }),
      this.prisma.workforceIssue.count({ where: where as any }),
    ]);

    const employeeIds = [...new Set(rawItems.filter((i) => i.employeeId).map((i) => i.employeeId!))];
    const employees = employeeIds.length > 0
      ? await this.prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, firstName: true, lastName: true, employeeNo: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const leIds = [...new Set(rawItems.filter((i) => i.legalEntityId).map((i) => i.legalEntityId!))];
    const legalEntities = leIds.length > 0
      ? await this.prisma.legalEntity.findMany({ where: { id: { in: leIds } }, select: { id: true, name: true } })
      : [];
    const leMap = new Map(legalEntities.map((le) => [le.id, le.name]));

    const ouIds = [...new Set(rawItems.filter((i) => i.orgUnitId).map((i) => i.orgUnitId!))];
    const orgUnits = ouIds.length > 0
      ? await this.prisma.orgUnit.findMany({ where: { id: { in: ouIds } }, select: { id: true, name: true } })
      : [];
    const ouMap = new Map(orgUnits.map((ou) => [ou.id, ou.name]));

    const assignedUserIds = [...new Set(rawItems.filter((i) => i.assignedUserId).map((i) => i.assignedUserId!))];
    const assignedUsers = assignedUserIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: assignedUserIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const userMap = new Map(assignedUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const now = Date.now();
    let items = rawItems.map((issue) => {
      const emp = issue.employeeId ? empMap.get(issue.employeeId) : undefined;
      const ageMs = now - issue.detectedAt.getTime();
      const ageHours = Math.floor(ageMs / 3600000);
      const ageDays = Math.floor(ageMs / 86400000);
      const priorityScore = this.computePriorityScore(issue, ageHours);

      return {
        ...issue,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
        employeeNo: emp?.employeeNo,
        legalEntityName: issue.legalEntityId ? leMap.get(issue.legalEntityId) : undefined,
        orgUnitName: issue.orgUnitId ? ouMap.get(issue.orgUnitId) : undefined,
        assignedToName: issue.assignedUserId ? userMap.get(issue.assignedUserId) : undefined,
        issueAgeHours: ageHours,
        issueAgeDays: ageDays,
        priorityScore,
        recommendedAction: this.buildRecommendedAction(issue),
      };
    });

    if (filters.sortBy === 'priority') {
      items.sort((a, b) => b.priorityScore - a.priorityScore);
    } else if (filters.sortBy === 'age') {
      items.sort((a, b) => b.issueAgeHours - a.issueAgeHours);
    }

    return { items, total };
  }

  private computePriorityScore(issue: any, ageHours: number): number {
    const SEVERITY_WEIGHT: Record<string, number> = { CRITICAL: 10, ERROR: 7, WARNING: 4, INFO: 1 };
    let score = SEVERITY_WEIGHT[issue.severity] ?? 1;
    if (issue.blocksExport) score += 5;
    if (ageHours > 168) score += 5;      // >7 days
    else if (ageHours > 48) score += 3;  // >48 hours
    return score;
  }

  // ─── Assignment ───────────────────────────────────────────

  async assignIssue(issueId: string, assignedUserId: string) {
    if (!assignedUserId?.trim()) {
      throw new Error('assignedUserId is required');
    }
    const issue = await this.prisma.workforceIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new Error(`Issue ${issueId} not found`);
    if (issue.resolvedAt) throw new Error('Cannot assign a resolved issue');

    const updated = await this.prisma.workforceIssue.update({
      where: { id: issueId },
      data: { assignedUserId, assignedAt: new Date() },
    });

    await this.auditService.log({
      userId: assignedUserId,
      action: 'ISSUE_ASSIGNED',
      entityType: 'WorkforceIssue',
      entityId: issueId,
      newValue: { assignedUserId, issueType: issue.issueType },
    });

    return updated;
  }

  async unassignIssue(issueId: string) {
    const issue = await this.prisma.workforceIssue.findUnique({
      where: { id: issueId },
      select: { assignedUserId: true, issueType: true },
    });

    const updated = await this.prisma.workforceIssue.update({
      where: { id: issueId },
      data: { assignedUserId: null, assignedAt: null },
    });

    if (issue?.assignedUserId) {
      await this.auditService.log({
        userId: issue.assignedUserId,
        action: 'ISSUE_UNASSIGNED',
        entityType: 'WorkforceIssue',
        entityId: issueId,
        newValue: { previousAssignee: issue.assignedUserId, issueType: issue.issueType },
      });
    }

    return updated;
  }

  // ─── Counts ────────────────────────────────────────────────

  async getIssueCounts() {
    const [total, byType, bySeverity, exportBlockers] = await Promise.all([
      this.prisma.workforceIssue.count({ where: { tenantId: TENANT_ID, resolvedAt: null } }),
      this.prisma.workforceIssue.groupBy({
        by: ['issueType'],
        where: { tenantId: TENANT_ID, resolvedAt: null },
        _count: true,
      }),
      this.prisma.workforceIssue.groupBy({
        by: ['severity'],
        where: { tenantId: TENANT_ID, resolvedAt: null },
        _count: true,
      }),
      this.prisma.workforceIssue.count({ where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true } }),
    ]);

    return {
      total,
      export_blockers: exportBlockers,
      by_type: Object.fromEntries(byType.map((r) => [r.issueType, r._count])),
      by_severity: Object.fromEntries(bySeverity.map((r) => [r.severity, r._count])),
    };
  }

  // ─── Queue stats ───────────────────────────────────────────

  async getQueueStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [
      openTotal,
      openBlockers,
      resolvedToday,
      resolvedThisWeek,
      oldestOpen,
      agingBuckets,
    ] = await Promise.all([
      this.prisma.workforceIssue.count({ where: { tenantId: TENANT_ID, resolvedAt: null } }),
      this.prisma.workforceIssue.count({ where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true } }),
      this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, resolvedAt: { gte: todayStart } },
      }),
      this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, resolvedAt: { gte: weekStart } },
      }),
      this.prisma.workforceIssue.findFirst({
        where: { tenantId: TENANT_ID, resolvedAt: null },
        orderBy: { detectedAt: 'asc' },
        select: { detectedAt: true },
      }),
      this.computeAgingBuckets(),
    ]);

    return {
      openTotal,
      openBlockers,
      resolvedToday,
      resolvedThisWeek,
      oldestOpenDays: oldestOpen ? Math.floor((now.getTime() - oldestOpen.detectedAt.getTime()) / 86400000) : 0,
      aging: agingBuckets,
    };
  }

  private async computeAgingBuckets() {
    const now = new Date();
    const issues = await this.prisma.workforceIssue.findMany({
      where: { tenantId: TENANT_ID, resolvedAt: null },
      select: { detectedAt: true },
    });

    const buckets = { fresh: 0, moderate: 0, stale: 0, critical: 0 };
    for (const issue of issues) {
      const days = Math.floor((now.getTime() - issue.detectedAt.getTime()) / 86400000);
      if (days <= 1) buckets.fresh++;
      else if (days <= 7) buckets.moderate++;
      else if (days <= 30) buckets.stale++;
      else buckets.critical++;
    }
    return buckets;
  }
}
