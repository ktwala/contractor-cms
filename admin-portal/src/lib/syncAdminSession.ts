import api from '../services/api';

/** Dispatched after localStorage permission snapshot is updated (see `useAccess`). */
export const ADMIN_PERMISSIONS_SYNCED_EVENT = 'admin-permissions-synced';

export type AuthMeResponse = {
  user_id: string;
  roles: string[];
  permissions: string[];
  legal_entity_access?: string[];
};

/**
 * Persist `/auth/me` (or login `user`) payload into the same keys the admin shell expects.
 * Dispatches a window event so `useAccess` re-reads storage without a full reload.
 */
export function persistAuthMeToStorage(me: AuthMeResponse): void {
  if (typeof window === 'undefined') return;
  const role = Array.isArray(me.roles) && me.roles.length > 0 ? me.roles[0] : '';
  localStorage.setItem('user_id', me.user_id);
  localStorage.setItem('role', role);
  localStorage.setItem('admin_permissions', JSON.stringify(me.permissions ?? []));
  window.dispatchEvent(new CustomEvent(ADMIN_PERMISSIONS_SYNCED_EVENT));
}

/**
 * Refresh roles + permissions from the backend (RBAC v1.1 via JwtStrategy validate path).
 * Safe to call on every admin shell mount; failures are silent so offline/bootstrap flows still render.
 */
export async function refreshAdminSessionFromApi(): Promise<boolean> {
  try {
    const { data } = await api.get<AuthMeResponse>('/auth/me');
    if (!data?.user_id || !Array.isArray(data.permissions)) return false;
    persistAuthMeToStorage(data);
    return true;
  } catch {
    return false;
  }
}
