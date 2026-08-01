/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupplierOperationalTrustPanel from '@/components/suppliers/SupplierOperationalTrustPanel';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    getSupplierOperationalTrustEvidence: jest.fn(),
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('SupplierOperationalTrustPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders as default export and shows chronological decision history', async () => {
    mockedApi.getSupplierOperationalTrustEvidence.mockResolvedValue({
      supplierId: 'ubuntu-1',
      currentStateLabel: 'Operational Trust Granted',
      oracleProcurementLabel: 'Approved',
      events: [
        {
          kind: 'RESTORED',
          label: 'Operational Trust Restored',
          actorDisplayName: 'Operations Admin',
          occurredAt: '2026-07-08T14:00:00.000Z',
          reason: 'Compliance review completed',
        },
        {
          kind: 'SUSPENDED',
          label: 'Operational Trust Suspended',
          actorDisplayName: 'Operations Admin',
          occurredAt: '2026-07-07T10:00:00.000Z',
          reason: 'Investigation hold',
        },
        {
          kind: 'GRANTED',
          label: 'Operational Trust Granted',
          actorDisplayName: 'System',
          occurredAt: '2026-07-01T08:00:00.000Z',
          reason: null,
        },
      ],
      latestGrant: {
        kind: 'RESTORED',
        label: 'Operational Trust Restored',
        actorDisplayName: 'Operations Admin',
        occurredAt: '2026-07-08T14:00:00.000Z',
        reason: 'Compliance review completed',
      },
      latestSuspension: {
        kind: 'SUSPENDED',
        label: 'Operational Trust Suspended',
        actorDisplayName: 'Operations Admin',
        occurredAt: '2026-07-07T10:00:00.000Z',
        reason: 'Investigation hold',
      },
    } as never);

    render(
      <SupplierOperationalTrustPanel supplierId="ubuntu-1" supplierStatus="ACTIVE" />,
    );

    expect(await screen.findByTestId('supplier-operational-trust-panel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('Operational Trust Restored').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Compliance review completed/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('operational-trust-timeline')).toBeInTheDocument();
    expect(screen.getByText('Decision history')).toBeInTheDocument();
  });
});
