import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '@/app/dashboard/page';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

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

jest.mock('@/components/dashboard/AnalyticsDashboard', () => {
  return function DummyAnalytics() {
    return <div data-testid="analytics-dash">Analytics</div>;
  };
});
jest.mock('@/components/dashboard/PermissionAwareDashboard', () => {
  return function DummyPermissionAware() {
    return <div data-testid="permission-aware-dash">PermissionAware</div>;
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

  it('renders AnalyticsDashboard for users with analytics:read', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'admin1', roles: [{ name: 'CMS_ADMIN' }] },
      can: (permission: string) => permission === 'analytics:read',
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('analytics-dash')).toBeTruthy();
    expect(screen.queryByTestId('permission-aware-dash')).toBeNull();
  });

  it('renders PermissionAwareDashboard for CONTRACTOR without analytics:read', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'contractor1', roles: [{ name: 'CONTRACTOR' }] },
      can: () => false,
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('permission-aware-dash')).toBeTruthy();
    expect(api.getDashboardAnalytics).not.toHaveBeenCalled();
  });

  it('renders PermissionAwareDashboard for internal users without analytics:read', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'manager1', roles: [{ name: 'CONTRACTOR_MANAGER' }] },
      can: () => false,
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('permission-aware-dash')).toBeTruthy();
  });

  it('renders PermissionAwareDashboard for FINANCE_USER without analytics:read', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'finance1', roles: [{ name: 'FINANCE_USER' }] },
      can: () => false,
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('permission-aware-dash')).toBeTruthy();
    expect(api.getDashboardAnalytics).not.toHaveBeenCalled();
  });
});
