import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupplierApprovalsQueue from '@/components/suppliers/SupplierApprovalsQueue';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    getSupplierApprovalQueue: jest.fn(),
    transitionSupplierStatus: jest.fn(),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    can: (p: string) =>
      p === 'suppliers:approve' || p === 'suppliers:suspend',
    user: { id: 'reviewer-1' },
    loading: false,
    refreshProfile: jest.fn().mockResolvedValue(undefined),
    canAny: jest.fn().mockReturnValue(false),
    canAll: jest.fn().mockReturnValue(false),
    hasRole: jest.fn().mockReturnValue(false),
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('SupplierApprovalsQueue (PR-CMS-OPERATIONS-1C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('when queue is empty, explains pending-only scope and links to management', async () => {
    mockedApi.getSupplierApprovalQueue.mockResolvedValue({ total: 0, data: [] });

    render(<SupplierApprovalsQueue />);

    expect(
      await screen.findByText(/No suppliers awaiting operational trust/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only shows suppliers awaiting a pending decision/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Operational Trust Management/i })).toHaveAttribute(
      'href',
      '/suppliers/operational-trust',
    );
  });

  it('renders pending suppliers with evidence status', async () => {
    mockedApi.getSupplierApprovalQueue.mockResolvedValue({
      total: 1,
      data: [
        {
          id: 'sup-1',
          type: 'COMPANY',
          status: 'PENDING_APPROVAL',
          companyName: 'Acme Ltd',
          email: 'acme@test.com',
          country: 'ZA',
          evidenceStatus: 'INCOMPLETE',
          evidenceComplete: false,
          missingCount: 2,
          expiredCount: 0,
          canApprove: true,
          waitingFor: 'Operational trust review required',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<SupplierApprovalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument();
    });
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View/i })).toHaveAttribute('href', '/suppliers/sup-1');
  });

  it('disables approve when evidence is incomplete', async () => {
    mockedApi.getSupplierApprovalQueue.mockResolvedValue({
      total: 1,
      data: [
        {
          id: 'sup-2',
          type: 'COMPANY',
          status: 'PENDING_APPROVAL',
          companyName: 'Incomplete Co',
          email: 'inc@test.com',
          country: 'ZA',
          evidenceStatus: 'INCOMPLETE',
          evidenceComplete: false,
          missingCount: 1,
          expiredCount: 0,
          canApprove: true,
          waitingFor: 'Operational trust review required',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<SupplierApprovalsQueue />);

    const grant = await screen.findByRole('button', { name: /Grant Operational Trust/i });
    expect(grant).toBeDisabled();
  });

  it('requires reviewer note on reject', async () => {
    mockedApi.getSupplierApprovalQueue.mockResolvedValue({
      total: 1,
      data: [
        {
          id: 'sup-3',
          type: 'COMPANY',
          status: 'PENDING_APPROVAL',
          companyName: 'Reject Co',
          email: 'reject@test.com',
          country: 'ZA',
          evidenceStatus: 'COMPLETE',
          evidenceComplete: true,
          missingCount: 0,
          expiredCount: 0,
          canApprove: true,
          waitingFor: 'Operational trust review required',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<SupplierApprovalsQueue />);

    fireEvent.click(await screen.findByRole('button', { name: /^Suspend$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm suspend/i }));

    expect(await screen.findByText(/reviewer note is required/i)).toBeInTheDocument();
    expect(mockedApi.transitionSupplierStatus).not.toHaveBeenCalled();
  });
});
