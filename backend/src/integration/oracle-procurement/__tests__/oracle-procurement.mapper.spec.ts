import { mapOracleProcurementItems } from '../oracle-procurement.mapper';

describe('mapOracleProcurementItems (PR-CMS-CONNECTOR-1A)', () => {
  it('maps Oracle FCM supplier list items to normalized records', () => {
    const body = {
      items: [
        {
          SupplierId: 'ORA-9001',
          Supplier: 'Acme Holdings',
          SupplierNumber: 'SUP-9001',
          CountryCode: 'ZA',
          TaxRegistrationNumber: 'ZA-TAX-9001',
          LastUpdateDate: '2026-05-01T10:00:00Z',
        },
      ],
      hasMore: false,
    };

    const records = mapOracleProcurementItems(body);
    expect(records).toHaveLength(1);
    expect(records[0].externalSupplierId).toBe('ORA-9001');
    expect(records[0].legalName).toBe('Acme Holdings');
    expect(records[0].countryCode).toBe('ZA');
    expect(records[0].sourceSystem).toBe('ORACLE_SUPPLIER_SAAS');
    expect(records[0].rawHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
