/**
 * PR-RBAC-REALIGN-2/3 — canonical permission bundles for doctrine **target** system roles.
 * PR-FINANCE-RBAC-1 — finance-sensitive permissions are explicit grants (not implied by `*:*`).
 * PR-RBAC-REALIGN-3B — production governance + supplier portal role split.
 */
export const SEED_TARGET_ROLE_PERMISSIONS = {
  /**
   * Supplier portal administration — profile, users, documents, onboarding.
   * Not client `suppliers:*` or `contractor-migration:*`.
   */
  SUPPLIER_ADMIN: [
    'supplier-profile:read',
    'supplier-profile:update',
    'supplier-onboarding:read',
    'supplier-onboarding:submit',
    'supplier-documents:read',
    'supplier-documents:manage',
    'supplier-users:manage',
    'supplier-contractors:read',
    'supplier-contractors:create',
    'supplier-contractors:update',
    'supplier-invoices:read',
    'supplier-timesheets:read',
    'supplier-timesheets:manage',
    'profile:read',
    'profile:update',
  ],
  /**
   * Supplier operational work — contractors, timesheets, invoice visibility.
   * No profile/users/documents/onboarding admin.
   */
  SUPPLIER_MANAGER: [
    'supplier-profile:read',
    'supplier-documents:read',
    'supplier-contractors:read',
    'supplier-contractors:create',
    'supplier-contractors:update',
    'supplier-invoices:read',
    'supplier-timesheets:read',
    'supplier-timesheets:manage',
    'profile:read',
    'profile:update',
  ],
  /**
   * Demo-only when `RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED=true` (PR-SPONSOR-REFERENCE-ONLY-1).
   * Default doctrine: sponsor is HCM reference on engagement; IGA/workflow owns approvals.
   */
  SPONSOR: [
    'contractors:read',
    'engagements:read',
    'engagements:update',
    'responsible-manager-tasks:read',
    'responsible-manager-tasks:manage',
    'invoices:read',
  ],
} as const;

/** Finance officer — amounts, payment status, supplier banking/tax, approvals. */
export const FINANCE_ADMIN_PERMISSIONS = [
  'invoices:read',
  'invoices:create',
  'invoices:update',
  'invoices:approve',
  'invoices:export',
  'invoice-amounts:view',
  'invoice-payment-status:view',
  'supplier-finance:view',
  'supplier-bank-details:view',
  'suppliers:read',
  'contractors:read',
  'timesheets:read',
  'timesheets:approve',
  'withholding:read',
  'analytics:read',
  'pdp-activation:view',
  'pdp-exceptions:view',
] as const;

/**
 * PR-RBAC-REALIGN-3A/3B — ingestion/bootstrap operator (supplier sync + HCM bootstrap).
 * Read-only registry visibility (`suppliers:read`, `contractors:read`) — no approvals or CMS contractor ops.
 */
export const GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS = [
  'suppliers:read',
  'suppliers:sync',
  'suppliers:governance-scan',
  'contractor-migration:read',
  'contractors:read',
  'contractors:bootstrap',
  'contractors:governance-scan',
  'workforce:cutover-manage',
] as const;

/** PR-RBAC-REALIGN-3B — supplier operational trust only (no sync, no bootstrap). */
export const SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS = [
  'suppliers:read',
  'suppliers:approve',
  'suppliers:suspend',
] as const;

/**
 * PR-RBAC-REALIGN-3B — CMS contractor operational authority (post-bootstrap).
 * No supplier sync/approve or HCM bootstrap.
 */
export const CONTRACTOR_MANAGER_PERMISSIONS = [
  'contractors:create',
  'contractors:read',
  'contractors:update',
  'contractor-remediation:manage',
  'pdp-restrictions:manage',
  'engagements:create',
  'engagements:read',
  'engagements:update',
  'contracts:create',
  'contracts:read',
  'contracts:update',
  'timesheets:read',
  'timesheets:approve',
  'pdp-activation:view',
  'pdp-exceptions:view',
] as const;

/** Dedupe permission lists used by demo composite roles. */
function dedupePermissions<const T extends readonly string[]>(
  perms: T,
): readonly T[number][] {
  return [...new Set(perms)];
}

/**
 * PR-CTR-CONNECTOR-1G / PR-RBAC-REALIGN-3A — **demo UAT composite only** (NOT production).
 * @see docs/business/PLATFORM_GOVERNANCE_ROLES.md
 */
export const GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS = dedupePermissions([
  ...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS,
  ...SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS,
  ...CONTRACTOR_MANAGER_PERMISSIONS,
  'audit:read',
  'pdp-telemetry:view',
  'governance-analytics:view',
  'governance-risk:view',
] as const);

/** Human workflow tester — governance scan + remediation (no bootstrap ingest). */
export const GOVERNANCE_REVIEWER_PERMISSIONS = [
  'suppliers:read',
  'contractor-migration:read',
  'contractors:read',
  'contractors:governance-scan',
  'contractor-remediation:manage',
] as const;

/**
 * @deprecated PR-RBAC-REALIGN-3B — use CONTRACTOR_MANAGER; retained for transitional demos.
 */
export const CONTRACTOR_OPERATIONS_USER_PERMISSIONS = [
  ...CONTRACTOR_MANAGER_PERMISSIONS,
] as const;

/** Read-only governance oversight (merged GOVERNANCE_VIEWER surface). */
export const GOVERNANCE_AUDITOR_PERMISSIONS = [
  'suppliers:read',
  'contractors:read',
  'contractor-migration:read',
  'audit:read',
  'pdp-activation:view',
  'pdp-exceptions:view',
  'pdp-telemetry:view',
  'governance-analytics:view',
  'governance-risk:view',
  'invoices:read',
  'contracts:read',
  'engagements:read',
] as const;

/**
 * @deprecated PR-RBAC-REALIGN-3B — permissions merged into GOVERNANCE_AUDITOR.
 */
export const GOVERNANCE_VIEWER_PERMISSIONS = [...GOVERNANCE_AUDITOR_PERMISSIONS] as const;

export type SeedTargetDoctrineRoleName = keyof typeof SEED_TARGET_ROLE_PERMISSIONS;
