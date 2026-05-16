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

  it('SUPPLIER_ADMIN uses supplier-portal scoped permissions only', () => {
    expectCatalogAndNoDupes('SUPPLIER_ADMIN');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).toEqual([
      'supplier-profile:read',
      'supplier-profile:update',
      'supplier-users:manage',
      'supplier-resources:read',
      'supplier-resources:create',
      'profile:read',
      'profile:update',
    ]);
    for (const forbidden of [...ORG_WIDE_FINANCIAL, 'suppliers:read', 'contractors:read']) {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain(forbidden);
    }
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain('engagements:read');
  });

  it('SUPPLIER_MANAGER uses supplier-portal scoped permissions (no client-wide modules)', () => {
    expectCatalogAndNoDupes('SUPPLIER_MANAGER');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).toEqual([
      'supplier-profile:read',
      'supplier-resources:read',
      'supplier-resources:create',
      'supplier-timesheets:read',
      'supplier-timesheets:submit',
      'profile:read',
      'profile:update',
    ]);
    for (const forbidden of [...ORG_WIDE_FINANCIAL, 'suppliers:read', 'timesheets:read']) {
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
