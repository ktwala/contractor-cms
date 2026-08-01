import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

export type PayrunPostCloseReconciliationImpactSummary = {
  payrun_id: string;
  original_status: string;
  original_payrun_type: string;
  financial_control_impacted: boolean;
  bank_reconciliation_impacted: boolean;
  gl_reconciliation_impacted: boolean;
  any_impact: boolean;
  downstream_reconciliation_outstanding: boolean;
  reversal_workflows: Array<{
    id: string;
    reversal_payrun_id: string | null;
    status: string;
    downstream_reconciliation_required: boolean;
  }>;
  correction_approvals: Array<{
    id: string;
    approval_reference: string;
    resulting_adjustment_payrun_id: string | null;
    status: string;
    downstream_reconciliation_required: boolean;
  }>;
};

/**
 * GOV-4 — when a governed reversal/correction links an adjustment payrun, downstream
 * financial / bank / GL truths for the immutable source may be stale until re-reconciled and acknowledged.
 */
@Injectable()
export class PayrunPostCloseReconciliationImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSummary(payrunId: string): Promise<PayrunPostCloseReconciliationImpactSummary> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: {
        id: true,
        status: true,
        payrunType: true,
        financialControlImpacted: true,
        bankReconciliationImpacted: true,
        glReconciliationImpacted: true,
      },
    });
    if (!payrun) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'PayRun not found' });
    }

    const [reversals, corrections] = await Promise.all([
      this.prisma.payrunReversalWorkflow.findMany({
        where: { sourcePayrunId: payrunId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reversalPayrunId: true,
          status: true,
          downstreamReconciliationRequired: true,
        },
      }),
      this.prisma.payrunCorrectionApproval.findMany({
        where: { payrunId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          approvalReference: true,
          resultingAdjustmentPayrunId: true,
          status: true,
          downstreamReconciliationRequired: true,
        },
      }),
    ]);

    const anyImpact =
      payrun.financialControlImpacted ||
      payrun.bankReconciliationImpacted ||
      payrun.glReconciliationImpacted;

    const downstreamOutstanding =
      reversals.some((r) => r.downstreamReconciliationRequired) ||
      corrections.some((c) => c.downstreamReconciliationRequired);

    return {
      payrun_id: payrunId,
      original_status: payrun.status,
      original_payrun_type: payrun.payrunType,
      financial_control_impacted: payrun.financialControlImpacted,
      bank_reconciliation_impacted: payrun.bankReconciliationImpacted,
      gl_reconciliation_impacted: payrun.glReconciliationImpacted,
      any_impact: anyImpact,
      downstream_reconciliation_outstanding: downstreamOutstanding,
      reversal_workflows: reversals.map((r) => ({
        id: r.id,
        reversal_payrun_id: r.reversalPayrunId,
        status: r.status,
        downstream_reconciliation_required: r.downstreamReconciliationRequired,
      })),
      correction_approvals: corrections.map((c) => ({
        id: c.id,
        approval_reference: c.approvalReference,
        resulting_adjustment_payrun_id: c.resultingAdjustmentPayrunId,
        status: c.status,
        downstream_reconciliation_required: c.downstreamReconciliationRequired,
      })),
    };
  }

  /**
   * Clears source impact flags and downstream_reconciliation_required on linked workflows/approvals.
   * Does not re-run 3A/3B/3C — operators must re-truth pillars on the source (and adjustment) as needed, then acknowledge.
   */
  async acknowledgeImpact(payrunId: string, actorUserId: string, note?: string): Promise<PayrunPostCloseReconciliationImpactSummary> {
    const before = await this.getSummary(payrunId);
    if (!before.any_impact && !before.downstream_reconciliation_outstanding) {
      throw new BadRequestException({
        code: 'POST_CLOSE_IMPACT_NOTHING_TO_ACK',
        message: 'No post-close reconciliation impact is pending for this payrun.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.payRun.update({
        where: { id: payrunId },
        data: {
          financialControlImpacted: false,
          bankReconciliationImpacted: false,
          glReconciliationImpacted: false,
        },
      }),
      this.prisma.payrunReversalWorkflow.updateMany({
        where: { sourcePayrunId: payrunId, downstreamReconciliationRequired: true },
        data: { downstreamReconciliationRequired: false },
      }),
      this.prisma.payrunCorrectionApproval.updateMany({
        where: { payrunId, downstreamReconciliationRequired: true },
        data: { downstreamReconciliationRequired: false },
      }),
    ]);

    await this.audit.log({
      userId: actorUserId,
      action: 'PAYRUN_POST_CLOSE_RECON_IMPACT_ACK',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: {
        prior_financial: before.financial_control_impacted,
        prior_bank: before.bank_reconciliation_impacted,
        prior_gl: before.gl_reconciliation_impacted,
        note: (note || '').trim() || undefined,
      },
      reason: 'post_close_reconciliation_impact_acknowledged',
    });

    return this.getSummary(payrunId);
  }

  /** Blocks payroll period close until GOV-4 impact flags are cleared (via acknowledge after re-truthing). */
  async assertAllowsPeriodClose(payrunId: string): Promise<void> {
    const p = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: {
        financialControlImpacted: true,
        bankReconciliationImpacted: true,
        glReconciliationImpacted: true,
      },
    });
    if (!p) return;
    if (p.financialControlImpacted || p.bankReconciliationImpacted || p.glReconciliationImpacted) {
      throw new ForbiddenException({
        code: 'PAYRUN_POST_CLOSE_RECON_IMPACT_PENDING',
        message:
          'A governed reversal or correction linked an adjustment to this payrun: re-run financial / bank / GL reconciliation as needed, then acknowledge post-close impact (GOV-4) before closing the payroll period.',
        post_close_reconciliation_impact_pending: true,
      });
    }
  }
}
