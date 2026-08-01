import { SupplierStatus } from '@prisma/client';
import {
  assertSupplierOperationalTrustGranted,
  isSupplierOperationalTrustGranted,
} from '../supplier-operational-trust.util';

describe('supplier operational trust util', () => {
  it('treats ACTIVE as Operational Trust Granted', () => {
    expect(isSupplierOperationalTrustGranted(SupplierStatus.ACTIVE)).toBe(true);
    expect(isSupplierOperationalTrustGranted(SupplierStatus.PENDING_APPROVAL)).toBe(false);
    expect(isSupplierOperationalTrustGranted(SupplierStatus.SUSPENDED)).toBe(false);
  });

  it('rejects non-granted suppliers with governance message', () => {
    expect(() =>
      assertSupplierOperationalTrustGranted({
        status: SupplierStatus.SUSPENDED,
        supplierName: 'Atlas Consulting',
      }),
    ).toThrow(/Supplier Operational Trust not granted/);
    expect(() =>
      assertSupplierOperationalTrustGranted({ status: SupplierStatus.ACTIVE }),
    ).not.toThrow();
  });
});
