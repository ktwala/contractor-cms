import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { PayrollReadinessService } from '../payroll-readiness/payroll-readiness.service';
import { PayrunGovernancePolicyResolutionService } from './payrun-governance-policy-resolution.service';
import { GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH } from '../payroll-cycle/constants/governance-policy-keys';

export const PAYRUN_READINESS_OVERRIDE_PERMISSION = 'payrun:readiness_override';

/** Minimum justification length when using an explicit override (auditable). */
export const PAYRUN_READINESS_OVERRIDE_JUSTIFICATION_MIN = 20;

export type PayrunReadinessGateUser = {
  sub: string;
  permissions?: string[];
};

export type PayrunReadinessOverrideHeaders = {
  overrideHeader?: string;
  justification?: string;
};

@Injectable()
export class PayrunReadinessGateService {
  constructor(
    private readonly payrollReadiness: PayrollReadinessService,
    private readonly audit: AuditService,
    private readonly govPolicy: PayrunGovernancePolicyResolutionService,
  ) {}

  /**
   * Blocks when payroll readiness is not green for the pay group, unless the caller
   * has override permission and sends approved override headers with justification.
   */
  async assertPayGroupAllowed(
    payGroupId: string,
    user: PayrunReadinessGateUser,
    headers: PayrunReadinessOverrideHeaders,
    operation: string,
  ): Promise<void> {
    const readiness = await this.payrollReadiness.getPayGroupReadiness(payGroupId);
    if (readiness.canCreatePayrun) {
      return;
    }

    const hasOverridePermission = user.permissions?.includes(PAYRUN_READINESS_OVERRIDE_PERMISSION) === true;
    const overrideApproved = (headers.overrideHeader || '').trim().toLowerCase() === 'approved';
    const justification = (headers.justification || '').trim();
    const ctx = await this.govPolicy.resolvePayGroupContext(payGroupId);
    const jPol = ctx
      ? await this.govPolicy.resolveJustificationMinForContext(ctx, PAYRUN_READINESS_OVERRIDE_JUSTIFICATION_MIN)
      : {
          value: PAYRUN_READINESS_OVERRIDE_JUSTIFICATION_MIN,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
        };
    const justificationOk = justification.length >= jPol.value;

    if (hasOverridePermission && overrideApproved && justificationOk) {
      await this.audit.log({
        userId: user.sub,
        action: 'PAYRUN_READINESS_GATE_OVERRIDE',
        entityType: 'PayGroup',
        entityId: payGroupId,
        newValue: {
          operation,
          readinessPercent: readiness.readinessPercent,
          blockingReasons: readiness.blockingReasons,
          canCreatePayrun: readiness.canCreatePayrun,
          justification,
          governance_policy_key: jPol.policy_key,
          governance_policy_id: jPol.policy_id,
          governance_policy_source: jPol.source,
          justification_min_length_applied: jPol.value,
        },
        reason: `readiness_override:${operation}`,
      });
      return;
    }

    throw new ForbiddenException({
      code: 'PAYROLL_READINESS_GATE_BLOCKED',
      message:
        'Payroll readiness is not green for this pay group. Resolve blocking items or use an approved override with justification.',
      blockingReasons: readiness.blockingReasons,
      canCreatePayrun: readiness.canCreatePayrun,
      readinessPercent: readiness.readinessPercent,
    });
  }
}
