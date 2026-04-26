/**
 * Canonical Permission Catalog
 *
 * This is the SINGLE SOURCE OF TRUTH for all permissions in the system.
 * Every @Permissions() decorator value and every seeded role permission
 * MUST reference a value defined here.
 *
 * Format: `resource:action`
 * Wildcards: `*:*` (all resources, all actions), `resource:*` (all actions on a resource)
 *
 * CI tests enforce that:
 * 1. Every @Permissions() decorator value exists in this catalog
 * 2. Every seeded role permission exists in this catalog (or is a wildcard)
 * 3. Every controller has @Permissions() on its handlers
 */

// ---------------------------------------------------------------------------
// Wildcard constants
// ---------------------------------------------------------------------------

/** Grants access to ALL permissions across ALL resources. */
export const WILDCARD_ALL = '*:*';

/** Wildcard action segment — used in `resource:*` patterns. */
export const WILDCARD_ACTION = '*';

// ---------------------------------------------------------------------------
// Permission catalog — grouped by resource
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  SUPPLIERS: {
    CREATE: 'suppliers:create',
    READ: 'suppliers:read',
    UPDATE: 'suppliers:update',
    DELETE: 'suppliers:delete',
  },

  CONTRACTORS: {
    CREATE: 'contractors:create',
    READ: 'contractors:read',
    UPDATE: 'contractors:update',
    DELETE: 'contractors:delete',
  },

  CONTRACTS: {
    CREATE: 'contracts:create',
    READ: 'contracts:read',
    UPDATE: 'contracts:update',
    DELETE: 'contracts:delete',
  },

  ENGAGEMENTS: {
    CREATE: 'engagements:create',
    READ: 'engagements:read',
    UPDATE: 'engagements:update',
    DELETE: 'engagements:delete',
  },

  TIMESHEETS: {
    CREATE: 'timesheets:create',
    READ: 'timesheets:read',
    UPDATE: 'timesheets:update',
    DELETE: 'timesheets:delete',
    SUBMIT: 'timesheets:submit',
    APPROVE: 'timesheets:approve',
  },

  INVOICES: {
    CREATE: 'invoices:create',
    READ: 'invoices:read',
    UPDATE: 'invoices:update',
    DELETE: 'invoices:delete',
    SUBMIT: 'invoices:submit',
    APPROVE: 'invoices:approve',
  },

  TAX_CLASSIFICATIONS: {
    CREATE: 'tax-classifications:create',
    READ: 'tax-classifications:read',
    UPDATE: 'tax-classifications:update',
    DELETE: 'tax-classifications:delete',
    APPROVE: 'tax-classifications:approve',
  },

  WITHHOLDING: {
    CREATE: 'withholding:create',
    READ: 'withholding:read',
    UPDATE: 'withholding:update',
    DELETE: 'withholding:delete',
  },

  PROJECTS: {
    CREATE: 'projects:create',
    READ: 'projects:read',
    UPDATE: 'projects:update',
    DELETE: 'projects:delete',
  },

  ORGANIZATIONS: {
    CREATE: 'organizations:create',
    READ: 'organizations:read',
    UPDATE: 'organizations:update',
  },

  ANALYTICS: {
    READ: 'analytics:read',
  },

  PROFILE: {
    READ: 'profile:read',
    UPDATE: 'profile:update',
  },

  USERS: {
    CREATE: 'users:create',
    READ: 'users:read',
    UPDATE: 'users:update',
    DEACTIVATE: 'users:deactivate',
  },

  ROLES: {
    CREATE: 'roles:create',
    READ: 'roles:read',
    UPDATE: 'roles:update',
    DELETE: 'roles:delete',
    ASSIGN: 'roles:assign',
  },

  AUDIT: {
    READ: 'audit:read',
  },
} as const;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Flat array of every explicit permission string in the catalog. */
const _allPermissions: string[] = Object.values(PERMISSIONS).flatMap(
  (resource) => Object.values(resource),
);

/** Read-only set for O(1) membership checks. */
export const ALL_PERMISSIONS: ReadonlySet<string> = new Set(_allPermissions);

/**
 * Grouped permissions for UI display (role editor, permission picker).
 * Each group has a resource key, a human-readable label, and its actions.
 */
export const PERMISSION_GROUPS = Object.entries(PERMISSIONS).map(
  ([resource, actions]) => ({
    resource,
    label: resource.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    permissions: Object.entries(actions).map(([action, value]) => ({
      action,
      value,
      label: action.charAt(0) + action.slice(1).toLowerCase(),
    })),
  }),
);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Valid permission format: `word:word` (alphanumeric + hyphens). */
const PERMISSION_FORMAT = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const WILDCARD_FORMAT = /^(\*:\*|[a-z][a-z0-9-]*:\*)$/;

/**
 * Returns true if `perm` is a well-formed permission string.
 * Accepts both explicit permissions (`suppliers:create`) and
 * wildcards (`*:*`, `suppliers:*`).
 */
export function isValidPermissionFormat(perm: string): boolean {
  return PERMISSION_FORMAT.test(perm) || WILDCARD_FORMAT.test(perm);
}

/**
 * Returns true if `perm` exists in the canonical catalog OR is a valid wildcard.
 */
export function isKnownPermission(perm: string): boolean {
  if (perm === WILDCARD_ALL) return true;
  if (perm.endsWith(`:${WILDCARD_ACTION}`)) {
    // Resource wildcard — check that at least one catalog perm starts with that resource
    const resource = perm.split(':')[0];
    return Array.from(ALL_PERMISSIONS).some((p) => p.startsWith(`${resource}:`));
  }
  return ALL_PERMISSIONS.has(perm);
}
