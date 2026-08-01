import {
  SEED_TARGET_ROLE_PERMISSIONS,
  SeedTargetDoctrineRoleName,
  GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS,
  SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS,
  CONTRACTOR_MANAGER_PERMISSIONS,
  GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS,
  GOVERNANCE_REVIEWER_PERMISSIONS,
} from './seed-system-role-bundles';
import { ALL_PERMISSIONS } from './permissions.constants';

function expectCatalogAndNoDupes(perms: readonly string[]) {
  expect(new Set(perms).size).toBe(perms.length);
  perms.forEach((p) => expect(ALL_PERMISSIONS.has(p)).toBe(true));
}

describe('SEED_TARGET_ROLE_PERMISSIONS (PR-RBAC-REALIGN-3B supplier portal)', () => {
  it('SUPPLIER_ADMIN — portal administration', () => {
    expectCatalogAndNoDupes(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN);
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).toEqual([
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
    ]);
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN).not.toContain('suppliers:read');
  });

  it('SUPPLIER_MANAGER — operational work with invoice visibility', () => {
    expectCatalogAndNoDupes(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER);
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).toContain('supplier-invoices:read');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).toContain(
      'supplier-timesheets:manage',
    );
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).not.toContain(
      'supplier-users:manage',
    );
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).not.toContain(
      'supplier-profile:update',
    );
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).not.toContain(
      'supplier-onboarding:submit',
    );
    expect(SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER).not.toContain(
      'supplier-documents:manage',
    );
  });
});

describe('SEED_TARGET_ROLE_PERMISSIONS — SPONSOR', () => {
  it('SPONSOR uses contractors + engagements (no supplier portal or sync)', () => {
    expectCatalogAndNoDupes(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR);
    expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).not.toContain('suppliers:sync');
    expect(SEED_TARGET_ROLE_PERMISSIONS.SPONSOR).not.toContain('supplier-profile:read');
  });
});

describe('Production governance bundles (PR-RBAC-REALIGN-3B)', () => {
  it('GOVERNANCE_INTEGRATION_OPERATOR has sync/bootstrap + read-only registries', () => {
    expectCatalogAndNoDupes(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS);
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).toContain('suppliers:read');
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).toContain('contractors:read');
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).not.toContain('suppliers:approve');
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).not.toContain('contractors:create');
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).not.toContain('contractors:update');
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).not.toContain(
      'contractor-remediation:manage',
    );
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).not.toContain(
      'pdp-restrictions:manage',
    );
    expect(GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS).not.toContain(
      'contractor-migration:manage',
    );
  });

  it('SUPPLIER_GOVERNANCE_REVIEWER has trust decisions only', () => {
    expectCatalogAndNoDupes(SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS);
    expect(SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS).not.toContain('suppliers:sync');
    expect(SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS).not.toContain('contractors:bootstrap');
  });

  it('CONTRACTOR_MANAGER has CMS ops without supplier sync/approve', () => {
    expectCatalogAndNoDupes(CONTRACTOR_MANAGER_PERMISSIONS);
    expect(CONTRACTOR_MANAGER_PERMISSIONS).toContain('contractors:create');
    expect(CONTRACTOR_MANAGER_PERMISSIONS).toContain('contractor-remediation:manage');
    expect(CONTRACTOR_MANAGER_PERMISSIONS).not.toContain('suppliers:approve');
    expect(CONTRACTOR_MANAGER_PERMISSIONS).not.toContain('suppliers:sync');
    expect(CONTRACTOR_MANAGER_PERMISSIONS).not.toContain('contractors:bootstrap');
    expect(CONTRACTOR_MANAGER_PERMISSIONS).not.toContain('contractor-migration:manage');
  });

  it('GOVERNANCE_REVIEWER has no bootstrap ingest', () => {
    expect(GOVERNANCE_REVIEWER_PERMISSIONS).not.toContain('contractors:bootstrap');
    expect(GOVERNANCE_REVIEWER_PERMISSIONS).not.toContain('contractor-migration:manage');
  });

  it('GOVERNANCE_OPERATIONS_ADMIN is demo composite of production slices', () => {
    for (const perm of GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS) {
      expect(GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS).toContain(perm);
    }
    for (const perm of SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS) {
      expect(GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS).toContain(perm);
    }
    for (const perm of CONTRACTOR_MANAGER_PERMISSIONS) {
      expect(GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS).toContain(perm);
    }
  });
});
