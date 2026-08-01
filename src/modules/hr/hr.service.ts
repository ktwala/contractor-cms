import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EmploymentsService } from '../employees/employments.service';
import { Country } from '../../common/dto/enums.dto';
import { EmployeeStatus } from '../../common/dto/enums.dto';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employmentsService: EmploymentsService,
  ) {}

  /**
   * Legal entities for HR contract (includes updated_at).
   */
  async getLegalEntities() {
    const items = await this.prisma.legalEntity.findMany({
      orderBy: { code: 'asc' },
    });
    return {
      items: items.map((e) => ({
        legal_entity_id: e.id,
        code: e.code,
        name: e.name,
        country: e.country as Country,
        updated_at: e.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Delta feed: employees changed after changed_since, or all if omitted.
   * Returns employee_no keyed data with manager_employee_no and optional current_employment.
   * Optional as_of: resolve current_employment as of that date (point-in-time); omit for "now".
   */
  async getEmployeesDelta(params: {
    changed_since?: string;
    limit?: number;
    cursor?: string;
    include?: string;
    as_of?: string;
  }) {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursorOffset = this.parseCursor(params.cursor);
    const includeCurrentEmployment = this.shouldInclude(params.include, 'current_employment');
    const changedSince = params.changed_since ? new Date(params.changed_since) : null;
    const asOfDate = this.parseAsOf(params.as_of);

    let employeeIds: string[];

    if (changedSince) {
      const [fromEmployee, fromEmployment] = await Promise.all([
        this.prisma.employee.findMany({
          where: { updatedAt: { gt: changedSince } },
          select: { id: true },
        }),
        this.prisma.employment.findMany({
          where: { updatedAt: { gt: changedSince } },
          select: { employeeId: true },
        }),
      ]);
      const idSet = new Set<string>();
      fromEmployee.forEach((r) => idSet.add(r.id));
      fromEmployment.forEach((r) => idSet.add(r.employeeId));
      employeeIds = Array.from(idSet);
    } else {
      const all = await this.prisma.employee.findMany({
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      });
      employeeIds = all.map((r) => r.id);
    }

    // Stable order: by employee updatedAt desc, then id; paginate on ordered set
    const orderedRows = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: cursorOffset,
      take: limit + 1,
      select: { id: true },
    });
    const hasMore = orderedRows.length > limit;
    const pageIds = orderedRows.slice(0, limit).map((r) => r.id);
    const nextCursor = hasMore ? String(cursorOffset + limit) : null;

    const page = await this.prisma.employee.findMany({
      where: { id: { in: pageIds } },
      include: {
        manager: { select: { employeeNo: true } },
      },
    });
    // Preserve order of pageIds (findMany does not guarantee order for "in")
    const orderMap = new Map(pageIds.map((id, i) => [id, i]));
    page.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    const items = await Promise.all(
      page.map((emp) =>
        this.mapEmployeeToHrResponse(emp, includeCurrentEmployment, asOfDate),
      ),
    );

    return {
      items,
      next_cursor: nextCursor,
      as_of: new Date().toISOString(),
    };
  }

  /**
   * Get one employee by employee_no (IGA-friendly key).
   * Optional as_of: resolve current_employment as of that date; omit for "now".
   */
  async getByEmployeeNo(employeeNo: string, asOf?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeNo },
      include: {
        manager: { select: { employeeNo: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Employee with employee_no '${employeeNo}' not found`,
      });
    }
    return this.mapEmployeeToHrResponse(employee, true, this.parseAsOf(asOf));
  }

  /**
   * Employment history for an employee identified by employee_no.
   */
  async getEmploymentsByEmployeeNo(employeeNo: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeNo },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Employee with employee_no '${employeeNo}' not found`,
      });
    }
    return this.employmentsService.listForEmployee(employee.id);
  }

  private parseCursor(cursor?: string): number {
    if (cursor == null || cursor === '') return 0;
    const n = parseInt(cursor, 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  }

  private shouldInclude(includeParam: string | undefined, key: string): boolean {
    if (!includeParam) return true;
    const parts = includeParam.split(',').map((s) => s.trim().toLowerCase());
    return parts.length === 0 || parts.includes(key.toLowerCase());
  }

  private parseAsOf(asOf?: string): Date | undefined {
    if (asOf == null || asOf === '') return undefined;
    const d = new Date(asOf);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  private async mapEmployeeToHrResponse(
    employee: any,
    includeCurrentEmployment: boolean,
    asOfDate?: Date,
  ) {
    const base: Record<string, unknown> = {
      employee_id: employee.id,
      employee_no: employee.employeeNo,
      first_name: employee.firstName,
      last_name: employee.lastName,
      email: employee.email ?? null,
      phone: employee.phone ?? null,
      status: employee.status as EmployeeStatus,
      hire_date: employee.hireDate.toISOString().split('T')[0],
      termination_date: employee.terminationDate?.toISOString().split('T')[0] ?? null,
      legal_entity_id: employee.legalEntityId ?? null,
      department: employee.department ?? null,
      job_title: employee.jobTitle ?? null,
      manager_employee_no: employee.manager?.employeeNo ?? null,
      updated_at: employee.updatedAt.toISOString(),
    };

    if (includeCurrentEmployment) {
      const enriched = await this.employmentsService.getCurrentEmploymentEnriched(
        employee.id,
        asOfDate,
      );
      base.current_employment = enriched
        ? this.mapEmploymentToHr(enriched)
        : null;
    }

    return base;
  }

  /**
   * Maps enriched employment (with current_assignment, next_assignment) to HR export format.
   * IGA-ready: legal entity, current org unit (and code), current cost center (and code),
   * effective dates, and next_assignment for planned move (JML) scenarios.
   */
  private mapEmploymentToHr(employment: any) {
    const ca = employment.current_assignment;
    const na = employment.next_assignment;
    const costCenterFromAssignment = ca?.cost_center?.name ?? ca?.cost_center?.code;
    const costCenter = costCenterFromAssignment ?? employment.cost_center ?? null;

    return {
      employment_id: employment.id,
      legal_entity_id: employment.legal_entity_id,
      pay_group_id: employment.pay_group_id,
      country: employment.country as Country,
      job_title: employment.job_title ?? null,
      org_unit_id: ca?.org_unit_id ?? null,
      org_unit_code: ca?.org_unit?.code ?? null,
      org_unit_name: ca?.org_unit?.name ?? null,
      position_id: ca?.position_id ?? null,
      position_code: ca?.position?.code ?? null,
      position_title: ca?.position?.title ?? null,
      cost_center_id: ca?.cost_center_id ?? null,
      cost_center_code: ca?.cost_center?.code ?? null,
      cost_center: costCenter,
      legacy_cost_center: employment.cost_center ?? null,
      employment_type: employment.employment_type,
      effective_from: employment.effective_from,
      effective_to: employment.effective_to ?? null,
      updated_at: employment.updated_at ?? employment.created_at,
      next_assignment: na
        ? {
            org_unit_id: na.org_unit_id,
            org_unit_code: na.org_unit?.code ?? null,
            org_unit_name: na.org_unit?.name ?? null,
            position_id: na.position_id ?? null,
            position_code: na.position?.code ?? null,
            position_title: na.position?.title ?? null,
            cost_center_id: na.cost_center_id,
            cost_center_code: na.cost_center?.code ?? null,
            cost_center_name: na.cost_center?.name ?? null,
            effective_from: na.effective_from,
            effective_to: na.effective_to ?? null,
          }
        : null,
    };
  }
}
