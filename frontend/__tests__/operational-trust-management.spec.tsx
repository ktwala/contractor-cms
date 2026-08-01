/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OperationalTrustManagement from '@/components/suppliers/OperationalTrustManagement';
import { api } from '@/lib/api';
import { OPERATIONAL_TRUST_LABELS } from '@/lib/operational-trust-labels';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('status=SUSPENDED'),
}));

jest.mock('@/lib/api', () => ({
  api: {
    getSuppliers: jest.fn(),
    getSupplierOperationalTrustEvidence: jest.fn(),
    transitionSupplierStatus: jest.fn(),
  },
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    can: (p: string) => p === 'suppliers:approve' || p === 'suppliers:suspend',
    user: { firstName: 'Ops', lastName: 'Admin', email: 'ops.admin@ewp.demo' },
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('OperationalTrustManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.getSuppliers.mockResolvedValue({
      data: [
        {
          id: 'ubuntu-1',
          status: 'SUSPENDED',
          companyName: 'Ubuntu Field Services (Pty) Ltd',
          tradingName: 'Ubuntu Field Services',
          email: 'samuel@ubuntu.demo',
          externalSupplierId: 'ORCL-SUP-MTN-003',
        },
      ],
    } as never);
    mockedApi.getSupplierOperationalTrustEvidence.mockResolvedValue({
      latestGrant: null,
      latestSuspension: {
        kind: 'SUSPENDED',
        label: 'Operational Trust Suspended',
        actorDisplayName: 'Operations Admin',
        occurredAt: new Date().toISOString(),
        reason: 'Compliance hold',
      },
      events: [],
    } as never);
  });

  it('lists suspended suppliers and restores Operational Trust', async () => {
    mockedApi.transitionSupplierStatus.mockResolvedValue({} as never);

    render(<OperationalTrustManagement />);

    expect(
      await screen.findByText(OPERATIONAL_TRUST_LABELS.managementPageTitle),
    ).toBeInTheDocument();
    expect(await screen.findByText(OPERATIONAL_TRUST_LABELS.lastDecisionColumn)).toBeInTheDocument();
    expect(await screen.findByText(/Suspended today/i)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Restore Operational Trust/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Restore Operational Trust/i }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Supplier restored after governance review.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm restore/i }));

    await waitFor(() => {
      expect(mockedApi.transitionSupplierStatus).toHaveBeenCalledWith('ubuntu-1', {
        targetStatus: 'ACTIVE',
        reason: 'Supplier restored after governance review.',
      });
    });
  });
});
