import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardLayout, { buildSidebarNavSections } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import type { Permission } from '@/lib/permissions.generated';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';

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

function engagementSection(sections: ReturnType<typeof buildSidebarNavSections>) {
  return sections.find((s) => s.group === 'engagementAdministration');
}

describe('PR-NAV-CAPABILITY-IA-1: buildSidebarNavSections (seed-aligned)', () => {
  it('CONTRACTOR: Overview + Timesheets only; no Invoices; no Governance', () => {
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
    expect(sections.find((s) => s.group === 'overview')?.items.map((i) => i.name)).toEqual([
      'Overview',
    ]);
    expect(engagementSection(sections)?.items.map((i) => i.name)).toEqual(['Timesheets']);
    expect(engagementSection(sections)?.items.some((i) => i.name === 'Invoices')).toBe(false);
    expect(sections.some((s) => s.group === 'governance')).toBe(false);
    expect(sections.some((s) => s.group === 'administration')).toBe(false);
  });

  it('FINANCE_USER: Engagement Administration includes Invoices', () => {
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
    expect(engagementSection(sections)?.items.map((i) => i.name)).toContain('Invoices');
    expect(
      sections.find((s) => s.group === 'supplierAdministration')?.items.map((i) => i.name),
    ).toContain('Suppliers');
  });

  it('CONTRACTOR_MANAGER: supplier + engagement capabilities with invoice summary', () => {
    const can = canFromSeedPermissions(
      new Set([
        'suppliers:create',
        'suppliers:read',
        'suppliers:update',
        'suppliers:approve',
        'suppliers:suspend',
        'contractors:create',
        'contractors:read',
        'contractors:update',
        'contracts:create',
        'contracts:read',
        'contracts:update',
        'timesheets:read',
        'timesheets:approve',
        'invoices:read',
        'tax-classifications:create',
        'tax-classifications:read',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    expect(engagementSection(sections)?.items.some((i) => i.name === 'Invoices')).toBe(true);
    expect(
      sections.find((s) => s.group === 'supplierAdministration')?.items.map((i) => i.name),
    ).toEqual(
      expect.arrayContaining([
        'Suppliers',
        'Operational trust queue',
        'Operational trust management',
      ]),
    );
    expect(engagementSection(sections)?.items.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Contracts', 'Timesheets']),
    );
    expect(sections.some((s) => s.group === 'supplierPortal')).toBe(false);
  });

  it('CMS_ADMIN on /supplier-portal URL keeps internal menu (Invoices + Governance)', () => {
    const can = canFromSeedPermissions(
      new Set([
        'suppliers:read',
        'supplier-profile:read',
        'contractors:read',
        'contracts:read',
        'engagements:read',
        'timesheets:read',
        'invoices:read',
        'projects:read',
        'users:read',
        'roles:read',
        'audit:read',
        'pdp-activation:view',
        'pdp-exceptions:view',
      ]),
    );
    const sections = buildSidebarNavSections(can, '/supplier-portal/profile');
    expect(
      sections.find((s) => s.group === 'supplierAdministration')?.items.some((i) => i.name === 'Suppliers'),
    ).toBe(true);
    expect(engagementSection(sections)?.items.some((i) => i.name === 'Invoices')).toBe(true);
    expect(sections.some((s) => s.group === 'supplierPortal')).toBe(false);
    expect(sections.some((s) => s.group === 'governance')).toBe(true);
    expect(sections.some((s) => s.group === 'administration')).toBe(true);
  });

  it('GOVERNANCE_INTEGRATION_OPERATOR: supplier + workforce capabilities; no approvals', () => {
    const can = canFromSeedPermissions(
      new Set([
        'suppliers:read',
        'suppliers:sync',
        'suppliers:governance-scan',
        'contractor-migration:read',
        'contractors:read',
        'contractors:bootstrap',
        'contractors:governance-scan',
        'workforce:cutover-manage',
      ]),
    );
    const sections = buildSidebarNavSections(can, '/dashboard', {
      tenantAuthority: {
        supplierAuthorityMode: 'ORACLE_ONLY',
        contractorAuthorityMode: 'HCM_ONLY',
      },
    });
    expect(
      sections.find((s) => s.group === 'supplierAdministration')?.items.map((i) => i.name),
    ).toEqual(expect.arrayContaining(['Suppliers', 'Supplier Synchronization']));
    expect(
      sections.find((s) => s.group === 'workforceAdministration')?.items.map((i) => i.name),
    ).toEqual(
      expect.arrayContaining(['External Workers', 'Workforce Discovery']),
    );
    expect(
      sections.find((s) => s.group === 'supplierAdministration')?.items.some(
        (i) => i.name === 'Operational trust queue',
      ),
    ).toBe(false);
    expect(engagementSection(sections)).toBeUndefined();
    expect(sections.some((s) => s.group === 'governance')).toBe(false);
  });

  it('GOVERNANCE_AUDITOR: governance + invoice summary; no supplier portal routes', () => {
    const can = canFromSeedPermissions(
      new Set([
        'audit:read',
        'governance-analytics:view',
        'governance-risk:view',
        'pdp-exceptions:view',
        'pdp-telemetry:view',
        'invoices:read',
        'contracts:read',
        'engagements:read',
        'suppliers:read',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    expect(sections.some((s) => s.group === 'governance')).toBe(true);
    expect(engagementSection(sections)?.items.some((i) => i.name === 'Invoices')).toBe(true);
    expect(sections.some((s) => s.group === 'supplierPortal')).toBe(false);
    expect(sections.some((s) => s.group === 'administration')).toBe(false);
  });

  it('supplierPortalPreview shows portal routes for internal operator', () => {
    const can = canFromSeedPermissions(
      new Set(['suppliers:read', 'invoices:read', 'users:read', 'supplier-profile:read']),
    );
    const sections = buildSidebarNavSections(can, '/dashboard', null, {
      supplierPortalPreview: true,
    });
    expect(
      sections.find((s) => s.group === 'supplierPortal')?.items.some((i) => i.name === 'Supplier profile'),
    ).toBe(true);
    expect(sections.some((s) => s.group === 'supplierAdministration')).toBe(false);
    expect(sections.some((s) => s.group === 'governance')).toBe(false);
  });

  it('SUPPLIER_ADMIN portal bundle: profile + contractors only (no client Suppliers)', () => {
    const can = canFromSeedPermissions(
      new Set([
        'supplier-profile:read',
        'supplier-profile:update',
        'supplier-users:manage',
        'supplier-contractors:read',
        'supplier-contractors:create',
        'supplier-contractors:update',
        'profile:read',
        'profile:update',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    expect(sections.find((s) => s.group === 'overview')?.items.map((i) => i.name)).toEqual([
      'Overview',
    ]);
    expect(sections.find((s) => s.group === 'supplierPortal')?.items.map((i) => i.name)).toEqual([
      'Supplier profile',
      'External workers',
    ]);
    expect(sections.some((s) => s.group === 'supplierAdministration')).toBe(false);
    expect(engagementSection(sections)).toBeUndefined();
    expect(sections.some((s) => s.group === 'governance')).toBe(false);
  });

  it('SUPPLIER_MANAGER portal bundle: profile, contractors, supplier timesheets', () => {
    const can = canFromSeedPermissions(
      new Set([
        'supplier-profile:read',
        'supplier-contractors:read',
        'supplier-contractors:create',
        'supplier-timesheets:read',
        'supplier-timesheets:submit',
        'profile:read',
        'profile:update',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    expect(sections.find((s) => s.group === 'supplierPortal')?.items.map((i) => i.name)).toEqual([
      'Supplier profile',
      'External workers',
      'Supplier timesheets',
    ]);
    expect(sections.some((s) => s.group === 'supplierAdministration')).toBe(false);
    expect(engagementSection(sections)).toBeUndefined();
  });

  it('HCM-linked sponsor view hidden when inbox flag is off', () => {
    const can = canFromSeedPermissions(
      new Set(['contractors:read', 'engagements:read', 'engagements:update']),
    );
    const sections = buildSidebarNavSections(can, '/dashboard', {
      externalId: 'cms:emp:sponsor-demo',
      responsibleManagerAccountabilityInboxEnabled: false,
    });
    expect(
      sections.find((s) => s.group === 'workforceAdministration')?.items.map((i) => i.name),
    ).not.toContain('Sponsored contractors');
    expect(
      sections.flatMap((s) => s.items).some((i) => i.path === '/responsible-manager-tasks'),
    ).toBe(false);
  });

  it('HCM-linked sponsor view: sponsored workers + engagements labels; no Invoices', () => {
    const can = canFromSeedPermissions(
      new Set([
        'contractors:read',
        'engagements:read',
        'engagements:update',
        'responsible-manager-tasks:read',
      ]),
    );
    const sections = buildSidebarNavSections(can, '/dashboard', {
      externalId: 'cms:emp:sponsor-demo',
      responsibleManagerAccountabilityInboxEnabled: true,
    });
    const workforce = sections.find((s) => s.group === 'workforceAdministration')?.items ?? [];
    const engagement = engagementSection(sections)?.items ?? [];
    expect([...workforce, ...engagement].map((i) => i.name)).toEqual(
      expect.arrayContaining([
        'Managed external workers',
        'My managed engagements',
        EXTERNAL_WORKFORCE_LABELS.myResponsibleManagerAccountability,
      ]),
    );
    expect(engagement.some((i) => i.name === 'Invoices')).toBe(false);
  });

  it('CMS_ADMIN: capability sections for supplier, workforce, engagement, governance, administration', () => {
    const can = canFromSeedPermissions(
      new Set([
        'suppliers:read',
        'contractors:read',
        'contracts:read',
        'engagements:read',
        'timesheets:read',
        'invoices:read',
        'projects:read',
        'users:read',
        'roles:read',
        'audit:read',
        'pdp-activation:view',
        'pdp-exceptions:view',
        'governance-analytics:view',
      ]),
    );
    const sections = buildSidebarNavSections(can);
    expect(sections.map((s) => s.group)).toEqual([
      'overview',
      'supplierAdministration',
      'workforceAdministration',
      'engagementAdministration',
      'governance',
      'administration',
    ]);
    expect(engagementSection(sections)?.items.map((i) => i.name) ?? []).toContain('Invoices');
    expect(sections.some((s) => s.group === 'supplierPortal')).toBe(false);
    expect(sections.find((s) => s.group === 'governance')?.items.length).toBe(4);
    expect(sections.find((s) => s.group === 'administration')?.items.length).toBe(2);
  });
});

describe('PR-NAV-CAPABILITY-IA-1: DashboardLayout grouped sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Engagement Administration section for CONTRACTOR', () => {
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

    expect(screen.getByTestId('nav-section-overview')).toBeInTheDocument();
    expect(screen.getByTestId('nav-section-engagementAdministration')).toBeInTheDocument();
    expect(screen.getByTestId('nav-section-label-engagementAdministration')).toHaveTextContent(
      'Engagement Administration',
    );
    expect(screen.getByRole('link', { name: /Timesheets/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Invoices$/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-section-governance')).not.toBeInTheDocument();
  });

  it('renders supplier portal links for SUPPLIER_ADMIN (no client Suppliers)', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'sa1',
        firstName: 'Supplier',
        lastName: 'Admin',
        effectivePermissions: [
          'supplier-profile:read',
          'supplier-profile:update',
          'supplier-users:manage',
          'supplier-contractors:read',
          'supplier-contractors:create',
          'supplier-contractors:update',
        ],
      },
      loading: false,
      logout: jest.fn(),
      can: (p: Permission) =>
        [
          'supplier-profile:read',
          'supplier-profile:update',
          'supplier-users:manage',
          'supplier-contractors:read',
          'supplier-contractors:create',
          'supplier-contractors:update',
        ].includes(p),
    });

    render(<DashboardLayout>child</DashboardLayout>);

    expect(screen.getByTestId('nav-shell-supplier-portal')).toBeInTheDocument();
    expect(screen.getByTestId('nav-section-supplierPortal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Supplier profile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^External workers$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Suppliers$/ })).not.toBeInTheDocument();
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
