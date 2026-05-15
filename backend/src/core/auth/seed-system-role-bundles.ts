/**
 * PR-RBAC-REALIGN-2 — canonical permission bundles for doctrine **target** system roles.
 * Single source used by `prisma/seed.ts` upserts and unit tests (no portal / sponsor runtime).
 */
export const SEED_TARGET_ROLE_PERMISSIONS = {
  SUPPLIER_ADMIN: [
    'suppliers:create',
    'suppliers:read',
    'suppliers:update',
    'suppliers:delete',
  ],
  SUPPLIER_MANAGER: [
    'suppliers:read',
    'suppliers:update',
    'timesheets:read',
    'timesheets:approve',
  ],
  SPONSOR: ['contractors:read', 'engagements:read', 'engagements:update'],
} as const;

export type SeedTargetDoctrineRoleName = keyof typeof SEED_TARGET_ROLE_PERMISSIONS;
