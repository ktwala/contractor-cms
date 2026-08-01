import { ForbiddenException } from '@nestjs/common';
import { PdpDecision } from './pdp.types';

export const PDP_GOVERNANCE_BLOCKED = 'PDP_GOVERNANCE_BLOCKED';

export class PdpGovernanceBlockedException extends ForbiddenException {
  constructor(decision: PdpDecision) {
    super({
      statusCode: 403,
      message:
        decision.message ??
        'This action is blocked by supplier governance policy.',
      error: 'Forbidden',
      code: PDP_GOVERNANCE_BLOCKED,
      reason_code: decision.reason_code,
      evaluatedDecision: decision.evaluatedDecision,
      effectiveDecision: decision.effectiveDecision,
    });
  }
}
