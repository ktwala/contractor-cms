import { PERMISSIONS, type Permission } from './permissions.generated';

/** Legacy demo role name — not required for production sponsor scope (PR-HCM-SPONSOR-USERS-1). */
export const BUSINESS_RESPONSIBLE_MANAGER_ROLE = 'SPONSOR';

export const BUSINESS_RESPONSIBLE_MANAGER_NAV_LABELS = {
  contractors: 'Managed external workers',
  engagements: 'My managed engagements',
  tasks: 'My responsible manager accountability',
} as const;

function hasResponsibleManagerScopeReadPermissions(can: (p: Permission) => boolean): boolean {
  return (
    can(PERMISSIONS.CONTRACTORS.READ) && can(PERMISSIONS.ENGAGEMENTS.READ)
  );
}

/**
 * Internal HCM-linked user in sponsor accountability inbox view (scoped lists + nav labels).
 * Requires `RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED` on the API (default off — PR-SPONSOR-REFERENCE-ONLY-1).
 */
export function isHcmLinkedResponsibleManagerView(
  user:
    | {
        externalId?: string | null;
        responsibleManagerAccountabilityInboxEnabled?: boolean;
      }
    | null
    | undefined,
  can: (permission: Permission) => boolean,
): boolean {
  if (!user?.responsibleManagerAccountabilityInboxEnabled) {
    return false;
  }
  if (!user?.externalId?.trim()) {
    return false;
  }
  if (!hasResponsibleManagerScopeReadPermissions(can)) {
    return false;
  }
  if (can(PERMISSIONS.SUPPLIER_PROFILE.READ)) {
    return false;
  }
  return true;
}

/** @deprecated Use isHcmLinkedResponsibleManagerView */
export function isBusinessResponsibleManagerUser(
  hasRole: (roleName: string) => boolean,
  can: (permission: Permission) => boolean,
): boolean {
  void hasRole;
  return (
    hasResponsibleManagerScopeReadPermissions(can) &&
    !can(PERMISSIONS.SUPPLIERS.READ) &&
    !can(PERMISSIONS.USERS.READ)
  );
}
