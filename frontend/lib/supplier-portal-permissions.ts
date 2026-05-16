import { PERMISSIONS, type Permission } from './permissions.generated';

/** Supplier portal contractor permissions (PR-SUPPLIER-RESOURCE-ALIAS-REMOVAL-1). */
export const SUPPLIER_PORTAL_CONTRACTOR_READ: Permission =
  PERMISSIONS.SUPPLIER_CONTRACTORS.READ;

export const SUPPLIER_PORTAL_CONTRACTOR_CREATE: Permission =
  PERMISSIONS.SUPPLIER_CONTRACTORS.CREATE;

export function canAccessSupplierPortalContractors(
  can: (p: Permission) => boolean,
): boolean {
  return can(SUPPLIER_PORTAL_CONTRACTOR_READ);
}

export function canCreateSupplierPortalContractor(
  can: (p: Permission) => boolean,
): boolean {
  return can(SUPPLIER_PORTAL_CONTRACTOR_CREATE);
}
