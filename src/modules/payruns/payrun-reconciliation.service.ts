import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

export interface ReconciliationCheck {
  checkCode: string;
  checkType: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_RUN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  expectedValue: number | null;
  actualValue: number | null;
  variance: number | null;
  message: string;
}

@Injectable()
export class PayrunReconciliationService {
  private readonly logger = new Logger(PayrunReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async runReconciliation(payrunId: string, actorUserId?: string) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        employeeResults: true,
        payGroup: { include: { legalEntity: true } },
        payrunExceptions: { where: { status: { in: ['OPEN', 'ASSIGNED'] } } },
      },
    });

    if (!payrun) throw new NotFoundException('Payrun not found');

    const results = payrun.employeeResults;
    const totals = results.reduce(
      (acc, r) => ({
        gross: acc.gross + Number(r.gross),
        paye: acc.paye + Number(r.paye),
        deductions: acc.deductions + Number(r.deductionsTotal),
        net: acc.net + Number(r.net),
      }),
      { gross: 0, paye: 0, deductions: 0, net: 0 },
    );

    const checks: ReconciliationCheck[] = [];

    // Check: Payment batch total vs payrun net
    const batch = await this.prisma.paymentBatch.findFirst({ where: { payrunId } });
    if (batch) {
      const batchTotal = Number(batch.totalAmount);
      const variance = Math.abs(totals.net - batchTotal);
      checks.push({
        checkCode: 'PAYRUN_NET_VS_BATCH_TOTAL',
        checkType: 'NET_PAY_MATCH',
        status: variance < 0.01 ? 'PASS' : variance < 100 ? 'WARNING' : 'FAIL',
        severity: 'CRITICAL',
        expectedValue: totals.net,
        actualValue: batchTotal,
        variance: totals.net - batchTotal,
        message: variance < 0.01 ? 'Payment batch total matches payrun net.' : `Variance of ${variance.toFixed(2)} detected.`,
      });

      const empCountMatch = batch.paymentCount === results.length;
      checks.push({
        checkCode: 'EMPLOYEE_COUNT_VS_BATCH_COUNT',
        checkType: 'EMPLOYEE_COUNT_MATCH',
        status: empCountMatch ? 'PASS' : 'WARNING',
        severity: 'HIGH',
        expectedValue: results.length,
        actualValue: batch.paymentCount,
        variance: results.length - batch.paymentCount,
        message: empCountMatch ? 'Employee counts match.' : `Expected ${results.length}, batch has ${batch.paymentCount}.`,
      });

      checks.push({
        checkCode: 'PAYMENT_BATCH_STATUS',
        checkType: 'APPROVAL_PAYMENT_SEQUENCE',
        status: ['CONFIRMED_PAID', 'PROCESSED'].includes(batch.status) ? 'PASS' : ['GENERATED', 'SUBMITTED'].includes(batch.status) ? 'WARNING' : 'FAIL',
        severity: 'HIGH',
        expectedValue: null, actualValue: null, variance: null,
        message: `Payment batch status: ${batch.status}.`,
      });
    } else {
      checks.push({
        checkCode: 'PAYMENT_BATCH_EXISTS',
        checkType: 'PAYMENT_MATCH',
        status: ['APPROVED', 'PAID', 'POSTED', 'FINALIZED'].includes(payrun.status) ? 'WARNING' : 'PASS',
        severity: 'MEDIUM',
        expectedValue: null, actualValue: null, variance: null,
        message: batch ? 'Payment batch exists.' : 'No payment batch linked to this payrun.',
      });
    }

    // PAYE total present
    checks.push({
      checkCode: 'PAYE_TOTAL_PRESENT',
      checkType: 'STATUTORY_TOTAL',
      status: totals.paye > 0 ? 'PASS' : results.length > 0 ? 'WARNING' : 'PASS',
      severity: 'MEDIUM',
      expectedValue: null, actualValue: totals.paye, variance: null,
      message: totals.paye > 0 ? `PAYE total: ${totals.paye.toFixed(2)}.` : 'PAYE total is zero.',
    });

    // No payment blockers
    const paymentBlockers = payrun.payrunExceptions.filter(e => e.blocksPayment).length;
    checks.push({
      checkCode: 'NO_PAYMENT_BLOCKERS',
      checkType: 'EXCEPTION_BLOCKER',
      status: paymentBlockers === 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
      expectedValue: 0, actualValue: paymentBlockers, variance: paymentBlockers,
      message: paymentBlockers === 0 ? 'No payment-blocking exceptions.' : `${paymentBlockers} payment-blocking exception(s) remain.`,
    });

    // No submission blockers
    const submissionBlockers = payrun.payrunExceptions.filter(e => e.blocksSubmission).length;
    checks.push({
      checkCode: 'NO_SUBMISSION_BLOCKERS',
      checkType: 'EXCEPTION_BLOCKER',
      status: submissionBlockers === 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
      expectedValue: 0, actualValue: submissionBlockers, variance: submissionBlockers,
      message: submissionBlockers === 0 ? 'No submission-blocking exceptions.' : `${submissionBlockers} submission-blocking exception(s) remain.`,
    });

    // Deductions vs gross check
    if (totals.deductions > totals.gross && results.length > 0) {
      checks.push({
        checkCode: 'DEDUCTIONS_VS_GROSS',
        checkType: 'DEDUCTION_VALIDATION',
        status: 'FAIL', severity: 'HIGH',
        expectedValue: totals.gross, actualValue: totals.deductions, variance: totals.deductions - totals.gross,
        message: 'Total deductions exceed total gross pay.',
      });
    } else {
      checks.push({
        checkCode: 'DEDUCTIONS_VS_GROSS',
        checkType: 'DEDUCTION_VALIDATION',
        status: 'PASS', severity: 'HIGH',
        expectedValue: totals.gross, actualValue: totals.deductions, variance: totals.deductions - totals.gross,
        message: 'Deductions within acceptable range.',
      });
    }

    // Finalization readiness
    const criticalFails = checks.filter(c => c.severity === 'CRITICAL' && c.status === 'FAIL').length;
    checks.push({
      checkCode: 'FINALIZATION_READINESS',
      checkType: 'FINALIZATION_READINESS',
      status: criticalFails === 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
      expectedValue: 0, actualValue: criticalFails, variance: criticalFails,
      message: criticalFails === 0 ? 'Payrun is ready for finalization.' : `${criticalFails} critical issue(s) must be resolved.`,
    });

    const passCount = checks.filter(c => c.status === 'PASS').length;
    const warningCount = checks.filter(c => c.status === 'WARNING').length;
    const failCount = checks.filter(c => c.status === 'FAIL').length;
    const overallResult = failCount > 0 ? 'FAIL' : warningCount > 0 ? 'WARNING' : 'PASS';

    await this.auditService.log({
      userId: actorUserId,
      action: 'RECONCILIATION_RUN',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { overallResult, passCount, warningCount, failCount },
    });

    return {
      payrunId,
      overallResult,
      passCount, warningCount, failCount,
      checksRun: checks.length,
      checks,
      reviewedAt: null,
      reviewedByName: null,
      reviewNote: null,
    };
  }

  async reviewReconciliation(payrunId: string, actorUserId: string, reviewNote?: string) {
    await this.auditService.log({
      userId: actorUserId,
      action: 'RECONCILIATION_REVIEWED',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { reviewNote },
    });

    return {
      payrunId,
      status: 'REVIEWED',
      reviewedAt: new Date().toISOString(),
      reviewedByName: actorUserId,
      reviewNote,
    };
  }
}
