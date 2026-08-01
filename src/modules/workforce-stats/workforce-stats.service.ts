import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import { WorkforceIssuesService } from '../workforce-issues/workforce-issues.service';
import { WorkforceReadinessService } from '../workforce-readiness/workforce-readiness.service';
import { OrgUnitManagerInferenceService } from '../org-unit-manager-inference/org-unit-manager-inference.service';

const TENANT_ID = 'default';

@Injectable()
export class WorkforceStatsService {
  private readonly logger = new Logger(WorkforceStatsService.name);
  private refreshing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly issuesService: WorkforceIssuesService,
    private readonly readinessService: WorkforceReadinessService,
    private readonly inferenceService: OrgUnitManagerInferenceService,
  ) {}

  // Hourly full snapshot + issue reconciliation
  @Interval(3600_000)
  async scheduledRefresh() {
    try {
      this.logger.log('Starting scheduled stats reconciliation');
      await this.refreshAllSnapshots();
      this.logger.log('Scheduled stats reconciliation complete');
    } catch (err) {
      this.logger.error('Scheduled refresh failed', err);
    }
  }

  // Trigger a targeted refresh for a specific scope (callable from CRUD hooks)
  async queueLegalEntityRefresh(legalEntityId: string) {
    try {
      await this.issuesService.detectAllIssues();
      await this.refreshLegalEntitySnapshot(legalEntityId);
      await this.readinessService.refreshReadinessSnapshot('LEGAL_ENTITY', legalEntityId, legalEntityId);
      await this.refreshOverviewSnapshot();
    } catch (err) {
      this.logger.error(`Scoped refresh failed for legal entity ${legalEntityId}`, err);
    }
  }

  async queueOrgUnitRefresh(orgUnitId: string) {
    try {
      await this.refreshOrgUnitSnapshots();
      await this.refreshOverviewSnapshot();
    } catch (err) {
      this.logger.error(`Scoped refresh failed for org unit ${orgUnitId}`, err);
    }
  }

  async queueCostCenterRefresh(costCenterId: string) {
    try {
      await this.refreshCostCenterSnapshots();
      await this.refreshOverviewSnapshot();
    } catch (err) {
      this.logger.error(`Scoped refresh failed for cost center ${costCenterId}`, err);
    }
  }

  async refreshAllSnapshots(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    const start = Date.now();

    try {
      await this.classifyTopOfChain();
      await this.inferenceService.reconcileStaleSuggestions();
      await this.inferenceService.generateSuggestions();
      await this.issuesService.detectAllIssues();
      await this.refreshOverviewSnapshot();
      await this.refreshLegalEntitySnapshots();
      await this.refreshOrgUnitSnapshots();
      await this.refreshCostCenterSnapshots();
      await this.readinessService.refreshReadinessSnapshot('OVERVIEW', 'global');

      const legalEntities = await this.prisma.legalEntity.findMany({ select: { id: true } });
      for (const le of legalEntities) {
        await this.readinessService.refreshReadinessSnapshot('LEGAL_ENTITY', le.id, le.id);
      }

      this.logger.log(`Full snapshot refresh complete in ${Date.now() - start}ms`);
    } finally {
      this.refreshing = false;
    }
  }

  // ─── Top-of-chain classification ──────────────────────────────
  //
  // Employees who are active, have no manager, and have at least one direct
  // report are classified as TOP_OF_CHAIN rather than defective. This runs
  // early in the refresh so issue detection respects it.

  private async classifyTopOfChain(): Promise<void> {
    // Find employees who should be TOP_OF_CHAIN: active, no manager, have direct reports
    const candidates = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        managerId: null,
        hierarchyRole: 'NORMAL',
      },
      select: {
        id: true,
        _count: { select: { directReports: true } },
      },
    });

    const topOfChainIds = candidates
      .filter((c) => c._count.directReports > 0)
      .map((c) => c.id);

    if (topOfChainIds.length > 0) {
      await this.prisma.employee.updateMany({
        where: { id: { in: topOfChainIds } },
        data: { hierarchyRole: 'TOP_OF_CHAIN' },
      });
      this.logger.log(`Classified ${topOfChainIds.length} employee(s) as TOP_OF_CHAIN`);
    }

    // Also reclassify anyone who now has a manager but is still marked TOP_OF_CHAIN
    await this.prisma.employee.updateMany({
      where: {
        status: 'ACTIVE',
        managerId: { not: null },
        hierarchyRole: 'TOP_OF_CHAIN',
      },
      data: { hierarchyRole: 'NORMAL' },
    });
  }

  // ─── Overview snapshot ────────────────────────────────────────

  async refreshOverviewSnapshot() {
    const now = new Date();

    const [
      legalEntitiesCount,
      employeesCount,
      activeEmployeesCount,
      employmentsCount,
      activeEmploymentsCount,
      assignmentsCount,
      activeAssignmentsCount,
      orgUnitsCount,
      costCentersCount,
    ] = await Promise.all([
      this.prisma.legalEntity.count(),
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
      this.prisma.employment.count(),
      this.prisma.employment.count({ where: { effectiveTo: null } }),
      this.prisma.employmentAssignment.count(),
      this.prisma.employmentAssignment.count({ where: { effectiveTo: null } }),
      this.prisma.orgUnit.count({ where: { isActive: true } }),
      this.prisma.costCenter.count({ where: { isActive: true } }),
    ]);

    const unitsWithoutManagerCount = await this.prisma.orgUnit.count({
      where: { isActive: true, managerEmployeeId: null },
    });

    const importJobsCount = await this.prisma.dataImportJob.count();
    const importsPublishedCount = await this.prisma.dataImportJob.count({ where: { status: 'PUBLISHED' } });
    const importsFailedCount = await this.prisma.dataImportJob.count({ where: { status: 'FAILED' } });

    const issueCounts = await this.issuesService.getIssueCounts();
    const readiness = await this.readinessService.computeOverviewReadiness();

    // Derive data-quality stats from WorkforceIssue (single source of truth)
    const issuesByType = issueCounts.by_type as Record<string, number>;
    const employeesWithoutManagerCount = issuesByType['MISSING_MANAGER'] ?? 0;
    const employeesWithoutAssignmentCount = issuesByType['MISSING_ORG_ASSIGNMENT'] ?? 0;
    const employeesMissingCostCenterCount = issuesByType['MISSING_COST_CENTER'] ?? 0;

    // Deduplicate: count unique employees with blocking issues (not total blocking issues)
    const blockedEmployeeGroups = await this.prisma.workforceIssue.groupBy({
      by: ['employeeId'],
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true, employeeId: { not: null } },
    });
    const exportBlockedEmployeesCount = blockedEmployeeGroups.length;

    const data = {
      asOf: now,
      legalEntitiesCount,
      employeesCount,
      activeEmployeesCount,
      employmentsCount,
      activeEmploymentsCount,
      assignmentsCount,
      activeAssignmentsCount,
      orgUnitsCount,
      costCentersCount,
      unitsWithoutManagerCount,
      employeesWithoutManagerCount,
      employeesWithoutAssignmentCount,
      employeesMissingCostCenterCount,
      importJobsCount,
      importsPublishedCount,
      importsFailedCount,
      onboardingCompletionPercent: 0,
      issuesCount: issueCounts.total,
      blockersCount: issueCounts.export_blockers,
      exportReadyEmployeesCount: activeEmployeesCount - exportBlockedEmployeesCount,
      exportBlockedEmployeesCount,
      readinessPercent: readiness.readinessPercent,
      readinessStatus: readiness.readinessStatus,
    };

    await this.prisma.overviewStatsSnapshot.upsert({
      where: { tenantId: TENANT_ID },
      update: data,
      create: { tenantId: TENANT_ID, ...data },
    });
  }

  // ─── Legal entity snapshots ───────────────────────────────────

  async refreshLegalEntitySnapshots() {
    const legalEntities = await this.prisma.legalEntity.findMany({
      select: { id: true },
    });

    for (const le of legalEntities) {
      await this.refreshLegalEntitySnapshot(le.id);
    }
  }

  async refreshLegalEntitySnapshot(legalEntityId: string) {
    const now = new Date();

    const directEmployeesCount = await this.prisma.employee.count({ where: { legalEntityId } });
    const directActiveCount = await this.prisma.employee.count({ where: { legalEntityId, status: 'ACTIVE' } });

    const employmentsCount = await this.prisma.employment.count({ where: { legalEntityId } });
    const activeEmploymentsCount = await this.prisma.employment.count({ where: { legalEntityId, effectiveTo: null } });

    const employeesViaEmployment = await this.prisma.employment.findMany({
      where: { legalEntityId },
      select: { employeeId: true, employee: { select: { status: true } } },
      distinct: ['employeeId'],
    });
    const employeesCount = Math.max(directEmployeesCount, employeesViaEmployment.length);
    const activeEmployeesCount = Math.max(
      directActiveCount,
      employeesViaEmployment.filter((e) => e.employee.status === 'ACTIVE').length,
    );
    const orgUnitsCount = await this.prisma.orgUnit.count({ where: { legalEntityId, isActive: true } });
    const rootOrgUnitsCount = await this.prisma.orgUnit.count({ where: { legalEntityId, isActive: true, parentOrgUnitId: null } });
    const costCentersCount = await this.prisma.costCenter.count({ where: { legalEntityId, isActive: true } });

    const orgUnitsWithManagerCount = await this.prisma.orgUnit.count({
      where: { legalEntityId, isActive: true, managerEmployeeId: { not: null } },
    });
    const orgUnitsWithoutManagerCount = orgUnitsCount - orgUnitsWithManagerCount;
    const allActiveEmployeeIds = new Set<string>();
    const directActive = await this.prisma.employee.findMany({
      where: { legalEntityId, status: 'ACTIVE' },
      select: { id: true },
    });
    directActive.forEach((e) => allActiveEmployeeIds.add(e.id));
    employeesViaEmployment
      .filter((e) => e.employee.status === 'ACTIVE')
      .forEach((e) => allActiveEmployeeIds.add(e.employeeId));

    const employeesWithoutManagerCount = await this.prisma.employee.count({
      where: {
        id: { in: Array.from(allActiveEmployeeIds) },
        managerId: null,
      },
    });

    const assignedIds = new Set(
      (await this.prisma.employmentAssignment.findMany({
        where: { effectiveTo: null, employment: { legalEntityId } },
        select: { employment: { select: { employeeId: true } } },
      })).map((a) => a.employment.employeeId),
    );
    const activeIds = Array.from(allActiveEmployeeIds);
    const employeesWithoutAssignmentCount = activeIds.filter((id) => !assignedIds.has(id)).length;

    const ccIds = new Set(
      (await this.prisma.employmentAssignment.findMany({
        where: { effectiveTo: null, costCenterId: { not: null }, employment: { legalEntityId } },
        select: { employment: { select: { employeeId: true } } },
      })).map((a) => a.employment.employeeId),
    );
    const employeesMissingCostCenterCount = activeIds.filter((id) => !ccIds.has(id)).length;

    const usedCostCenterIds = new Set(
      (await this.prisma.employmentAssignment.findMany({
        where: { effectiveTo: null, costCenterId: { not: null }, employment: { legalEntityId } },
        select: { costCenterId: true },
      })).map((a) => a.costCenterId),
    );
    const usedCostCentersCount = usedCostCenterIds.size;

    const issuesCount = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, legalEntityId, resolvedAt: null },
    });
    const blockersCount = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, legalEntityId, resolvedAt: null, blocksExport: true },
    });

    const readiness = await this.readinessService.computeLegalEntityReadiness(legalEntityId);

    const data = {
      asOf: now,
      employeesCount,
      activeEmployeesCount,
      employmentsCount,
      activeEmploymentsCount,
      orgUnitsCount,
      rootOrgUnitsCount,
      costCentersCount,
      usedCostCentersCount,
      orgUnitsWithManagerCount,
      orgUnitsWithoutManagerCount,
      employeesWithoutManagerCount,
      employeesWithoutAssignmentCount,
      employeesMissingCostCenterCount,
      issuesCount,
      blockersCount,
      readinessPercent: readiness.readinessPercent,
      readinessStatus: readiness.readinessStatus,
    };

    await this.prisma.legalEntityStatsSnapshot.upsert({
      where: { tenantId_legalEntityId: { tenantId: TENANT_ID, legalEntityId } },
      update: data,
      create: { tenantId: TENANT_ID, legalEntityId, ...data },
    });
  }

  // ─── Org unit snapshots ───────────────────────────────────────

  async refreshOrgUnitSnapshots() {
    const orgUnits = await this.prisma.orgUnit.findMany({
      where: { isActive: true },
      select: { id: true, legalEntityId: true, managerEmployeeId: true, parentOrgUnitId: true },
    });

    const childMap = new Map<string, string[]>();
    for (const ou of orgUnits) {
      if (ou.parentOrgUnitId) {
        if (!childMap.has(ou.parentOrgUnitId)) childMap.set(ou.parentOrgUnitId, []);
        childMap.get(ou.parentOrgUnitId)!.push(ou.id);
      }
    }

    const assignmentsByOu = new Map<string, { employeeId: string; costCenterId: string | null }[]>();
    const allAssignments = await this.prisma.employmentAssignment.findMany({
      where: { effectiveTo: null },
      select: {
        orgUnitId: true,
        costCenterId: true,
        employment: { select: { employeeId: true } },
      },
    });
    for (const a of allAssignments) {
      if (!assignmentsByOu.has(a.orgUnitId)) assignmentsByOu.set(a.orgUnitId, []);
      assignmentsByOu.get(a.orgUnitId)!.push({ employeeId: a.employment.employeeId, costCenterId: a.costCenterId });
    }

    const getDescendants = (id: string): string[] => {
      const children = childMap.get(id) || [];
      return children.flatMap((c) => [c, ...getDescendants(c)]);
    };

    for (const ou of orgUnits) {
      const directAssignments = assignmentsByOu.get(ou.id) || [];
      const directEmployeeIds = new Set(directAssignments.map((a) => a.employeeId));
      const descendants = getDescendants(ou.id);
      const descendantEmployeeIds = new Set<string>();
      for (const dId of descendants) {
        for (const a of (assignmentsByOu.get(dId) || [])) {
          descendantEmployeeIds.add(a.employeeId);
        }
      }
      for (const eid of directEmployeeIds) descendantEmployeeIds.add(eid);

      const costCenterIds = directAssignments.filter((a) => a.costCenterId).map((a) => a.costCenterId!);
      const linkedCostCenterId = costCenterIds.length > 0 ? costCenterIds[0] : null;

      const issuesCount = await this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, orgUnitId: ou.id, resolvedAt: null },
      });
      const blockersCount = await this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, orgUnitId: ou.id, resolvedAt: null, blocksExport: true },
      });

      const childCount = (childMap.get(ou.id) || []).length;
      const data = {
        asOf: new Date(),
        legalEntityId: ou.legalEntityId,
        directEmployeesCount: directEmployeeIds.size,
        descendantEmployeesCount: descendantEmployeeIds.size,
        activeEmploymentsCount: directAssignments.length,
        childCount,
        descendantOrgUnitsCount: descendants.length,
        hasManager: !!ou.managerEmployeeId,
        managerEmployeeId: ou.managerEmployeeId,
        linkedCostCenterId,
        issuesCount,
        blockersCount,
        missingManager: !ou.managerEmployeeId,
        missingCostCenter: !linkedCostCenterId,
        missingAssignmentsCount: 0,
        readinessPercent: 0,
        readinessStatus: 'INCOMPLETE' as const,
      };

      await this.prisma.orgUnitStatsSnapshot.upsert({
        where: { tenantId_orgUnitId: { tenantId: TENANT_ID, orgUnitId: ou.id } },
        update: data,
        create: { tenantId: TENANT_ID, orgUnitId: ou.id, ...data },
      });
    }
  }

  // ─── Cost center snapshots ────────────────────────────────────

  async refreshCostCenterSnapshots() {
    const costCenters = await this.prisma.costCenter.findMany({
      where: { isActive: true },
      select: { id: true, legalEntityId: true },
    });

    for (const cc of costCenters) {
      const assignments = await this.prisma.employmentAssignment.findMany({
        where: { costCenterId: cc.id, effectiveTo: null },
        select: { employment: { select: { employeeId: true } } },
      });

      const employeeIds = new Set(assignments.map((a) => a.employment.employeeId));
      const orgUnitsCount = await this.prisma.employmentAssignment.groupBy({
        by: ['orgUnitId'],
        where: { costCenterId: cc.id, effectiveTo: null },
      });

      const isUsed = assignments.length > 0;
      let usageStatus: 'ACTIVE' | 'LOW_USAGE' | 'UNUSED' = 'UNUSED';
      if (assignments.length >= 5) usageStatus = 'ACTIVE';
      else if (assignments.length > 0) usageStatus = 'LOW_USAGE';

      const issuesCount = await this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, costCenterId: cc.id, resolvedAt: null },
      });
      const blockersCount = await this.prisma.workforceIssue.count({
        where: { tenantId: TENANT_ID, costCenterId: cc.id, resolvedAt: null, blocksExport: true },
      });

      const data = {
        asOf: new Date(),
        legalEntityId: cc.legalEntityId,
        orgUnitsCount: orgUnitsCount.length,
        employeesCount: employeeIds.size,
        activeEmploymentsCount: assignments.length,
        isUsed,
        usageStatus,
        issuesCount,
        blockersCount,
        readinessPercent: isUsed ? 100 : 0,
        readinessStatus: isUsed ? ('READY' as const) : ('INCOMPLETE' as const),
      };

      await this.prisma.costCenterStatsSnapshot.upsert({
        where: { tenantId_costCenterId: { tenantId: TENANT_ID, costCenterId: cc.id } },
        update: data,
        create: { tenantId: TENANT_ID, costCenterId: cc.id, ...data },
      });
    }
  }

  // ─── Read APIs (serve from snapshots, auto-refresh if stale) ──

  private static readonly STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  private isStale(asOf: Date | null | undefined): boolean {
    if (!asOf) return true;
    return Date.now() - asOf.getTime() > WorkforceStatsService.STALE_THRESHOLD_MS;
  }

  async getOverviewStats() {
    let snapshot = await this.prisma.overviewStatsSnapshot.findUnique({
      where: { tenantId: TENANT_ID },
    });

    if (!snapshot || this.isStale(snapshot.asOf)) {
      await this.refreshAllSnapshots();
      snapshot = await this.prisma.overviewStatsSnapshot.findUnique({ where: { tenantId: TENANT_ID } });
    }
    if (!snapshot) return null;

    return {
      structure: {
        legalEntitiesCount: snapshot.legalEntitiesCount,
        orgUnitsCount: snapshot.orgUnitsCount,
        costCentersCount: snapshot.costCentersCount,
        unitsWithoutManagerCount: snapshot.unitsWithoutManagerCount,
      },
      workforce: {
        employeesCount: snapshot.employeesCount,
        activeEmployeesCount: snapshot.activeEmployeesCount,
        activeEmploymentsCount: snapshot.activeEmploymentsCount,
        activeAssignmentsCount: snapshot.activeAssignmentsCount,
      },
      dataQuality: {
        employeesWithoutManagerCount: snapshot.employeesWithoutManagerCount,
        employeesWithoutAssignmentCount: snapshot.employeesWithoutAssignmentCount,
        employeesMissingCostCenterCount: snapshot.employeesMissingCostCenterCount,
      },
      imports: {
        importJobsCount: snapshot.importJobsCount,
        importsPublishedCount: snapshot.importsPublishedCount,
        importsFailedCount: snapshot.importsFailedCount,
      },
      readiness: {
        percent: snapshot.readinessPercent,
        status: snapshot.readinessStatus,
        blockersCount: snapshot.blockersCount,
        issuesCount: snapshot.issuesCount,
        exportReadyCount: snapshot.exportReadyEmployeesCount,
        exportBlockedCount: snapshot.exportBlockedEmployeesCount,
      },
      asOf: snapshot.asOf,
    };
  }

  async getLegalEntityStats(filters?: { readinessStatus?: string; search?: string }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters?.readinessStatus) where.readinessStatus = filters.readinessStatus;

    let snapshots = await this.prisma.legalEntityStatsSnapshot.findMany({
      where: where as any,
      orderBy: { legalEntityId: 'asc' },
    });

    if (snapshots.length === 0) {
      await this.refreshLegalEntitySnapshots();
      snapshots = await this.prisma.legalEntityStatsSnapshot.findMany({
        where: where as any,
        orderBy: { legalEntityId: 'asc' },
      });
    }

    const legalEntities = await this.prisma.legalEntity.findMany({
      select: { id: true, code: true, name: true, country: true },
    });
    const leMap = new Map(legalEntities.map((le) => [le.id, le]));

    let results = snapshots.map((s) => {
      const le = leMap.get(s.legalEntityId);
      return {
        ...s,
        code: le?.code,
        name: le?.name,
        country: le?.country,
        allowedActions: {
          view: true,
          edit: true,
          viewEmployees: true,
          resolveIssues: s.issuesCount > 0,
          exportPreview: true,
          runExport: false,
        },
      };
    });

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter((r) =>
        r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q),
      );
    }

    return results;
  }

  async getOrgUnitStatsTree(filters?: {
    legalEntityId?: string;
    missingManager?: boolean;
    readinessStatus?: string;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters?.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters?.missingManager) where.missingManager = true;
    if (filters?.readinessStatus) where.readinessStatus = filters.readinessStatus;

    let snapshots = await this.prisma.orgUnitStatsSnapshot.findMany({
      where: where as any,
      orderBy: { orgUnitId: 'asc' },
    });

    if (snapshots.length === 0) {
      await this.refreshOrgUnitSnapshots();
      snapshots = await this.prisma.orgUnitStatsSnapshot.findMany({
        where: where as any,
        orderBy: { orgUnitId: 'asc' },
      });
    }

    const orgUnits = await this.prisma.orgUnit.findMany({
      where: { isActive: true },
      select: {
        id: true, code: true, name: true, legalEntityId: true, parentOrgUnitId: true,
        managerEmployeeId: true, managerAssignmentSource: true,
      },
    });
    const ouMap = new Map(orgUnits.map((ou) => [ou.id, ou]));

    const managerIds = orgUnits.filter((ou) => ou.managerEmployeeId).map((ou) => ou.managerEmployeeId!);
    const managers = await this.prisma.employee.findMany({
      where: { id: { in: managerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const mgrMap = new Map(managers.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

    // Load pending suggestions for unmanaged org units
    const pendingSuggestions = await this.prisma.orgUnitManagerSuggestion.findMany({
      where: { tenantId: TENANT_ID, status: 'PENDING' },
    });
    const suggestionMap = new Map(pendingSuggestions.map((s) => [s.orgUnitId, s]));

    // Resolve suggested employee names
    const sugEmpIds = pendingSuggestions.map((s) => s.suggestedEmployeeId);
    const sugEmployees = sugEmpIds.length > 0
      ? await this.prisma.employee.findMany({
          where: { id: { in: sugEmpIds } },
          select: { id: true, firstName: true, lastName: true, employeeNo: true },
        })
      : [];
    const sugEmpMap = new Map(sugEmployees.map((e) => [e.id, e]));

    return snapshots.map((s) => {
      const ou = ouMap.get(s.orgUnitId);
      const suggestion = suggestionMap.get(s.orgUnitId);
      const sugEmp = suggestion ? sugEmpMap.get(suggestion.suggestedEmployeeId) : null;

      return {
        ...s,
        code: ou?.code,
        name: ou?.name,
        parentOrgUnitId: ou?.parentOrgUnitId,
        managerName: s.managerEmployeeId ? mgrMap.get(s.managerEmployeeId) : null,
        managerAssignmentSource: ou?.managerAssignmentSource ?? null,
        managerSuggestion: suggestion ? {
          id: suggestion.id,
          employeeId: suggestion.suggestedEmployeeId,
          employeeName: sugEmp ? `${sugEmp.firstName} ${sugEmp.lastName}` : 'Unknown',
          employeeNo: sugEmp?.employeeNo,
          confidence: suggestion.confidenceScore,
          confidenceBand: suggestion.confidenceScore >= 85 ? 'HIGH' : suggestion.confidenceScore >= 60 ? 'MEDIUM' : 'LOW',
          reasonCode: suggestion.reasonCode,
          reasonDetails: suggestion.reasonDetails,
          status: suggestion.status,
        } : null,
        allowedActions: {
          view: true,
          edit: true,
          addChild: true,
          assignManager: true,
          viewEmployees: true,
          resolveIssues: s.issuesCount > 0,
          acceptSuggestion: !!suggestion,
        },
      };
    });
  }

  async getCostCenterStats(filters?: {
    legalEntityId?: string;
    usageStatus?: string;
    search?: string;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters?.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters?.usageStatus) where.usageStatus = filters.usageStatus;

    let snapshots = await this.prisma.costCenterStatsSnapshot.findMany({
      where: where as any,
      orderBy: { costCenterId: 'asc' },
    });

    if (snapshots.length === 0) {
      await this.refreshCostCenterSnapshots();
      snapshots = await this.prisma.costCenterStatsSnapshot.findMany({
        where: where as any,
        orderBy: { costCenterId: 'asc' },
      });
    }

    const costCenters = await this.prisma.costCenter.findMany({
      where: { isActive: true },
      select: { id: true, costCenterCode: true, costCenterName: true, legalEntityId: true },
    });
    const ccMap = new Map(costCenters.map((cc) => [cc.id, cc]));

    let results = snapshots.map((s) => {
      const cc = ccMap.get(s.costCenterId);
      return {
        ...s,
        code: cc?.costCenterCode,
        name: cc?.costCenterName,
        allowedActions: {
          view: true,
          edit: true,
          viewEmployees: true,
          resolveIssues: s.issuesCount > 0,
        },
      };
    });

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter((r) =>
        r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q),
      );
    }

    return results;
  }

  async getManagerHierarchyStats() {
    const activeEmployees = await this.prisma.employee.count({ where: { status: 'ACTIVE' } });
    const withManager = await this.prisma.employee.count({ where: { status: 'ACTIVE', managerId: { not: null } } });
    const topOfChain = await this.prisma.employee.count({ where: { status: 'ACTIVE', hierarchyRole: 'TOP_OF_CHAIN' } });
    const withoutManager = activeEmployees - withManager;
    const missingManager = withoutManager - topOfChain;
    const orgUnitsTotal = await this.prisma.orgUnit.count({ where: { isActive: true } });
    const orgUnitsWithManager = await this.prisma.orgUnit.count({
      where: { isActive: true, managerEmployeeId: { not: null } },
    });

    // Count unresolved hierarchy issues
    const hierarchyIssues = await this.prisma.workforceIssue.count({
      where: {
        tenantId: TENANT_ID,
        resolvedAt: null,
        issueType: { in: ['MISSING_MANAGER', 'MANAGER_SELF_REFERENCE', 'HIERARCHY_CYCLE_RISK', 'MANAGER_CHAIN_INCOMPLETE'] },
      },
    });

    // Count pending org unit manager suggestions
    const pendingSuggestions = await this.prisma.orgUnitManagerSuggestion.count({
      where: { tenantId: TENANT_ID, status: 'PENDING' },
    });

    return {
      activeEmployees,
      withManager,
      withoutManager,
      topOfChain,
      missingManager,
      managerCoverage: activeEmployees > 0 ? Math.round((withManager / activeEmployees) * 100) : 0,
      hierarchyIssues,
      orgUnitsTotal,
      orgUnitsWithManager,
      orgUnitsWithoutManager: orgUnitsTotal - orgUnitsWithManager,
      orgUnitManagerCoverage: orgUnitsTotal > 0 ? Math.round((orgUnitsWithManager / orgUnitsTotal) * 100) : 0,
      pendingSuggestions,
    };
  }

  async getHrExportStats() {
    const total = await this.prisma.employee.count({ where: { status: 'ACTIVE' } });
    // Use blocksExport as the single source of truth for export blocking
    const blocked = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true },
    });
    // Deduplicate: count unique employees blocked (an employee may have multiple blocking issues)
    const blockedEmployees = await this.prisma.workforceIssue.groupBy({
      by: ['employeeId'],
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true, employeeId: { not: null } },
    });
    const uniqueBlocked = blockedEmployees.length;
    const ready = Math.max(0, total - uniqueBlocked);

    return {
      totalActiveEmployees: total,
      exportReady: ready,
      exportBlocked: uniqueBlocked,
      totalBlockingIssues: blocked,
      readinessPercent: total > 0 ? Math.round((ready / total) * 100) : 0,
    };
  }
}
