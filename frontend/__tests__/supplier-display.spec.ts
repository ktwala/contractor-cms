import { formatSupplierDisplayName } from '../lib/supplier-display';

describe('formatSupplierDisplayName', () => {
  it('renders companyName for COMPANY supplier (even if first/last are null)', () => {
    expect(
      formatSupplierDisplayName({
        type: 'COMPANY',
        companyName: 'Demo Supplier Ltd',
        firstName: null,
        lastName: null,
      }),
    ).toBe('Demo Supplier Ltd');
  });

  it('prefers companyName when present for unknown type (defensive)', () => {
    expect(
      formatSupplierDisplayName({
        companyName: 'Acme Corp',
        firstName: null,
        lastName: null,
      }),
    ).toBe('Acme Corp');
  });

  it('renders trimmed individual name for INDIVIDUAL', () => {
    expect(
      formatSupplierDisplayName({
        type: 'INDIVIDUAL',
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    ).toBe('Jane Doe');
  });

  it('never returns "null null"', () => {
    expect(
      formatSupplierDisplayName({
        type: 'COMPANY',
        companyName: null,
        firstName: null,
        lastName: null,
      }),
    ).toBe('-');

    expect(
      formatSupplierDisplayName({
        type: 'INDIVIDUAL',
        firstName: null,
        lastName: null,
      }),
    ).toBe('-');
  });

  it('returns "-" for missing supplier', () => {
    expect(formatSupplierDisplayName(null)).toBe('-');
    expect(formatSupplierDisplayName(undefined)).toBe('-');
  });
});
