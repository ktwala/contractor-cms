import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) { }

  async getDashboardOverview(filters?: { country?: string; legal_entity_id?: string }) {
    const where: any = {};
    if (filters?.country) where.country = filters.country;
    if (filters?.legal_entity_id) where.legalEntityId = filters.legal_entity_id;

    const [employees, payrollData, leaveData, expenseData, loanData, performanceData] = await Promise.all([
      this.getEmployeeMetrics(where),
      this.getPayrollMetrics(filters?.country),
      this.getLeaveMetrics(filters?.country),
      this.getExpenseMetrics(),
      this.getLoanMetrics(filters?.country),
      this.getPerformanceMetrics(),
    ]);

    return {
      employees,
      payroll: payrollData,
      leave: leaveData,
      expenses: expenseData,
      loans: loanData,
      performance: performanceData,
      generated_at: new Date().toISOString(),
    };
  }

  private async getEmployeeMetrics(where: any) {
    const employees = await (this.prisma as any).employee.groupBy({
      by: ['status'],
      _count: { id: true },
      where,
    });

    return {
      total_employees: employees.reduce((sum: number, e: any) => sum + e._count.id, 0),
      active_employees: employees.find((e: any) => e.status === 'ACTIVE')?._count?.id || 0,
      inactive_employees: employees.find((e: any) => e.status === 'INACTIVE')?._count?.id || 0,
      terminated_employees: employees.find((e: any) => e.status === 'TERMINATED')?._count?.id || 0,
    };
  }

  private async getPayrollMetrics(country?: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await (this.prisma as any).paySlip.aggregate({
      _sum: { grossPay: true, netPay: true, totalDeductions: true },
      _count: true,
      where: {
        payRun: { payDate: { gte: threeMonthsAgo }, status: 'APPROVED', ...(country && { country }) },
      },
    });

    return {
      total_payruns: result._count || 0,
      total_gross_pay: Number(result._sum?.grossPay || 0),
      total_net_pay: Number(result._sum?.netPay || 0),
      total_deductions: Number(result._sum?.totalDeductions || 0),
    };
  }

  private async getLeaveMetrics(country?: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const requests = await (this.prisma as any).leaveRequest.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { daysRequested: true },
      where: { requestDate: { gte: threeMonthsAgo }, ...(country && { country }) },
    });

    return {
      total_leave_requests: requests.reduce((sum: number, r: any) => sum + r._count.id, 0),
      approved_days: requests.find((r: any) => r.status === 'approved')?._sum?.daysRequested || 0,
      pending_requests: requests.find((r: any) => r.status === 'pending')?._count?.id || 0,
    };
  }

  private async getExpenseMetrics() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const claims = await (this.prisma as any).expenseClaim.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { totalAmount: true },
      where: { claimDate: { gte: threeMonthsAgo } },
    });

    return {
      total_claims: claims.reduce((sum: number, c: any) => sum + c._count.id, 0),
      approved_amount: Number(claims.find((c: any) => c.status === 'approved')?._sum?.totalAmount || 0),
      pending_amount: Number(claims.find((c: any) => c.status === 'pending')?._sum?.totalAmount || 0),
      pending_claims: claims.find((c: any) => c.status === 'pending')?._count?.id || 0,
    };
  }

  private async getLoanMetrics(country?: string) {
    const result = await (this.prisma as any).loanApplication.aggregate({
      _sum: { principalAmount: true, outstandingBalance: true, monthlyDeduction: true },
      _count: true,
      where: { status: 'active', ...(country && { country }) },
    });

    return {
      total_active_loans: result._count || 0,
      total_principal: Number(result._sum?.principalAmount || 0),
      total_outstanding: Number(result._sum?.outstandingBalance || 0),
      total_monthly_deductions: Number(result._sum?.monthlyDeduction || 0),
    };
  }

  private async getPerformanceMetrics() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await (this.prisma as any).performanceReview.aggregate({
      _count: true,
      _avg: { overallRating: true },
      where: { createdAt: { gte: oneYearAgo } },
    });

    const completed = await (this.prisma as any).performanceReview.count({
      where: { createdAt: { gte: oneYearAgo }, status: 'completed' },
    });

    return {
      total_reviews: result._count || 0,
      average_rating: result._avg?.overallRating || 0,
      completed_reviews: completed,
    };
  }

  async getPayrollTrends(filters: { country?: string; period: 'monthly' | 'quarterly' | 'yearly'; limit?: number }) {
    const payslips = await (this.prisma as any).paySlip.findMany({
      include: { payRun: { select: { payDate: true, status: true, country: true } } },
      where: { payRun: { status: 'APPROVED', ...(filters.country && { country: filters.country }) } },
      orderBy: { payRun: { payDate: 'desc' } },
      take: filters.limit || 1000,
    });

    const grouped = new Map<string, any>();
    for (const ps of payslips) {
      const date = new Date(ps.payRun.payDate);
      const key = filters.period === 'monthly' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : `${date.getFullYear()}`;

      if (!grouped.has(key)) grouped.set(key, { period: key, total_gross: 0, total_net: 0, employee_count: 0 });
      const entry = grouped.get(key);
      entry.total_gross += Number(ps.grossPay || 0);
      entry.total_net += Number(ps.netPay || 0);
      entry.employee_count += 1;
    }

    return Array.from(grouped.values()).slice(0, filters.limit || 12).reverse();
  }

  async getDepartmentAnalysis(filters?: { country?: string; legal_entity_id?: string }) {
    const where: any = {};
    if (filters?.country) where.country = filters.country;
    if (filters?.legal_entity_id) where.legalEntityId = filters.legal_entity_id;

    const employees = await (this.prisma as any).employee.groupBy({
      by: ['department'],
      _count: { id: true },
      _avg: { salary: true },
      where,
    });

    return employees.map((e: any) => ({
      department: e.department,
      employee_count: e._count.id,
      avg_salary: Number(e._avg?.salary || 0),
    }));
  }

  async getTurnoverAnalysis(filters: { country?: string; period_months?: number }) {
    const periodMonths = filters.period_months || 12;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);

    const where: any = filters.country ? { country: filters.country } : {};

    const [terminated, hired, active] = await Promise.all([
      (this.prisma as any).employee.count({ where: { ...where, status: 'TERMINATED', endDate: { gte: cutoffDate } } }),
      (this.prisma as any).employee.count({ where: { ...where, hireDate: { gte: cutoffDate } } }),
      (this.prisma as any).employee.count({ where: { ...where, status: 'ACTIVE' } }),
    ]);

    const turnoverRate = active > 0 ? (terminated / active * 100).toFixed(2) : 0;

    return {
      terminated_count: terminated,
      hired_count: hired,
      current_active: active,
      turnover_rate: parseFloat(turnoverRate as string),
      period_months: periodMonths,
    };
  }

  async getTaxSummary(filters: { country?: string; date_from?: string; date_to?: string }) {
    const where: any = {};
    if (filters.country) where.country = filters.country;

    // Simplified tax summary using aggregation
    const result = await (this.prisma as any).paySlip.aggregate({
      _sum: { taxAmount: true },
      _count: true,
      where: {
        payRun: {
          status: 'APPROVED',
          ...(filters.date_from && { payDate: { gte: new Date(filters.date_from) } }),
          ...(filters.date_to && { payDate: { lte: new Date(filters.date_to) } }),
          ...(filters.country && { country: filters.country }),
        },
      },
    });

    return [{ tax_type: 'PAYE', tax_name: 'Pay As You Earn', payrun_count: result._count || 0, total_employee_tax: Number(result._sum?.taxAmount || 0), total_tax: Number(result._sum?.taxAmount || 0) }];
  }

  async getExpenseAnalytics(filters?: { country?: string; date_from?: string; date_to?: string }) {
    const where: any = {};
    if (filters?.date_from) where.claimDate = { gte: new Date(filters.date_from) };
    if (filters?.date_to) where.claimDate = { ...(where.claimDate || {}), lte: new Date(filters.date_to) };

    const claims = await (this.prisma as any).expenseClaim.groupBy({
      by: ['category'],
      _count: { id: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
      where,
    });

    return claims.map((c: any) => ({
      category: c.category,
      claim_count: c._count.id,
      total_amount: Number(c._sum?.totalAmount || 0),
      avg_amount: Number(c._avg?.totalAmount || 0),
    }));
  }

  async getLoanPortfolio(filters?: { country?: string }) {
    const result = await (this.prisma as any).loanApplication.groupBy({
      by: ['loanTypeId'],
      _count: { id: true },
      _sum: { principalAmount: true, outstandingBalance: true },
      _avg: { interestRate: true },
      where: { status: 'active', ...(filters?.country && { country: filters.country }) },
    });

    return result.map((r: any) => ({
      loan_type: r.loanTypeId,
      active_loans: r._count.id,
      total_principal: Number(r._sum?.principalAmount || 0),
      total_outstanding: Number(r._sum?.outstandingBalance || 0),
      avg_interest_rate: Number(r._avg?.interestRate || 0),
    }));
  }

  async getPerformanceStats(filters?: { country?: string; cycle_id?: string }) {
    const where: any = {};
    if (filters?.cycle_id) where.cycleId = filters.cycle_id;

    const [total, completed, inProgress] = await Promise.all([
      (this.prisma as any).performanceReview.count({ where }),
      (this.prisma as any).performanceReview.count({ where: { ...where, status: 'completed' } }),
      (this.prisma as any).performanceReview.count({ where: { ...where, status: 'in_progress' } }),
    ]);

    const avgRatings = await (this.prisma as any).performanceReview.aggregate({
      where: { ...where, overallRating: { not: null } },
      _avg: { overallRating: true, goalsRating: true, competenciesRating: true },
    });

    const promotions = await (this.prisma as any).performanceReview.count({ where: { ...where, recommendedForPromotion: true } });

    return {
      summary: {
        total_reviews: total,
        completed_reviews: completed,
        in_progress_reviews: inProgress,
        avg_overall_rating: avgRatings._avg?.overallRating || 0,
        avg_goals_rating: avgRatings._avg?.goalsRating || 0,
        avg_competencies_rating: avgRatings._avg?.competenciesRating || 0,
        promotion_recommendations: promotions,
      },
      category_distribution: [],
    };
  }

  async createSavedReport(data: any) {
    return (this.prisma as any).savedReport.create({
      data: {
        reportName: data.report_name,
        reportType: data.report_type,
        description: data.description,
        filters: data.filters || {},
        columns: data.columns || [],
        grouping: data.grouping || [],
        sorting: data.sorting || [],
        isScheduled: data.is_scheduled || false,
        scheduleFrequency: data.schedule_frequency,
        outputFormat: data.output_format || 'csv',
        emailRecipients: data.email_recipients || [],
        visibility: data.visibility || 'private',
        createdBy: data.created_by,
        country: data.country,
        isActive: true,
      },
    });
  }

  async getSavedReports(filters?: { created_by?: string; report_type?: string }) {
    return (this.prisma as any).savedReport.findMany({
      where: {
        isActive: true,
        ...(filters?.created_by && { createdBy: filters.created_by }),
        ...(filters?.report_type && { reportType: filters.report_type }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordReportExecution(data: any) {
    return (this.prisma as any).reportExecution.create({
      data: {
        savedReportId: data.saved_report_id,
        reportName: data.report_name,
        executionType: data.execution_type,
        executedBy: data.executed_by,
        status: data.status,
        recordCount: data.record_count,
        executionTimeMs: data.execution_time_ms,
        errorMessage: data.error_message,
      },
    });
  }

  async getKPIs(filters?: { kpi_type?: string; country?: string }) {
    return (this.prisma as any).analyticsKpi.findMany({
      where: {
        isActive: true,
        ...(filters?.kpi_type && { kpiType: filters.kpi_type }),
        ...(filters?.country && { OR: [{ country: filters.country }, { country: null }] }),
      },
      orderBy: [{ kpiType: 'asc' }, { kpiName: 'asc' }],
    });
  }

  async updateKPI(id: string, value: number) {
    const kpi = await (this.prisma as any).analyticsKpi.findUnique({ where: { id } });
    await (this.prisma as any).analyticsKpi.update({
      where: { id },
      data: { previousValue: kpi?.currentValue, currentValue: value, lastCalculatedAt: new Date() },
    });
  }
}
