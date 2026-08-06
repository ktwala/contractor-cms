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
    'supplier-contractors:read',
    'supplier-contractors:create',
    'supplier-contractors:update',
    'profile:read',
    'profile:update',
  ],
  SUPPLIER_MANAGER: [
    'supplier-profile:read',
    'supplier-contractors:read',
    'supplier-contractors:create',
    'supplier-timesheets:read',
    'supplier-timesheets:submit',
    'profile:read',
    'profile:update',
  ],
  SPONSOR: ['contractors:read', 'engagements:read', 'engagements:update'],
} as const;

const defaultAuth = {
  user: null,
  loading: false,
  refreshProfile: jest.fn().mockResolvedValue(undefined),
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  hasRole: () => false,
};

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(() => defaultAuth),
}));

function mockAuth(overrides: any) {
  const user = overrides.user === null ? null : {
    id: 'user-id',
    email: 'user@example.com',
    firstName: 'User',
    lastName: 'Name',
    roles: [],
    effectivePermissions: [],
    organizationId: 'org-id',
    ...overrides.user,
  };

  (useAuth as jest.Mock).mockReturnValue({
    ...defaultAuth,
    ...overrides,
    user,
  });
}

jest.mock('@/lib/api', () => ({
  api: {
    getTimesheets: jest.fn(),
    getInvoices: jest.fn(),
    getContracts: jest.fn(),
    getSuppliers: jest.fn(),
    getContractors: jest.fn(),
    getContractorWorkforceReviewQueue: jest.fn(),
    getSupplierApprovalQueue: jest.fn(),
    getResponsibleManagerTasks: jest.fn(),
  },
}));

jest.mock('@/services/pdp-exception.service', () => ({
  pdpExceptionService: {
    listExceptions: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/pdp-activation.service', () => ({
  pdpActivationService: {
    listRules: jest.fn().mockResolvedValue({ rules: [], isEmergencyOverrideActive: false }),
  },
}));

jest.mock('@/lib/api-supplier-portal', () => ({
  supplierPortalApi: {
    getTimesheets: jest.fn(),
    getDashboard: jest.fn(),
    getContractors: jest.fn(),
    getInvoices: jest.fn(),
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
    (supplierPortalApi.getDashboard as jest.Mock).mockResolvedValue({
      status: 'ok',
      supplier_context: { supplier_id: 'supplier-123', organization_id: 'org-id' },
      data: {
        profile: { available: true, display_name: 'Supplier', status: 'ACTIVE' },
        contractors: { count: 0 },
        timesheets: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
      },
    });
    (supplierPortalApi.getContractors as jest.Mock).mockResolvedValue({
      status: 'ok',
      supplier_context: { supplier_id: 'supplier-123', organization_id: 'org-id' },
      data: [],
    });
    (supplierPortalApi.getInvoices as jest.Mock).mockResolvedValue({
      status: 'ok',
      supplier_context: { supplier_id: 'supplier-123', organization_id: 'org-id' },
      data: [],
    });
  });

  it('SUPPLIER_ADMIN dashboard renders supplier Contractors card, not client modules', () => {
    mockAuth({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN),
      user: { supplierId: 'supplier-123' },
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Supplier profile')).toBeInTheDocument();
    expect(screen.getByText('External workers')).toBeInTheDocument();
    expect(screen.queryByText('Suppliers')).not.toBeInTheDocument();
    expect(screen.queryByText('Contracts')).not.toBeInTheDocument();
    expect(screen.queryByText('Timesheets')).not.toBeInTheDocument();
  });

  it('SUPPLIER_MANAGER dashboard renders supplier Contractors and timesheets, not client modules', () => {
    mockAuth({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER),
      user: { supplierId: 'supplier-123' },
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Supplier profile')).toBeInTheDocument();
    expect(screen.getByText('External workers')).toBeInTheDocument();
    expect(screen.getByText('Timesheets')).toBeInTheDocument();
    expect(screen.queryByText('Suppliers')).not.toBeInTheDocument();
    expect(screen.queryByText('Contracts')).not.toBeInTheDocument();
  });

  it('HCM-linked sponsor dashboard renders sponsored contractors and engagements cards', () => {
    mockAuth({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SPONSOR),
      user: {
        externalId: 'ewp:emp:responsible-manager-demo',
        responsibleManagerAccountabilityInboxEnabled: true,
      },
    });

    render(<DashboardNavCards />);

    expect(screen.getAllByText('Managed external workers').length).toBeGreaterThan(0);
    expect(screen.getByText('My managed engagements')).toBeInTheDocument();
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
    mockAuth({
      can: mockCan(managerPerms),
      user: { firstName: 'Manager' },
    });

    render(<DashboardNavCards />);

    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('External Workers')).toBeInTheDocument();
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
    (api.getContracts as jest.Mock).mockResolvedValue({ total: 0, data: [] });
    (api.getSuppliers as jest.Mock).mockResolvedValue({ data: [] });
    (api.getContractors as jest.Mock).mockResolvedValue({ data: [] });
    (api.getContractorWorkforceReviewQueue as jest.Mock).mockResolvedValue({ data: [] });
    (api.getSupplierApprovalQueue as jest.Mock).mockResolvedValue({ data: [] });
    (api.getResponsibleManagerTasks as jest.Mock).mockResolvedValue({ data: [] });
    (supplierPortalApi.getDashboard as jest.Mock).mockResolvedValue({
      status: 'ok',
      supplier_context: { supplier_id: 'supplier-123', organization_id: 'org-id' },
      data: {
        profile: { available: true, display_name: 'Supplier', status: 'ACTIVE' },
        contractors: { count: 0 },
        timesheets: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
      },
    });
    (supplierPortalApi.getContractors as jest.Mock).mockResolvedValue({
      status: 'ok',
      supplier_context: { supplier_id: 'supplier-123', organization_id: 'org-id' },
      data: [],
    });
    (supplierPortalApi.getInvoices as jest.Mock).mockResolvedValue({
      status: 'ok',
      supplier_context: { supplier_id: 'supplier-123', organization_id: 'org-id' },
      data: [],
    });
  });

  it('SUPPLIER_MANAGER dashboard uses supplier portal dashboard API', async () => {
    mockAuth({
      can: mockCan(TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER),
      user: { firstName: 'Mgr', supplierId: 'supplier-123' },
    });

    render(<PermissionAwareDashboard />);

    await waitFor(() => {
      expect(supplierPortalApi.getDashboard).toHaveBeenCalled();
    });
    expect(api.getTimesheets).not.toHaveBeenCalled();
  });

  it('CONTRACTOR dashboard does not call getInvoices', async () => {
    const contractorPerms = ['timesheets:read', 'timesheets:create', 'profile:read'];
    mockAuth({
      can: mockCan(contractorPerms),
      user: { firstName: 'Alex' },
    });

    render(<PermissionAwareDashboard />);

    await waitFor(() => {
      expect(api.getTimesheets).toHaveBeenCalled();
    });
    expect(api.getInvoices).not.toHaveBeenCalled();
    expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument();
  });

  it('FINANCE_USER with invoices:read calls getInvoices', async () => {
    const financePerms = [
      'suppliers:read',
      'contractors:read',
      'timesheets:read',
      'invoices:read',
    ];
    mockAuth({
      can: mockCan(financePerms),
      user: { firstName: 'Finance' },
    });

    render(<PermissionAwareDashboard />);

    await waitFor(() => {
      expect(api.getInvoices).toHaveBeenCalled();
    });
  });
});
