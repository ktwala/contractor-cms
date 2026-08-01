import { ConfigService } from '@nestjs/config';
import {
  OracleSupplierConnectorHealth,
  SupplierAuthorityMode,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierType,
} from '@prisma/client';
import { SupplierGovernanceDashboardService } from '../supplier-governance-dashboard.service';
import { SupplierEvidenceChecklistService } from '../supplier-evidence-checklist.service';

describe('SupplierGovernanceDashboardService (PR-CMS-GOV-1E)', () => {
  const evidenceChecklist = new SupplierEvidenceChecklistService({} as never);
  const config = {
    get: () => undefined,
  } as unknown as ConfigService;
  const prisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue({
        oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.UNKNOWN,
        oracleSupplierLastSuccessfulSyncAt: null,
        oracleSupplierConnectorLastError: null,
      }),
    },
    supplier: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: SupplierGovernanceDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findUnique.mockResolvedValue({
      supplierAuthorityMode: SupplierAuthorityMode.CMS_ONLY,
      oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.UNKNOWN,
      oracleSupplierLastSuccessfulSyncAt: null,
      oracleSupplierConnectorLastError: null,
    });
    service = new SupplierGovernanceDashboardService(
      prisma as never,
      evidenceChecklist,
      config,
    );
  });

  it('aggregates Oracle-linked lifecycle buckets', async () => {
    prisma.supplier.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5);

    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 's1',
        type: SupplierType.COMPANY,
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-1',
        sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
        documents: [],
      },
      {
        id: 's2',
        type: SupplierType.COMPANY,
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-2',
        sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
        documents: [{ id: 'd1', type: 'COMPANY_REGISTRATION', fileName: 'a.pdf', expiryDate: null, uploadedAt: new Date() }],
      },
    ]);

    jest.spyOn(evidenceChecklist, 'evaluateChecklist').mockImplementation(
      (_id, _type, _jurisdiction, _docs) =>
        ({
          complete: _id === 's2',
          missingCount: _id === 's1' ? 2 : 0,
          expiredCount: 0,
          jurisdictionCode: 'ZA',
        }) as never,
    );

    const result = await service.getDashboard({
      targetOrganizationId: 'org-1',
    } as never);

    expect(result.buckets.synced).toBe(3);
    expect(result.buckets.active).toBe(1);
    expect(result.buckets.suspended).toBe(1);
    expect(result.buckets.pendingEvidence).toBe(1);
    expect(result.oracleLinkedTotal).toBe(5);
    expect(result.oracleConnectorHealth).toBe(
      OracleSupplierConnectorHealth.DISABLED,
    );

    expect(prisma.supplier.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
        }),
      }),
    );
  });
});
