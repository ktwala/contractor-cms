import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

type SpanWarning = 'OK' | 'WATCH' | 'OVER_THRESHOLD';

export interface TeamNode {
  employeeId: string;
  employeeNo: string;
  name: string;
  jobTitle: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  status: string;
  hierarchyRole: string;
  directReportsCount: number;
  teamSize: number;
  children?: TeamNode[];
}

@Injectable()
export class HierarchyIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeamSummary(employeeId: string) {
    const employee = await this.findEmployeeOrThrow(employeeId);

    const directReports = await this.prisma.employee.count({
      where: { managerId: employeeId, status: 'ACTIVE' },
    });

    const subtree = await this.getSubtreeIds(employeeId);
    const totalTeamSize = subtree.length;
    const levelsBelow = await this.computeMaxDepth(employeeId);

    const largestSpan = await this.computeLargestSpanInSubtree(employeeId, subtree);

    return {
      employeeId: employee.id,
      employeeNo: employee.employeeNo,
      name: `${employee.firstName} ${employee.lastName}`,
      hierarchyRole: employee.hierarchyRole,
      directReportsCount: directReports,
      totalTeamSize,
      levelsBelow,
      largestSpanInSubtree: largestSpan,
      spanWarning: this.computeSpanWarning(directReports),
    };
  }

  async getDirectReports(employeeId: string) {
    await this.findEmployeeOrThrow(employeeId);

    const reports = await this.prisma.employee.findMany({
      where: { managerId: employeeId, status: 'ACTIVE' },
      select: {
        id: true, employeeNo: true, firstName: true, lastName: true,
        jobTitle: true, status: true, hierarchyRole: true,
        legalEntityId: true,
        _count: { select: { directReports: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { lastName: 'asc' },
    });

    const empIds = reports.map((r) => r.id);

    // Batch-fetch org unit and position from assignments
    const assignments = empIds.length > 0
      ? await this.prisma.employmentAssignment.findMany({
          where: { effectiveTo: null, employment: { employeeId: { in: empIds }, effectiveTo: null } },
          select: {
            employment: { select: { employeeId: true } },
            orgUnit: { select: { id: true, name: true } },
            position: { select: { title: true } },
          },
        })
      : [];
    const ouMap = new Map<string, { id: string; name: string }>();
    const positionMap = new Map<string, string>();
    for (const a of assignments) {
      if (a.employment?.employeeId) {
        if (a.orgUnit) ouMap.set(a.employment.employeeId, a.orgUnit);
        if (a.position?.title) positionMap.set(a.employment.employeeId, a.position.title);
      }
    }

    // Batch-fetch legal entity names
    const leIds = [...new Set(reports.filter((r) => r.legalEntityId).map((r) => r.legalEntityId!))];
    const les = leIds.length > 0
      ? await this.prisma.legalEntity.findMany({ where: { id: { in: leIds } }, select: { id: true, name: true } })
      : [];
    const leMap = new Map(les.map((le) => [le.id, le.name]));

    // Compute team sizes for each direct report
    const teamSizes = await Promise.all(empIds.map(async (id) => {
      const sub = await this.getSubtreeIds(id);
      return { id, size: sub.length };
    }));
    const sizeMap = new Map(teamSizes.map((t) => [t.id, t.size]));

    return {
      managerId: employeeId,
      directReports: reports.map((r) => {
        const ou = ouMap.get(r.id);
        const drCount = r._count.directReports;
        const teamSize = sizeMap.get(r.id) ?? 0;
        return {
          employeeId: r.id,
          employeeNo: r.employeeNo,
          name: `${r.firstName} ${r.lastName}`,
          jobTitle: r.jobTitle || positionMap.get(r.id) || null,
          orgUnitId: ou?.id ?? null,
          orgUnitName: ou?.name ?? null,
          legalEntityName: r.legalEntityId ? leMap.get(r.legalEntityId) ?? null : null,
          status: r.status,
          hierarchyRole: r.hierarchyRole,
          directReportsCount: drCount,
          teamSize,
          spanWarning: this.computeSpanWarning(drCount),
        };
      }),
    };
  }

  async getTeamTree(employeeId: string, maxDepth = 3) {
    const employee = await this.findEmployeeOrThrow(employeeId);
    const node = await this.buildTreeNode(employee, 0, maxDepth);
    return { employeeId, node };
  }

  async getFlatTeam(employeeId: string) {
    await this.findEmployeeOrThrow(employeeId);
    const subtreeIds = await this.getSubtreeIds(employeeId);

    if (subtreeIds.length === 0) return { managerId: employeeId, team: [], totalSize: 0 };

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: subtreeIds } },
      select: {
        id: true, employeeNo: true, firstName: true, lastName: true,
        jobTitle: true, status: true, managerId: true, hierarchyRole: true,
      },
      orderBy: { lastName: 'asc' },
    });

    const empIds = employees.map(e => e.id);
    const assignments = empIds.length > 0
      ? await this.prisma.employmentAssignment.findMany({
          where: { effectiveTo: null, employment: { employeeId: { in: empIds }, effectiveTo: null } },
          select: { employment: { select: { employeeId: true } }, position: { select: { title: true } } },
        })
      : [];
    const positionMap = new Map<string, string>();
    for (const a of assignments) {
      if (a.employment?.employeeId && a.position?.title) {
        positionMap.set(a.employment.employeeId, a.position.title);
      }
    }

    return {
      managerId: employeeId,
      team: employees.map((e) => ({
        employeeId: e.id,
        employeeNo: e.employeeNo,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle || positionMap.get(e.id) || null,
        status: e.status,
        managerId: e.managerId,
        hierarchyRole: e.hierarchyRole,
      })),
      totalSize: employees.length,
    };
  }

  // ─── Internal helpers ─────────────────────────────────────

  private async findEmployeeOrThrow(id: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true, employeeNo: true, firstName: true, lastName: true,
        jobTitle: true, hierarchyRole: true, status: true, managerId: true,
        legalEntityId: true,
      },
    });
    if (!emp) throw new NotFoundException(`Employee ${id} not found`);
    return emp;
  }

  private async getSubtreeIds(rootId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.prisma.$queryRaw`
      WITH RECURSIVE team AS (
        SELECT id FROM employees WHERE manager_id = ${rootId} AND status = 'ACTIVE'
        UNION ALL
        SELECT e.id FROM employees e JOIN team t ON e.manager_id = t.id WHERE e.status = 'ACTIVE'
      )
      SELECT id FROM team
    `;
    return rows.map((r) => r.id);
  }

  private async computeMaxDepth(rootId: string): Promise<number> {
    const rows: { max_depth: number }[] = await this.prisma.$queryRaw`
      WITH RECURSIVE team AS (
        SELECT id, 1 AS depth FROM employees WHERE manager_id = ${rootId} AND status = 'ACTIVE'
        UNION ALL
        SELECT e.id, t.depth + 1 FROM employees e JOIN team t ON e.manager_id = t.id WHERE e.status = 'ACTIVE'
      )
      SELECT COALESCE(MAX(depth), 0) AS max_depth FROM team
    `;
    return Number(rows[0]?.max_depth ?? 0);
  }

  private async computeLargestSpanInSubtree(rootId: string, subtreeIds: string[]): Promise<number> {
    if (subtreeIds.length === 0) {
      return await this.prisma.employee.count({ where: { managerId: rootId, status: 'ACTIVE' } });
    }

    const allManagerIds = [rootId, ...subtreeIds];
    const spans = await this.prisma.employee.groupBy({
      by: ['managerId'],
      where: { managerId: { in: allManagerIds }, status: 'ACTIVE' },
      _count: true,
    });

    return spans.reduce((max, s) => Math.max(max, s._count), 0);
  }

  private async buildTreeNode(
    employee: { id: string; employeeNo: string; firstName: string; lastName: string; jobTitle: string | null; hierarchyRole: string },
    currentDepth: number,
    maxDepth: number,
  ): Promise<TeamNode> {
    const directReports = await this.prisma.employee.findMany({
      where: { managerId: employee.id, status: 'ACTIVE' },
      select: {
        id: true, employeeNo: true, firstName: true, lastName: true,
        jobTitle: true, hierarchyRole: true, status: true,
        _count: { select: { directReports: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { lastName: 'asc' },
    });

    const empIds = directReports.map(dr => dr.id);
    const assignments = empIds.length > 0
      ? await this.prisma.employmentAssignment.findMany({
          where: { effectiveTo: null, employment: { employeeId: { in: empIds }, effectiveTo: null } },
          select: { employment: { select: { employeeId: true } }, position: { select: { title: true } } },
        })
      : [];
    const positionMap = new Map<string, string>();
    for (const a of assignments) {
      if (a.employment?.employeeId && a.position?.title) {
        positionMap.set(a.employment.employeeId, a.position.title);
      }
    }

    // Also get position for the root node
    let rootJobTitle = employee.jobTitle;
    if (!rootJobTitle) {
      const rootAssignment = await this.prisma.employmentAssignment.findFirst({
        where: { effectiveTo: null, employment: { employeeId: employee.id, effectiveTo: null } },
        select: { position: { select: { title: true } } },
      });
      if (rootAssignment?.position?.title) {
        rootJobTitle = rootAssignment.position.title;
      }
    }

    const subtreeSize = await this.getSubtreeIds(employee.id);

    const children: TeamNode[] = currentDepth < maxDepth
      ? await Promise.all(directReports.map((dr) => this.buildTreeNode(dr, currentDepth + 1, maxDepth)))
      : directReports.map((dr) => ({
          employeeId: dr.id,
          employeeNo: dr.employeeNo,
          name: `${dr.firstName} ${dr.lastName}`,
          jobTitle: dr.jobTitle || positionMap.get(dr.id) || null,
          orgUnitId: null, orgUnitName: null,
          legalEntityId: null, legalEntityName: null,
          status: dr.status,
          hierarchyRole: dr.hierarchyRole,
          directReportsCount: dr._count.directReports,
          teamSize: 0,
        }));

    return {
      employeeId: employee.id,
      employeeNo: employee.employeeNo,
      name: `${employee.firstName} ${employee.lastName}`,
      jobTitle: rootJobTitle || null,
      orgUnitId: null, orgUnitName: null,
      legalEntityId: null, legalEntityName: null,
      status: 'ACTIVE',
      hierarchyRole: employee.hierarchyRole,
      directReportsCount: directReports.length,
      teamSize: subtreeSize.length,
      children,
    };
  }

  computeSpanWarning(directReportsCount: number): SpanWarning {
    if (directReportsCount > 100) return 'OVER_THRESHOLD';
    if (directReportsCount > 50) return 'WATCH';
    return 'OK';
  }
}
