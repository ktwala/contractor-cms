import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PayRunStatus } from '@prisma/client';

@Injectable()
export class RunCenterService {
  private readonly logger = new Logger(RunCenterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const activeStatuses: PayRunStatus[] = [PayRunStatus.DRAFT, PayRunStatus.SNAPSHOT, PayRunStatus.CALCULATING, PayRunStatus.CALCULATED, PayRunStatus.IN_REVIEW, PayRunStatus.APPROVED, PayRunStatus.PAID, PayRunStatus.POSTED];

    const [
      activePayruns,
      blockedPayruns,
      paymentsPending,
      reconciliationIssues,
      compliancePending,
      checklistTasksOpen,
    ] = await Promise.all([
      this.prisma.payRun.count({
        where: { status: { in: activeStatuses } },
      }),
      this.countBlockedPayruns(),
      this.prisma.paymentBatch.count({
        where: { status: { notIn: ['CONFIRMED_PAID', 'PROCESSED', 'CANCELLED'] } },
      }),
      this.countReconciliationIssues(),
      this.prisma.payrollComplianceReport.count({
        where: { submissionStatus: { notIn: ['SUBMITTED', 'ACCEPTED'] } },
      }),
      this.prisma.payrollChecklistTask.count({
        where: { status: { notIn: ['completed', 'skipped'] } },
      }),
    ]);

    return {
      activePayruns,
      blockedPayruns,
      paymentsPending,
      reconciliationIssues,
      compliancePending,
      checklistTasksOpen,
    };
  }

  private async countBlockedPayruns(): Promise<number> {
    const blocked = await this.prisma.payrunException.findMany({
      where: {
        status: { in: ['OPEN', 'ASSIGNED'] },
        OR: [{ blocksSubmission: true }, { blocksPayment: true }],
      },
      select: { payrunId: true },
      distinct: ['payrunId'],
    });
    return blocked.length;
  }

  private async countReconciliationIssues(): Promise<number> {
    const payruns = await this.prisma.payRun.findMany({
      where: { status: { in: ['CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED'] } },
      include: {
        employeeResults: { select: { net: true } },
        paymentBatches: { select: { totalAmount: true, paymentCount: true, status: true }, take: 1 },
        payrunExceptions: {
          where: { status: { in: ['OPEN', 'ASSIGNED'] }, OR: [{ blocksPayment: true }, { blocksSubmission: true }] },
          select: { id: true },
        },
      },
    });

    let issues = 0;
    for (const pr of payruns) {
      const batch = pr.paymentBatches[0];
      if (!batch) continue;
      const payrunNet = pr.employeeResults.reduce((s: number, r: any) => s + Number(r.net), 0);
      const batchTotal = Number(batch.totalAmount);
      const hasBlockers = pr.payrunExceptions.length > 0;
      const netMismatch = Math.abs(payrunNet - batchTotal) > 0.01;
      const countMismatch = batch.paymentCount !== pr.employeeResults.length;
      if (hasBlockers || netMismatch || countMismatch) issues++;
    }
    return issues;
  }

  async getCurrentPeriods() {
    const payGroups = await this.prisma.payGroup.findMany({
      include: {
        legalEntity: { select: { name: true } },
        payPeriods: {
          orderBy: [{ year: 'desc' }, { periodNum: 'desc' }],
          take: 1,
          include: {
            payRuns: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, status: true } },
            checklists: {
              take: 1,
              select: { completionPercentage: true, totalTasks: true, completedTasks: true },
            },
          },
        },
      },
    });

    const periods = [];
    for (const pg of payGroups) {
      const period = pg.payPeriods[0];
      if (!period) continue;

      const payrun = period.payRuns[0];
      const checklist = period.checklists[0];

      let paymentStatus = 'No Batch';
      let reconciliationStatus = 'Not Run';
      let complianceStatus = 'Pending';

      if (payrun) {
        const batch = await this.prisma.paymentBatch.findFirst({
          where: { payrunId: payrun.id },
          select: { status: true },
        });
        if (batch) paymentStatus = batch.status;

        const compReport = await this.prisma.payrollComplianceReport.findFirst({
          where: { payrunId: payrun.id },
          select: { status: true, submissionStatus: true },
        });
        if (compReport) {
          complianceStatus = compReport.submissionStatus === 'SUBMITTED' || compReport.submissionStatus === 'ACCEPTED'
            ? 'Submitted' : compReport.status === 'GENERATED' ? 'Ready' : 'Pending';
        }
      }

      periods.push({
        calendarId: pg.id,
        calendarName: pg.name,
        country: pg.country,
        legalEntity: pg.legalEntity?.name ?? null,
        periodId: period.id,
        periodName: `${period.year} P${period.periodNum}`,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        payDate: period.payDate,
        payrunId: payrun?.id ?? null,
        payrunStatus: payrun?.status ?? null,
        checklistPct: checklist ? Number(checklist.completionPercentage) : null,
        checklistOpen: checklist ? (checklist.totalTasks - checklist.completedTasks) : null,
        paymentStatus,
        reconciliationStatus,
        complianceStatus,
      });
    }

    return { items: periods };
  }

  async getCriticalAlerts() {
    const alerts: any[] = [];

    // Critical exceptions
    const criticalExceptions = await this.prisma.payrunException.findMany({
      where: { severity: 'CRITICAL', status: { in: ['OPEN', 'ASSIGNED'] } },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        payrun: {
          select: {
            id: true, status: true,
            payGroup: { select: { name: true } },
          },
        },
      },
      take: 10,
      orderBy: { detectedAt: 'desc' },
    });

    for (const exc of criticalExceptions) {
      alerts.push({
        type: 'CRITICAL_EXCEPTION',
        severity: 'critical',
        title: exc.title,
        description: exc.description,
        payrunId: exc.payrunId,
        payrunName: exc.payrun?.payGroup?.name ?? null,
        employeeName: exc.employee ? `${exc.employee.firstName} ${exc.employee.lastName}` : null,
        detectedAt: exc.detectedAt,
        link: `/payroll/payruns/${exc.payrunId}?tab=exceptions`,
      });
    }

    // Failed payment batches
    const failedBatches = await this.prisma.paymentBatch.findMany({
      where: { status: 'FAILED' },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    for (const batch of failedBatches) {
      alerts.push({
        type: 'PAYMENT_BATCH_FAILED',
        severity: 'critical',
        title: 'Payment batch failed',
        description: `Batch ${batch.reference} failed processing`,
        payrunId: batch.payrunId,
        link: batch.id ? `/payroll/payment-batches/${batch.id}` : null,
        detectedAt: batch.updatedAt,
      });
    }

    // Compliance submission failures
    const failedCompliance = await this.prisma.payrollComplianceReport.findMany({
      where: { status: 'FAILED' },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    for (const rep of failedCompliance) {
      alerts.push({
        type: 'COMPLIANCE_SUBMISSION_FAILED',
        severity: 'critical',
        title: `${rep.reportType} submission failed`,
        description: `${rep.reportType} for ${rep.periodName ?? 'unknown period'} failed`,
        link: `/payroll/compliance`,
        detectedAt: rep.updatedAt,
      });
    }

    // Overdue checklist tasks
    const overdueTasks = await this.prisma.payrollChecklistTask.findMany({
      where: {
        status: { notIn: ['completed', 'skipped'] },
        dueDate: { lt: new Date() },
      },
      include: {
        checklist: { select: { checklistName: true } },
      },
      take: 5,
      orderBy: { dueDate: 'asc' },
    });

    for (const task of overdueTasks) {
      alerts.push({
        type: 'CHECKLIST_OVERDUE',
        severity: 'warning',
        title: `Overdue task: ${task.taskName}`,
        description: `Due ${task.dueDate?.toLocaleDateString() ?? 'unknown'}`,
        link: '/payroll/checklist',
        detectedAt: task.dueDate,
      });
    }

    alerts.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
    });

    return { items: alerts.slice(0, 20), total: alerts.length };
  }

  async getActivePayruns() {
    const payruns = await this.prisma.payRun.findMany({
      where: { status: { notIn: ['FINALIZED', 'CANCELLED'] } },
      include: {
        payGroup: { select: { name: true, code: true, country: true, legalEntity: { select: { name: true } } } },
        payrunExceptions: {
          where: { status: { in: ['OPEN', 'ASSIGNED'] } },
          select: { severity: true, blocksSubmission: true, blocksPayment: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const enriched = await Promise.all(payruns.map(async (pr) => {
      const batch = await this.prisma.paymentBatch.findFirst({
        where: { payrunId: pr.id },
        select: { id: true, status: true },
      });

      const compReport = await this.prisma.payrollComplianceReport.findFirst({
        where: { payrunId: pr.id },
        select: { status: true, submissionStatus: true, reportType: true },
      });

      const excs = pr.payrunExceptions;
      const criticalCount = excs.filter(e => e.severity === 'CRITICAL').length;
      const blockersCount = excs.filter(e => e.blocksSubmission || e.blocksPayment).length;

      return {
        id: pr.id,
        payGroupName: pr.payGroup?.name ?? null,
        payGroupCode: pr.payGroup?.code ?? null,
        country: pr.payGroup?.country ?? null,
        legalEntity: pr.payGroup?.legalEntity?.name ?? null,
        periodStart: pr.periodStart,
        periodEnd: pr.periodEnd,
        status: pr.status,
        exceptionCount: excs.length,
        criticalExceptions: criticalCount,
        blockers: blockersCount,
        paymentBatchId: batch?.id ?? null,
        paymentStatus: batch?.status ?? 'No Batch',
        reconciliationStatus: 'Not Run',
        complianceStatus: compReport
          ? (compReport.submissionStatus === 'SUBMITTED' ? 'Submitted' : compReport.status)
          : 'None',
        updatedAt: pr.updatedAt,
      };
    }));

    return { items: enriched };
  }

  async getPendingPayments() {
    const batches = await this.prisma.paymentBatch.findMany({
      where: { status: { notIn: ['CONFIRMED_PAID', 'PROCESSED', 'CANCELLED'] } },
      include: {
        payrun: {
          select: {
            payGroup: { select: { name: true } },
            periodStart: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return {
      items: batches.map((b) => ({
        id: b.id,
        reference: b.reference,
        payrunId: b.payrunId,
        payrunName: b.payrun
          ? `${b.payrun.payGroup?.name ?? ''} ${b.payrun.periodStart ? new Date(b.payrun.periodStart).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : ''}`.trim()
          : null,
        employeeCount: b.paymentCount,
        totalAmount: Number(b.totalAmount),
        status: b.status,
        exportStatus: b.exportStatus ?? (b.exportGeneratedAt ? 'GENERATED' : 'NOT_GENERATED'),
        confirmedPaid: b.confirmedPaidAt != null,
        createdAt: b.createdAt,
      })),
    };
  }

  async getReconciliationStatus() {
    const payruns = await this.prisma.payRun.findMany({
      where: { status: { in: ['CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'] } },
      include: {
        payGroup: { select: { name: true } },
        employeeResults: { select: { net: true } },
        payrunExceptions: {
          where: { status: { in: ['OPEN', 'ASSIGNED'] } },
          select: { blocksPayment: true, blocksSubmission: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const items = await Promise.all(payruns.map(async (pr) => {
      const batch = await this.prisma.paymentBatch.findFirst({
        where: { payrunId: pr.id },
        select: { totalAmount: true, paymentCount: true, status: true },
      });

      const payrunNet = pr.employeeResults.reduce((s, r) => s + Number(r.net), 0);
      const batchTotal = batch ? Number(batch.totalAmount) : null;
      const netMatch = batchTotal != null ? Math.abs(payrunNet - batchTotal) < 0.01 : null;
      const countMatch = batch ? batch.paymentCount === pr.employeeResults.length : null;
      const hasBlockers = pr.payrunExceptions.some(e => e.blocksPayment || e.blocksSubmission);

      let overallResult = 'NOT_RUN';
      if (batch) {
        if (hasBlockers) overallResult = 'FAIL';
        else if (netMatch === false || countMatch === false) overallResult = 'WARNING';
        else overallResult = 'PASS';
      }

      return {
        payrunId: pr.id,
        payrunName: `${pr.payGroup?.name ?? ''} ${pr.periodStart ? new Date(pr.periodStart).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : ''}`.trim(),
        status: pr.status,
        overallResult,
        failedChecks: overallResult === 'FAIL' ? 1 : 0,
        warningChecks: overallResult === 'WARNING' ? 1 : 0,
        passChecks: overallResult === 'PASS' ? 1 : 0,
        reviewed: false,
      };
    }));

    return { items };
  }

  async getComplianceStatus() {
    const reports = await this.prisma.payrollComplianceReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      items: reports.map(r => ({
        id: r.id,
        reportType: r.reportType,
        countryCode: r.countryCode,
        periodName: r.periodName,
        legalEntityName: r.legalEntityName,
        status: r.status,
        submissionStatus: r.submissionStatus,
        generatedAt: r.generatedAt,
        submittedAt: r.submittedAt,
        submissionReference: r.submissionReference,
        payrunId: r.payrunId,
      })),
    };
  }

  async getFinalizationReadiness(payrunId: string) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payrunExceptions: { where: { status: { in: ['OPEN', 'ASSIGNED'] } } },
      },
    });

    if (!payrun) return null;

    const criticalExceptions = payrun.payrunExceptions.filter(e => e.severity === 'CRITICAL').length;
    const submissionBlockers = payrun.payrunExceptions.filter(e => e.blocksSubmission).length;
    const paymentBlockers = payrun.payrunExceptions.filter(e => e.blocksPayment).length;

    const batch = await this.prisma.paymentBatch.findFirst({
      where: { payrunId },
      select: { status: true },
    });
    const batchConfirmed = batch?.status === 'CONFIRMED_PAID' || batch?.status === 'PROCESSED';

    const compReport = await this.prisma.payrollComplianceReport.findFirst({
      where: { payrunId },
      select: { status: true },
    });
    const complianceGenerated = compReport != null;

    const checklist = await this.prisma.payrollChecklist.findFirst({
      where: { periodId: payrun.periodId ?? undefined },
      select: { totalTasks: true, completedTasks: true },
    });
    const requiredTasksComplete = checklist ? checklist.completedTasks >= checklist.totalTasks : true;

    const checks = [
      { check: 'NO_CRITICAL_EXCEPTIONS', pass: criticalExceptions === 0, message: criticalExceptions === 0 ? 'No critical exceptions' : `${criticalExceptions} critical exception(s)` },
      { check: 'NO_SUBMISSION_BLOCKERS', pass: submissionBlockers === 0, checkType: 'EXCEPTION_BLOCKER', message: submissionBlockers === 0 ? 'No submission blockers' : `${submissionBlockers} submission blocker(s)` },
      { check: 'NO_PAYMENT_BLOCKERS', pass: paymentBlockers === 0, checkType: 'EXCEPTION_BLOCKER', message: paymentBlockers === 0 ? 'No payment blockers' : `${paymentBlockers} payment blocker(s)` },
      { check: 'PAYMENT_BATCH_CONFIRMED', pass: batchConfirmed, message: batchConfirmed ? 'Payment confirmed' : 'Payment batch not confirmed' },
      { check: 'COMPLIANCE_GENERATED', pass: complianceGenerated, message: complianceGenerated ? 'Compliance report generated' : 'Compliance report not generated' },
      { check: 'CHECKLIST_COMPLETE', pass: requiredTasksComplete, message: requiredTasksComplete ? 'Required tasks complete' : 'Checklist tasks incomplete' },
    ];

    const ready = checks.every(c => c.pass);

    return { payrunId, ready, checks };
  }
}
