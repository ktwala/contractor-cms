import { Injectable } from '@nestjs/common';
import { PdpEngine } from './pdp.engine';
import { PdpGovernanceBlockedException } from './pdp-governance.errors';
import { PdpReasonCode } from './pdp.reason-codes';
import { PdpAction, PdpContext, PdpDecisionType } from './pdp.types';

/** Supplier lifecycle / evidence reason codes enforced outside shadow mode (PR-CMS-OPERATIONS-1D2). */
const HARD_ENFORCED_SUPPLIER_REASONS = new Set<PdpReasonCode>([
  PdpReasonCode.SUPPLIER_NOT_APPROVED,
  PdpReasonCode.MISSING_REQUIRED_DOCS,
]);

/** PR-CTR-CONNECTOR-1G — workforce PDP cascade always enforced when evaluated BLOCK/HOLD. */
const HARD_ENFORCED_WORKFORCE_REASONS = new Set<PdpReasonCode>([
  PdpReasonCode.WORKFORCE_GOVERNANCE_RESTRICTED,
]);

const BLOCKING_DECISIONS = new Set<PdpDecisionType>([
  'HOLD',
  'BLOCK',
  'APPROVAL_REQUIRED',
]);

@Injectable()
export class PdpOperationalGuardService {
  constructor(private readonly pdpEngine: PdpEngine) {}

  async assertAllowed(action: PdpAction, context: PdpContext): Promise<void> {
    const decision = await this.pdpEngine.evaluate(action, context);

    const hardEnforce =
      decision.reason_code != null &&
      (HARD_ENFORCED_SUPPLIER_REASONS.has(decision.reason_code) ||
        HARD_ENFORCED_WORKFORCE_REASONS.has(decision.reason_code));

    const evaluatedBlocks = BLOCKING_DECISIONS.has(decision.evaluatedDecision);
    const effectiveBlocks = BLOCKING_DECISIONS.has(decision.effectiveDecision);

    if (hardEnforce ? evaluatedBlocks : effectiveBlocks) {
      throw new PdpGovernanceBlockedException(decision);
    }
  }
}
