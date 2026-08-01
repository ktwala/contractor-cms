import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { SetupService } from '../setup/setup.service';
import { HierarchyIntegrityService } from '../hierarchy/hierarchy-integrity.service';
import {
  DashboardQueryDto,
  TrendQueryDto,
  DashboardResponseDto,
  AnalyticsResponseDto,
  PayrollSummaryDto,
  DepartmentBreakdownDto,
  PayItemBreakdownDto,
  StatutoryTotalsDto,
  PayRunStatusCountDto,
  UpcomingPayrunsDto,
  PeriodTrendDto,
  PayrollTrendsDto,
  PendingApprovalsDto,
  WorkforceSummaryDto,
  PayrollSnapshotDto,
  ComplianceSnapshotDto,
  DataImportsSummaryDto,
  HrExportReadinessDto,
} from './dto/dashboard.dto';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import type { CurrentUserData } from '../../common/decorators/current-user.decorator';

/** Scope for dashboard queries: legal entity IDs the user can access. Empty = no filtering (platform-wide). */
export type DashboardScope = { legalEntityIds: string[] };

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly setupService: SetupService,
    private readonly hierarchyIntegrity: HierarchyIntegrityService,
  ) {}

  // ============================================================================
  // Main Dashboard
  // ============================================================================

  async getDashboard(query: DashboardQueryDto): Promise<DashboardResponseDto> {
    const { fromDate, toDate, periodLabel } = this.resolveDateRange(query);

    const [summary, byDepartment, statutory, payrunStatus, upcomingPayruns] = await Promise.all([
      this.getPayrollSummary(query, fromDate, toDate),
      this.getDepartmentBreakdown(query, fromDate, toDate),
      this.getStatutoryTotals(query, fromDate, toDate),
      this.getPayRunStatusCounts(query),
      this.getUpcomingPayruns(query),
    ]);

    return {
      summary,
      by_department: byDepartment,
      statutory,
      payrun_status: payrunStatus,
      upcoming_payruns: upcomingPayruns,
      period_label: periodLabel,
    };
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  async getAnalytics(query: TrendQueryDto): Promise<AnalyticsResponseDto> {
    const periods = query.periods || 6;
    const { fromDate, toDate } = this.resolveDateRange(query);

    const [trends, topEarnings, topDeductions, departmentComparison] = await Promise.all([
      this.getPayrollTrends(query, periods),
      this.getTopPayItems(query, fromDate, toDate, 'EARNING', 10),
      this.getTopPayItems(query, fromDate, toDate, 'DEDUCTION', 10),
      this.getDepartmentBreakdown(query, fromDate, toDate),
    ]);

    return {
      trends,
      top_earnings: topEarnings,
      top_deductions: topDeductions,
      department_comparison: departmentComparison,
    };
  }

  // ============================================================================
  // Payroll Summary
  // ============================================================================

  async getPayrollSummary(
    query: DashboardQueryDto,
    fromDate: Date,
    toDate: Date,
  ): Promise<PayrollSummaryDto> {
    const payrunFilter = this.buildPayrunFilter(query, fromDate, toDate);

    const results = await this.prisma.employeeResult.findMany({
      where: {
        payrun: {
          ...payrunFilter,
          status: { in: ['CALCULATED', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
        },
      },
      select: {
        gross: true,
        paye: true,
        deductionsTotal: true,
        net: true,
      },
    });

    const totals = results.reduce(
      (acc: { gross: number; paye: number; deductions: number; net: number }, r: { gross: any; paye: any; deductionsTotal: any; net: any }) => ({
        gross: acc.gross + Number(r.gross),
        paye: acc.paye + Number(r.paye),
        deductions: acc.deductions + Number(r.deductionsTotal),
        net: acc.net + Number(r.net),
      }),
      { gross: 0, paye: 0, deductions: 0, net: 0 },
    );

    const employeeCount = results.length;
    const averageSalary = employeeCount > 0 ? totals.gross / employeeCount : 0;

    // Estimate employer cost (gross + employer contributions ~15%)
    const employerCost = totals.gross * 1.15;

    return {
      total_gross: Math.round(totals.gross * 100) / 100,
      total_paye: Math.round(totals.paye * 100) / 100,
      total_deductions: Math.round(totals.deductions * 100) / 100,
      total_net: Math.round(totals.net * 100) / 100,
      total_employer_cost: Math.round(employerCost * 100) / 100,
      employee_count: employeeCount,
      average_salary: Math.round(averageSalary * 100) / 100,
    };
  }

  // ============================================================================
  // Department Breakdown
  // ============================================================================

  async getDepartmentBreakdown(
    query: DashboardQueryDto,
    fromDate: Date,
    toDate: Date,
  ): Promise<DepartmentBreakdownDto[]> {
    const payrunFilter = this.buildPayrunFilter(query, fromDate, toDate);

    const results = await this.prisma.employeeResult.findMany({
      where: {
        payrun: {
          ...payrunFilter,
          status: { in: ['CALCULATED', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
        },
      },
      include: {
        employee: {
          include: {
            employments: {
              where: { effectiveTo: null },
              take: 1,
            },
          },
        },
      },
    });

    // Group by department
    const byDept = new Map<string, { gross: number; net: number; count: number }>();
    let totalGross = 0;

    for (const result of results) {
      const dept = result.employee.employments?.[0]?.costCenter || 'Unassigned';
      const current = byDept.get(dept) || { gross: 0, net: 0, count: 0 };

      current.gross += Number(result.gross);
      current.net += Number(result.net);
      current.count += 1;
      totalGross += Number(result.gross);

      byDept.set(dept, current);
    }

    // Convert to array and calculate percentages
    const breakdown: DepartmentBreakdownDto[] = [];
    for (const [dept, data] of byDept.entries()) {
      breakdown.push({
        department: dept,
        employee_count: data.count,
        total_gross: Math.round(data.gross * 100) / 100,
        total_net: Math.round(data.net * 100) / 100,
        percentage_of_total: totalGross > 0 ? Math.round((data.gross / totalGross) * 10000) / 100 : 0,
      });
    }

    return breakdown.sort((a, b) => b.total_gross - a.total_gross);
  }

  // ============================================================================
  // Statutory Totals
  // ============================================================================

  async getStatutoryTotals(
    query: DashboardQueryDto,
    fromDate: Date,
    toDate: Date,
  ): Promise<StatutoryTotalsDto> {
    const payrunFilter = this.buildPayrunFilter(query, fromDate, toDate);

    const payLines = await this.prisma.payLine.findMany({
      where: {
        employeeResult: {
          payrun: {
            ...payrunFilter,
            status: { in: ['CALCULATED', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
          },
        },
      },
      include: {
        payItem: true,
      },
    });

    const totals = {
      paye: 0,
      uif_employee: 0,
      uif_employer: 0,
      sdl: 0,
    };

    for (const line of payLines) {
      const code = line.payItem?.code?.toUpperCase() || '';
      const amount = Number(line.amount);

      if (code === 'PAYE' || line.type === 'TAX') {
        totals.paye += amount;
      } else if (code === 'UIF_EE' || code === 'UIF') {
        totals.uif_employee += amount;
      } else if (code === 'UIF_ER') {
        totals.uif_employer += amount;
      } else if (code === 'SDL') {
        totals.sdl += amount;
      }
    }

    return {
      paye: Math.round(totals.paye * 100) / 100,
      uif_employee: Math.round(totals.uif_employee * 100) / 100,
      uif_employer: Math.round(totals.uif_employer * 100) / 100,
      sdl: Math.round(totals.sdl * 100) / 100,
      total_statutory: Math.round(
        (totals.paye + totals.uif_employee + totals.uif_employer + totals.sdl) * 100,
      ) / 100,
    };
  }

  // ============================================================================
  // Pay Item Breakdown
  // ============================================================================

  async getTopPayItems(
    query: DashboardQueryDto,
    fromDate: Date,
    toDate: Date,
    type: 'EARNING' | 'DEDUCTION',
    limit: number,
  ): Promise<PayItemBreakdownDto[]> {
    const payrunFilter = this.buildPayrunFilter(query, fromDate, toDate);

    const payLines = await this.prisma.payLine.findMany({
      where: {
        type,
        employeeResult: {
          payrun: {
            ...payrunFilter,
            status: { in: ['CALCULATED', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'] },
          },
        },
      },
      include: {
        payItem: true,
      },
    });

    // Group by pay item
    const byItem = new Map<string, { name: string; type: string; total: number; count: number }>();

    for (const line of payLines) {
      const code = line.payItem?.code || 'UNKNOWN';
      const current = byItem.get(code) || {
        name: line.payItem?.name || code,
        type: line.type,
        total: 0,
        count: 0,
      };

      current.total += Number(line.amount);
      current.count += 1;
      byItem.set(code, current);
    }

    // Convert and sort
    const breakdown: PayItemBreakdownDto[] = [];
    for (const [code, data] of byItem.entries()) {
      breakdown.push({
        code,
        name: data.name,
        type: data.type,
        total_amount: Math.round(data.total * 100) / 100,
        employee_count: data.count,
        average_amount: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
      });
    }

    return breakdown.sort((a, b) => b.total_amount - a.total_amount).slice(0, limit);
  }

  // ============================================================================
  // Trends
  // ============================================================================

  async getPayrollTrends(query: TrendQueryDto, periods: number): Promise<PayrollTrendsDto> {
    const trendData: PeriodTrendDto[] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const periodDate = subMonths(now, i);
      const periodStart = startOfMonth(periodDate);
      const periodEnd = endOfMonth(periodDate);
      const periodLabel = format(periodDate, 'MMM yyyy');

      const summary = await this.getPayrollSummary(query, periodStart, periodEnd);

      trendData.push({
        period: periodLabel,
        period_start: format(periodStart, 'yyyy-MM-dd'),
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        total_gross: summary.total_gross,
        total_net: summary.total_net,
        employee_count: summary.employee_count,
        average_salary: summary.average_salary,
      });
    }

    // Calculate change percentages (comparing last to first period)
    const first = trendData[0];
    const last = trendData[trendData.length - 1];

    const grossChange = first.total_gross > 0
      ? ((last.total_gross - first.total_gross) / first.total_gross) * 100
      : 0;

    const headcountChange = first.employee_count > 0
      ? ((last.employee_count - first.employee_count) / first.employee_count) * 100
      : 0;

    const avgSalaryChange = first.average_salary > 0
      ? ((last.average_salary - first.average_salary) / first.average_salary) * 100
      : 0;

    return {
      periods: trendData,
      gross_change_percent: Math.round(grossChange * 100) / 100,
      headcount_change_percent: Math.round(headcountChange * 100) / 100,
      average_salary_change_percent: Math.round(avgSalaryChange * 100) / 100,
    };
  }

  // ============================================================================
  // PayRun Status
  // ============================================================================

  async getPayRunStatusCounts(query: DashboardQueryDto): Promise<PayRunStatusCountDto[]> {
    const where: any = {};

    if (query.legal_entity_id) {
      where.payGroup = { legalEntityId: query.legal_entity_id };
    }
    if (query.pay_group_id) {
      where.payGroupId = query.pay_group_id;
    }

    const payruns = await this.prisma.payRun.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    return payruns.map((p: { status: string; _count: { status: number } }) => ({
      status: p.status,
      count: p._count.status,
    }));
  }

  // ============================================================================
  // Upcoming PayRuns
  // ============================================================================

  async getUpcomingPayruns(query: DashboardQueryDto): Promise<UpcomingPayrunsDto[]> {
    const where: any = {
      status: { in: ['DRAFT', 'SNAPSHOT', 'CALCULATED', 'IN_REVIEW'] },
      payDate: { gte: new Date() },
    };

    if (query.legal_entity_id) {
      where.payGroup = { legalEntityId: query.legal_entity_id };
    }
    if (query.pay_group_id) {
      where.payGroupId = query.pay_group_id;
    }

    const payruns = await this.prisma.payRun.findMany({
      where,
      include: {
        payGroup: true,
        payRunEmployees: { where: { included: true } },
        employeeResults: true,
      },
      orderBy: { payDate: 'asc' },
      take: 5,
    });

    return payruns.map((pr: any) => {
      const estimatedTotal = pr.employeeResults.reduce(
        (sum: number, er: { gross: any }) => sum + Number(er.gross),
        0,
      );

      return {
        payrun_id: pr.id,
        pay_group_name: pr.payGroup.name,
        period_start: pr.periodStart ? format(pr.periodStart, 'yyyy-MM-dd') : '',
        period_end: pr.periodEnd ? format(pr.periodEnd, 'yyyy-MM-dd') : '',
        pay_date: pr.payDate ? format(pr.payDate, 'yyyy-MM-dd') : '',
        status: pr.status,
        employee_count: pr.payRunEmployees.length,
        estimated_total: Math.round(estimatedTotal * 100) / 100,
      };
    });
  }

  // ============================================================================
  // Pending Approvals
  // ============================================================================

  async getPendingApprovals(userId: string, scope?: DashboardScope): Promise<PendingApprovalsDto> {
    // Empty legalEntityAccess = no scope → return empty, NOT platform-wide
    if (!scope || scope.legalEntityIds.length === 0) {
      return { total_pending: 0, my_pending: 0, items: [] };
    }
    const instanceWhere: any = {
      isCancelled: false,
      workflow: {
        OR: [
          { legalEntityId: { in: scope.legalEntityIds } },
          { legalEntityId: null },
        ],
      },
    };
    const pendingSteps = await this.prisma.approvalStep.findMany({
      where: {
        status: 'PENDING',
        instance: instanceWhere,
      },
      include: {
        instance: {
          include: { submitter: { select: { firstName: true, lastName: true } } },
        },
        level: true,
      },
    });

    const myPending = pendingSteps.filter((s: any) => s.assignedTo === userId);

    const items = pendingSteps.slice(0, 10).map((step: any) => ({
      entity_type: step.instance.entityType,
      entity_id: step.instance.entityId,
      description: `${step.level.name} approval`,
      submitted_at: step.instance.submittedAt.toISOString(),
      level: step.levelOrder,
    }));

    return {
      total_pending: pendingSteps.length,
      my_pending: myPending.length,
      items,
    };
  }

  // ============================================================================
  // Operational Dashboard Widgets (permission-gated, scope-aware)
  // ============================================================================

  async getWorkforceSummary(scope: DashboardScope): Promise<WorkforceSummaryDto> {
    // Empty legalEntityAccess = no scope (bad data or no assignments) → return zeros, NOT platform-wide
    if (scope.legalEntityIds.length === 0) {
      return { employees: 0, employments: 0, org_units: 0, cost_centers: 0, legal_entities: 0, positions: 0 };
    }
    const leFilter = scope.legalEntityIds;

    const employeeWhere = leFilter
      ? {
          OR: [
            { legalEntityId: { in: leFilter } },
            { employments: { some: { legalEntityId: { in: leFilter } } } },
          ],
        }
      : {};
    const employmentWhere = leFilter
      ? { legalEntityId: { in: leFilter } }
      : {};
    const orgUnitWhere = leFilter
      ? { legalEntityId: { in: leFilter } }
      : {};
    const costCenterWhere = leFilter
      ? { legalEntityId: { in: leFilter } }
      : {};
    const positionWhere = leFilter
      ? { legalEntityId: { in: leFilter } }
      : {};
    const legalEntityWhere = leFilter
      ? { id: { in: leFilter } }
      : {};

    const [employees, employments, orgUnits, costCenters, legalEntities, positions] =
      await Promise.all([
        this.prisma.employee.count({ where: employeeWhere }),
        this.prisma.employment.count({ where: employmentWhere }),
        this.prisma.orgUnit.count({ where: orgUnitWhere }),
        this.prisma.costCenter.count({ where: costCenterWhere }),
        this.prisma.legalEntity.count({ where: legalEntityWhere }),
        this.prisma.position.count({ where: positionWhere }),
      ]);

    return {
      employees,
      employments,
      org_units: orgUnits,
      cost_centers: costCenters,
      legal_entities: legalEntities,
      positions,
    };
  }

  async getPayrollSnapshotSummary(scope: DashboardScope): Promise<PayrollSnapshotDto> {
    // Empty legalEntityAccess = no scope → return empty, NOT platform-wide
    if (scope.legalEntityIds.length === 0) {
      return {
        current_period: null,
        pending_approvals: 0,
        exceptions: 0,
        payment_batches: 0,
        next_pay_date: null,
        setup_required: true,
      };
    }
    const leFilter = scope.legalEntityIds;
    const payrunWhere: any = {};
    if (leFilter) {
      payrunWhere.payGroup = { legalEntityId: { in: leFilter } };
    }

    const [payruns, exceptionCount, approvalCount, payGroupCount] = await Promise.all([
      this.prisma.payRun.findMany({
        where: { ...payrunWhere, status: { notIn: ['CANCELLED'] } },
        include: { payGroup: true, period: true },
        orderBy: { periodStart: 'desc' },
        take: 10,
      }),
      this.prisma.payrollException.count({
        where: {
          status: { in: ['pending', 'in_review'] },
          payrun: payrunWhere,
        },
      }),
      this.prisma.approvalStep.count({
        where: {
          status: 'PENDING',
          instance: {
            isCancelled: false,
            ...(leFilter
              ? {
                  workflow: {
                    OR: [
                      { legalEntityId: { in: leFilter } },
                      { legalEntityId: null },
                    ],
                  },
                }
              : {}),
          },
        },
      }),
      this.prisma.payGroup.count(leFilter ? { where: { legalEntityId: { in: leFilter } } } : undefined),
    ]);

    // Current period = most recent non-finalized payrun
    const currentRun = payruns.find(
      (p: any) => !['PAID', 'POSTED', 'FINALIZED', 'CANCELLED'].includes(p.status),
    );
    const nextPayRun = payruns
      .filter((p: any) => p.payDate && new Date(p.payDate) >= new Date())
      .sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime())[0];

    const setupRequired = payGroupCount === 0;

    return {
      current_period: currentRun
        ? {
            label: currentRun.periodStart
              ? format(new Date(currentRun.periodStart), 'MMM yyyy')
              : 'Current',
            status: currentRun.status,
          }
        : null,
      pending_approvals: approvalCount,
      exceptions: exceptionCount,
      payment_batches: payGroupCount,
      next_pay_date: nextPayRun?.payDate
        ? format(new Date(nextPayRun.payDate), 'yyyy-MM-dd')
        : null,
      ...(setupRequired ? { setup_required: true } : {}),
    };
  }

  async getComplianceSummary(scope: DashboardScope): Promise<ComplianceSnapshotDto> {
    // Empty legalEntityAccess = no scope → return minimal/empty, NOT platform-wide
    if (scope.legalEntityIds.length === 0) {
      return {
        emp201: { status: 'NOT_CONFIGURED' },
        irp5: { status: 'NOT_CONFIGURED' },
        alerts: 0,
        tax_tables_configured: false,
      };
    }
    const leFilter = scope.legalEntityIds;

    const taxTableCount = await this.prisma.taxTableSet.count({
      where: { status: 'ACTIVE', country: 'ZA' },
    });

    const emp201Where = leFilter
      ? { legalEntityId: { in: leFilter }, status: { in: ['draft', 'pending'] } }
      : { status: { in: ['draft', 'pending'] } };
    const emp201Count = await this.prisma.eMP201Return.count({ where: emp201Where });
    const irp5Count = leFilter
      ? await this.prisma.iRP5Certificate.count({
          where: { legalEntityId: { in: leFilter } },
        })
      : await this.prisma.iRP5Certificate.count();

    const emp201Due = leFilter
      ? await this.prisma.eMP201Return.findFirst({
          where: emp201Where,
          orderBy: [{ taxYear: 'asc' }, { monthNumber: 'asc' }],
          select: { taxYear: true, monthNumber: true, submissionDueDate: true },
        })
      : await this.prisma.eMP201Return.findFirst({
          where: emp201Where,
          orderBy: [{ taxYear: 'asc' }, { monthNumber: 'asc' }],
          select: { taxYear: true, monthNumber: true, submissionDueDate: true },
        });

    const dueDateStr = emp201Due?.submissionDueDate
      ? format(emp201Due.submissionDueDate, 'yyyy-MM-dd')
      : emp201Due
        ? `${emp201Due.taxYear}-${String(emp201Due.monthNumber).padStart(2, '0')}-07`
        : undefined;

    return {
      emp201:
        emp201Count > 0
          ? {
              status: emp201Due ? 'DUE_SOON' : 'READY',
              due_date: dueDateStr,
            }
          : { status: 'NOT_CONFIGURED' },
      irp5: irp5Count > 0 ? { status: 'OUT_OF_SEASON' } : { status: 'NOT_CONFIGURED' },
      alerts: 0,
      tax_tables_configured: taxTableCount > 0,
    };
  }

  async getDataImportsSummary(): Promise<DataImportsSummaryDto> {
    const [latestJob, rejectedRows, pendingJobs] = await Promise.all([
      this.prisma.dataImportJob.findFirst({
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          status: true,
          uploadedAt: true,
        },
      }),
      this.prisma.dataImportRow.count({ where: { status: 'INVALID' } }),
      this.prisma.dataImportJob.count({
        where: {
          status: {
            in: ['UPLOADED', 'PARSED', 'VALIDATED', 'HAS_ERRORS', 'APPROVED'],
          },
        },
      }),
    ]);

    const mapStatus = (s: string) => {
      const m: Record<string, string> = {
        UPLOADED: 'PENDING',
        PARSED: 'VALIDATING',
        VALIDATED: 'VALIDATING',
        HAS_ERRORS: 'VALIDATING',
        APPROVED: 'APPROVED',
        PUBLISHED: 'COMPLETED',
        FAILED: 'FAILED',
      };
      return m[s] || s;
    };

    return {
      latest_job: latestJob
        ? {
            id: latestJob.id,
            name: latestJob.fileName,
            status: mapStatus(latestJob.status),
            submitted_at: latestJob.uploadedAt.toISOString(),
          }
        : null,
      rejected_rows: rejectedRows,
      pending_jobs: pendingJobs,
    };
  }

  async getHrExportReadiness(scope: DashboardScope): Promise<HrExportReadinessDto> {
    // Empty legalEntityAccess = no scope → return NOT_READY, NOT platform-wide
    if (scope.legalEntityIds.length === 0) {
      return {
        status: 'NOT_READY',
        exportable_employees: 0,
        warnings: 0,
        issues: [{ code: 'NO_LEGAL_ENTITY_ACCESS', count: 0 }],
      };
    }
    const leFilter = scope.legalEntityIds;

    const employmentWhere = { legalEntityId: { in: leFilter } };
    const employeeIds = await this.prisma.employment
      .findMany({ where: employmentWhere, select: { employeeId: true }, distinct: ['employeeId'] })
      .then((r) => r.map((x) => x.employeeId));

    const employeeCount = new Set(employeeIds).size;
    const employmentCount = await this.prisma.employment.count({ where: employmentWhere });

    // Simplified readiness: has employments = exportable
    const hasEmployees = await this.prisma.employee.count() > 0;
    const hasEmployments = employmentCount > 0;
    const hasLegalEntities = (await this.prisma.legalEntity.count()) > 0;

    let status: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY' = 'NOT_READY';
    let warnings = 0;
    const issues: { code: string; count: number }[] = [];

    if (!hasLegalEntities || !hasEmployees || !hasEmployments) {
      if (!hasLegalEntities) issues.push({ code: 'NO_LEGAL_ENTITIES', count: 0 });
      if (!hasEmployees) issues.push({ code: 'NO_EMPLOYEES', count: 0 });
      if (!hasEmployments) issues.push({ code: 'NO_EMPLOYMENTS', count: 0 });
      status = 'NOT_READY';
    } else {
      const missingManager =
        employeeIds.length > 0
          ? await this.prisma.employee.count({
              where: { managerId: null, id: { in: employeeIds } },
            })
          : 0;
      if (missingManager > 0) {
        warnings += missingManager;
        issues.push({ code: 'MISSING_MANAGER', count: missingManager });
      }
      status = warnings > 0 ? 'READY_WITH_WARNINGS' : 'READY';
    }

    // Manager hierarchy metrics for IGA readiness
    const hierarchyReport = employeeIds.length > 0
      ? await this.hierarchyIntegrity.getReport(employeeIds)
      : null;

    if (hierarchyReport?.cycles_detected && hierarchyReport.cycles_detected > 0) {
      status = 'NOT_READY';
      issues.push({
        code: 'HIERARCHY_CYCLES',
        count: hierarchyReport.cycles_detected,
      });
    }

    return {
      status,
      exportable_employees: employeeCount,
      warnings,
      issues: issues.length > 0 ? issues : undefined,
      manager_hierarchy: hierarchyReport
        ? {
            employees_total: hierarchyReport.employees_total,
            manager_assigned: hierarchyReport.manager_assigned,
            missing_manager: hierarchyReport.missing_manager,
            cycles_detected: hierarchyReport.cycles_detected,
            status: hierarchyReport.status,
          }
        : undefined,
    };
  }

  // ============================================================================
  // Aggregated Dashboard Summary (GET /dashboard/summary)
  // ============================================================================

  private toScope(user: CurrentUserData): DashboardScope {
    const ids = user?.legalEntityAccess ?? [];
    return { legalEntityIds: Array.isArray(ids) ? ids : [] };
  }

  private scopeMode(user: CurrentUserData): 'GLOBAL' | 'LEGAL_ENTITY' | 'EMPTY' {
    const ids = user?.legalEntityAccess ?? [];
    const count = Array.isArray(ids) ? ids.length : 0;
    if (count === 0) return 'EMPTY';
    return user?.hasGlobalScope ? 'GLOBAL' : 'LEGAL_ENTITY';
  }

  private hasAny(user: CurrentUserData, perms: string[]): boolean {
    const userPerms = user?.permissions ?? [];
    return perms.some((p) => userPerms.includes(p));
  }

  private canSeeSetupProgress(user: CurrentUserData): boolean {
    return this.hasAny(user, ['iam:legal_entities:manage', 'legal_entity:read', 'employee:read', 'hr:read']);
  }
  private canSeeWorkforceSnapshot(user: CurrentUserData): boolean {
    return this.hasAny(user, ['employee:read', 'employment:read']);
  }
  private canSeePayrollSnapshot(user: CurrentUserData): boolean {
    return this.hasAny(user, ['payrun:read']);
  }
  private canSeeComplianceSnapshot(user: CurrentUserData): boolean {
    return this.hasAny(user, ['sars:irp5:read', 'sars:emp201:read', 'sars:emp501:read']);
  }
  private canSeePendingApprovals(user: CurrentUserData): boolean {
    return this.hasAny(user, ['iam:users:manage', 'approval:approve', 'payrun:approve']);
  }
  private canSeeDataImports(user: CurrentUserData): boolean {
    return this.hasAny(user, ['data_import:read', 'data_import:write', 'data_import:approve', 'data_import:publish']);
  }
  private canSeeHrExport(user: CurrentUserData): boolean {
    return this.hasAny(user, ['hr:read', 'iam:legal_entities:manage']);
  }

  private async buildVisibleWidget<T>(
    visible: boolean,
    loader: () => Promise<T>,
  ): Promise<{ visible: false } | { visible: true; data: T }> {
    if (!visible) return { visible: false };
    return { visible: true, data: await loader() };
  }

  private async buildSetupProgress(): Promise<any> {
    const status = await this.setupService.getStatus();
    const items = status.items.map((i) => ({
      key: i.key,
      label: i.label,
      count: i.count,
      status: i.ready ? 'READY' as const : (i.count > 0 ? 'IN_PROGRESS' as const : 'NOT_STARTED' as const),
      href: i.href,
    }));
    const completed = status.items.filter((i) => i.ready).length;
    return {
      summary: { completed, total: status.items.length, is_complete: status.complete },
      items,
    };
  }

  private async buildWorkforceSnapshot(user: CurrentUserData): Promise<WorkforceSummaryDto> {
    return this.getWorkforceSummary(this.toScope(user));
  }

  private async buildPayrollSnapshot(user: CurrentUserData): Promise<PayrollSnapshotDto> {
    return this.getPayrollSnapshotSummary(this.toScope(user));
  }

  private async buildComplianceSnapshot(user: CurrentUserData): Promise<ComplianceSnapshotDto> {
    return this.getComplianceSummary(this.toScope(user));
  }

  private async buildPendingApprovals(user: CurrentUserData): Promise<any> {
    const dto = await this.getPendingApprovals(user.sub, this.toScope(user));
    return {
      count: dto.total_pending,
      my_pending: dto.my_pending,
      items: dto.items.map((i) => ({
        id: i.entity_id,
        type: i.entity_type,
        title: i.description,
        href: '/enterprise/approvals/pending',
      })),
    };
  }

  private async buildDataImportsSummary(): Promise<DataImportsSummaryDto> {
    return this.getDataImportsSummary();
  }

  private async buildHrExportReadiness(user: CurrentUserData): Promise<HrExportReadinessDto> {
    return this.getHrExportReadiness(this.toScope(user));
  }

  async getDashboardSummary(user: CurrentUserData): Promise<{
    widgets: Record<string, { visible: false } | { visible: true; data: any }>;
    meta: { generated_at: string; scope_mode: string; legal_entity_count: number };
  }> {
    const scope = this.toScope(user);
    const mode = this.scopeMode(user);
    const leCount = scope.legalEntityIds.length;

    const widgets = {
      setup_progress: await this.buildVisibleWidget(
        this.canSeeSetupProgress(user),
        () => this.buildSetupProgress(),
      ),
      workforce_snapshot: await this.buildVisibleWidget(
        this.canSeeWorkforceSnapshot(user),
        () => this.buildWorkforceSnapshot(user),
      ),
      payroll_snapshot: await this.buildVisibleWidget(
        this.canSeePayrollSnapshot(user),
        () => this.buildPayrollSnapshot(user),
      ),
      compliance_snapshot: await this.buildVisibleWidget(
        this.canSeeComplianceSnapshot(user),
        () => this.buildComplianceSnapshot(user),
      ),
      pending_approvals: await this.buildVisibleWidget(
        this.canSeePendingApprovals(user),
        () => this.buildPendingApprovals(user),
      ),
      data_imports: await this.buildVisibleWidget(
        this.canSeeDataImports(user),
        () => this.buildDataImportsSummary(),
      ),
      hr_export_readiness: await this.buildVisibleWidget(
        this.canSeeHrExport(user),
        () => this.buildHrExportReadiness(user),
      ),
    };

    const visibleWidgets = Object.entries(widgets)
      .filter(([, w]) => (w as any).visible === true)
      .map(([k]) => k);
    this.logger.log(
      `dashboard.summary userId=${user?.sub} scope=${mode} leCount=${leCount} visibleWidgets=${visibleWidgets.join(',')}`,
    );

    return {
      widgets,
      meta: {
        generated_at: new Date().toISOString(),
        scope_mode: mode,
        legal_entity_count: leCount,
      },
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private resolveDateRange(query: DashboardQueryDto): {
    fromDate: Date;
    toDate: Date;
    periodLabel: string;
  } {
    if (query.from_date && query.to_date) {
      return {
        fromDate: new Date(query.from_date),
        toDate: new Date(query.to_date),
        periodLabel: `${query.from_date} to ${query.to_date}`,
      };
    }

    // Default to current month
    const now = new Date();
    return {
      fromDate: startOfMonth(now),
      toDate: endOfMonth(now),
      periodLabel: format(now, 'MMMM yyyy'),
    };
  }

  private buildPayrunFilter(query: DashboardQueryDto, fromDate: Date, toDate: Date): any {
    const filter: any = {
      periodStart: { gte: fromDate },
      periodEnd: { lte: toDate },
    };

    if (query.legal_entity_id) {
      filter.payGroup = { legalEntityId: query.legal_entity_id };
    }
    if (query.pay_group_id) {
      filter.payGroupId = query.pay_group_id;
    }

    return filter;
  }
}
