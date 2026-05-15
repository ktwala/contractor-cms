import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardLayout, { buildSidebarNavSections } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import type { Permission } from '@/lib/permissions.generated';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default ({ href, children, ...rest }: { href: string; children: React.ReactNode }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

function canFromSeedPermissions(allowed: Set<string>): (p: Permission) => boolean {
  return (p) => allowed.has(p);
}

describe('PR-NAV-IA-1: buildSidebarNavSections (seed-aligned)', () => {
  it('CONTRACTOR: Operations (Dashboard + Timesheets) only; no Invoices; no Governance', () => {
    const can = canFromSeedPermissions(
      new Set([
        'timesheets:create',
        'timesheets:read',
        'timesheets:update',
        'profile:read',
        'profile:update',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    const ops = sections.find((s) => s.group === 'operations');
    expect(ops?.items.map((i) => i.name)).toEqual(['Dashboard', 'Timesheets']);
    expect(ops?.items.some((i) => i.name === 'Invoices')).toBe(false);
    expect(sections.some((s) => s.group === 'governance')).toBe(false);
    expect(sections.some((s) => s.group === 'administration')).toBe(false);
  });

  it('FINANCE_USER: Operations includes Invoices', () => {
    const can = canFromSeedPermissions(
      new Set([
        'invoices:read',
        'invoices:approve',
        'suppliers:read',
        'contractors:read',
        'timesheets:read',
        'timesheets:approve',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    const ops = sections.find((s) => s.group === 'operations');
    expect(ops?.items.map((i) => i.name)).toContain('Invoices');
    expect(ops?.items.map((i) => i.name)).toContain('Suppliers');
  });

  it('CONTRACTOR_MANAGER: rich Operations but not Invoices', () => {
    const can = canFromSeedPermissions(
      new Set([
        'suppliers:create',
        'suppliers:read',
        'suppliers:update',
        'contractors:create',
        'contractors:read',
        'contractors:update',
        'contracts:create',
        'contracts:read',
        'contracts:update',
        'timesheets:read',
        'timesheets:approve',
        'tax-classifications:create',
        'tax-classifications:read',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    const ops = sections.find((s) => s.group === 'operations');
    expect(ops?.items.some((i) => i.name === 'Invoices')).toBe(false);
    expect(ops?.items.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Suppliers', 'Contracts', 'Timesheets']),
    );
  });

  it('SUPPLIER_ADMIN seed bundle: suppliers only in Operations', () => {
    const can = canFromSeedPermissions(
      new Set([
        'suppliers:create',
        'suppliers:read',
        'suppliers:update',
        'suppliers:delete',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    const ops = sections.find((s) => s.group === 'operations');
    expect(ops?.items.map((i) => i.name)).toEqual(['Dashboard', 'Suppliers']);
    expect(ops?.items.some((i) => i.name === 'Invoices')).toBe(false);
  });

  it('SPONSOR seed bundle: contractors + engagements; no Invoices', () => {
    const can = canFromSeedPermissions(
      new Set(['contractors:read', 'engagements:read', 'engagements:update']),
    );
    const sections = buildSidebarNavSections(can);
    const ops = sections.find((s) => s.group === 'operations');
    expect(ops?.items.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Dashboard', 'Contractors', 'Engagements']),
    );
    expect(ops?.items.some((i) => i.name === 'Invoices')).toBe(false);
  });

  it('CMS_ADMIN wildcard: Operations, Governance, and Administration sections', () => {
    const can = () => true;
    const sections = buildSidebarNavSections(can);
    expect(sections.map((s) => s.group)).toEqual(['operations', 'governance', 'administration']);
    expect(sections.find((s) => s.group === 'operations')?.items.map((i) => i.name)).toContain(
      'Invoices',
    );
    expect(sections.find((s) => s.group === 'governance')?.items.length).toBe(4);
    expect(sections.find((s) => s.group === 'administration')?.items.length).toBe(2);
  });
});

describe('PR-NAV-IA-1: DashboardLayout grouped sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Operations section label and seed-appropriate links for CONTRACTOR', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'u1',
        firstName: 'Pat',
        lastName: 'Worker',
        effectivePermissions: [
          'timesheets:create',
          'timesheets:read',
          'timesheets:update',
          'profile:read',
          'profile:update',
        ],
      },
      loading: false,
      logout: jest.fn(),
      can: (p: Permission) =>
        [
          'timesheets:create',
          'timesheets:read',
          'timesheets:update',
          'profile:read',
          'profile:update',
        ].includes(p),
    });

    render(<DashboardLayout>child</DashboardLayout>);

    expect(screen.getByTestId('nav-section-operations')).toBeInTheDocument();
    expect(screen.getByTestId('nav-section-label-operations')).toHaveTextContent('Operations');
    expect(screen.getByRole('link', { name: /Timesheets/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Invoices$/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-section-governance')).not.toBeInTheDocument();
  });

  it('renders Invoices for FINANCE_USER', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'u2',
        firstName: 'Fin',
        lastName: 'User',
        effectivePermissions: [
          'invoices:read',
          'invoices:approve',
          'suppliers:read',
          'contractors:read',
          'timesheets:read',
          'timesheets:approve',
        ],
      },
      loading: false,
      logout: jest.fn(),
      can: (p: Permission) =>
        [
          'invoices:read',
          'invoices:approve',
          'suppliers:read',
          'contractors:read',
          'timesheets:read',
          'timesheets:approve',
        ].includes(p),
    });

    render(<DashboardLayout>child</DashboardLayout>);

    expect(screen.getByRole('link', { name: /^Invoices$/ })).toBeInTheDocument();
  });
});
