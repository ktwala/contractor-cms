import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  BulkRemediationPreviewRequest,
  BulkRemediationPreview,
  BulkRemediationApplyRequest,
  BulkRemediationResult,
  AffectedEmployee,
  ISSUE_TO_REMEDIATION,
} from './bulk-remediation.types';
import { assertBatchSize, assertFixField } from './bulk-remediation.policy';

const TENANT_ID = 'default';

@Injectable()
export class WorkforceRemediationService {
  private readonly logger = new Logger(WorkforceRemediationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Preview ──────────────────────────────────────────────────

  async preview(req: BulkRemediationPreviewRequest): Promise<BulkRemediationPreview> {
    const remType = ISSUE_TO_REMEDIATION[req.issueType];
    if (!remType) throw new BadRequestException(`No bulk remediation for issue type: ${req.issueType}`);

    switch (remType) {
      case 'BULK_ASSIGN_MANAGER':
        return this.previewBulkManagerAssignment(req);
      case 'BULK_ASSIGN_ORG_UNIT':
        return this.previewBulkOrgAssignment(req);
      case 'BULK_ASSIGN_COST_CENTER':
        return this.previewBulkCostCenterAssignment(req);
      case 'BULK_CREATE_ASSIGNMENTS':
        return this.previewBulkAssignmentCreation(req);
      case 'BULK_CREATE_EMPLOYMENTS':
        return this.previewBulkEmploymentCreation(req);
      default:
        throw new BadRequestException(`Unsupported remediation type: ${remType}`);
    }
  }

  // ─── Apply ────────────────────────────────────────────────────

  async apply(req: BulkRemediationApplyRequest, userId: string): Promise<BulkRemediationResult> {
    const remType = ISSUE_TO_REMEDIATION[req.issueType];
    if (!remType) throw new BadRequestException(`No bulk remediation for issue type: ${req.issueType}`);

    // Zero-record safety check
    const preview = await this.preview({ issueType: req.issueType, filters: req.filters, proposedFix: req.fix });
    if (preview.recordsAffected === 0) {
      return { success: true, recordsUpdated: 0, affectedScopes: { legalEntityIds: [], orgUnitIds: [] } };
    }

    switch (remType) {
      case 'BULK_ASSIGN_MANAGER':
        return this.applyBulkManagerAssignment(req, userId);
      case 'BULK_ASSIGN_ORG_UNIT':
        return this.applyBulkOrgAssignment(req, userId);
      case 'BULK_ASSIGN_COST_CENTER':
        return this.applyBulkCostCenterAssignment(req, userId);
      case 'BULK_CREATE_ASSIGNMENTS':
        return this.applyBulkAssignmentCreation(req, userId);
      case 'BULK_CREATE_EMPLOYMENTS':
        return this.applyBulkEmploymentCreation(req, userId);
      default:
        throw new BadRequestException(`Unsupported remediation type: ${remType}`);
    }
  }

  // ─── MISSING_MANAGER ─────────────────────────────────────────

  private async getAffectedEmployees(issueType: string, filters?: { legalEntityId?: string; orgUnitId?: string }): Promise<any[]> {
    const where: Record<string, unknown> = {
      tenantId: TENANT_ID,
      issueType,
      resolvedAt: null,
    };
    if (filters?.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters?.orgUnitId) where.orgUnitId = filters.orgUnitId;

    return this.prisma.workforceIssue.findMany({
      where: where as any,
      select: {
        id: true,
        employeeId: true,
        employmentId: true,
        assignmentId: true,
        orgUnitId: true,
        legalEntityId: true,
        title: true,
        blocksExport: true,
      },
    });
  }

  private async enrichEmployees(issues: any[]): Promise<AffectedEmployee[]> {
    const employeeIds = [...new Set(issues.filter((i) => i.employeeId).map((i) => i.employeeId))];
    if (employeeIds.length === 0) return [];

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const orgIds = [...new Set(issues.filter((i) => i.orgUnitId).map((i) => i.orgUnitId))];
    const orgUnits = orgIds.length > 0
      ? await this.prisma.orgUnit.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [];
    const ouMap = new Map(orgUnits.map((o) => [o.id, o.name]));

    return issues
      .filter((i) => i.employeeId && empMap.has(i.employeeId))
      .map((i) => {
        const emp = empMap.get(i.employeeId)!;
        return {
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          employeeNo: emp.employeeNo,
          orgUnitName: i.orgUnitId ? ouMap.get(i.orgUnitId) : undefined,
        };
      });
  }

  private async previewBulkManagerAssignment(req: BulkRemediationPreviewRequest): Promise<BulkRemediationPreview> {
    assertFixField(req.proposedFix, 'managerEmployeeId');
    const issues = await this.getAffectedEmployees('MISSING_MANAGER', req.filters);
    assertBatchSize(issues.length);

    const manager = await this.prisma.employee.findUnique({
      where: { id: req.proposedFix.managerEmployeeId as string },
      select: { firstName: true, lastName: true },
    });

    return {
      recordsAffected: issues.length,
      employees: await this.enrichEmployees(issues),
      changesPreview: {
        field: 'managerId',
        label: 'Manager',
        oldValue: null,
        newValue: req.proposedFix.managerEmployeeId,
        newValueLabel: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
      },
      expectedImpact: {
        issuesResolved: issues.length,
        exportBlockersReduced: issues.filter((i) => i.blocksExport).length,
        readinessDeltaEstimate: this.estimateReadinessDelta(issues.length),
      },
    };
  }

  private async applyBulkManagerAssignment(req: BulkRemediationApplyRequest, userId: string): Promise<BulkRemediationResult> {
    assertFixField(req.fix, 'managerEmployeeId');
    const issues = await this.getAffectedEmployees('MISSING_MANAGER', req.filters);
    assertBatchSize(issues.length);

    const managerId = req.fix.managerEmployeeId as string;
    const employeeIds = [...new Set(issues.filter((i) => i.employeeId).map((i) => i.employeeId as string))];

    await this.prisma.employee.updateMany({
      where: { id: { in: employeeIds } },
      data: { managerId },
    });

    const scopes = this.extractScopes(issues);
    await this.logBulkRemediation(userId, 'BULK_ASSIGN_MANAGER', employeeIds.length, { managerId }, scopes, 'MISSING_MANAGER');

    return { success: true, recordsUpdated: employeeIds.length, affectedScopes: scopes };
  }

  // ─── MISSING_ORG_ASSIGNMENT ───────────────────────────────────

  private async previewBulkOrgAssignment(req: BulkRemediationPreviewRequest): Promise<BulkRemediationPreview> {
    assertFixField(req.proposedFix, 'orgUnitId');
    const issues = await this.getAffectedEmployees('MISSING_ORG_ASSIGNMENT', req.filters);
    assertBatchSize(issues.length);

    const ou = await this.prisma.orgUnit.findUnique({
      where: { id: req.proposedFix.orgUnitId as string },
      select: { name: true, code: true },
    });

    return {
      recordsAffected: issues.length,
      employees: await this.enrichEmployees(issues),
      changesPreview: {
        field: 'orgUnitId',
        label: 'Org Unit Assignment',
        oldValue: null,
        newValue: req.proposedFix.orgUnitId,
        newValueLabel: ou ? `${ou.name} (${ou.code})` : undefined,
      },
      expectedImpact: {
        issuesResolved: issues.length,
        exportBlockersReduced: issues.filter((i) => i.blocksExport).length,
        readinessDeltaEstimate: this.estimateReadinessDelta(issues.length),
      },
    };
  }

  private async applyBulkOrgAssignment(req: BulkRemediationApplyRequest, userId: string): Promise<BulkRemediationResult> {
    assertFixField(req.fix, 'orgUnitId');
    const issues = await this.getAffectedEmployees('MISSING_ORG_ASSIGNMENT', req.filters);
    assertBatchSize(issues.length);

    const orgUnitId = req.fix.orgUnitId as string;
    const employeeIds = [...new Set(issues.filter((i) => i.employeeId).map((i) => i.employeeId as string))];

    let created = 0;
    for (const empId of employeeIds) {
      const employment = await this.prisma.employment.findFirst({
        where: { employeeId: empId, effectiveTo: null },
        select: { id: true },
      });
      if (!employment) continue;

      await this.prisma.employmentAssignment.create({
        data: {
          employmentId: employment.id,
          orgUnitId,
          effectiveFrom: new Date(),
        },
      });
      created++;
    }

    const scopes = this.extractScopes(issues);
    scopes.orgUnitIds = [...new Set([...scopes.orgUnitIds, orgUnitId])];
    await this.logBulkRemediation(userId, 'BULK_ASSIGN_ORG_UNIT', created, { orgUnitId }, scopes, 'MISSING_ORG_ASSIGNMENT');

    return { success: true, recordsUpdated: created, affectedScopes: scopes };
  }

  // ─── MISSING_COST_CENTER ──────────────────────────────────────

  private async previewBulkCostCenterAssignment(req: BulkRemediationPreviewRequest): Promise<BulkRemediationPreview> {
    assertFixField(req.proposedFix, 'costCenterId');
    const issues = await this.getAffectedEmployees('MISSING_COST_CENTER', req.filters);
    assertBatchSize(issues.length);

    const cc = await this.prisma.costCenter.findUnique({
      where: { id: req.proposedFix.costCenterId as string },
      select: { costCenterName: true, costCenterCode: true },
    });

    return {
      recordsAffected: issues.length,
      employees: await this.enrichEmployees(issues),
      changesPreview: {
        field: 'costCenterId',
        label: 'Cost Center',
        oldValue: null,
        newValue: req.proposedFix.costCenterId,
        newValueLabel: cc ? `${cc.costCenterName} (${cc.costCenterCode})` : undefined,
      },
      expectedImpact: {
        issuesResolved: issues.length,
        exportBlockersReduced: issues.filter((i) => i.blocksExport).length,
        readinessDeltaEstimate: this.estimateReadinessDelta(issues.length),
      },
    };
  }

  private async applyBulkCostCenterAssignment(req: BulkRemediationApplyRequest, userId: string): Promise<BulkRemediationResult> {
    assertFixField(req.fix, 'costCenterId');
    const issues = await this.getAffectedEmployees('MISSING_COST_CENTER', req.filters);
    assertBatchSize(issues.length);

    const costCenterId = req.fix.costCenterId as string;
    const employeeIds = [...new Set(issues.filter((i) => i.employeeId).map((i) => i.employeeId as string))];

    let updated = 0;
    for (const empId of employeeIds) {
      const assignment = await this.prisma.employmentAssignment.findFirst({
        where: { effectiveTo: null, employment: { employeeId: empId } },
        select: { id: true },
      });
      if (!assignment) continue;

      await this.prisma.employmentAssignment.update({
        where: { id: assignment.id },
        data: { costCenterId },
      });
      updated++;
    }

    const scopes = this.extractScopes(issues);
    await this.logBulkRemediation(userId, 'BULK_ASSIGN_COST_CENTER', updated, { costCenterId }, scopes, 'MISSING_COST_CENTER');

    return { success: true, recordsUpdated: updated, affectedScopes: scopes };
  }

  // ─── EMPLOYEE_WITHOUT_ASSIGNMENT ──────────────────────────────

  private async previewBulkAssignmentCreation(req: BulkRemediationPreviewRequest): Promise<BulkRemediationPreview> {
    assertFixField(req.proposedFix, 'orgUnitId');
    const issues = await this.getAffectedEmployees('EMPLOYEE_WITHOUT_ASSIGNMENT', req.filters);
    assertBatchSize(issues.length);

    const ou = await this.prisma.orgUnit.findUnique({
      where: { id: req.proposedFix.orgUnitId as string },
      select: { name: true, code: true },
    });

    return {
      recordsAffected: issues.length,
      employees: await this.enrichEmployees(issues),
      changesPreview: {
        field: 'assignment',
        label: 'Employment Assignment',
        oldValue: 'No assignment',
        newValue: req.proposedFix.orgUnitId,
        newValueLabel: ou ? `${ou.name} (${ou.code})` : undefined,
      },
      expectedImpact: {
        issuesResolved: issues.length,
        exportBlockersReduced: issues.filter((i) => i.blocksExport).length,
        readinessDeltaEstimate: this.estimateReadinessDelta(issues.length),
      },
    };
  }

  private async applyBulkAssignmentCreation(req: BulkRemediationApplyRequest, userId: string): Promise<BulkRemediationResult> {
    assertFixField(req.fix, 'orgUnitId');
    const issues = await this.getAffectedEmployees('EMPLOYEE_WITHOUT_ASSIGNMENT', req.filters);
    assertBatchSize(issues.length);

    const orgUnitId = req.fix.orgUnitId as string;
    const costCenterId = (req.fix.costCenterId as string) || null;
    const employeeIds = [...new Set(issues.filter((i) => i.employeeId).map((i) => i.employeeId as string))];

    let created = 0;
    for (const empId of employeeIds) {
      const employment = await this.prisma.employment.findFirst({
        where: { employeeId: empId, effectiveTo: null },
        select: { id: true },
      });
      if (!employment) continue;

      await this.prisma.employmentAssignment.create({
        data: {
          employmentId: employment.id,
          orgUnitId,
          costCenterId,
          effectiveFrom: new Date(),
        },
      });
      created++;
    }

    const scopes = this.extractScopes(issues);
    scopes.orgUnitIds = [...new Set([...scopes.orgUnitIds, orgUnitId])];
    await this.logBulkRemediation(userId, 'BULK_CREATE_ASSIGNMENTS', created, { orgUnitId, costCenterId }, scopes, 'EMPLOYEE_WITHOUT_ASSIGNMENT');

    return { success: true, recordsUpdated: created, affectedScopes: scopes };
  }

  // ─── EMPLOYEE_WITHOUT_EMPLOYMENT ──────────────────────────────

  private async previewBulkEmploymentCreation(req: BulkRemediationPreviewRequest): Promise<BulkRemediationPreview> {
    assertFixField(req.proposedFix, 'legalEntityId');
    assertFixField(req.proposedFix, 'payGroupId');
    const issues = await this.getAffectedEmployees('EMPLOYEE_WITHOUT_EMPLOYMENT', req.filters);
    assertBatchSize(issues.length);

    const le = await this.prisma.legalEntity.findUnique({
      where: { id: req.proposedFix.legalEntityId as string },
      select: { name: true, code: true },
    });

    return {
      recordsAffected: issues.length,
      employees: await this.enrichEmployees(issues),
      changesPreview: {
        field: 'employment',
        label: 'Employment',
        oldValue: 'No active employment',
        newValue: req.proposedFix.legalEntityId,
        newValueLabel: le ? `${le.name} (${le.code})` : undefined,
      },
      expectedImpact: {
        issuesResolved: issues.length,
        exportBlockersReduced: issues.filter((i) => i.blocksExport).length,
        readinessDeltaEstimate: this.estimateReadinessDelta(issues.length),
      },
    };
  }

  private async applyBulkEmploymentCreation(req: BulkRemediationApplyRequest, userId: string): Promise<BulkRemediationResult> {
    assertFixField(req.fix, 'legalEntityId');
    assertFixField(req.fix, 'payGroupId');
    const issues = await this.getAffectedEmployees('EMPLOYEE_WITHOUT_EMPLOYMENT', req.filters);
    assertBatchSize(issues.length);

    const legalEntityId = req.fix.legalEntityId as string;
    const payGroupId = req.fix.payGroupId as string;
    const country = (req.fix.country as string) || 'LS';
    const employeeIds = [...new Set(issues.filter((i) => i.employeeId).map((i) => i.employeeId as string))];

    let created = 0;
    for (const empId of employeeIds) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: empId },
        select: { hireDate: true },
      });
      if (!employee) continue;

      await this.prisma.employment.create({
        data: {
          employeeId: empId,
          legalEntityId,
          payGroupId,
          country: country as any,
          effectiveFrom: employee.hireDate,
        },
      });
      created++;
    }

    const scopes = this.extractScopes(issues);
    scopes.legalEntityIds = [...new Set([...scopes.legalEntityIds, legalEntityId])];
    await this.logBulkRemediation(userId, 'BULK_CREATE_EMPLOYMENTS', created, { legalEntityId, payGroupId }, scopes, 'EMPLOYEE_WITHOUT_EMPLOYMENT');

    return { success: true, recordsUpdated: created, affectedScopes: scopes };
  }

  // ─── Import analysis ─────────────────────────────────────────

  async getImportAnalysis(jobId: string) {
    const job = await this.prisma.dataImportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true, status: true, datasetType: true,
        rows: { select: { status: true } },
      },
    });
    if (!job) throw new BadRequestException(`Import job ${jobId} not found`);

    const publishedRows = job.rows.filter((r) => r.status === 'PUBLISHED').length;

    const issueCounts = await this.prisma.workforceIssue.groupBy({
      by: ['issueType'],
      where: { tenantId: TENANT_ID, resolvedAt: null },
      _count: true,
    });
    const issueMap = Object.fromEntries(issueCounts.map((g) => [g.issueType, g._count]));

    const activeEmployees = await this.prisma.employee.count({ where: { status: 'ACTIVE' } });
    const totalIssues = issueCounts.reduce((s, g) => s + g._count, 0);
    const blockers = await this.prisma.workforceIssue.count({
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true },
    });

    const readinessEstimate = activeEmployees > 0
      ? Math.max(0, Math.round(((activeEmployees - blockers) / activeEmployees) * 100))
      : 0;

    const recommendedActions = [
      { issueType: 'MISSING_MANAGER', label: 'Assign managers', count: issueMap.MISSING_MANAGER ?? 0 },
      { issueType: 'MISSING_ORG_ASSIGNMENT', label: 'Create org assignments', count: issueMap.MISSING_ORG_ASSIGNMENT ?? 0 },
      { issueType: 'MISSING_COST_CENTER', label: 'Assign cost centers', count: issueMap.MISSING_COST_CENTER ?? 0 },
      { issueType: 'EMPLOYEE_WITHOUT_EMPLOYMENT', label: 'Create employments', count: issueMap.EMPLOYEE_WITHOUT_EMPLOYMENT ?? 0 },
      { issueType: 'EMPLOYEE_WITHOUT_ASSIGNMENT', label: 'Create assignments', count: issueMap.EMPLOYEE_WITHOUT_ASSIGNMENT ?? 0 },
    ].filter((a) => a.count > 0);

    return {
      jobId: job.id,
      datasetType: job.datasetType,
      status: job.status,
      recordsPublished: publishedRows,
      totalIssues,
      issuesDetected: {
        missingManager: issueMap.MISSING_MANAGER ?? 0,
        missingOrgAssignment: issueMap.MISSING_ORG_ASSIGNMENT ?? 0,
        missingCostCenter: issueMap.MISSING_COST_CENTER ?? 0,
        missingLegalEntity: issueMap.MISSING_LEGAL_ENTITY ?? 0,
        employeeWithoutEmployment: issueMap.EMPLOYEE_WITHOUT_EMPLOYMENT ?? 0,
        employeeWithoutAssignment: issueMap.EMPLOYEE_WITHOUT_ASSIGNMENT ?? 0,
      },
      readinessEstimate: `${readinessEstimate}%`,
      recommendedActions,
    };
  }

  // ─── Bulk remediation history ──────────────────────────────────

  async getHistory(filters?: {
    limit?: number;
    offset?: number;
    actionType?: string;
    issueType?: string;
    legalEntityId?: string;
    userId?: string;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters?.actionType) where.actionType = filters.actionType;
    if (filters?.issueType) where.issueType = filters.issueType;
    if (filters?.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters?.userId) where.userId = filters.userId;

    const [items, total] = await Promise.all([
      this.prisma.workforceBulkRemediation.findMany({
        where: where as any,
        orderBy: { executedAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.workforceBulkRemediation.count({ where: where as any }),
    ]);

    const leIds = [...new Set(items.filter((i) => i.legalEntityId).map((i) => i.legalEntityId!))];
    const ouIds = [...new Set(items.filter((i) => i.orgUnitId).map((i) => i.orgUnitId!))];
    const [les, ous] = await Promise.all([
      leIds.length > 0 ? this.prisma.legalEntity.findMany({ where: { id: { in: leIds } }, select: { id: true, name: true } }) : [],
      ouIds.length > 0 ? this.prisma.orgUnit.findMany({ where: { id: { in: ouIds } }, select: { id: true, name: true } }) : [],
    ]);
    const leMap = new Map(les.map((le) => [le.id, le.name]));
    const ouMap = new Map(ous.map((ou) => [ou.id, ou.name]));

    return {
      items: items.map((item) => ({
        id: item.id,
        actionType: item.actionType,
        issueType: item.issueType,
        recordsAffected: item.recordsAffected,
        fixPayload: item.fixPayload,
        previewSummary: item.previewSummary,
        legalEntityId: item.legalEntityId,
        legalEntityName: item.legalEntityId ? leMap.get(item.legalEntityId) : undefined,
        orgUnitId: item.orgUnitId,
        orgUnitName: item.orgUnitId ? ouMap.get(item.orgUnitId) : undefined,
        userName: `${item.user.firstName} ${item.user.lastName}`,
        userEmail: item.user.email,
        executedAt: item.executedAt,
      })),
      total,
    };
  }

  // ─── Legal entity readiness progress ─────────────────────────

  async getLegalEntityProgress() {
    const entities = await this.prisma.legalEntity.findMany({
      select: { id: true, name: true, code: true },
    });

    const snapshots = await this.prisma.legalEntityStatsSnapshot.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { asOf: 'desc' },
    });
    const snapMap = new Map<string, any>();
    for (const s of snapshots) {
      if (!snapMap.has(s.legalEntityId)) snapMap.set(s.legalEntityId, s);
    }

    const issuesByLE = await this.prisma.workforceIssue.groupBy({
      by: ['legalEntityId'],
      where: { tenantId: TENANT_ID, resolvedAt: null },
      _count: true,
    });
    const issueMap = new Map(issuesByLE.map((g) => [g.legalEntityId, g._count]));

    const blockersByLE = await this.prisma.workforceIssue.groupBy({
      by: ['legalEntityId'],
      where: { tenantId: TENANT_ID, resolvedAt: null, blocksExport: true },
      _count: true,
    });
    const blockerMap = new Map(blockersByLE.map((g) => [g.legalEntityId, g._count]));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const resolvedTodayByLE = await this.prisma.workforceIssue.groupBy({
      by: ['legalEntityId'],
      where: { tenantId: TENANT_ID, resolvedAt: { gte: todayStart } },
      _count: true,
    });
    const resolvedTodayMap = new Map(resolvedTodayByLE.map((g) => [g.legalEntityId, g._count]));

    return entities.map((le) => {
      const snap = snapMap.get(le.id);
      return {
        legalEntityId: le.id,
        name: le.name,
        code: le.code,
        employeeCount: snap?.activeEmployeesCount ?? 0,
        readinessPercent: snap?.readinessPercent ?? 0,
        readinessStatus: snap?.readinessStatus ?? 'INCOMPLETE',
        openIssues: issueMap.get(le.id) ?? 0,
        exportBlockers: blockerMap.get(le.id) ?? 0,
        resolvedToday: resolvedTodayMap.get(le.id) ?? 0,
      };
    }).sort((a, b) => a.readinessPercent - b.readinessPercent);
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private extractScopes(issues: any[]): { legalEntityIds: string[]; orgUnitIds: string[] } {
    return {
      legalEntityIds: [...new Set(issues.filter((i) => i.legalEntityId).map((i) => i.legalEntityId as string))],
      orgUnitIds: [...new Set(issues.filter((i) => i.orgUnitId).map((i) => i.orgUnitId as string))],
    };
  }

  private estimateReadinessDelta(recordsFixed: number): string {
    if (recordsFixed <= 0) return '+0%';
    if (recordsFixed <= 5) return '+1-2%';
    if (recordsFixed <= 15) return '+3-5%';
    if (recordsFixed <= 50) return '+5-10%';
    return '+10%+';
  }

  private async logBulkRemediation(
    userId: string,
    actionType: string,
    recordsAffected: number,
    fixApplied: Record<string, unknown>,
    scopes: { legalEntityIds: string[]; orgUnitIds: string[] },
    issueType?: string,
  ) {
    await this.prisma.workforceBulkRemediation.create({
      data: {
        tenantId: TENANT_ID,
        actionType,
        issueType: issueType ?? actionType,
        recordsAffected,
        userId,
        legalEntityId: scopes.legalEntityIds[0] ?? null,
        orgUnitId: scopes.orgUnitIds[0] ?? null,
        fixPayload: fixApplied as any,
        previewSummary: { scopes } as any,
      },
    });

    await this.auditService.log({
      userId,
      action: 'BULK_REMEDIATION',
      entityType: 'WorkforceRemediation',
      entityId: `bulk_${Date.now()}`,
      newValue: { actionType, recordsAffected, fixApplied, scopes },
    });

    this.logger.log(`Bulk remediation: ${actionType} applied to ${recordsAffected} records by user ${userId}`);
  }
}
