import { Injectable } from '@nestjs/common';
import {
  SupplierAuthorityMode,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierType,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { buildSupplierEvidenceChecklist } from './supplier-evidence-evaluator';
import { SupplierOnboardingEvidenceIncompleteException } from './supplier-evidence.errors';
import { EvidenceChecklistResult } from './supplier-evidence.types';
import { resolveSupplierJurisdictionCode } from './supplier-jurisdiction.constants';
import {
  isProcurementEvidenceTrusted,
  resolveSupplierEvidenceAuthorityMode,
} from './supplier-evidence-policy';

@Injectable()
export class SupplierEvidenceChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  evaluateChecklist(
    supplierId: string,
    supplierType: SupplierType,
    jurisdictionCode: ReturnType<typeof resolveSupplierJurisdictionCode>,
    documents: Array<{
      id: string;
      type: string;
      fileName: string;
      expiryDate: Date | null;
      uploadedAt: Date;
    }>,
    now = new Date(),
  ): EvidenceChecklistResult {
    return buildSupplierEvidenceChecklist(
      supplierId,
      supplierType,
      jurisdictionCode,
      documents,
      now,
    );
  }

  async buildChecklistForSupplier(supplierId: string): Promise<EvidenceChecklistResult> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { documents: true },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const jurisdictionCode = resolveSupplierJurisdictionCode(
      supplier.country,
      supplier.countryCode,
    );

    return this.evaluateChecklist(
      supplierId,
      supplier.type,
      jurisdictionCode,
      supplier.documents,
    );
  }

  isApprovalEvidenceSatisfied(params: {
    supplierAuthorityMode: SupplierAuthorityMode;
    sourceSystem: SupplierSourceSystem;
    externalSupplierId: string | null;
    sourceSyncStatus: SupplierSourceSyncStatus | null;
    checklist: EvidenceChecklistResult;
  }): boolean {
    const evidenceAuthorityMode = resolveSupplierEvidenceAuthorityMode(
      params.supplierAuthorityMode,
    );
    if (
      isProcurementEvidenceTrusted({
        evidenceAuthorityMode,
        sourceSystem: params.sourceSystem,
        externalSupplierId: params.externalSupplierId,
        sourceSyncStatus: params.sourceSyncStatus,
      })
    ) {
      return true;
    }
    return params.checklist.complete;
  }

  async assertApprovalEvidenceComplete(
    supplierId: string,
    supplierType: SupplierType,
    jurisdictionCode: ReturnType<typeof resolveSupplierJurisdictionCode>,
    supplierAuthorityMode: SupplierAuthorityMode,
    supplierSource?: {
      sourceSystem: SupplierSourceSystem;
      externalSupplierId: string | null;
      sourceSyncStatus: SupplierSourceSyncStatus | null;
    },
  ): Promise<EvidenceChecklistResult> {
    const supplier =
      supplierSource ??
      (await this.prisma.supplier.findUnique({
        where: { id: supplierId },
        select: {
          sourceSystem: true,
          externalSupplierId: true,
          sourceSyncStatus: true,
        },
      }));

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const checklist = await this.buildChecklistForSupplier(supplierId);
    if (
      !this.isApprovalEvidenceSatisfied({
        supplierAuthorityMode,
        sourceSystem: supplier.sourceSystem,
        externalSupplierId: supplier.externalSupplierId,
        sourceSyncStatus: supplier.sourceSyncStatus,
        checklist,
      })
    ) {
      throw new SupplierOnboardingEvidenceIncompleteException(checklist);
    }
    return checklist;
  }
}
