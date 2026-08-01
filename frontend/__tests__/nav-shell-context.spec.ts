import {
  resolveNavShell,
  isSupplierPortalRoute,
} from '@/lib/nav-shell-context';
import type { Permission } from '@/lib/permissions.generated';

function canFrom(allowed: Set<string>): (p: Permission) => boolean {
  return (p) => allowed.has(p);
}

describe('PR-SHELL-NAV-CONTEXT-1: nav-shell-context', () => {
  it('detects supplier-portal routes by prefix', () => {
    expect(isSupplierPortalRoute('/supplier-portal/profile')).toBe(true);
    expect(isSupplierPortalRoute('/suppliers')).toBe(false);
  });

  it('SUPPLIER_ADMIN resolves to supplier-portal shell', () => {
    const can = canFrom(
      new Set([
        'supplier-profile:read',
        'supplier-contractors:read',
        'profile:read',
      ]),
    );
    expect(resolveNavShell(can)).toBe('supplier-portal');
  });

  it('CMS_ADMIN with client suppliers:read stays on internal shell', () => {
    const can = canFrom(
      new Set([
        'suppliers:read',
        'supplier-profile:read',
        'invoices:read',
        'users:read',
        'audit:read',
      ]),
    );
    expect(resolveNavShell(can)).toBe('internal');
  });

  it('supplierPortalPreview forces supplier-portal shell for internal operators', () => {
    const can = canFrom(new Set(['suppliers:read', 'invoices:read', 'users:read']));
    expect(
      resolveNavShell(can, { supplierPortalPreview: true }),
    ).toBe('supplier-portal');
  });
});
