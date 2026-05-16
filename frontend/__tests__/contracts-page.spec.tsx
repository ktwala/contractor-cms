import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ContractsPage from '../app/contracts/page';
import { api } from '../lib/api';
import { AuthProvider } from '../lib/auth-context';
import { ToastProvider } from '../lib/toast';

jest.mock('../lib/api', () => ({
  api: {
    getContracts: jest.fn(),
    getContractors: jest.fn(),
    getSuppliers: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/contracts',
}));

// Mock permissions wrapper
jest.mock('../components/RequirePermission', () => {
  return function MockRequirePermission({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
});

jest.mock('../components/dashboard-layout', () => {
  return function MockDashboardLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="dashboard-layout">{children}</div>;
  };
});

describe('ContractsPage', () => {
  const mockAuthContext = {
    user: { id: '1', email: 'test@example.com' },
    token: 'fake-token',
    login: jest.fn(),
    logout: jest.fn(),
    can: jest.fn().mockReturnValue(true),
    loading: false,
  };

  const renderWithAuth = () => {
    return render(
      <ToastProvider>
        <AuthProvider value={mockAuthContext as any}>
          <ContractsPage />
        </AuthProvider>
      </ToastProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.getContractors as jest.Mock).mockResolvedValue({ data: [] });
    (api.getSuppliers as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('renders contracts table with validity badges', async () => {
    const today = new Date();
    const expiredDate = new Date(today);
    expiredDate.setDate(expiredDate.getDate() - 10);
    
    (api.getContracts as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          contractNumber: 'CT-001',
          title: 'Dev Services',
          type: 'FIXED_TERM',
          startDate: '2026-01-01T00:00:00Z',
          endDate: expiredDate.toISOString(),
          rate: 100,
          rateType: 'HOURLY',
          currency: 'ZAR',
          status: 'ACTIVE',
        }
      ],
      total: 1
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('CT-001')).toBeInTheDocument();
    expect(screen.getByText('Expired 10 days ago')).toBeInTheDocument(); // Validity Badge
  });

  it('calls API with expiryState when filter is changed', async () => {
    (api.getContracts as jest.Mock).mockResolvedValue({ data: [], total: 0 });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const filterSelect = screen.getByRole('combobox');
    
    // Change filter
    fireEvent.change(filterSelect, { target: { value: 'expiring_soon' } });
    
    await waitFor(() => {
      expect(api.getContracts).toHaveBeenCalledWith(
        expect.objectContaining({ expiryState: 'expiring_soon' })
      );
    });
  });
});
