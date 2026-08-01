import {
  expandEffectivePermissions,
  AUTHORITY_SENSITIVE_PERMISSIONS,
  FINANCE_SENSITIVE_PERMISSIONS,
  permissionSatisfied,
} from './permission-evaluation';
import { PERMISSIONS } from '../permissions.constants';

describe('permission-evaluation (PR-FINANCE-RBAC-1)', () => {
  it('does not grant finance-sensitive permissions from *:* alone', () => {
    const perms = new Set(['*:*']);
    for (const financePerm of FINANCE_SENSITIVE_PERMISSIONS) {
      expect(permissionSatisfied(perms, financePerm)).toBe(false);
    }
    expect(permissionSatisfied(perms, PERMISSIONS.SUPPLIERS.READ)).toBe(true);
    expect(permissionSatisfied(perms, PERMISSIONS.INVOICES.READ)).toBe(true);
  });

  it('grants finance-sensitive permissions when explicitly listed', () => {
    const perms = new Set(['*:*', PERMISSIONS.INVOICE_AMOUNTS.VIEW]);
    expect(permissionSatisfied(perms, PERMISSIONS.INVOICE_AMOUNTS.VIEW)).toBe(
      true,
    );
  });

  it('expandEffectivePermissions omits finance-sensitive entries for *:*', () => {
    const expanded = expandEffectivePermissions(['*:*']);
    expect(expanded).toContain(PERMISSIONS.INVOICES.READ);
    expect(expanded).not.toContain(PERMISSIONS.INVOICE_AMOUNTS.VIEW);
    expect(expanded).not.toContain(PERMISSIONS.INVOICES.APPROVE);
  });

  it('expandEffectivePermissions includes explicit finance grants with *:*', () => {
    const expanded = expandEffectivePermissions([
      '*:*',
      PERMISSIONS.INVOICE_AMOUNTS.VIEW,
    ]);
    expect(expanded).toContain(PERMISSIONS.INVOICE_AMOUNTS.VIEW);
  });

  it('does not grant authority-sensitive permissions from *:* alone (PR-CMS-AUTHORITY-1)', () => {
    const perms = new Set(['*:*']);
    for (const authorityPerm of AUTHORITY_SENSITIVE_PERMISSIONS) {
      expect(permissionSatisfied(perms, authorityPerm)).toBe(false);
    }
  });
});

describe('permission-evaluation (PR-RBAC-REALIGN-3B portal aliases)', () => {
  it('maps supplier-timesheets:manage to submit route permission', () => {
    const manage = new Set([PERMISSIONS.SUPPLIER_TIMESHEETS.MANAGE]);
    expect(permissionSatisfied(manage, PERMISSIONS.SUPPLIER_TIMESHEETS.SUBMIT)).toBe(true);
  });

  it('does not grant coarse contractor-migration:manage after legacy bridge removal', () => {
    const legacy = new Set([PERMISSIONS.CONTRACTOR_MIGRATION.MANAGE]);
    expect(permissionSatisfied(legacy, PERMISSIONS.CONTRACTORS.BOOTSTRAP)).toBe(false);
    expect(permissionSatisfied(legacy, PERMISSIONS.SUPPLIERS.SYNC)).toBe(false);
  });

  it('maps pdp-restrictions:manage to activation and exception manage routes', () => {
    const manage = new Set([PERMISSIONS.PDP_RESTRICTIONS.MANAGE]);
    expect(permissionSatisfied(manage, PERMISSIONS.PDP_ACTIVATION.MANAGE)).toBe(true);
    expect(permissionSatisfied(manage, PERMISSIONS.PDP_EXCEPTIONS.MANAGE)).toBe(true);
  });
});
