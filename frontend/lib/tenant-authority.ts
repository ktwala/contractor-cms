/** PR-CMS-AUTHORITY-1 — tenant authority modes from auth profile. */

export type SupplierAuthorityMode = 'CMS_ONLY' | 'ORACLE_ONLY' | 'HYBRID';
export type ContractorAuthorityMode = 'CMS_ONLY' | 'HCM_ONLY' | 'HYBRID';

export type TenantAuthorityProfile = {
  supplierAuthorityMode: SupplierAuthorityMode;
  contractorAuthorityMode: ContractorAuthorityMode;
};

export function isOracleSupplierAuthority(
  authority?: TenantAuthorityProfile | null,
): boolean {
  return authority?.supplierAuthorityMode === 'ORACLE_ONLY';
}

/** Supplier sync / Oracle Procurement ingestion (ORACLE_ONLY + HYBRID). */
export function usesOracleSupplierConnector(
  authority?: TenantAuthorityProfile | null,
): boolean {
  const mode = authority?.supplierAuthorityMode;
  return mode === 'ORACLE_ONLY' || mode === 'HYBRID';
}

/** HCM workforce bootstrap surface (import + CMS materialization). */
export function usesHcmContractorConnector(
  authority?: TenantAuthorityProfile | null,
): boolean {
  const mode = authority?.contractorAuthorityMode;
  return mode === 'HCM_ONLY' || mode === 'HYBRID' || mode === 'CMS_ONLY';
}

export function canCreateSupplierMaster(
  authority?: TenantAuthorityProfile | null,
): boolean {
  return !isOracleSupplierAuthority(authority);
}

/** Client suppliers list — create action label. */
export function supplierMasterCreateLabel(
  authority?: TenantAuthorityProfile | null,
): string {
  if (isOracleSupplierAuthority(authority)) {
    return 'Import from Oracle';
  }
  return 'Add Supplier';
}

/** Supplier portal — primary onboarding headline. */
export function supplierPortalProfileTitle(
  authority?: TenantAuthorityProfile | null,
): string {
  if (isOracleSupplierAuthority(authority)) {
    return 'Complete compliance profile';
  }
  return 'Supplier profile';
}

export function supplierPortalProfileDescription(
  authority?: TenantAuthorityProfile | null,
): string {
  if (isOracleSupplierAuthority(authority)) {
    return 'Your supplier master is maintained in Oracle Procurement. Complete governance evidence here to enable contractor and timesheet operations.';
  }
  return 'View and update your supplier organization details for this membership.';
}
