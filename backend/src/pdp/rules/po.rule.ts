import { PrismaClient } from '@prisma/client';
import { PdpAction, PdpContext, PdpRuleResult } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

export class PoRuleEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpRuleResult> {
    if (action === 'SUBMIT_INVOICE' && !context.poId) {
      return {
        decision: 'BLOCK',
        reason_code: PdpReasonCode.PO_MISSING,
        message: 'No Purchase Order reference provided.',
      };
    }

    // When the real PurchaseOrder model exists, we will fetch it here.
    return { decision: 'ALLOW' };
  }
}
