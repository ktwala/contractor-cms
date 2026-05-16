import { getSupplierPortalErrorMessage } from '@/lib/supplier-portal-errors';
import { AxiosError } from 'axios';

describe('getSupplierPortalErrorMessage', () => {
  it('maps 403 membership errors', () => {
    const err = new AxiosError('Forbidden');
    err.response = {
      status: 403,
      data: { message: 'Active supplier membership required for supplier portal access' },
      statusText: 'Forbidden',
      headers: {},
      config: {} as never,
    };
    expect(getSupplierPortalErrorMessage(err, 'fallback')).toMatch(/Supplier membership required/);
  });

  it('maps network errors', () => {
    const err = new AxiosError('Network');
    err.code = 'ERR_NETWORK';
    expect(getSupplierPortalErrorMessage(err, 'fallback')).toMatch(/Cannot reach the API/);
  });
});
