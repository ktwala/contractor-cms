import { PrismaClient, SupplierStatus } from '@prisma/client';
import { buildSupplierEvidenceChecklist } from '../../domain/suppliers/supplier-evidence-evaluator';
import { resolveSupplierJurisdictionCode } from '../../domain/suppliers/supplier-jurisdiction.constants';
import {
  isProcurementEvidenceTrusted,
  resolveSupplierEvidenceAuthorityMode,
} from '../../domain/suppliers/supplier-evidence-policy';
import { isSupplierOperationalTrustGranted } from '../../domain/suppliers/supplier-operational-trust.util';
import { PdpAction, PdpContext, PdpRuleResult } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

export class SupplierRuleEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpRuleResult> {
    if (!context.supplierId) {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.SUPPLIER_NOT_APPROVED,
        message: 'Supplier context is required for this action.',
      };
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: context.supplierId },
      include: {
        documents: true,
        organization: { select: { supplierAuthorityMode: true } },
      },
    });

    if (!supplier) {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.SUPPLIER_NOT_APPROVED,
        message: 'Supplier not found.',
      };
    }

    if (supplier.status === SupplierStatus.SUSPENDED || (supplier.status as string) === 'TERMINATED') {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.SUPPLIER_MASTER_EXPIRED,
        message: `Supplier is ${supplier.status}.`,
      };
    }

    if (!isSupplierOperationalTrustGranted(supplier.status)) {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.SUPPLIER_NOT_APPROVED,
        message: 'Supplier Operational Trust not granted.',
      };
    }

    const jurisdictionCode = resolveSupplierJurisdictionCode(
      supplier.country,
      supplier.countryCode,
    );
    const checklist = buildSupplierEvidenceChecklist(
      supplier.id,
      supplier.type,
      jurisdictionCode,
      supplier.documents,
      context.transactionDate,
    );

    const evidenceAuthorityMode = resolveSupplierEvidenceAuthorityMode(
      supplier.organization?.supplierAuthorityMode,
    );
    if (
      isProcurementEvidenceTrusted({
        evidenceAuthorityMode,
        sourceSystem: supplier.sourceSystem,
        externalSupplierId: supplier.externalSupplierId,
        sourceSyncStatus: supplier.sourceSyncStatus,
      })
    ) {
      return { decision: 'ALLOW' };
    }

    if (!checklist.complete) {
      return {
        decision: 'HOLD',
        reason_code: PdpReasonCode.MISSING_REQUIRED_DOCS,
        message:
          'Required supplier evidence is missing or expired. Upload valid documents before operational actions.',
      };
    }

    return { decision: 'ALLOW' };
  }
}
