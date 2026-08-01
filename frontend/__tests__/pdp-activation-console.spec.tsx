import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PdpActivationConsole } from '@/components/pdp/PdpActivationConsole';
import { pdpActivationService } from '@/services/pdp-activation.service';

jest.mock('@/services/pdp-activation.service', () => ({
  pdpActivationService: {
    listRules: jest.fn(),
    createRule: jest.fn(),
    updateRule: jest.fn(),
    disableRule: jest.fn(),
    previewEvaluation: jest.fn(),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    can: () => true,
    user: { id: 'u1' },
  }),
}));

describe('PdpActivationConsole UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pdpActivationService.listRules as jest.Mock).mockResolvedValue({
      rules: [],
      isEmergencyOverrideActive: false,
    });
  });

  it('uses light shell page title and simulation section (no dark PDP panel)', async () => {
    const { container } = render(<PdpActivationConsole />);
    expect(await screen.findByRole('heading', { name: /Policy evaluation rules/i })).toBeInTheDocument();
    expect(screen.getByText(/simulate evaluation decisions/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Simulation playground/i })).toBeInTheDocument();
    expect(container.querySelector('.bg-slate-900')).toBeNull();
  });

  it('renders the emergency override banner if active', async () => {
    (pdpActivationService.listRules as jest.Mock).mockResolvedValue({
      rules: [],
      isEmergencyOverrideActive: true,
    });

    render(<PdpActivationConsole />);
    expect(await screen.findByText(/Emergency override active/i)).toBeInTheDocument();
  });

  it('renders active rules in the table', async () => {
    (pdpActivationService.listRules as jest.Mock).mockResolvedValue({
      rules: [
        {
          id: 'rule-1',
          isActive: true,
          enforcementLevel: 'HARD_BLOCK',
          reasonCode: 'POST_EXPIRY_LABOR_PROHIBITED',
          environment: 'production',
          rolloutPercent: 100,
          priority: 10,
        },
      ],
      isEmergencyOverrideActive: false,
    });

    render(<PdpActivationConsole />);

    expect(await screen.findByText('POST_EXPIRY_LABOR_PROHIBITED')).toBeInTheDocument();
    expect(screen.getByText('HARD_BLOCK')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('opens the modal when New Activation Rule is clicked', async () => {
    render(<PdpActivationConsole />);

    const newBtn = await screen.findByRole('button', { name: /New Activation Rule/i });
    fireEvent.click(newBtn);

    expect(screen.getByRole('heading', { name: /^New Activation Rule$/i })).toBeInTheDocument();
  });

  it('shows API-backed empty state when no rules', async () => {
    render(<PdpActivationConsole />);
    expect(await screen.findByText('No activation rules yet')).toBeInTheDocument();
  });
});
