import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrunFinancialControlStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from './payrun-governance-policy-resolution.service';
import {
  GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../payroll-cycle/constants/governance-policy-keys';

export const PAYRUN_FINANCIAL_OVERRIDE_PERMISSION = 'payrun:financial_override';
export const PAYRUN_FINANCIAL_OVERRIDE_JUSTIFICATION_MIN = 20;
/** Absolute net total tolerance (same currency) — baseline v1. */
export const DEFAULT_NET_VARIANCE_THRESHOLD = 0.05;

export type PayrunFinancialOverrideHeaders = {
  overrideHeader?: string;
  justification?: string;
};

export type PayrunFinancialGateUser = {
  sub: string;
  permissions?: string[];
};

export type PayrunFinancialControlResponse = {
  payrun_id: string;
  payment_batch_id: string | null;
  employee_count_register: number;
  employee_count_export: number;
  total_net_register: number;
  total_net_export: number;
  variance_amount: number;
  variance_employee_count: number;
  status: PayrunFinancialControlStatus;
  threshold_policy: string;
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  soft_warnings: string[];
  blocked_reasons: string[];
  reconciled_at: string | null;
  /** GOV-4 — true when a governed reversal/correction linked an adjustment; clear via post-close acknowledge after re-truthing. */
  post_close_reconciliation_impact_pending: boolean;
};

@Injectable()
export class PayrunFinancialControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly govPolicy: PayrunGovernancePolicyResolutionService,
  ) {}

  async getForPayrun(payrunId: string): Promise<PayrunFinancialControlResponse | null> {
    const [row, payrun] = await Promise.all([
      this.prisma.payrunFinancialControl.findUnique({ where: { payrunId } }),
      this.prisma.payRun.findUnique({
        where: { id: payrunId },
        select: { financialControlImpacted: true },
      }),
    ]);
    if (!row) return null;
    return this.mapRow(row, payrun?.financialControlImpacted === true);
  }

  /**
   * Re-run reconciliation for a payrun (latest non-cancelled batch with generated export).
   */
  async reconcilePayrun(payrunId: string, actorUserId?: string): Promise<PayrunFinancialControlResponse> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { select: { legalEntityId: true } },
        employeeResults: { select: { employeeId: true, net: true } },
        paymentBatches: {
          where: { status: { notIn: ['CANCELLED', 'FAILED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            payments: { select: { employeeId: true, amount: true, bankName: true, accountNumber: true } },
          },
        },
      },
    });
    if (!payrun) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payrun not found' });

    const batch = payrun.paymentBatches[0] ?? null;
    const registerCount = payrun.employeeResults.length;
    const totalNetRegister = payrun.employeeResults.reduce((s, r) => s + Number(r.net ?? 0), 0);

    const blockedReasons: string[] = [];
    const softWarnings: string[] = [];

    if (!batch) {
      blockedReasons.push('NO_PAYMENT_BATCH');
    } else if (batch.exportStatus !== 'GENERATED') {
      blockedReasons.push('EXPORT_NOT_GENERATED');
    }

    let exportCount = 0;
    let totalNetExport = 0;
    const employeeIdsInBatch = new Set<string>();
    const bankKeys = new Map<string, number>();

    if (batch && batch.exportStatus === 'GENERATED') {
      for (const p of batch.payments) {
        exportCount += 1;
        totalNetExport += Number(p.amount ?? 0);
        if (employeeIdsInBatch.has(p.employeeId)) {
          blockedReasons.push('DUPLICATE_PAYMENT_EMPLOYEE');
        }
        employeeIdsInBatch.add(p.employeeId);
        const amt = Number(p.amount ?? 0);
        if (amt < 0) {
          blockedReasons.push('NEGATIVE_PAYMENT');
        }
        const bk = `${p.bankName ?? ''}|${p.accountNumber ?? ''}`;
        bankKeys.set(bk, (bankKeys.get(bk) ?? 0) + 1);
      }
      for (const [k, c] of bankKeys) {
        if (c > 1 && k !== '|') {
          blockedReasons.push('DUPLICATE_BANK_ACCOUNT');
          break;
        }
      }
    }

    for (const r of payrun.employeeResults) {
      const n = Number(r.net ?? 0);
      if (n === 0) softWarnings.push('ZERO_NET_EMPLOYEE');
    }

    if (batch && batch.exportStatus === 'GENERATED') {
      for (const p of batch.payments) {
        if (!p.bankName || !p.accountNumber) {
          softWarnings.push('MISSING_BANK_REFERENCE');
          break;
        }
      }
    }

    const varianceEmployeeCount = Math.abs(registerCount - exportCount);
    const varianceAmount = totalNetRegister - totalNetExport;
    const absVar = Math.abs(varianceAmount);

    let netThreshold = DEFAULT_NET_VARIANCE_THRESHOLD;
    let netThresholdPolicyKey = GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD;
    let netThresholdPolicyId: string | null = null;
    let netThresholdSource: 'registry' | 'default' = 'default';
    if (payrun.payGroup?.legalEntityId && payrun.payGroupId) {
      const resolved = await this.govPolicy.resolveNumberForContext(
        GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
        { legalEntityId: payrun.payGroup.legalEntityId, payGroupId: payrun.payGroupId },
        DEFAULT_NET_VARIANCE_THRESHOLD,
      );
      netThreshold = resolved.value;
      netThresholdPolicyKey = resolved.policy_key;
      netThresholdPolicyId = resolved.policy_id;
      netThresholdSource = resolved.source;
    }

    if (batch && batch.exportStatus === 'GENERATED') {
      if (varianceEmployeeCount !== 0) {
        blockedReasons.push('EMPLOYEE_COUNT_MISMATCH');
      }
      if (absVar > netThreshold) {
        blockedReasons.push('NET_TOTAL_BEYOND_THRESHOLD');
      }
    }

    const softWarningsUnique = [...new Set(softWarnings)];
    const blockedReasonsUnique = [...new Set(blockedReasons)];

    let status: PayrunFinancialControlStatus;
    let reviewRequired = false;

    if (blockedReasonsUnique.length > 0) {
      status = PayrunFinancialControlStatus.BLOCKED;
    } else if (softWarningsUnique.length > 0) {
      status = PayrunFinancialControlStatus.VARIANCE;
      reviewRequired = true;
    } else {
      status = PayrunFinancialControlStatus.MATCH;
    }

    const row = await this.prisma.payrunFinancialControl.upsert({
      where: { payrunId },
      create: {
        payrunId,
        paymentBatchId: batch?.id ?? null,
        employeeCountRegister: registerCount,
        employeeCountExport: exportCount,
        totalNetRegister,
        totalNetExport,
        varianceAmount,
        varianceEmployeeCount,
        status,
        thresholdPolicy:
          netThresholdSource === 'registry'
            ? `REGISTRY:${netThresholdPolicyKey}:${netThresholdPolicyId}`
            : `DEFAULT:${GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD}`,
        reviewRequired,
        softWarningsJson: softWarningsUnique.length ? softWarningsUnique : undefined,
        blockedReasonsJson: blockedReasonsUnique.length ? blockedReasonsUnique : undefined,
        reconciledAt: new Date(),
        reconciledByUserId: actorUserId ?? null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
      update: {
        paymentBatchId: batch?.id ?? null,
        employeeCountRegister: registerCount,
        employeeCountExport: exportCount,
        totalNetRegister,
        totalNetExport,
        varianceAmount,
        varianceEmployeeCount,
        status,
        thresholdPolicy:
          netThresholdSource === 'registry'
            ? `REGISTRY:${netThresholdPolicyKey}:${netThresholdPolicyId}`
            : `DEFAULT:${GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD}`,
        reviewRequired,
        softWarningsJson: softWarningsUnique.length ? softWarningsUnique : undefined,
        blockedReasonsJson: blockedReasonsUnique.length ? blockedReasonsUnique : undefined,
        reconciledAt: new Date(),
        reconciledByUserId: actorUserId ?? null,
        ...(status !== PayrunFinancialControlStatus.VARIANCE
          ? { reviewedAt: null, reviewedByUserId: null }
          : {}),
      },
    });

    const auditAction =
      status === PayrunFinancialControlStatus.MATCH
        ? 'PAYRUN_FINANCIAL_CONTROL_MATCH'
        : 'PAYRUN_FINANCIAL_CONTROL_VARIANCE';

    await this.audit.log({
      userId: actorUserId,
      action: auditAction,
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: {
        status,
        payment_batch_id: batch?.id ?? null,
        total_net_register: totalNetRegister,
        total_net_export: totalNetExport,
        variance_amount: varianceAmount,
        blocked_reasons: blockedReasonsUnique,
        soft_warnings: softWarningsUnique,
        governance_policy_key: netThresholdPolicyKey,
        governance_policy_id: netThresholdPolicyId,
        governance_policy_source: netThresholdSource,
        net_variance_threshold_applied: netThreshold,
      },
      reason: 'payrun_financial_control_reconcile',
    });

    const impact = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { financialControlImpacted: true },
    });
    return this.mapRow(row, impact?.financialControlImpacted === true);
  }

  /** Called after a payment batch export completes (same DB transaction context as caller). */
  async reconcileAfterPaymentExport(batchId: string, actorUserId?: string): Promise<void> {
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
      select: { payrunId: true },
    });
    if (batch?.payrunId) {
      await this.reconcilePayrun(batch.payrunId, actorUserId);
    }
  }

  async acknowledgeVarianceReview(payrunId: string, userId: string, _note?: string): Promise<PayrunFinancialControlResponse> {
    const row = await this.prisma.payrunFinancialControl.findUnique({ where: { payrunId } });
    if (!row) {
      throw new NotFoundException({ code: 'FINANCIAL_CONTROL_NOT_FOUND', message: 'Reconcile before acknowledging review' });
    }
    if (row.status !== PayrunFinancialControlStatus.VARIANCE) {
      throw new BadRequestException({
        code: 'FINANCIAL_CONTROL_REVIEW_INVALID',
        message: 'Review acknowledgement only applies when status is VARIANCE',
      });
    }
    const updated = await this.prisma.payrunFinancialControl.update({
      where: { payrunId },
      data: {
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewRequired: false,
      },
    });
    await this.audit.log({
      userId,
      action: 'PAYRUN_FINANCIAL_CONTROL_VARIANCE',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { reviewed: true },
      reason: 'payrun_financial_control_variance_acknowledged',
    });
    const impact = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { financialControlImpacted: true },
    });
    return this.mapRow(updated, impact?.financialControlImpacted === true);
  }

  /**
   * Blocks mark-paid / mark-posted unless register↔export control is MATCH,
   * or VARIANCE with operator review recorded, or audited financial override.
   */
  async assertAllowsMarkPaidOrPosted(
    payrunId: string,
    user: PayrunFinancialGateUser,
    headers: PayrunFinancialOverrideHeaders,
    operation: 'payrun.mark_paid' | 'payrun.mark_posted' | 'payroll.period_close',
  ): Promise<void> {
    const row = await this.prisma.payrunFinancialControl.findUnique({ where: { payrunId } });
    if (!row) {
      throw new ForbiddenException({
        code: 'PAYRUN_FINANCIAL_GATE_BLOCKED',
        message:
          'Payrun financial control is missing. Generate and export a payment batch, then reconcile before marking paid or posted.',
        financial_control_required: true,
      });
    }

    const ok =
      row.status === PayrunFinancialControlStatus.MATCH ||
      (row.status === PayrunFinancialControlStatus.VARIANCE && row.reviewedAt != null);

    if (ok) {
      return;
    }

    const hasPerm = user.permissions?.includes(PAYRUN_FINANCIAL_OVERRIDE_PERMISSION) === true;
    const approved = (headers.overrideHeader || '').trim().toLowerCase() === 'approved';
    const justification = (headers.justification || '').trim();
    const ctx = await this.govPolicy.resolvePayrunContext(payrunId);
    const jPol = ctx
      ? await this.govPolicy.resolveJustificationMinForContext(ctx, PAYRUN_FINANCIAL_OVERRIDE_JUSTIFICATION_MIN)
      : {
          value: PAYRUN_FINANCIAL_OVERRIDE_JUSTIFICATION_MIN,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
        };
    const justificationOk = justification.length >= jPol.value;

    if (hasPerm && approved && justificationOk) {
      await this.audit.log({
        userId: user.sub,
        action: 'PAYRUN_FINANCIAL_CONTROL_OVERRIDE',
        entityType: 'PayRun',
        entityId: payrunId,
        newValue: {
          operation,
          status: row.status,
          justification,
          blocked_reasons: row.blockedReasonsJson,
          soft_warnings: row.softWarningsJson,
          governance_policy_key: jPol.policy_key,
          governance_policy_id: jPol.policy_id,
          governance_policy_source: jPol.source,
          justification_min_length_applied: jPol.value,
        },
        reason: `financial_override:${operation}`,
      });
      return;
    }

    throw new ForbiddenException({
      code: 'PAYRUN_FINANCIAL_GATE_BLOCKED',
      message:
        'Payrun register does not reconcile to the payment export for this run. Resolve blockers, complete reconciliation, obtain variance review, or use an audited financial override.',
      status: row.status,
      blocked_reasons: row.blockedReasonsJson,
      soft_warnings: row.softWarningsJson,
      review_required: row.reviewRequired,
    });
  }

  private mapRow(row: {
    payrunId: string;
    paymentBatchId: string | null;
    employeeCountRegister: number;
    employeeCountExport: number;
    totalNetRegister: unknown;
    totalNetExport: unknown;
    varianceAmount: unknown;
    varianceEmployeeCount: number;
    status: PayrunFinancialControlStatus;
    thresholdPolicy: string;
    reviewRequired: boolean;
    reviewedByUserId: string | null;
    reviewedAt: Date | null;
    softWarningsJson: unknown;
    blockedReasonsJson: unknown;
    reconciledAt: Date | null;
  }, postCloseReconciliationImpactPending: boolean): PayrunFinancialControlResponse {
    return {
      payrun_id: row.payrunId,
      payment_batch_id: row.paymentBatchId,
      employee_count_register: row.employeeCountRegister,
      employee_count_export: row.employeeCountExport,
      total_net_register: Number(row.totalNetRegister),
      total_net_export: Number(row.totalNetExport),
      variance_amount: Number(row.varianceAmount),
      variance_employee_count: row.varianceEmployeeCount,
      status: row.status,
      threshold_policy: row.thresholdPolicy,
      review_required: row.reviewRequired,
      reviewed_by: row.reviewedByUserId,
      reviewed_at: row.reviewedAt?.toISOString() ?? null,
      soft_warnings: Array.isArray(row.softWarningsJson)
        ? (row.softWarningsJson as string[])
        : [],
      blocked_reasons: Array.isArray(row.blockedReasonsJson)
        ? (row.blockedReasonsJson as string[])
        : [],
      reconciled_at: row.reconciledAt?.toISOString() ?? null,
      post_close_reconciliation_impact_pending: postCloseReconciliationImpactPending,
    };
  }
}
