export const RISK_MAP: Record<string, string> = {
  USER_ROLE_ASSIGNED: 'medium',
  USER_ROLE_REMOVED: 'medium',
  CMS_ADMIN_ASSIGNED: 'critical', // Special mapping for highly privileged roles
  ROLE_UPDATED: 'high',
  ROLE_DELETED: 'high',
  USER_DEACTIVATED: 'high',
  AUDIT_EXPORTED: 'high',
  LOGIN_FAILED: 'medium',
} as const;

/**
 * Returns a deterministic risk level for an audit action.
 * Defaults to 'low' for unknown or standard actions.
 */
export const getRiskLevel = (action: string): string => {
  return RISK_MAP[action] ?? 'low';
};
