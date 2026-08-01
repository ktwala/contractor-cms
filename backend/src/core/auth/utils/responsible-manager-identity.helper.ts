import { WILDCARD_ALL, WILDCARD_ACTION } from '../permissions.constants';

/**
 * PR-HCM-SPONSOR-USERS-1 — minimum permissions before HCM-linked row scope applies.
 * Scope is identity-derived (User.externalId ↔ engagement.responsibleManagerEmployeeId), not role-named.
 */
export const SPONSOR_SCOPE_READ_PERMISSIONS = [
  'contractors:read',
  'engagements:read',
] as const;

function permissionGranted(
  userPermissions: Set<string>,
  required: string,
): boolean {
  if (userPermissions.has(WILDCARD_ALL)) {
    return true;
  }
  if (userPermissions.has(required)) {
    return true;
  }
  const [resource] = required.split(':');
  return userPermissions.has(`${resource}:${WILDCARD_ACTION}`);
}

/** True when the actor may use responsible-manager-scoped contractor/engagement reads. */
export function hasResponsibleManagerScopePermissions(
  userPermissions: Set<string>,
): boolean {
  return SPONSOR_SCOPE_READ_PERMISSIONS.every((perm) =>
    permissionGranted(userPermissions, perm),
  );
}

/**
 * HCM employee reference for sponsor row filters on AccessContext.
 * Requires internal user, non-global access, externalId, and sponsor-capable read permissions.
 */
export function resolveSponsorEmployeeId(input: {
  externalId: string | null | undefined;
  userType: string;
  isGlobalAccess: boolean;
  userPermissions: Set<string>;
}): string | null {
  if (input.isGlobalAccess) {
    return null;
  }
  if (input.userType !== 'INTERNAL') {
    return null;
  }
  const ref = input.externalId?.trim();
  if (!ref) {
    return null;
  }
  if (!hasResponsibleManagerScopePermissions(input.userPermissions)) {
    return null;
  }
  return ref;
}
