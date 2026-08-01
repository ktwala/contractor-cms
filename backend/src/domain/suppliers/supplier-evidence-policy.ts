import {
  SupplierAuthorityMode,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
} from '@prisma/client';

/**
 * How CMS treats onboarding evidence relative to upstream procurement.
 *
 * - CMS_FULL: CMS catalog documents required before operational trust
 * - ORACLE_PROCUREMENT_TRUSTED: synced Oracle-linked suppliers inherit procurement onboarding
 * - CMS_SUPPLEMENTAL: hybrid tenants — CMS adds checks on top of upstream (future refinement)
 */
export type SupplierEvidenceAuthorityMode =
  | 'CMS_FULL'
  | 'ORACLE_PROCUREMENT_TRUSTED'
  | 'CMS_SUPPLEMENTAL';

export function resolveSupplierEvidenceAuthorityMode(
  supplierAuthorityMode: SupplierAuthorityMode,
): SupplierEvidenceAuthorityMode {
  switch (supplierAuthorityMode) {
    case SupplierAuthorityMode.ORACLE_ONLY:
      return 'ORACLE_PROCUREMENT_TRUSTED';
    case SupplierAuthorityMode.HYBRID:
      return 'CMS_SUPPLEMENTAL';
    default:
      return 'CMS_FULL';
  }
}

export function isProcurementEvidenceTrusted(params: {
  evidenceAuthorityMode: SupplierEvidenceAuthorityMode;
  sourceSystem: SupplierSourceSystem;
  externalSupplierId: string | null;
  sourceSyncStatus: SupplierSourceSyncStatus | null;
}): boolean {
  return (
    params.evidenceAuthorityMode === 'ORACLE_PROCUREMENT_TRUSTED' &&
    params.sourceSystem === SupplierSourceSystem.ORACLE_SUPPLIER_SAAS &&
    params.externalSupplierId != null &&
    params.sourceSyncStatus === SupplierSourceSyncStatus.SYNCED
  );
}
