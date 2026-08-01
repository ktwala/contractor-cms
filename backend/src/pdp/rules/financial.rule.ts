import { PrismaClient } from '@prisma/client';
import { PdpAction, PdpContext, PdpRuleResult } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

export class FinancialRuleEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpRuleResult> {
    if (!context.contractorId) return { decision: 'ALLOW' };

    const engagements = await this.prisma.contractorEngagement.findMany({
      where: { contractorId: context.contractorId },
      include: { contract: true },
    });

    if (engagements.length === 0) return { decision: 'ALLOW' };

    const engagement = engagements[0];
    const contractEndDate = engagement.contract?.endDate;

    if (contractEndDate) {
      if (context.transactionDate > contractEndDate) {
        return {
          decision: 'BLOCK',
          reason_code: PdpReasonCode.POST_EXPIRY_LABOR_PROHIBITED,
          message: 'Labor logged after contract expiration date.',
        };
      }

      const msIn30Days = 30 * 24 * 60 * 60 * 1000;
      const today = new Date();
      if (today.getTime() - context.transactionDate.getTime() > msIn30Days) {
        return {
          decision: 'APPROVAL_REQUIRED',
          reason_code: PdpReasonCode.TIMESHEET_LATE_SUBMISSION,
          message: 'Pre-expiry timesheet submitted late.',
        };
      }
    }

    return { decision: 'ALLOW' };
  }
}
