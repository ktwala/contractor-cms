import { Injectable } from '@nestjs/common';
import { PayRunType, PayrunCorrectionApprovalStatus, PayrunReversalWorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { PayrollReadinessService } from '../payroll-readiness/payroll-readiness.service';
import { PayrunsService, type RequestUser } from './payruns.service';
import { PayrunFinancialControlService } from './payrun-financial-control.service';
import { PayrunBankReconciliationService } from './payrun-bank-reconciliation.service';
import { PayrunGLReconciliationService } from './payrun-gl-reconciliation.service';
import { PayrunReversalWorkflowService } from './payrun-reversal-workflow.service';
import { PayrunCorrectionApprovalService } from './payrun-correction-approval.service';
import { PayrunPostCloseReconciliationImpactService } from './payrun-post-close-reconciliation-impact.service';
import type { GovernanceRag, PayrunGovernanceHealthDto } from './dto/payrun-governance-health.dto';

const OVERRIDE_ACTION_SNIPPETS = [
  'OVERRIDE',
  'BYPASS',
  'GATE_OVERRIDE',
] as const;

@Injectable()
export class PayrunGovernanceHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payruns: PayrunsService,
    private readonly payrollReadiness: PayrollReadinessService,
    private readonly financialControl: PayrunFinancialControlService,
    private readonly bankReconciliation: PayrunBankReconciliationService,
    private readonly glReconciliation: PayrunGLReconciliationService,
    private readonly reversalWorkflows: PayrunReversalWorkflowService,
    private readonly correctionApprovals: PayrunCorrectionApprovalService,
    private readonly postCloseImpact: PayrunPostCloseReconciliationImpactService,
  ) {}

  async getHealthForPayrun(payrunId: string, user: RequestUser): Promise<PayrunGovernanceHealthDto> {
    const payrun = await this.payruns.findOne(payrunId, user);
    const payGroupId = (payrun as any).pay_group_id ?? (payrun as any).payGroupId;
    const periodId = ((payrun as any).period_id ?? (payrun as any).periodId) as string | null | undefined;
    const status = String((payrun as any).status ?? '');
    const payrunType = String((payrun as any).payrunType ?? (payrun as any).payrun_type ?? 'REGULAR');

    const periodClosed =
      payrunType !== PayRunType.ADJUSTMENT &&
      !!periodId &&
      !!(await this.prisma.payPeriod.findUnique({ where: { id: periodId }, select: { closedAt: true } }))?.closedAt;

    const closed_period_status: 'OPEN' | 'CLOSED' = periodClosed ? 'CLOSED' : 'OPEN';

    const readiness = await this.payrollReadiness.getPayGroupReadiness(payGroupId);
    const readiness_status: GovernanceRag = readiness.canCreatePayrun
      ? 'GREEN'
      : readiness.readinessPercent != null && readiness.readinessPercent >= 80
        ? 'AMBER'
        : 'AMBER';

    const fc = await this.financialControl.getForPayrun(payrunId);
    const financial_control_status = this.ragFinancial(fc);

    const bank = await this.bankReconciliation.getForPayrun(payrunId);
    const bank_reconciliation_status = this.ragBank(bank);

    const gl = await this.glReconciliation.getForPayrun(payrunId);
    const gl_reconciliation_status = this.ragGl(gl);

    const [reversals, corrections] = await Promise.all([
      this.reversalWorkflows.listForSourcePayrun(payrunId),
      this.correctionApprovals.listForPayrun(payrunId),
    ]);

    const linked =
      reversals.some((r) => r.reversal_payrun_id != null) ||
      corrections.some((c) => c.resulting_adjustment_payrun_id != null);
    const activeRev = reversals.some(
      (r) =>
        r.status === PayrunReversalWorkflowStatus.PENDING_APPROVAL ||
        (r.status === PayrunReversalWorkflowStatus.APPROVED && !r.reversal_payrun_id),
    );
    const activeCorr = corrections.some(
      (c) =>
        c.status === PayrunCorrectionApprovalStatus.PENDING ||
        (c.status === PayrunCorrectionApprovalStatus.APPROVED && !c.resulting_adjustment_payrun_id),
    );

    let reversal_status: PayrunGovernanceHealthDto['reversal_status'] = 'NONE';
    if (linked) reversal_status = 'ADJUSTMENT_LINKED';
    else if (activeRev || activeCorr) reversal_status = 'ACTIVE';

    const impact = await this.postCloseImpact.getSummary(payrunId);
    const post_close_impact_status: PayrunGovernanceHealthDto['post_close_impact_status'] = impact.any_impact
      ? 'PENDING'
      : 'CLEAR';

    const auditRows = await this.prisma.auditLog.findMany({
      where: { entityType: 'PayRun', entityId: payrunId },
      select: { action: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const overrideActions = auditRows
      .map((r) => r.action)
      .filter((a) => OVERRIDE_ACTION_SNIPPETS.some((s) => a.includes(s)));
    const override_types = [...new Set(overrideActions)];
    const override_count = overrideActions.length;

    const unresolved_governance_blocks: string[] = [];
    if (!readiness.canCreatePayrun) {
      unresolved_governance_blocks.push(
        `Readiness not green (${readiness.readinessPercent ?? 0}%): resolve pay group readiness or record override.`,
      );
    }
    if (fc?.post_close_reconciliation_impact_pending) {
      unresolved_governance_blocks.push('GOV-4: post-close reconciliation impact pending acknowledgement.');
    }
    if (fc?.status === 'BLOCKED') {
      unresolved_governance_blocks.push(`GOV-3A: financial control BLOCKED (${(fc.blocked_reasons ?? []).join(', ') || 'see financial control'}).`);
    }
    if (fc?.status === 'VARIANCE' && fc.review_required && !fc.reviewed_at) {
      unresolved_governance_blocks.push('GOV-3A: financial variance review still required.');
    }
    if (bank?.post_close_reconciliation_impact_pending) {
      unresolved_governance_blocks.push('GOV-4: bank reconciliation marked impacted; re-truth 3B then acknowledge post-close impact.');
    }
    if (bank && ['BLOCKED', 'REJECTED'].includes(String(bank.status)) && !(bank as { reviewed_at?: string | null }).reviewed_at) {
      unresolved_governance_blocks.push(`GOV-3B: bank reconciliation ${bank.status} — resolve or review.`);
    }
    if (gl?.post_close_reconciliation_impact_pending) {
      unresolved_governance_blocks.push('GOV-4: GL reconciliation marked impacted; re-truth 3C then acknowledge post-close impact.');
    }
    if (gl && String(gl.status) === 'VARIANCE' && gl.review_required && !gl.reviewed_at) {
      unresolved_governance_blocks.push('GOV-3C: GL variance review still required.');
    }
    if (
      ['PAID', 'POSTED', 'FINALIZED'].includes(status) &&
      !gl &&
      payrunType === PayRunType.REGULAR
    ) {
      unresolved_governance_blocks.push('GOV-3C: no GL reconciliation row yet for a paid/posted/finalized regular payrun (period close risk).');
    }

    const ladder: PayrunGovernanceHealthDto['ladder'] = [
      {
        layer: 'GOV-2',
        label: 'Execution readiness (pay group)',
        rag: readiness_status,
        blocked_by: readiness.canCreatePayrun ? undefined : (readiness.blockingReasons?.[0]?.message ?? 'Readiness'),
      },
      {
        layer: 'GOV-3A',
        label: 'Financial control (register ↔ export)',
        rag: financial_control_status,
        blocked_by: fc?.status === 'BLOCKED' ? (fc.blocked_reasons?.[0] ?? 'BLOCKED') : undefined,
      },
      {
        layer: 'GOV-3B',
        label: 'Bank reconciliation (export ↔ settlement)',
        rag: bank_reconciliation_status,
        blocked_by: bank && bank.status === 'BLOCKED' ? (bank.blocked_reasons?.[0] ?? 'BLOCKED') : undefined,
      },
      {
        layer: 'GOV-3C',
        label: 'GL reconciliation (register ↔ posting)',
        rag: gl_reconciliation_status,
        blocked_by: gl && gl.status === 'BLOCKED' ? (gl.blocked_reasons?.[0] ?? 'BLOCKED') : undefined,
      },
      {
        layer: 'GOV-3D',
        label: 'Temporal protection (closed period)',
        rag: closed_period_status === 'CLOSED' ? 'GREEN' : 'GREY',
        blocked_by: closed_period_status === 'CLOSED' ? 'Period closed — REGULAR mutations blocked unless governed' : undefined,
      },
      {
        layer: 'GOV-3D-2',
        label: 'Governed reversal / correction',
        rag:
          reversal_status === 'ADJUSTMENT_LINKED'
            ? 'AMBER'
            : reversal_status === 'ACTIVE'
              ? 'AMBER'
              : 'GREEN',
        blocked_by:
          reversal_status === 'ACTIVE'
            ? 'Reversal or correction workflow in flight'
            : reversal_status === 'ADJUSTMENT_LINKED'
              ? 'Adjustment linked — verify downstream controls'
              : undefined,
      },
      {
        layer: 'GOV-4',
        label: 'Post-close impact',
        rag: post_close_impact_status === 'PENDING' ? 'AMBER' : 'GREEN',
        blocked_by: post_close_impact_status === 'PENDING' ? 'Impact flags or downstream reconciliation outstanding' : undefined,
      },
    ];

    const overall_governance_rag = this.worstRag([
      readiness_status,
      financial_control_status,
      bank_reconciliation_status,
      gl_reconciliation_status,
      reversal_status === 'ADJUSTMENT_LINKED' || reversal_status === 'ACTIVE' ? 'AMBER' : 'GREEN',
      post_close_impact_status === 'PENDING' ? 'AMBER' : 'GREEN',
    ]);

    return {
      payrun_id: payrunId,
      pay_group_id: payGroupId,
      period_id: periodId ?? null,
      payrun_status: status,
      payrun_type: payrunType,
      readiness_status,
      readiness_percent: readiness.readinessPercent ?? null,
      financial_control_status,
      bank_reconciliation_status,
      gl_reconciliation_status,
      closed_period_status,
      reversal_status,
      post_close_impact_status,
      override_count,
      override_types,
      unresolved_governance_blocks,
      overall_governance_rag,
      ladder,
    };
  }

  private worstRag(rags: GovernanceRag[]): GovernanceRag {
    if (rags.includes('RED')) return 'RED';
    if (rags.includes('AMBER')) return 'AMBER';
    if (rags.every((r) => r === 'GREY')) return 'GREY';
    return 'GREEN';
  }

  private ragFinancial(fc: Awaited<ReturnType<PayrunFinancialControlService['getForPayrun']>>): GovernanceRag {
    if (!fc) return 'GREY';
    if (fc.post_close_reconciliation_impact_pending) return 'AMBER';
    if (fc.status === 'BLOCKED') return 'RED';
    if (fc.status === 'VARIANCE' && fc.review_required && !fc.reviewed_at) return 'AMBER';
    if (fc.status === 'MATCH') return 'GREEN';
    return 'AMBER';
  }

  private ragBank(bank: Awaited<ReturnType<PayrunBankReconciliationService['getForPayrun']>>): GovernanceRag {
    if (!bank) return 'GREY';
    if (bank.post_close_reconciliation_impact_pending) return 'AMBER';
    if (bank.status === 'BLOCKED') return 'RED';
    if (['REJECTED', 'PARTIAL'].includes(String(bank.status)) && !bank.reviewed_at) return 'AMBER';
    if (String(bank.status) === 'VARIANCE' && bank.review_required && !bank.reviewed_at) return 'AMBER';
    if (String(bank.status) === 'MATCH') return 'GREEN';
    return 'AMBER';
  }

  private ragGl(gl: Awaited<ReturnType<PayrunGLReconciliationService['getForPayrun']>>): GovernanceRag {
    if (!gl) return 'GREY';
    if (gl.post_close_reconciliation_impact_pending) return 'AMBER';
    if (gl.status === 'BLOCKED') return 'RED';
    if (gl.status === 'VARIANCE' && gl.review_required && !gl.reviewed_at) return 'AMBER';
    if (gl.status === 'MATCH') return 'GREEN';
    return 'AMBER';
  }
}
