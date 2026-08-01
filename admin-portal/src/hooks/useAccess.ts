/**
 * useAccess — frontend access helper for RBAC-aligned UI.
 * Reads token, role, and (when available) permissions from storage.
 * "Hide what you can't do. Disable what you might do later. Explain why."
 */

import * as React from 'react';
import { ADMIN_PERMISSIONS_SYNCED_EVENT } from '../lib/syncAdminSession';

const STORAGE_KEYS = {
  token: 'token',
  role: 'role',
  permissions: 'admin_permissions',
} as const;

function getStoredPermissions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.permissions);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Returns true if the user has at least one of the given permissions.
 * When backend does not yet send permissions: treats legacy admin role as having all access.
 */
export function canAny(permissions: string[]): boolean {
  if (permissions.length === 0) return true;
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (!token) return false;

  const role = (localStorage.getItem(STORAGE_KEYS.role) || '').toUpperCase();
  const legacyFullAccess = ['PLATFORM_SUPERADMIN'].includes(role);
  if (legacyFullAccess) return true;

  const stored = getStoredPermissions();
  if (stored.length > 0) return permissions.some((p) => stored.includes(p));
  return false;
}

/**
 * Returns true if the user has the given permission.
 */
export function can(permission: string): boolean {
  return canAny([permission]);
}

export function useAccess() {
  const [syncTick, setSyncTick] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const bump = () => setSyncTick((n) => n + 1);
    window.addEventListener(ADMIN_PERMISSIONS_SYNCED_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(ADMIN_PERMISSIONS_SYNCED_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  void syncTick;
  const token = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.token) : null;
  const role = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.role) : null;
  const permissions = typeof window !== 'undefined' ? getStoredPermissions() : [];

  const isAuthenticated = !!token;

  return {
    isAuthenticated,
    role: role ?? null,
    permissions,
    can,
    canAny,
  };
}
