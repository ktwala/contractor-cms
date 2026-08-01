import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ContractRenewalsWidget } from '../components/dashboard/ContractRenewalsWidget';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({
  api: {
    getContracts: jest.fn(),
  },
}));

describe('ContractRenewalsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (api.getContracts as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<ContractRenewalsWidget />);
    expect(screen.getByText('Loading renewals...')).toBeInTheDocument();
  });

  it('fetches and displays renewal metrics', async () => {
    // Mock responses for the 3 api calls
    (api.getContracts as jest.Mock)
      .mockResolvedValueOnce({ total: 5 }) // expired
      .mockResolvedValueOnce({ total: 12 }) // < 30 days
      .mockResolvedValueOnce({ total: 25 }); // < 90 days

    render(<ContractRenewalsWidget />);

    await waitFor(() => {
      expect(screen.queryByText('Loading renewals...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Contract Renewals')).toBeInTheDocument();
    
    // Check metric numbers
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    
    // Check labels
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('< 30 Days')).toBeInTheDocument();
    expect(screen.getByText('< 90 Days')).toBeInTheDocument();
    
    // Check API calls
    expect(api.getContracts).toHaveBeenCalledTimes(3);
    expect(api.getContracts).toHaveBeenNthCalledWith(1, { expiryState: 'expired', limit: 1 });
    expect(api.getContracts).toHaveBeenNthCalledWith(2, { expiresWithinDays: 30, limit: 1 });
    expect(api.getContracts).toHaveBeenNthCalledWith(3, { expiresWithinDays: 90, limit: 1 });
  });

  it('handles API errors gracefully by showing 0', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (api.getContracts as jest.Mock).mockRejectedValue(new Error('API failed'));

    render(<ContractRenewalsWidget />);

    await waitFor(() => {
      expect(screen.queryByText('Loading renewals...')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('0')).toHaveLength(3);
    consoleSpy.mockRestore();
  });
});
