import {
  SEED_TARGET_ROLE_PERMISSIONS,
  SeedTargetDoctrineRoleName,
} from './seed-system-role-bundles';
import { ALL_PERMISSIONS } from './permissions.constants';

function expectCatalogAndNoDupes(role: SeedTargetDoctrineRoleName) {
  const perms = [...SEED_TARGET_ROLE_PERMISSIONS[role]];
  expect(new Set(perms).size).toBe(perms.length);
  perms.forEach((p) => expect(ALL_PERMISSIONS.has(p)).toBe(true));
}

describe('SEED_TARGET_ROLE_PERMISSIONS (PR-RBAC-REALIGN-2)', () => {
  it('SUPPLIER_ADMIN uses supplier-portal scoped permissions only', () => {
    expectCatalogAndNoDupes('SUPPLIER_ADMIN');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).toEqual([
      'supplier-profile:read',
      'supplier-profile:update',
      'supplier-users:manage',
      'supplier-contractors:read',
      'supplier-contractors:create',
      'supplier-contractors:update',
      'profile:read',
      'profile:update',
    ]);
    const forbidden = ['suppliers:read', 'contractors:read', 'timesheets:read'];
    forbidden.forEach((f) => {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain(f);
    });
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain('engagements:read');
  });

  it('SUPPLIER_MANAGER uses supplier-portal scoped permissions (no client-wide modules)', () => {
    expectCatalogAndNoDupes('SUPPLIER_MANAGER');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).toEqual([
      'supplier-profile:read',
      'supplier-contractors:read',
      'supplier-contractors:create',
      'supplier-timesheets:read',
      'supplier-timesheets:submit',
      'profile:read',
      'profile:update',
    ]);
    const forbidden = ['suppliers:read', 'contractors:read', 'timesheets:read'];
    forbidden.forEach((f) => {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).not.toContain(f);
    });
  });

  it('SPONSOR uses contractors + engagements only (no suppliers/invoices)', () => {
    expectCatalogAndNoDupes('SPONSOR');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).toEqual([
      'contractors:read',
      'engagements:read',
      'engagements:update',
    ]);
    const forbidden = ['suppliers:read', 'invoices:read', 'timesheets:read'];
    forbidden.forEach((f) => {
      expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).not.toContain(f);
    });
    expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).not.toContain('suppliers:read');
  });
});
