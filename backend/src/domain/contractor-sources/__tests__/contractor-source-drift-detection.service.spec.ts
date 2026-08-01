import {
  ContractorAuthorityMode,
  ContractorSourceDriftType,
  HcmContractorCorrelationMatchStatus,
  MigrationSourceSystem,
} from '@prisma/client';
import { HcmContractorNormalizationService } from '../../contractor-migration/services/hcm-contractor-normalization.service';
import { ContractorSourceDriftDetectionService } from '../contractor-source-drift-detection.service';

describe('ContractorSourceDriftDetectionService (PR-CTR-CONNECTOR-1F)', () => {
  const organizationId = 'org-ctr-drift-1';

  function buildService(authorityMode: ContractorAuthorityMode = ContractorAuthorityMode.HCM_ONLY) {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ contractorAuthorityMode: authorityMode }),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([{ id: 'sup-1' }]),
      },
      hcmContractorStaging: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'stg-1',
            sourcePersonId: 'HCM-PERSON-1',
            sourcePersonNumber: null,
            sourcePayloadJson: { assignment_status: 'terminated' },
            normalizedPayloadJson: {
              assignmentStatus: 'terminated',
              email: 'worker@test.com',
              supplier: 'Acme',
            },
            correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
            correlationConfidence: 'HIGH',
            correlationMatchReason: 'person id',
            proposedContractorId: 'ctr-1',
            validationStatus: 'PASSED',
            proposedContractor: {
              id: 'ctr-1',
              isActive: true,
              email: 'worker@test.com',
              legacySourcePersonId: 'HCM-PERSON-1',
            },
          },
        ]),
      },
      contractor: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      contractorSourceSyncRun: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      contractorSourceDrift: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'drift-1' }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    return {
      service: new ContractorSourceDriftDetectionService(
        prisma as never,
        new HcmContractorNormalizationService(),
      ),
      prisma,
    };
  }

  it('creates GOVERNANCE_LIFECYCLE_CONFLICT for terminated upstream but active contractor (HCM_ONLY)', async () => {
    const { service, prisma } = buildService(ContractorAuthorityMode.HCM_ONLY);
    const result = await service.detectForOrganization(organizationId, 'run-1');

    expect(result.detected).toBeGreaterThan(0);
    expect(prisma.contractorSourceDrift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
          contractorId: 'ctr-1',
          organizationId,
          sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        }),
      }),
    );
  });

  it('skips GOVERNANCE_LIFECYCLE_CONFLICT when CMS is authoritative', async () => {
    const { service, prisma } = buildService(ContractorAuthorityMode.CMS_ONLY);
    await service.detectForOrganization(organizationId, 'run-1');

    const lifecycleCalls = (prisma.contractorSourceDrift.create as jest.Mock).mock.calls.filter(
      ([arg]: [{ data: { driftType: string } }]) =>
        arg.data.driftType === ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
    );
    expect(lifecycleCalls).toHaveLength(0);
  });

  it('creates MISSING_RESPONSIBLE_MANAGER for active imported contractors without sponsor', async () => {
    const prisma = {
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ contractorAuthorityMode: ContractorAuthorityMode.CMS_ONLY }),
      },
      supplier: { findMany: jest.fn().mockResolvedValue([{ id: 'sup-1' }]) },
      hcmContractorStaging: { findMany: jest.fn().mockResolvedValue([]) },
      contractor: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'ctr-flagship',
              legacySourcePersonId: 'HCM-WORKER-DEMO-008',
              email: 'demo.worker.unsponsored08@demo.local',
            },
          ]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      contractorSourceSyncRun: { findFirst: jest.fn().mockResolvedValue(null) },
      contractorSourceDrift: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'drift-unsponsored' }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const service = new ContractorSourceDriftDetectionService(
      prisma as never,
      new HcmContractorNormalizationService(),
    );
    await service.detectForOrganization(organizationId, 'run-1');

    expect(prisma.contractorSourceDrift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driftType: ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
          contractorId: 'ctr-flagship',
        }),
      }),
    );
  });

  it('creates MISSING_RESPONSIBLE_MANAGER for active CMS-native contractors without sponsor', async () => {
    const prisma = {
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ contractorAuthorityMode: ContractorAuthorityMode.CMS_ONLY }),
      },
      supplier: { findMany: jest.fn().mockResolvedValue([{ id: 'sup-1' }]) },
      hcmContractorStaging: { findMany: jest.fn().mockResolvedValue([]) },
      contractor: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'ctr-cms-native',
              legacySourcePersonId: null,
              legacySourceSystem: null,
              email: 'cms.native.unsponsored@demo.local',
            },
          ]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      contractorSourceSyncRun: { findFirst: jest.fn().mockResolvedValue(null) },
      contractorSourceDrift: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'drift-unsponsored-cms' }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const service = new ContractorSourceDriftDetectionService(
      prisma as never,
      new HcmContractorNormalizationService(),
    );
    await service.detectForOrganization(organizationId, 'run-1');

    expect(prisma.contractorSourceDrift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driftType: ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
          contractorId: 'ctr-cms-native',
          sourceSystem: MigrationSourceSystem.CMS_NATIVE,
        }),
      }),
    );
  });
});
