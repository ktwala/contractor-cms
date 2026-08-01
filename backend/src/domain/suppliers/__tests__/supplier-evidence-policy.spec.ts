import {
  SupplierAuthorityMode,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
} from '@prisma/client';
import {
  isProcurementEvidenceTrusted,
  resolveSupplierEvidenceAuthorityMode,
} from '../supplier-evidence-policy';

describe('supplier-evidence-policy', () => {
  it('trusts procurement onboarding for ORACLE_ONLY synced suppliers', () => {
    expect(resolveSupplierEvidenceAuthorityMode(SupplierAuthorityMode.ORACLE_ONLY)).toBe(
      'ORACLE_PROCUREMENT_TRUSTED',
    );
    expect(
      isProcurementEvidenceTrusted({
        evidenceAuthorityMode: 'ORACLE_PROCUREMENT_TRUSTED',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-1',
        sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
      }),
    ).toBe(true);
  });

  it('does not trust unsynced Oracle suppliers', () => {
    expect(
      isProcurementEvidenceTrusted({
        evidenceAuthorityMode: 'ORACLE_PROCUREMENT_TRUSTED',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-1',
        sourceSyncStatus: SupplierSourceSyncStatus.PENDING,
      }),
    ).toBe(false);
  });

  it('requires CMS evidence for CMS_ONLY tenants', () => {
    expect(resolveSupplierEvidenceAuthorityMode(SupplierAuthorityMode.CMS_ONLY)).toBe(
      'CMS_FULL',
    );
  });
});
