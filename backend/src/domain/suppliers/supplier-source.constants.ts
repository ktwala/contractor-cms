/** PR-CMS-OPERATIONS-1D0 — external supplier master systems. */
export const SUPPLIER_SOURCE_SYSTEMS = {
  CMS_NATIVE: 'CMS_NATIVE',
  ORACLE_SUPPLIER_SAAS: 'ORACLE_SUPPLIER_SAAS',
} as const;

export type SupplierSourceSystemCode =
  (typeof SUPPLIER_SOURCE_SYSTEMS)[keyof typeof SUPPLIER_SOURCE_SYSTEMS];

/**
 * Oracle Supplier SaaS is a source system for supplier facts — not the CMS governance authority.
 * For ORACLE_ONLY tenants, procurement onboarding evidence may be trusted upstream; CMS still
 * governs operational trust (approve to ACTIVE, suspend, PDP, remediation).
 */
export const ORACLE_SUPPLIER_RECONCILIATION_KEYS = [
  'externalSupplierId',
  'supplierNumber',
  'taxRegistrationNumber',
  'countryCode',
  'name',
] as const;
