import { SupplierSourceStagingMatchStatus, SupplierSourceSystem } from '@prisma/client';
import { SupplierSourceReconciliationService } from '../supplier-source-reconciliation.service';

describe('SupplierSourceReconciliationService', () => {
  const prisma = {
    supplier: {
      findMany: jest.fn(),
    },
  };

  const service = new SupplierSourceReconciliationService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns MATCHED when externalSupplierId links to Oracle CMS supplier', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'cms-1',
        companyName: 'Linked Co',
        tradingName: null,
        firstName: null,
        lastName: null,
        status: 'ACTIVE',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-1',
        externalSupplierNumber: 'SUP-1',
        taxNumber: 'TAX-1',
        countryCode: 'ZA',
        country: 'ZA',
      },
    ]);

    const outcome = await service.reconcile({
      organizationId: 'org-1',
      externalSupplierId: 'ORA-1',
      supplierNumber: 'SUP-1',
      taxRegistrationNumber: 'TAX-1',
      name: 'Linked Co',
      countryCode: 'ZA',
    });

    expect(outcome.matchStatus).toBe(SupplierSourceStagingMatchStatus.MATCHED);
    expect(outcome.proposedSupplierId).toBe('cms-1');
  });

  it('returns POSSIBLE_MATCH on supplier number only', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'cms-2',
        companyName: 'Number Match Co',
        tradingName: null,
        firstName: null,
        lastName: null,
        status: 'PENDING_APPROVAL',
        sourceSystem: SupplierSourceSystem.CMS_NATIVE,
        externalSupplierId: null,
        externalSupplierNumber: 'SUP-99',
        taxNumber: null,
        countryCode: 'LS',
        country: 'LS',
      },
    ]);

    const outcome = await service.reconcile({
      organizationId: 'org-1',
      externalSupplierId: 'ORA-NEW',
      supplierNumber: 'SUP-99',
      name: 'Oracle Name',
      countryCode: 'LS',
    });

    expect(outcome.matchStatus).toBe(SupplierSourceStagingMatchStatus.POSSIBLE_MATCH);
    expect(outcome.proposedSupplierId).toBe('cms-2');
  });

  it('returns NEW when no CMS supplier matches', async () => {
    prisma.supplier.findMany.mockResolvedValue([]);

    const outcome = await service.reconcile({
      organizationId: 'org-1',
      externalSupplierId: 'ORA-NEW-2',
      supplierNumber: 'SUP-X',
      name: 'Brand New',
      countryCode: 'LS',
    });

    expect(outcome.matchStatus).toBe(SupplierSourceStagingMatchStatus.NEW);
    expect(outcome.proposedSupplierId).toBeNull();
  });

  it('returns CONFLICT when multiple suppliers share tax number', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'cms-a',
        companyName: 'A',
        tradingName: null,
        firstName: null,
        lastName: null,
        status: 'ACTIVE',
        sourceSystem: SupplierSourceSystem.CMS_NATIVE,
        externalSupplierId: null,
        externalSupplierNumber: null,
        taxNumber: 'SHARED-TAX',
        countryCode: 'ZA',
        country: 'ZA',
      },
      {
        id: 'cms-b',
        companyName: 'B',
        tradingName: null,
        firstName: null,
        lastName: null,
        status: 'ACTIVE',
        sourceSystem: SupplierSourceSystem.CMS_NATIVE,
        externalSupplierId: null,
        externalSupplierNumber: null,
        taxNumber: 'SHARED-TAX',
        countryCode: 'ZA',
        country: 'ZA',
      },
    ]);

    const outcome = await service.reconcile({
      organizationId: 'org-1',
      externalSupplierId: 'ORA-C',
      taxRegistrationNumber: 'SHARED-TAX',
      name: 'Conflict',
      countryCode: 'ZA',
    });

    expect(outcome.matchStatus).toBe(SupplierSourceStagingMatchStatus.CONFLICT);
  });
});
