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
    /** PR-CMS-OPERATIONS-1A — governed lifecycle transitions */
    SUBMIT_FOR_APPROVAL: 'suppliers:submit-for-approval',
    /** PR-CMS-AUTHORITY-1 — HYBRID intake only; never implied by `*:*` */
    GOVERNANCE_INTAKE: 'suppliers:governance-intake',
    APPROVE: 'suppliers:approve',
    SUSPEND: 'suppliers:suspend',
    OFFBOARD: 'suppliers:offboard',
    ARCHIVE: 'suppliers:archive',
    /** PR-RBAC-REALIGN-3A — Oracle import/sync/reconcile (not CMS supplier field edits). */
    SYNC: 'suppliers:sync',
    /** PR-RBAC-REALIGN-3A — drift detect/assign/resolve for supplier sources. */
    GOVERNANCE_SCAN: 'suppliers:governance-scan',
  },

  CONTRACTORS: {
    CREATE: 'contractors:create',
    READ: 'contractors:read',
    UPDATE: 'contractors:update',
    DELETE: 'contractors:delete',
    /** PR-RBAC-REALIGN-3A — HCM sync/import/materialize/promote (bootstrap path). */
    BOOTSTRAP: 'contractors:bootstrap',
    /** PR-RBAC-REALIGN-3A — workforce drift detect/assign/resolve. */
    GOVERNANCE_SCAN: 'contractors:governance-scan',
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
    EXPORT: 'invoices:export',
  },

  /** Sensitive invoice monetary fields (not implied by `*:*`). */
  INVOICE_AMOUNTS: {
    VIEW: 'invoice-amounts:view',
  },

  /** Payment dates, references, and paid-state detail (not implied by `*:*`). */
  INVOICE_PAYMENT_STATUS: {
    VIEW: 'invoice-payment-status:view',
  },

  /** Supplier financial summary fields (not implied by `*:*`). */
  SUPPLIER_FINANCE: {
    VIEW: 'supplier-finance:view',
  },

  /** Supplier banking / tax identifiers (not implied by `*:*`). */
  SUPPLIER_BANK_DETAILS: {
    VIEW: 'supplier-bank-details:view',
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

  PDP_ACTIVATION: {
    VIEW: 'pdp-activation:view',
    MANAGE: 'pdp-activation:manage',
  },

  PDP_EXCEPTIONS: {
    VIEW: 'pdp-exceptions:view',
    REQUEST: 'pdp-exceptions:request',
    MANAGE: 'pdp-exceptions:manage',
  },

  PDP_TELEMETRY: {
    VIEW: 'pdp-telemetry:view',
  },

  GOVERNANCE_ANALYTICS: {
    VIEW: 'governance-analytics:view',
    EXPORT: 'governance-analytics:export',
  },

  GOVERNANCE_RISK: {
    VIEW: 'governance-risk:view',
    MANAGE: 'governance-risk:manage',
  },

  /** PR-EXTID-EVENT-FEED-1 — integration pull API (IGA/middleware consumes; CMS does not execute IGA). */
  EXTID_EVENTS: {
    READ: 'extid-events:read',
    ACK: 'extid-events:ack',
    FAIL: 'extid-events:fail',
  },

  /**
   * PR-SUPPLIER-SCOPING-1 — supplier-portal scope (row-level via SupplierMembership).
   * Client-side procurement uses `suppliers:*`; supplier users use `supplier-*` only.
   */
  SUPPLIER_PROFILE: {
    READ: 'supplier-profile:read',
    UPDATE: 'supplier-profile:update',
  },
  SUPPLIER_USERS: {
    MANAGE: 'supplier-users:manage',
  },
  /** Supplier-portal contractor CRUD (membership-scoped; not client `contractors:*`). */
  SUPPLIER_CONTRACTORS: {
    READ: 'supplier-contractors:read',
    CREATE: 'supplier-contractors:create',
    UPDATE: 'supplier-contractors:update',
  },
  SUPPLIER_TIMESHEETS: {
    READ: 'supplier-timesheets:read',
    /** Operational submit/manage for supplier-scoped timesheets (portal). */
    MANAGE: 'supplier-timesheets:manage',
    /** @deprecated PR-RBAC-REALIGN-3B — prefer supplier-timesheets:manage */
    SUBMIT: 'supplier-timesheets:submit',
  },
  /** PR-CMS-OPERATIONS-1D2 — portal onboarding checklist and approval submission. */
  SUPPLIER_ONBOARDING: {
    READ: 'supplier-onboarding:read',
    SUBMIT: 'supplier-onboarding:submit',
  },
  /** PR-CMS-OPERATIONS-1D2 — portal evidence document metadata (membership-scoped). */
  SUPPLIER_DOCUMENTS: {
    READ: 'supplier-documents:read',
    MANAGE: 'supplier-documents:manage',
  },
  SUPPLIER_INVOICES: {
    READ: 'supplier-invoices:read',
    SUBMIT: 'supplier-invoices:submit',
  },

  /** PR-SPONSOR-TASKS-1 — sponsor accountability inbox (row-scoped by HCM employee id). */
  RESPONSIBLE_MANAGER_TASKS: {
    READ: 'responsible-manager-tasks:read',
    MANAGE: 'responsible-manager-tasks:manage',
  },

  /** PR-CTR-6 — HCM contractor migration control plane (staging / quarantine / promote). */
  CONTRACTOR_MIGRATION: {
    READ: 'contractor-migration:read',
    /** @deprecated PR-RBAC-REALIGN-3A — use contractors:bootstrap, contractors:governance-scan, workforce:cutover-manage, contractor-remediation:manage */
    MANAGE: 'contractor-migration:manage',
  },

  /** PR-RBAC-REALIGN-3A — workforce migration cutover ceremony + bootstrap decay. */
  WORKFORCE: {
    CUTOVER_MANAGE: 'workforce:cutover-manage',
  },

  /** PR-RBAC-REALIGN-3A — operational remediation lifecycle (not bootstrap ingest). */
  CONTRACTOR_REMEDIATION: {
    MANAGE: 'contractor-remediation:manage',
  },

  /** PR-RBAC-REALIGN-3A — PDP activation + exception resolution (union manage surface). */
  PDP_RESTRICTIONS: {
    MANAGE: 'pdp-restrictions:manage',
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

/** Supplier portal contractor route permissions (PR-SUPPLIER-RESOURCE-ALIAS-REMOVAL-1). */
export const SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS = {
  READ: [PERMISSIONS.SUPPLIER_CONTRACTORS.READ] as const,
  CREATE: [PERMISSIONS.SUPPLIER_CONTRACTORS.CREATE] as const,
  UPDATE: [PERMISSIONS.SUPPLIER_CONTRACTORS.UPDATE] as const,
};

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
