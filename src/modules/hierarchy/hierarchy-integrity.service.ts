import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { OrgGraphService } from './org-graph.service';

export type HierarchyIssue = {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  employee_ids?: string[];
};

export type HierarchyIntegrityReport = {
  employees_total: number;
  manager_assigned: number;
  missing_manager: number;
  cycles_detected: number;
  self_manager: number;
  orphan_managers: number;
  cross_entity_managers: number;
  cross_org_managers: number;
  max_depth: number;
  largest_span: number;
  status: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  errors: HierarchyIssue[];
  warnings: HierarchyIssue[];
};

type EmployeeRow = {
  id: string;
  managerId: string | null;
  legalEntityId: string | null;
  orgUnitId: string | null;
  orgUnitParentId: string | null;
};

@Injectable()
export class HierarchyIntegrityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgGraph: OrgGraphService,
  ) {}

  async getReport(employeeIds?: string[]): Promise<HierarchyIntegrityReport> {
    await this.orgGraph.buildGraph(true);

    const ids =
      employeeIds ??
      (await this.prisma.employee.findMany({ select: { id: true } })).map(
        (e) => e.id,
      );

    if (ids.length === 0) {
      return {
        employees_total: 0,
        manager_assigned: 0,
        missing_manager: 0,
        cycles_detected: 0,
        self_manager: 0,
        orphan_managers: 0,
        cross_entity_managers: 0,
        cross_org_managers: 0,
        max_depth: 0,
        largest_span: 0,
        status: 'READY',
        errors: [],
        warnings: [],
      };
    }

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, managerId: true, legalEntityId: true },
    });

    const currentAssignments = await this.prisma.employmentAssignment.findMany({
      where: {
        employment: { employeeId: { in: ids } },
        effectiveTo: null,
      },
      select: {
        employment: { select: { employeeId: true } },
        orgUnitId: true,
        orgUnit: { select: { parentOrgUnitId: true } },
      },
    });
    const empOrgMap = new Map<string, { orgUnitId: string; orgUnitParentId: string | null }>();
    for (const a of currentAssignments) {
      if (!empOrgMap.has(a.employment.employeeId)) {
        empOrgMap.set(a.employment.employeeId, {
          orgUnitId: a.orgUnitId,
          orgUnitParentId: a.orgUnit.parentOrgUnitId,
        });
      }
    }

    const orgUnitParents = new Map<string, string | null>();
    const orgUnits = await this.prisma.orgUnit.findMany({ select: { id: true, parentOrgUnitId: true } });
    for (const ou of orgUnits) {
      orgUnitParents.set(ou.id, ou.parentOrgUnitId);
    }

    const employeeMap = new Map<string, EmployeeRow>(
      employees.map((e) => {
        const orgInfo = empOrgMap.get(e.id);
        return [e.id, {
          ...e,
          orgUnitId: orgInfo?.orgUnitId ?? null,
          orgUnitParentId: orgInfo?.orgUnitParentId ?? null,
        }];
      }),
    );
    const allEmployeeIds = new Set(
      (await this.prisma.employee.findMany({ select: { id: true } })).map((e) => e.id),
    );

    const errors: HierarchyIssue[] = [];
    const warnings: HierarchyIssue[] = [];

    const selfManagers = this.detectSelfManagers(employeeMap);
    if (selfManagers.length > 0) {
      errors.push({
        code: 'HIER-002',
        severity: 'ERROR',
        message: `${selfManagers.length} employee(s) report to themselves`,
        employee_ids: selfManagers,
      });
    }

    const orphanManagers = this.detectOrphanManagers(employeeMap, allEmployeeIds);
    if (orphanManagers.length > 0) {
      errors.push({
        code: 'HIER-003',
        severity: 'ERROR',
        message: `${orphanManagers.length} employee(s) point to a manager that does not exist`,
        employee_ids: orphanManagers,
      });
    }

    const cycleIds = this.detectCycles(employeeMap);
    if (cycleIds.length > 0) {
      errors.push({
        code: 'HIER-001',
        severity: 'ERROR',
        message: `${cycleIds.length} employee(s) involved in circular reporting chains`,
        employee_ids: cycleIds,
      });
    }

    const withManager = employees.filter((e) => e.managerId !== null).length;
    const missingManager = employees.length - withManager;
    if (missingManager > 0) {
      warnings.push({
        code: 'HIER-W01',
        severity: 'WARNING',
        message: `${missingManager} employee(s) have no manager assigned`,
      });
    }

    const crossEntityPairs = this.detectCrossEntity(employeeMap);
    if (crossEntityPairs.length > 0) {
      warnings.push({
        code: 'HIER-W02',
        severity: 'WARNING',
        message: `${crossEntityPairs.length} employee(s) report to a manager in a different legal entity`,
        employee_ids: crossEntityPairs,
      });
    }

    const crossOrgPairs = this.detectCrossOrg(employeeMap, orgUnitParents);
    if (crossOrgPairs.length > 0) {
      warnings.push({
        code: 'HIER-W03',
        severity: 'WARNING',
        message: `${crossOrgPairs.length} employee(s) report to a manager in an unrelated org branch`,
        employee_ids: crossOrgPairs,
      });
    }

    const maxDepth = await this.orgGraph.getHierarchyDepth();
    if (maxDepth > 12) {
      warnings.push({
        code: 'HIER-W05',
        severity: 'WARNING',
        message: `Hierarchy depth is ${maxDepth} (threshold: 12)`,
      });
    }

    const largestSpan = await this.computeLargestSpan(ids);
    if (largestSpan > 50) {
      warnings.push({
        code: 'HIER-W04',
        severity: 'WARNING',
        message: `Largest span of control is ${largestSpan} direct reports (threshold: 50)`,
      });
    }

    let status: HierarchyIntegrityReport['status'] = 'READY';
    if (errors.length > 0) {
      status = 'NOT_READY';
    } else if (warnings.length > 0) {
      status = 'READY_WITH_WARNINGS';
    }

    return {
      employees_total: employees.length,
      manager_assigned: withManager,
      missing_manager: missingManager,
      cycles_detected: cycleIds.length,
      self_manager: selfManagers.length,
      orphan_managers: orphanManagers.length,
      cross_entity_managers: crossEntityPairs.length,
      cross_org_managers: crossOrgPairs.length,
      max_depth: maxDepth,
      largest_span: largestSpan,
      status,
      errors,
      warnings,
    };
  }

  private detectSelfManagers(employeeMap: Map<string, EmployeeRow>): string[] {
    const result: string[] = [];
    for (const [id, emp] of employeeMap) {
      if (emp.managerId === id) {
        result.push(id);
      }
    }
    return result;
  }

  private detectOrphanManagers(
    employeeMap: Map<string, EmployeeRow>,
    allEmployeeIds: Set<string>,
  ): string[] {
    const result: string[] = [];
    for (const [id, emp] of employeeMap) {
      if (emp.managerId && !allEmployeeIds.has(emp.managerId)) {
        result.push(id);
      }
    }
    return result;
  }

  private detectCycles(employeeMap: Map<string, EmployeeRow>): string[] {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycleMembers = new Set<string>();

    const dfs = (node: string) => {
      visited.add(node);
      inStack.add(node);
      const emp = employeeMap.get(node);
      const managerId = emp?.managerId;
      if (managerId && managerId !== node && employeeMap.has(managerId)) {
        if (!visited.has(managerId)) {
          dfs(managerId);
        } else if (inStack.has(managerId)) {
          let cur = managerId;
          do {
            cycleMembers.add(cur);
            const m = employeeMap.get(cur)?.managerId;
            if (!m || m === cur) break;
            cur = m;
          } while (cur !== managerId);
          cycleMembers.add(node);
        }
      }
      inStack.delete(node);
    };

    for (const id of employeeMap.keys()) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }
    return Array.from(cycleMembers);
  }

  /**
   * Returns per-employee issue rows for the Exceptions tab UI.
   */
  async getIssues(filters?: {
    legal_entity_id?: string;
    org_unit_id?: string;
    status?: 'errors' | 'warnings' | 'clean' | 'all';
    search?: string;
  }): Promise<Array<{
    employee_id: string;
    employee_no: string;
    first_name: string;
    last_name: string;
    manager_id: string | null;
    manager_name: string | null;
    legal_entity_id: string | null;
    legal_entity_name: string | null;
    org_unit_name: string | null;
    issues: Array<{ code: string; severity: 'ERROR' | 'WARNING'; message: string }>;
  }>> {
    const report = await this.getReport();
    const allIssueEmployeeIds = new Map<string, Array<{ code: string; severity: 'ERROR' | 'WARNING'; message: string }>>();

    for (const issue of [...report.errors, ...report.warnings]) {
      if (issue.employee_ids) {
        for (const empId of issue.employee_ids) {
          if (!allIssueEmployeeIds.has(empId)) allIssueEmployeeIds.set(empId, []);
          allIssueEmployeeIds.get(empId)!.push({ code: issue.code, severity: issue.severity, message: issue.message });
        }
      }
    }

    const missingManagerIds = (await this.prisma.employee.findMany({
      where: { managerId: null },
      select: { id: true },
    })).map((e) => e.id);
    for (const empId of missingManagerIds) {
      if (!allIssueEmployeeIds.has(empId)) allIssueEmployeeIds.set(empId, []);
      const existing = allIssueEmployeeIds.get(empId)!;
      if (!existing.some((i) => i.code === 'HIER-W01')) {
        existing.push({ code: 'HIER-W01', severity: 'WARNING', message: 'No manager assigned' });
      }
    }

    const statusFilter = filters?.status ?? 'all';
    let targetIds: string[];

    if (statusFilter === 'clean') {
      const allEmps = await this.prisma.employee.findMany({ select: { id: true } });
      const issueSet = new Set(allIssueEmployeeIds.keys());
      targetIds = allEmps.map((e) => e.id).filter((id) => !issueSet.has(id));
    } else if (statusFilter === 'errors') {
      targetIds = [...allIssueEmployeeIds.entries()]
        .filter(([, issues]) => issues.some((i) => i.severity === 'ERROR'))
        .map(([id]) => id);
    } else if (statusFilter === 'warnings') {
      targetIds = [...allIssueEmployeeIds.entries()]
        .filter(([, issues]) => issues.some((i) => i.severity === 'WARNING') && !issues.some((i) => i.severity === 'ERROR'))
        .map(([id]) => id);
    } else {
      targetIds = [...allIssueEmployeeIds.keys()];
    }

    if (targetIds.length === 0) return [];

    const where: Record<string, unknown> = { id: { in: targetIds } };
    if (filters?.legal_entity_id) where.legalEntityId = filters.legal_entity_id;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { employeeNo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where: where as any,
      include: {
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: { lastName: 'asc' },
      take: 200,
    });

    const leIds = [...new Set(employees.map((e) => e.legalEntityId).filter(Boolean) as string[])];
    const leNames = new Map<string, string>();
    if (leIds.length > 0) {
      const les = await this.prisma.legalEntity.findMany({ where: { id: { in: leIds } }, select: { id: true, name: true } });
      for (const le of les) leNames.set(le.id, le.name);
    }

    const empAssignments = await this.prisma.employmentAssignment.findMany({
      where: {
        employment: { employeeId: { in: employees.map((e) => e.id) } },
        effectiveTo: null,
      },
      select: {
        employment: { select: { employeeId: true } },
        orgUnit: { select: { name: true } },
      },
    });
    const empOrgNames = new Map<string, string>();
    for (const a of empAssignments) {
      if (!empOrgNames.has(a.employment.employeeId)) {
        empOrgNames.set(a.employment.employeeId, a.orgUnit.name);
      }
    }

    return employees.map((e) => ({
      employee_id: e.id,
      employee_no: e.employeeNo,
      first_name: e.firstName,
      last_name: e.lastName,
      manager_id: e.managerId,
      manager_name: e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : null,
      legal_entity_id: e.legalEntityId,
      legal_entity_name: e.legalEntityId ? leNames.get(e.legalEntityId) ?? null : null,
      org_unit_name: empOrgNames.get(e.id) ?? null,
      issues: allIssueEmployeeIds.get(e.id) ?? [],
    }));
  }

  private detectCrossEntity(employeeMap: Map<string, EmployeeRow>): string[] {
    const result: string[] = [];
    for (const [id, emp] of employeeMap) {
      if (!emp.managerId || !emp.legalEntityId) continue;
      const manager = employeeMap.get(emp.managerId);
      if (!manager || !manager.legalEntityId) continue;
      if (emp.legalEntityId !== manager.legalEntityId) {
        result.push(id);
      }
    }
    return result;
  }

  private detectCrossOrg(
    employeeMap: Map<string, EmployeeRow>,
    orgUnitParents: Map<string, string | null>,
  ): string[] {
    const getAncestors = (ouId: string): Set<string> => {
      const ancestors = new Set<string>();
      let current: string | null = ouId;
      const visited = new Set<string>();
      while (current) {
        if (visited.has(current)) break;
        visited.add(current);
        ancestors.add(current);
        current = orgUnitParents.get(current) ?? null;
      }
      return ancestors;
    };

    const result: string[] = [];
    for (const [id, emp] of employeeMap) {
      if (!emp.managerId || !emp.orgUnitId) continue;
      const manager = employeeMap.get(emp.managerId);
      if (!manager || !manager.orgUnitId) continue;
      if (emp.orgUnitId === manager.orgUnitId) continue;

      const empAncestors = getAncestors(emp.orgUnitId);
      const mgrAncestors = getAncestors(manager.orgUnitId);

      const related =
        empAncestors.has(manager.orgUnitId) ||
        mgrAncestors.has(emp.orgUnitId);

      if (!related) {
        result.push(id);
      }
    }
    return result;
  }

  private async computeLargestSpan(employeeIds: string[]): Promise<number> {
    await this.orgGraph.buildGraph();
    let max = 0;
    for (const id of employeeIds) {
      const reports = await this.orgGraph.getDirectReports(id);
      if (reports.length > max) max = reports.length;
    }
    return max;
  }
}
