/**
 * PR-RBAC-REALIGN-2 — canonical permission bundles for doctrine **target** system roles.
 * Single source used by `prisma/seed.ts` upserts and unit tests (no portal / sponsor runtime).
 */
export const SEED_TARGET_ROLE_PERMISSIONS = {
  /** Own supplier profile + users + supplier-scoped contractors only (membership row-scoped). */
  SUPPLIER_ADMIN: [
    'supplier-profile:read',
    'supplier-profile:update',
    'supplier-users:manage',
    'supplier-contractors:read',
    'supplier-contractors:create',
    'supplier-contractors:update',
    'profile:read',
    'profile:update',
  ],
  /** Operational supplier scope — timesheets for own contractors, no client-wide modules. */
  SUPPLIER_MANAGER: [
    'supplier-profile:read',
    'supplier-contractors:read',
    'supplier-contractors:create',
    'supplier-timesheets:read',
    'supplier-timesheets:submit',
    'profile:read',
    'profile:update',
  ],
  SPONSOR: ['contractors:read', 'engagements:read', 'engagements:update'],
} as const;

export type SeedTargetDoctrineRoleName = keyof typeof SEED_TARGET_ROLE_PERMISSIONS;
