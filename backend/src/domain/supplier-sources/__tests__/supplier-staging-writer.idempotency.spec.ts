import {
  SupplierSourceStagingMatchStatus,
  SupplierType,
} from '@prisma/client';
import { SupplierStagingWriterService } from '../supplier-staging-writer.service';
import { SupplierSourceReconciliationService } from '../supplier-source-reconciliation.service';

describe('SupplierStagingWriterService idempotency (PR-CMS-CONNECTOR-1C)', () => {
  const prisma = {
    supplierSourceStaging: { upsert: jest.fn() },
  };
  const reconciliation = {
    reconcile: jest.fn(),
    presentMatchedSupplierSummary: jest.fn(),
  };

  let writer: SupplierStagingWriterService;

  beforeEach(() => {
    jest.clearAllMocks();
    writer = new SupplierStagingWriterService(
      prisma as never,
      reconciliation as unknown as SupplierSourceReconciliationService,
    );
    reconciliation.reconcile.mockResolvedValue({
      matchStatus: SupplierSourceStagingMatchStatus.NEW,
      proposedSupplierId: null,
      matchReason: null,
    });
    prisma.supplierSourceStaging.upsert.mockResolvedValue({ id: 'stg-1' });
  });

  it('upserts by organizationId + sourceSystem + externalSupplierId', async () => {
    await writer.upsertRecords('org-1', [
      {
        sourceSystem: 'ORACLE_SUPPLIER_SAAS',
        externalSupplierId: 'ORA-1',
        legalName: 'Acme',
        countryCode: 'ZA',
        rawHash: 'abc',
      },
    ]);

    expect(prisma.supplierSourceStaging.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_sourceSystem_externalSupplierId: {
            organizationId: 'org-1',
            sourceSystem: 'ORACLE_SUPPLIER_SAAS',
            externalSupplierId: 'ORA-1',
          },
        },
      }),
    );
  });

  it('replay of same external id updates staging row (idempotent)', async () => {
    const record = {
      sourceSystem: 'ORACLE_SUPPLIER_SAAS' as const,
      externalSupplierId: 'ORA-REPLAY',
      legalName: 'Replay Co',
      countryCode: 'ZA',
      rawHash: 'hash-v1',
    };

    await writer.upsertRecords('org-1', [record]);
    await writer.upsertRecords('org-1', [{ ...record, rawHash: 'hash-v2' }]);

    expect(prisma.supplierSourceStaging.upsert).toHaveBeenCalledTimes(2);
    const secondCall = prisma.supplierSourceStaging.upsert.mock.calls[1][0];
    expect(secondCall.update.name).toBe('Replay Co');
  });
});
