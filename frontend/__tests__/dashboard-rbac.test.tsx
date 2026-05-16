import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '@/app/dashboard/page';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

// Mock dependencies
jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    getDashboardAnalytics: jest.fn(),
    getTimesheets: jest.fn(),
    getInvoices: jest.fn(),
  },
}));

// Mock sub-components so we don't need to mount complex charts in JSDOM
jest.mock('@/components/dashboard/AnalyticsDashboard', () => {
  return function DummyAnalytics() {
    return <div data-testid="analytics-dash">Analytics</div>;
  };
});
jest.mock('@/components/dashboard/ContractorDashboard', () => {
  return function DummyContractor() {
    return <div data-testid="contractor-dash">Contractor</div>;
  };
});
jest.mock('@/components/dashboard/OperationalDashboard', () => {
  return function DummyOperational() {
    return <div data-testid="operational-dash">Operational</div>;
  };
});
jest.mock('@/components/dashboard/FinanceDashboard', () => {
  return function DummyFinance() {
    return <div data-testid="finance-dash">Finance</div>;
  };
});
jest.mock('@/components/dashboard-layout', () => {
  return function DummyDashboardLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="dashboard-layout">{children}</div>;
  };
});

describe('DashboardPage RBAC Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AnalyticsDashboard and calls getDashboardAnalytics for users with analytics:read', async () => {
    // Mock user with analytics:read permission
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'admin1', roles: [{ name: 'CMS_ADMIN' }] },
      can: (permission: string) => permission === 'analytics:read',
    });

    (api.getDashboardAnalytics as jest.Mock).mockResolvedValue({
      financial: { totalInvoiced: 0, totalPaid: 0, totalPending: 0 },
      contractors: { activeContractors: 0, supplierCount: 0 },
      projects: { activeProjects: 0, totalBudget: 0, averageUtilization: 0, totalUtilized: 0 },
      timesheets: { pendingApproval: 0, approved: 0, rejected: 0 },
      tax: { totalWithheld: 0, payeWithheld: 0, sdlWithheld: 0, uifWithheld: 0 },
    });

    render(<DashboardPage />);
    
    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('analytics-dash')).toBeTruthy();
  });

  it('renders ContractorDashboard and skips getDashboardAnalytics for CONTRACTOR users without analytics:read', async () => {
    // Mock user lacking analytics:read but having CONTRACTOR role
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'contractor1', roles: [{ name: 'CONTRACTOR' }] },
      can: () => false, // No analytics:read
    });

    (api.getTimesheets as jest.Mock).mockResolvedValue({ data: [] });
    (api.getInvoices as jest.Mock).mockResolvedValue({ data: [] });

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('contractor-dash')).toBeTruthy();
  });

  it('renders OperationalDashboard for internal users without analytics:read', async () => {
    // Mock user lacking analytics:read and lacking CONTRACTOR role (e.g. CONTRACTOR_MANAGER)
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'manager1', roles: [{ name: 'CONTRACTOR_MANAGER' }] },
      can: () => false, // No analytics:read
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('operational-dash')).toBeTruthy();
  });

  it('renders FinanceDashboard and skips getDashboardAnalytics for FINANCE_USER', async () => {
    // Mock user lacking analytics:read but having FINANCE_USER role
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'finance1', roles: [{ name: 'FINANCE_USER' }] },
      can: () => false, // No analytics:read
    });

    (api.getTimesheets as jest.Mock).mockResolvedValue({ data: [] });
    (api.getInvoices as jest.Mock).mockResolvedValue({ data: [] });

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('finance-dash')).toBeTruthy();
    expect(api.getDashboardAnalytics).not.toHaveBeenCalled();
  });
});
