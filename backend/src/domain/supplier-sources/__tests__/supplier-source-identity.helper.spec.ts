import { SupplierSourceSystem } from '@prisma/client';
import {
  assertOracleSourceIdentityNotMutated,
  governanceTwinEmail,
  isOracleLinkedSupplier,
} from '../supplier-source-identity.helper';
import { SupplierSourceIdentityImmutableException } from '../supplier-governance-twin.errors';

describe('supplier-source-identity.helper (PR-CMS-DATA-2)', () => {
  const linked = {
    sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
    externalSupplierId: 'ORA-1',
  };

  it('detects oracle-linked suppliers', () => {
    expect(isOracleLinkedSupplier(linked)).toBe(true);
    expect(
      isOracleLinkedSupplier({
        sourceSystem: SupplierSourceSystem.CMS_NATIVE,
        externalSupplierId: null,
      }),
    ).toBe(false);
  });

  it('blocks externalSupplierId mutation', () => {
    expect(() =>
      assertOracleSourceIdentityNotMutated(
        { ...linked, id: 's1' } as never,
        { externalSupplierId: 'ORA-2' },
      ),
    ).toThrow(SupplierSourceIdentityImmutableException);
  });

  it('builds deterministic governance email', () => {
    const email = governanceTwinEmail('org-uuid', 'ORA-30003');
    expect(email).toContain('oracle.ORA-30003');
    expect(email).toContain('@supplier-governance.invalid');
  });
});
