import {
  SupplierAuthorityMode,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import {
  COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX,
  COMPARISON_ANCHOR_SUPPLIER_EMAIL,
} from '../demo/connector-demo-comparison.constants';
import { SupplierEvidenceChecklistService } from './supplier-evidence-checklist.service';
import {
  isProcurementEvidenceTrusted,
  resolveSupplierEvidenceAuthorityMode,
  SupplierEvidenceAuthorityMode,
} from './supplier-evidence-policy';
import { resolveSupplierJurisdictionCode } from './supplier-jurisdiction.constants';

export const SUPPLIER_GOVERNANCE_BUCKETS = [
  'synced',
  'pending_evidence',
  'active',
  'suspended',
] as const;

export type SupplierGovernanceBucket =
  (typeof SUPPLIER_GOVERNANCE_BUCKETS)[number];

export function buildOracleLinkedSupplierWhere(organizationId: string) {
  return {
    organizationId,
    sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
    externalSupplierId: { not: null },
    email: { not: COMPARISON_ANCHOR_SUPPLIER_EMAIL },
    companyName: { not: { startsWith: COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX } },
  };
}

export function applyGovernanceBucketPrismaWhere(
  base: Record<string, unknown>,
  bucket: SupplierGovernanceBucket,
): Record<string, unknown> {
  switch (bucket) {
    case 'synced':
      return {
        ...base,
        sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
      };
    case 'active':
      return { ...base, status: SupplierStatus.ACTIVE };
    case 'suspended':
      return { ...base, status: SupplierStatus.SUSPENDED };
    case 'pending_evidence':
      return { ...base, status: SupplierStatus.PENDING_APPROVAL };
    default:
      return base;
  }
}

type SupplierEvidenceRow = {
  id: string;
  type: SupplierType;
  country: string | null;
  countryCode: string | null;
  sourceSystem: SupplierSourceSystem;
  externalSupplierId: string | null;
  sourceSyncStatus: SupplierSourceSyncStatus | null;
  documents: Array<{
    id: string;
    type: string;
    fileName: string;
    expiryDate: Date | null;
    uploadedAt: Date;
  }>;
};

export function isSupplierPendingGovernanceEvidence(params: {
  supplier: SupplierEvidenceRow;
  evidenceAuthorityMode: SupplierEvidenceAuthorityMode;
  evidenceChecklist: SupplierEvidenceChecklistService;
}): boolean {
  const { supplier, evidenceAuthorityMode, evidenceChecklist } = params;

  if (
    isProcurementEvidenceTrusted({
      evidenceAuthorityMode,
      sourceSystem: supplier.sourceSystem,
      externalSupplierId: supplier.externalSupplierId,
      sourceSyncStatus: supplier.sourceSyncStatus,
    })
  ) {
    return false;
  }

  const jurisdictionCode = resolveSupplierJurisdictionCode(
    supplier.country,
    supplier.countryCode,
  );
  const checklist = evidenceChecklist.evaluateChecklist(
    supplier.id,
    supplier.type,
    jurisdictionCode,
    supplier.documents,
  );
  return !checklist.complete;
}

export function filterSuppliersByPendingEvidence<T extends SupplierEvidenceRow>(params: {
  suppliers: T[];
  supplierAuthorityMode: SupplierAuthorityMode;
  evidenceChecklist: SupplierEvidenceChecklistService;
}): T[] {
  const evidenceAuthorityMode = resolveSupplierEvidenceAuthorityMode(
    params.supplierAuthorityMode,
  );
  return params.suppliers.filter((supplier) =>
    isSupplierPendingGovernanceEvidence({
      supplier,
      evidenceAuthorityMode,
      evidenceChecklist: params.evidenceChecklist,
    }),
  );
}
