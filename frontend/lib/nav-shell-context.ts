import { PERMISSIONS, type Permission } from './permissions.generated';
import { isSupplierPortalUser } from './supplier-portal-modules';

export type NavShell = 'internal' | 'supplier-portal';

export const SUPPLIER_PORTAL_PATH_PREFIX = '/supplier-portal';

export type NavShellOptions = {
  /** Explicit supplier-portal preview (future impersonation / support mode). */
  supplierPortalPreview?: boolean;
};

export function isSupplierPortalRoute(path: string): boolean {
  return path.startsWith(SUPPLIER_PORTAL_PATH_PREFIX);
}

/**
 * PR-SHELL-NAV-CONTEXT-1 — navigation shell follows actor context, not URL prefix.
 * Internal platform operators keep the full menu even when visiting `/supplier-portal/*`.
 */
export function resolveNavShell(
  can: (permission: Permission) => boolean,
  options?: NavShellOptions,
): NavShell {
  if (options?.supplierPortalPreview) {
    return 'supplier-portal';
  }
  if (isSupplierPortalUser(can)) {
    return 'supplier-portal';
  }
  return 'internal';
}

/** Internal operators with client-wide supplier module access. */
export function isInternalCmsOperator(can: (permission: Permission) => boolean): boolean {
  return can(PERMISSIONS.SUPPLIERS.READ) || can(PERMISSIONS.USERS.READ);
}
