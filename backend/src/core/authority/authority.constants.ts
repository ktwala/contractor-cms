import { ContractorAuthorityMode, SupplierAuthorityMode } from '@prisma/client';

export { ContractorAuthorityMode, SupplierAuthorityMode };

export const SUPPLIER_MASTER_CREATION_FORBIDDEN =
  'SUPPLIER_MASTER_CREATION_FORBIDDEN';

/** Default modes for new tenants (portal-native product default). */
export const DEFAULT_SUPPLIER_AUTHORITY_MODE = SupplierAuthorityMode.CMS_ONLY;
export const DEFAULT_CONTRACTOR_AUTHORITY_MODE =
  ContractorAuthorityMode.CMS_ONLY;

/** Demo / Oracle-first client profile (seed). */
export const DEMO_CLIENT_SUPPLIER_AUTHORITY_MODE =
  SupplierAuthorityMode.ORACLE_ONLY;
/** Connector demo: HCM bootstraps identities; CMS owns contractor lifecycle after import. */
export const DEMO_CLIENT_CONTRACTOR_AUTHORITY_MODE =
  ContractorAuthorityMode.CMS_ONLY;

export type TenantAuthorityProfile = {
  supplierAuthorityMode: SupplierAuthorityMode;
  contractorAuthorityMode: ContractorAuthorityMode;
};
