import { PrismaClient } from '@prisma/client';
import { PdpAction, PdpContext, PdpRuleResult } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

export class ContractorRuleEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpRuleResult> {
    if (!context.contractorId) {
      return { decision: 'ALLOW' };
    }

    const contractor = await this.prisma.contractor.findUnique({
      where: { id: context.contractorId }
    });

    if (!contractor || !contractor.isActive) {
      return {
        decision: 'BLOCK',
        reason_code: PdpReasonCode.CONTRACTOR_OFFBOARDED,
        message: 'Contractor is offboarded or missing.',
      };
    }

    if (contractor.accessExpiresAt && contractor.accessExpiresAt < context.transactionDate) {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.CONTRACTOR_FROZEN_SUPPLIER_LAPSE,
        message: 'Contractor access has expired.',
      };
    }

    return { decision: 'ALLOW' };
  }
}
