import { PrismaClient } from '@prisma/client';
import { PdpAction, PdpContext, PdpRuleResult } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

const RESTRICTED_ACTIONS = new Set<PdpAction>([
  'SUBMIT_TIMESHEET',
  'CREATE_CONTRACTOR',
  'SUBMIT_INVOICE',
]);

/**
 * PR-CTR-CONNECTOR-1G — PDP cascade from active governance remediations (no identity mutation).
 */
export class WorkforceGovernanceRuleEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpRuleResult> {
    if (!context.contractorId || !RESTRICTED_ACTIONS.has(action)) {
      return { decision: 'ALLOW' };
    }

    const activeRestriction = await this.prisma.contractorGovernanceRemediation.findFirst({
      where: {
        contractorId: context.contractorId,
        pdpRestrictionsApplied: true,
        remediationStatus: {
          not: 'CLOSED',
        },
      },
      include: { drift: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeRestriction) {
      return { decision: 'ALLOW' };
    }

    return {
      decision: 'BLOCK',
      reason_code: PdpReasonCode.WORKFORCE_GOVERNANCE_RESTRICTED,
      reason_category: 'LIFECYCLE',
      severity: 'CRITICAL',
      reversibility: 'REVERSIBLE_AFTER_CURE',
      message:
        'Workforce governance remediation is active. Operational actions are restricted until governance closes the remediation (contractor record is not auto-deactivated).',
      next_action:
        'Complete operational governance remediation (assign sponsor / resolve governance issue).',
    };
  }
}
