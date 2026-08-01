import {
  SupplierSourceDriftType,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
} from '@prisma/client';
import { SupplierSourceDriftDetectionService } from '../supplier-source-drift-detection.service';

describe('SupplierSourceDriftDetectionService (PR-CMS-CONNECTOR-4)', () => {
  const organizationId = 'org-drift-1';

  function buildService() {
    const prisma = {
      supplier: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sup-1',
            externalSupplierId: 'ORA-1',
            status: SupplierStatus.ACTIVE,
            sourceSyncStatus: SupplierSourceSyncStatus.NOT_SYNCED,
            companyName: 'Active Drift Co',
            tradingName: null,
            sourceLastSyncedAt: null,
          },
        ]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      supplierSourceStaging: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'stg-1',
            externalSupplierId: 'ORA-2',
            matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
            matchReason: 'supplier number',
            proposedSupplierId: null,
            name: 'Possible Co',
          },
        ]),
      },
      supplierSourceSyncRun: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      supplierSourceDrift: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'drift-1' }),
        update: jest.fn(),
      },
    };

    return {
      service: new SupplierSourceDriftDetectionService(prisma as never),
      prisma,
    };
  }

  it('creates GOVERNANCE_STATE_CONFLICT for ACTIVE supplier not SYNCED', async () => {
    const { service, prisma } = buildService();
    const result = await service.detectForOrganization(organizationId, 'run-1');

    expect(result.detected).toBeGreaterThan(0);
    expect(prisma.supplierSourceDrift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driftType: SupplierSourceDriftType.GOVERNANCE_STATE_CONFLICT,
          organizationId,
        }),
      }),
    );
  });
});
