import { PrismaClient } from '@prisma/client';
import { PdpAction, PdpContext, PdpRuleResult } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

export class SupplierRuleEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpRuleResult> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: context.supplierId }
    });

    if (!supplier || supplier.status === 'PENDING_APPROVAL') {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.SUPPLIER_NOT_APPROVED,
        message: 'Supplier is missing or pending approval.',
      };
    }

    if (supplier.status === 'SUSPENDED' || supplier.status === 'TERMINATED') {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.SUPPLIER_MASTER_EXPIRED,
        message: `Supplier is ${supplier.status}.`,
      };
    }

    return { decision: 'ALLOW' };
  }
}
