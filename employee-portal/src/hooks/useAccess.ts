/**
 * useAccess — frontend access helper for employee self-service (RBAC-aligned).
 * "Hide what you can't do. Disable what you might do later. Explain why."
 */

import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY_PERMISSIONS = 'employee_permissions';

function getStoredPermissions(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERMISSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Returns true if the user has at least one of the given permissions.
 * When backend does not yet send permissions: authenticated users see all self-service nav.
 */
export function canAny(permissions: string[], isAuthenticated: boolean): boolean {
  if (!isAuthenticated) return false;
  if (permissions.length === 0) return true;
  const stored = getStoredPermissions();
  if (stored.length === 0) return true;
  return permissions.some((p) => stored.includes(p));
}

/**
 * Returns true if the user has the given permission.
 */
export function can(permission: string, isAuthenticated: boolean): boolean {
  return canAny([permission], isAuthenticated);
}

export function useAccess() {
  const { isAuthenticated } = useAuth();
  const permissions = getStoredPermissions();

  return {
    isAuthenticated,
    permissions,
    can: (permission: string) => can(permission, isAuthenticated),
    canAny: (perms: string[]) => canAny(perms, isAuthenticated),
  };
}
