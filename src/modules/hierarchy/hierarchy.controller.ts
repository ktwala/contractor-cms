import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HierarchyIntegrityService } from './hierarchy-integrity.service';
import { OrgGraphService } from './org-graph.service';
import { PrismaService } from '../../core/database/prisma.service';
import { HierarchyIntelligenceService } from '../hierarchy-intelligence/hierarchy-intelligence.service';

@Controller('v1/enterprise/manager-hierarchy')
@UseGuards(AuthGuard('jwt'))
export class HierarchyController {
  constructor(
    private readonly integrity: HierarchyIntegrityService,
    private readonly orgGraph: OrgGraphService,
    private readonly prisma: PrismaService,
    private readonly hierarchyIntelligence: HierarchyIntelligenceService,
  ) {}

  @Get('summary')
  async getSummary() {
    return this.integrity.getReport();
  }

  @Get('issues')
  async getIssues(
    @Query('legal_entity_id') legalEntityId?: string,
    @Query('org_unit_id') orgUnitId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.integrity.getIssues({
      legal_entity_id: legalEntityId,
      org_unit_id: orgUnitId,
      status: (status as 'errors' | 'warnings' | 'clean' | 'all') ?? 'all',
      search,
    });
  }

  @Get('tree')
  async getTree(@Query('root_employee_id') rootEmployeeId?: string) {
    await this.orgGraph.buildGraph(true);

    if (rootEmployeeId) {
      return this.buildSubTree(rootEmployeeId, 0);
    }

    const allEmployees = await this.prisma.employee.findMany({
      select: { id: true, managerId: true, employeeNo: true, firstName: true, lastName: true, jobTitle: true },
    });
    const byManager = new Map<string | null, typeof allEmployees>();
    for (const e of allEmployees) {
      const key = e.managerId;
      if (!byManager.has(key)) byManager.set(key, []);
      byManager.get(key)!.push(e);
    }

    const roots = byManager.get(null) ?? [];
    const buildNode = (emp: (typeof allEmployees)[0], depth: number): unknown => {
      if (depth > 15) return { ...this.formatEmployee(emp), children: [], truncated: true };
      const children = byManager.get(emp.id) ?? [];
      return {
        ...this.formatEmployee(emp),
        direct_reports_count: children.length,
        children: children.map((c) => buildNode(c, depth + 1)),
      };
    };

    return roots.map((r) => buildNode(r, 0));
  }

  @Get('direct-reports/:employeeId')
  async getDirectReports(@Param('employeeId') employeeId: string) {
    const reportIds = await this.orgGraph.getDirectReports(employeeId);
    if (reportIds.length === 0) return [];

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: reportIds } },
    });

    const leIds = [...new Set(employees.map((e) => e.legalEntityId).filter(Boolean) as string[])];
    const leNames = new Map<string, string>();
    if (leIds.length > 0) {
      const les = await this.prisma.legalEntity.findMany({ where: { id: { in: leIds } }, select: { id: true, name: true } });
      for (const le of les) leNames.set(le.id, le.name);
    }

    const reportCounts = new Map<string, number>();
    for (const emp of employees) {
      const subReports = await this.orgGraph.getDirectReports(emp.id);
      reportCounts.set(emp.id, subReports.length);
    }

    return employees.map((e) => ({
      employee_id: e.id,
      employee_no: e.employeeNo,
      first_name: e.firstName,
      last_name: e.lastName,
      job_title: e.jobTitle,
      legal_entity_name: e.legalEntityId ? leNames.get(e.legalEntityId) ?? null : null,
      direct_reports_count: reportCounts.get(e.id) ?? 0,
    }));
  }

  @Get('managers')
  async getManagers() {
    await this.orgGraph.buildGraph(true);

    const employees = await this.prisma.employee.findMany({
      include: {
        employments: {
          where: { effectiveTo: null },
          select: { jobTitle: true, legalEntityId: true },
          take: 1,
        },
      },
    });

    const allLeIds = new Set<string>();
    for (const e of employees) {
      if (e.legalEntityId) allLeIds.add(e.legalEntityId);
      for (const emp of e.employments) {
        if (emp.legalEntityId) allLeIds.add(emp.legalEntityId);
      }
    }
    const leNames = new Map<string, string>();
    if (allLeIds.size > 0) {
      const les = await this.prisma.legalEntity.findMany({ where: { id: { in: Array.from(allLeIds) } }, select: { id: true, name: true } });
      for (const le of les) leNames.set(le.id, le.name);
    }

    const managers: Array<{
      employee_id: string;
      employee_no: string;
      first_name: string;
      last_name: string;
      job_title: string | null;
      legal_entity_name: string | null;
      direct_reports_count: number;
      team_size: number;
      span_warning: boolean;
      span_warning_label: string;
    }> = [];

    for (const emp of employees) {
      const reports = await this.orgGraph.getDirectReports(emp.id);
      if (reports.length > 0) {
        const spanLabel = this.hierarchyIntelligence.computeSpanWarning(reports.length);
        const activeEmployment = emp.employments[0];
        const effectiveLeId = emp.legalEntityId ?? activeEmployment?.legalEntityId;
        managers.push({
          employee_id: emp.id,
          employee_no: emp.employeeNo,
          first_name: emp.firstName,
          last_name: emp.lastName,
          job_title: emp.jobTitle ?? activeEmployment?.jobTitle ?? null,
          legal_entity_name: effectiveLeId ? leNames.get(effectiveLeId) ?? null : null,
          direct_reports_count: reports.length,
          team_size: reports.length,
          span_warning: reports.length > 50,
          span_warning_label: spanLabel,
        });
      }
    }

    // Compute full team sizes in parallel
    await Promise.all(managers.map(async (m) => {
      try {
        const summary = await this.hierarchyIntelligence.getTeamSummary(m.employee_id);
        m.team_size = summary.totalTeamSize;
      } catch {
        // keep direct_reports_count as fallback
      }
    }));

    return managers.sort((a, b) => b.direct_reports_count - a.direct_reports_count);
  }

  @Patch('employees/:employeeId/manager')
  async updateManager(
    @Param('employeeId') employeeId: string,
    @Body() body: { manager_id: string | null },
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (body.manager_id) {
      const manager = await this.prisma.employee.findUnique({ where: { id: body.manager_id } });
      if (!manager) throw new NotFoundException('Manager not found');

      if (body.manager_id === employeeId) {
        throw new NotFoundException('An employee cannot be their own manager');
      }
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { managerId: body.manager_id },
    });

    this.orgGraph.invalidateCache();

    return { employee_id: employeeId, manager_id: body.manager_id };
  }

  @Post('revalidate')
  async revalidate() {
    this.orgGraph.invalidateCache();
    return this.integrity.getReport();
  }

  private async buildSubTree(employeeId: string, depth: number): Promise<unknown> {
    if (depth > 15) return { truncated: true };
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeNo: true, firstName: true, lastName: true, jobTitle: true, managerId: true },
    });
    if (!emp) return null;

    const reportIds = await this.orgGraph.getDirectReports(employeeId);
    const children = [];
    for (const rid of reportIds) {
      const child = await this.buildSubTree(rid, depth + 1);
      if (child) children.push(child);
    }

    return {
      ...this.formatEmployee(emp),
      direct_reports_count: reportIds.length,
      children,
    };
  }

  private formatEmployee(emp: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
  }) {
    return {
      employee_id: emp.id,
      employee_no: emp.employeeNo,
      name: `${emp.firstName} ${emp.lastName}`,
      job_title: emp.jobTitle ?? null,
    };
  }
}
