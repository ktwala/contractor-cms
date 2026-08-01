import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PayRunType } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunReversalWorkflowService } from './payrun-reversal-workflow.service';
import { PayrunCorrectionApprovalService } from './payrun-correction-approval.service';
import { PayrunGovernancePolicyResolutionService } from './payrun-governance-policy-resolution.service';
import {
  GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../payroll-cycle/constants/governance-policy-keys';

/** Break-glass + structured bypass for mutations in a closed pay period (GOV-3D-1). */
export const PAYRUN_CLOSED_PERIOD_OVERRIDE_PERMISSION = 'payrun:closed_period_override';

export const PAYRUN_CLOSED_PERIOD_JUSTIFICATION_MIN = 20;

export type PayrunClosedPeriodGateUser = {
  sub: string;
  permissions?: string[];
};

export type PayrunClosedPeriodMutationHeaders = {
  bypassHeader?: string;
  justification?: string;
  reversalWorkflowId?: string;
  correctionApprovalId?: string;
};

@Injectable()
export class PayrunClosedPeriodMutationGuardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reversalWorkflows: PayrunReversalWorkflowService,
    private readonly correctionApprovals: PayrunCorrectionApprovalService,
    private readonly govPolicy: PayrunGovernancePolicyResolutionService,
  ) {}

  /**
   * Blocks creating a new REGULAR payrun for a calendar period that has been closed.
   */
  async assertAllowsCreateRegularForPeriod(
    periodId: string | null | undefined,
    user: PayrunClosedPeriodGateUser,
    headers: PayrunClosedPeriodMutationHeaders,
    operation: string,
  ): Promise<void> {
    if (!periodId) return;
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        closedAt: true,
        payGroupId: true,
        payGroup: { select: { legalEntityId: true } },
      },
    });
    if (!period?.closedAt) return;
    const policyCtx =
      period.payGroup?.legalEntityId && period.payGroupId
        ? { legalEntityId: period.payGroup.legalEntityId, payGroupId: period.payGroupId }
        : undefined;
    await this.resolveBypassOrThrow(user, headers, operation, {
      kind: 'create_regular_payrun',
      periodId,
      policyCtx,
    });
  }

  /**
   * Blocks register / lifecycle mutations for payruns tied to a closed period unless:
   * - payrun is an ADJUSTMENT run, or
   * - caller holds payrun:closed_period_override and supplies an auditable bypass
   *   (break-glass, reversal workflow id, or correction approval id) with justification.
   */
  async assertAllowsPayrunTemporalMutation(
    payrunId: string,
    user: PayrunClosedPeriodGateUser,
    headers: PayrunClosedPeriodMutationHeaders,
    operation: string,
  ): Promise<void> {
    const row = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: {
        periodId: true,
        payrunType: true,
        payGroupId: true,
        payGroup: { select: { legalEntityId: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `PayRun with id '${payrunId}' not found`,
      });
    }
    if (row.payrunType === PayRunType.ADJUSTMENT) return;
    if (!row.periodId) return;

    const period = await this.prisma.payPeriod.findUnique({
      where: { id: row.periodId },
      select: { closedAt: true },
    });
    if (!period?.closedAt) return;

    const policyCtx =
      row.payGroup?.legalEntityId && row.payGroupId
        ? { legalEntityId: row.payGroup.legalEntityId, payGroupId: row.payGroupId }
        : undefined;
    await this.resolveBypassOrThrow(user, headers, operation, {
      kind: 'payrun_temporal_mutation',
      payrunId,
      periodId: row.periodId,
      policyCtx,
    });
  }

  private async resolveBypassOrThrow(
    user: PayrunClosedPeriodGateUser,
    headers: PayrunClosedPeriodMutationHeaders,
    operation: string,
    ctx: Record<string, unknown>,
  ): Promise<void> {
    const policyCtx = ctx.policyCtx as
      | { legalEntityId: string; payGroupId?: string | null }
      | undefined;
    const jPol = policyCtx
      ? await this.govPolicy.resolveJustificationMinForContext(policyCtx, PAYRUN_CLOSED_PERIOD_JUSTIFICATION_MIN)
      : {
          value: PAYRUN_CLOSED_PERIOD_JUSTIFICATION_MIN,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
        };
    const mutPol = policyCtx
      ? await this.govPolicy.resolveClosedPeriodMutationMode(policyCtx)
      : {
          value: 'STANDARD' as const,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
        };

    const hasPerm = user.permissions?.includes(PAYRUN_CLOSED_PERIOD_OVERRIDE_PERMISSION) === true;
    const justification = (headers.justification || '').trim();
    const bypassApproved = (headers.bypassHeader || '').trim().toLowerCase() === 'approved';
    const rev = (headers.reversalWorkflowId || '').trim();
    const corr = (headers.correctionApprovalId || '').trim();
    const justificationOk = justification.length >= jPol.value;

    const hasStructuredBypass = rev.length >= 8 || corr.length >= 8;
    const hasBreakGlass = bypassApproved;

    const payrunIdForGoverned = typeof ctx.payrunId === 'string' ? ctx.payrunId : undefined;
    const periodEntityId = (ctx.periodId as string) || 'unknown';
    const policyAudit = {
      governance_policy_key_justification: jPol.policy_key,
      governance_policy_id_justification: jPol.policy_id,
      governance_policy_source_justification: jPol.source,
      justification_min_length_applied: jPol.value,
      governance_policy_key_mutation_mode: mutPol.policy_key,
      governance_policy_id_mutation_mode: mutPol.policy_id,
      governance_policy_source_mutation_mode: mutPol.source,
      closed_period_mutation_mode_applied: mutPol.value,
    };

    if (justificationOk && payrunIdForGoverned && rev) {
      const ok = await this.reversalWorkflows.isApprovedWorkflowForSourceMutation(rev, payrunIdForGoverned);
      if (ok) {
        const { policyCtx: _pc, ...rest } = ctx;
        await this.audit.log({
          userId: user.sub,
          action: 'PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION',
          entityType: 'PayPeriod',
          entityId: periodEntityId,
          newValue: {
            operation,
            ...rest,
            route: 'reversal_workflow',
            reversal_workflow_id: rev,
            justification,
            ...policyAudit,
          },
          reason: `closed_period_governed_mutation:${operation}`,
        });
        return;
      }
    }

    if (justificationOk && payrunIdForGoverned && corr) {
      const ok = await this.correctionApprovals.isApprovedCorrectionForSourceMutation(corr, payrunIdForGoverned);
      if (ok) {
        const { policyCtx: _pc, ...rest } = ctx;
        await this.audit.log({
          userId: user.sub,
          action: 'PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION',
          entityType: 'PayPeriod',
          entityId: periodEntityId,
          newValue: {
            operation,
            ...rest,
            route: 'correction_approval',
            correction_approval_ref: corr,
            justification,
            ...policyAudit,
          },
          reason: `closed_period_governed_mutation:${operation}`,
        });
        return;
      }
    }

    if (mutPol.value !== 'GOVERNED_PATHS_ONLY' && hasPerm && justificationOk && (hasBreakGlass || hasStructuredBypass)) {
      const { policyCtx: _pc, ...rest } = ctx;
      await this.audit.log({
        userId: user.sub,
        action: 'PAYRUN_CLOSED_PERIOD_MUTATION_BYPASS',
        entityType: 'PayPeriod',
        entityId: periodEntityId,
        newValue: {
          operation,
          ...rest,
          bypass_break_glass: hasBreakGlass,
          reversal_workflow_id: rev || null,
          correction_approval_id: corr || null,
          justification,
          ...policyAudit,
        },
        reason: `closed_period_mutation_bypass:${operation}`,
      });
      return;
    }

    const { policyCtx: _pce, ...restCtx } = ctx;
    throw new ForbiddenException({
      code: 'CLOSED_PERIOD_MUTATION_BLOCKED',
      message:
        'This pay period is closed. Register and lifecycle changes are blocked unless performed on an adjustment payrun, an approved governed reversal/correction (GOV-3D-2), or an audited break-glass override (GOV-3D-1).',
      operation,
      ...restCtx,
    });
  }
}
