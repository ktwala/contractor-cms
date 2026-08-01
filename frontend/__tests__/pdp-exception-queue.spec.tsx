import React from 'react';
import { render, screen } from '@testing-library/react';
import { PdpExceptionQueue } from '@/components/pdp/PdpExceptionQueue';
import { pdpExceptionService } from '../services/pdp-exception.service';

jest.mock('../services/pdp-exception.service', () => ({
  pdpExceptionService: {
    listExceptions: jest.fn(),
    approveException: jest.fn(),
    rejectException: jest.fn(),
  },
}));

jest.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'approver-1' },
    can: () => true,
  }),
}));

describe('PdpExceptionQueue UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pdpExceptionService.listExceptions as jest.Mock).mockResolvedValue([]);
  });

  it('uses standard titles and light table shell', async () => {
    const { container } = render(<PdpExceptionQueue />);
    expect(await screen.findByRole('heading', { name: /^Exceptions$/i })).toBeInTheDocument();
    expect(screen.getByText(/Review and approve temporary policy overrides/i)).toBeInTheDocument();
    expect(container.querySelector('.bg-slate-900')).toBeNull();
  });

  it('shows pending empty state copy', async () => {
    render(<PdpExceptionQueue />);
    expect(await screen.findByText('No pending exceptions found')).toBeInTheDocument();
  });
});
