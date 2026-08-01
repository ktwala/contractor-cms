import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  WILDCARD_ACTION,
  WILDCARD_ALL,
} from '../permissions.constants';

/**
 * Finance-sensitive permissions are never granted implicitly by platform `*:*`.
 * CMS operators must be explicitly assigned finance capabilities (PR-FINANCE-RBAC-1).
 */
export const FINANCE_SENSITIVE_PERMISSIONS: ReadonlySet<string> = new Set([
  PERMISSIONS.SUPPLIER_FINANCE.VIEW,
  PERMISSIONS.SUPPLIER_BANK_DETAILS.VIEW,
  PERMISSIONS.INVOICE_AMOUNTS.VIEW,
  PERMISSIONS.INVOICE_PAYMENT_STATUS.VIEW,
  PERMISSIONS.INVOICES.APPROVE,
  PERMISSIONS.INVOICES.EXPORT,
]);

/** Never granted implicitly by platform `*:*` (PR-CMS-AUTHORITY-1). */
export const AUTHORITY_SENSITIVE_PERMISSIONS: ReadonlySet<string> = new Set([
  PERMISSIONS.SUPPLIERS.GOVERNANCE_INTAKE,
]);

export function isFinanceSensitivePermission(permission: string): boolean {
  return FINANCE_SENSITIVE_PERMISSIONS.has(permission);
}

export function isAuthoritySensitivePermission(permission: string): boolean {
  return AUTHORITY_SENSITIVE_PERMISSIONS.has(permission);
}

export function requiresExplicitGrant(permission: string): boolean {
  return (
    isFinanceSensitivePermission(permission) ||
    isAuthoritySensitivePermission(permission)
  );
}

/**
 * PR-RBAC-REALIGN-3B — portal alias: manage satisfies legacy submit on supplier timesheet routes.
 */
const PORTAL_PERMISSION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  [PERMISSIONS.SUPPLIER_TIMESHEETS.SUBMIT]: [PERMISSIONS.SUPPLIER_TIMESHEETS.MANAGE],
  [PERMISSIONS.PDP_ACTIVATION.MANAGE]: [PERMISSIONS.PDP_RESTRICTIONS.MANAGE],
  [PERMISSIONS.PDP_EXCEPTIONS.MANAGE]: [PERMISSIONS.PDP_RESTRICTIONS.MANAGE],
};

function hasPermissionOrAlias(
  userPermissions: ReadonlySet<string>,
  required: string,
): boolean {
  if (userPermissions.has(required)) {
    return true;
  }
  const aliases = PORTAL_PERMISSION_ALIASES[required];
  return aliases?.some((alias) => userPermissions.has(alias)) ?? false;
}

/**
 * Returns true when `userPermissions` satisfies `required`.
 * `*:*` grants all non-finance-sensitive permissions; finance requires explicit grant.
 */
export function permissionSatisfied(
  userPermissions: ReadonlySet<string>,
  required: string,
): boolean {
  if (!required.includes(':')) {
    return false;
  }

  if (hasPermissionOrAlias(userPermissions, required)) {
    return true;
  }

  if (userPermissions.has(WILDCARD_ALL)) {
    return !requiresExplicitGrant(required);
  }

  const [requiredResource] = required.split(':');
  const resourceWildcard = `${requiredResource}:${WILDCARD_ACTION}`;
  if (userPermissions.has(resourceWildcard)) {
    return !requiresExplicitGrant(required);
  }

  return false;
}

/**
 * Expands role wildcards for profile/UI checks. Finance-sensitive permissions
 * are included only when explicitly listed on a role.
 */
export function expandEffectivePermissions(rawPermissions: Iterable<string>): string[] {
  const raw = new Set(rawPermissions);
  const resolved = new Set<string>();

  const addExplicitSensitiveFromRaw = () => {
    for (const perm of raw) {
      if (requiresExplicitGrant(perm)) {
        resolved.add(perm);
      }
    }
  };

  if (raw.has(WILDCARD_ALL)) {
    for (const catalogPerm of ALL_PERMISSIONS) {
      if (!requiresExplicitGrant(catalogPerm)) {
        resolved.add(catalogPerm);
      }
    }
    addExplicitSensitiveFromRaw();
    return Array.from(resolved).sort();
  }

  for (const perm of raw) {
    if (perm.endsWith(`:${WILDCARD_ACTION}`)) {
      const resource = perm.split(':')[0];
      for (const catalogPerm of ALL_PERMISSIONS) {
        if (
          catalogPerm.startsWith(`${resource}:`) &&
          !requiresExplicitGrant(catalogPerm)
        ) {
          resolved.add(catalogPerm);
        }
      }
      for (const catalogPerm of ALL_PERMISSIONS) {
        if (
          catalogPerm.startsWith(`${resource}:`) &&
          requiresExplicitGrant(catalogPerm) &&
          raw.has(catalogPerm)
        ) {
          resolved.add(catalogPerm);
        }
      }
    } else {
      resolved.add(perm);
    }
  }

  return Array.from(resolved).sort();
}

export function buildPermissionSetFromRoles(
  roles: Array<{ role?: { permissions?: string[] } }>,
): Set<string> {
  return new Set(
    roles.flatMap((userRole) => userRole.role?.permissions ?? []),
  );
}
