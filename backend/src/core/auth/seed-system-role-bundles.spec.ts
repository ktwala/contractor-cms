import {
  SEED_TARGET_ROLE_PERMISSIONS,
  type SeedTargetDoctrineRoleName,
} from './seed-system-role-bundles';
import { isKnownPermission } from './permissions.constants';

describe('PR-RBAC-REALIGN-2: seed target role bundles', () => {
  const ORG_WIDE_FINANCIAL = ['invoices:read', 'invoices:create', 'invoices:approve'];

  function expectCatalogAndNoDupes(role: SeedTargetDoctrineRoleName) {
    const perms = [...SEED_TARGET_ROLE_PERMISSIONS[role]];
    expect(new Set(perms).size).toBe(perms.length);
    for (const p of perms) {
      expect(isKnownPermission(p)).toBe(true);
    }
  }

  it('SUPPLIER_ADMIN matches expected suppliers-only bundle', () => {
    expectCatalogAndNoDupes('SUPPLIER_ADMIN');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).toEqual([
      'suppliers:create',
      'suppliers:read',
      'suppliers:update',
      'suppliers:delete',
    ]);
    for (const forbidden of ORG_WIDE_FINANCIAL) {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain(forbidden);
    }
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain('engagements:read');
  });

  it('SUPPLIER_MANAGER matches expected bundle (suppliers + timesheet oversight, no invoices)', () => {
    expectCatalogAndNoDupes('SUPPLIER_MANAGER');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).toEqual([
      'suppliers:read',
      'suppliers:update',
      'timesheets:read',
      'timesheets:approve',
    ]);
    for (const forbidden of ORG_WIDE_FINANCIAL) {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).not.toContain(forbidden);
    }
  });

  it('SPONSOR matches expected placement bundle (no supplier portal, no invoices)', () => {
    expectCatalogAndNoDupes('SPONSOR');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).toEqual([
      'contractors:read',
      'engagements:read',
      'engagements:update',
    ]);
    for (const forbidden of ORG_WIDE_FINANCIAL) {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).not.toContain(forbidden);
    }
    expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).not.toContain('suppliers:read');
  });
});
