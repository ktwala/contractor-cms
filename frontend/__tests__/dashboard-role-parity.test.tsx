import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardNavCards from '@/components/dashboard/DashboardNavCards';
import PermissionAwareDashboard from '@/components/dashboard/PermissionAwareDashboard';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
/** Mirrors `backend/src/core/auth/seed-system-role-bundles.ts` doctrine target roles. */
const TARGET_ROLE_PERMISSIONS = {
  SUPPLIER_ADMIN: [
    'supplier-profile:read',
    'supplier-profile:update',
    'supplier-users:manage',
    'supplier-resources:read',
    'supplier-resources:create',
    'profile:read',
    'profile:update',
  ],
  SUPPLIER_MANAGER: [
    'supplier-profile:read',
    'supplier-resources:read',
    'supplier-resources:create',
    'supplier-timesheets:read',
    'supplier-timesheets:submit',
    'profile:read',
    'profile:update',
  ],
  SPONSOR: ['contractors:read', 'engagements:read', 'engagements:update'],
} as const;

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    getTimesheets: jest.fn(),
    getInvoices: jest.fn(),
    getContracts: jest.fn(),
  },
}));

jest.mock('@/lib/api-supplier-portal', () => ({
  supplierPortalApi: {
    getTimesheets: jest.fn(),
  },
}));

jest.mock('@/components/dashboard/ContractRenewalsWidget', () => ({
  ContractRenewalsWidget: () => <div data-testid="renewals-widget">Renewals</div>,
}));

function mockCan(permissions: readonly string[]) {
  const set = new Set(permissions);
  return (permission: string) => set.has(permission);
}

describe('Dashboard role parity (permission-filtered cards)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getTimesheets as jest.Mock).mockResolvedValue({ data: [] });
    (api.getInvoices as jest.Mock).mockResolvedValue({ data: [] });
    (api.getContracts as jest.Mock).mockResolvedValue({ data: [], total: 0 });
  });

  it('SUPPLIER_ADMIN dashboard does not render Contractors, Contracts, or Timesheets cards', () => {
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN),
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Supplier profile')).toBeInTheDocument();
    expect(screen.queryByText('Suppliers')).not.toBeInTheDocument();
    expect(screen.queryByText('Contractors')).not.toBeInTheDocument();
    expect(screen.queryByText('Contracts')).not.toBeInTheDocument();
    expect(screen.queryByText('Timesheets')).not.toBeInTheDocument();
  });

  it('SUPPLIER_MANAGER dashboard does not render Contractors or Contracts cards', () => {
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER),
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Supplier profile')).toBeInTheDocument();
    expect(screen.getByText('Timesheets')).toBeInTheDocument();
    expect(screen.queryByText('Suppliers')).not.toBeInTheDocument();
    expect(screen.queryByText('Contractors')).not.toBeInTheDocument();
    expect(screen.queryByText('Contracts')).not.toBeInTheDocument();
  });

  it('SPONSOR dashboard renders only Contractors and Engagements cards', () => {
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SPONSOR),
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByText('Engagements')).toBeInTheDocument();
    expect(screen.queryByText('Suppliers')).not.toBeInTheDocument();
    expect(screen.queryByText('Contracts')).not.toBeInTheDocument();
    expect(screen.queryByText('Timesheets')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
  });

  it('CONTRACTOR_MANAGER dashboard does not render Invoices card', () => {
    const managerPerms = [
      'suppliers:read',
      'contractors:read',
      'contracts:read',
      'engagements:read',
      'timesheets:read',
      'timesheets:approve',
      'pdp-activation:read',
      'pdp-exceptions:read',
    ];
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(managerPerms),
      user: { firstName: 'Manager' },
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Engagements')).toBeInTheDocument();
    expect(screen.getByText('Timesheets')).toBeInTheDocument();
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
  });
});

describe('Dashboard role parity (permission-gated API calls)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getTimesheets as jest.Mock).mockResolvedValue({ data: [] });
    (api.getInvoices as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('SUPPLIER_MANAGER dashboard uses supplier portal timesheets API', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER),
      user: { firstName: 'Mgr' },
    });

    (supplierPortalApi.getTimesheets as jest.Mock).mockResolvedValue({ data: [] });

    render(<PermissionAwareDashboard />);

    await waitFor(() => {
      expect(supplierPortalApi.getTimesheets).toHaveBeenCalled();
    });
    expect(api.getTimesheets).not.toHaveBeenCalled();
  });

  it('CONTRACTOR dashboard does not call getInvoices', async () => {
    const contractorPerms = ['timesheets:read', 'timesheets:create', 'profile:read'];
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(contractorPerms),
      user: { firstName: 'Alex' },
    });

    render(<PermissionAwareDashboard />);

    await waitFor(() => {
      expect(api.getTimesheets).toHaveBeenCalled();
    });
    expect(api.getInvoices).not.toHaveBeenCalled();
    expect(screen.queryByText(/Failed to load dashboard data/i)).not.toBeInTheDocument();
  });

  it('FINANCE_USER with invoices:read calls getInvoices', async () => {
    const financePerms = [
      'suppliers:read',
      'contractors:read',
      'timesheets:read',
      'invoices:read',
    ];
    (useAuth as jest.Mock).mockReturnValue({
      can: mockCan(financePerms),
      user: { firstName: 'Finance' },
    });

    render(<PermissionAwareDashboard />);

    await waitFor(() => {
      expect(api.getInvoices).toHaveBeenCalled();
    });
  });
});
