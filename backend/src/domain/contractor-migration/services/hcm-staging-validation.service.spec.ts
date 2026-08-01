import { Test } from '@nestjs/testing';
import {
  HcmMigrationPipelineStatus,
  HcmResponsibleManagerValidationStatus,
  HcmStagingValidationStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { HcmResponsibleManagerLookupService } from '../../../core/hcm/hcm-responsible-manager-lookup.service';
import { HCM_VALIDATION_REASON } from '../constants/hcm-validation-reason-codes';
import { HcmContractorNormalizationService } from './hcm-contractor-normalization.service';
import { HcmStagingQuarantineService } from './hcm-staging-quarantine.service';
import { HcmStagingValidationService } from './hcm-staging-validation.service';

const ORG_ID = 'org-1';
const BATCH_ID = 'batch-1';
const STAGING_ID = 'staging-1';

function validPayload() {
  return {
    first_name: 'Sam',
    last_name: 'Contractor',
    email: 'sam.contractor@example.com',
    worker_type: 'Contingent Worker',
    start_date: '2024-06-01',
    end_date: '2025-06-01',
    sponsor_employee_id: 'cms:emp:sponsor-valid',
    assignment_status: 'Active',
  };
}

function stagingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STAGING_ID,
    organizationId: ORG_ID,
    migrationBatchId: BATCH_ID,
    sourcePersonId: 'hcm-person-1',
    sourcePersonNumber: 'PN-001',
    sourcePayloadJson: validPayload(),
    sourceHash: 'hash-1',
    normalizedPayloadJson: null,
    pipelineStatus: HcmMigrationPipelineStatus.EXTRACTED,
    validationStatus: HcmStagingValidationStatus.PENDING,
    validationErrorsJson: null,
    responsibleManagerValidationStatus: null,
    ...overrides,
  };
}

describe('HcmStagingValidationService (PR-CTR-2B)', () => {
  let service: HcmStagingValidationService;
  let prisma: {
    hcmContractorStaging: {
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    contractor: { findFirst: jest.Mock; create: jest.Mock };
    supplier: { findMany: jest.Mock };
    user: { findFirst: jest.Mock };
    contractorIdentityMap: { create: jest.Mock };
    ctrSequenceRegistry: { update: jest.Mock; create: jest.Mock };
    igaOutboxEvent: { create: jest.Mock };
    contractorMigrationAudit: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let hcmResponsibleManager: {
    isValidationEnabled: jest.Mock;
    validateReferenceFormat: jest.Mock;
    responsibleManagerExists: jest.Mock;
  };
  let quarantineWrite: jest.Mock;

  beforeEach(async () => {
    prisma = {
      hcmContractorStaging: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([{ id: 'supplier-1' }]),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      contractorIdentityMap: { create: jest.fn() },
      ctrSequenceRegistry: { update: jest.fn(), create: jest.fn() },
      igaOutboxEvent: { create: jest.fn() },
      contractorMigrationAudit: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (arg) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg.map((op) => (typeof op === 'function' ? op() : op)));
        }
        return arg(prisma);
      }),
    };

    hcmResponsibleManager = {
      isValidationEnabled: jest.fn().mockReturnValue(true),
      validateReferenceFormat: jest.fn().mockReturnValue(true),
      responsibleManagerExists: jest.fn().mockResolvedValue(true),
    };

    quarantineWrite = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        HcmStagingValidationService,
        HcmContractorNormalizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: HcmResponsibleManagerLookupService, useValue: hcmResponsibleManager },
        {
          provide: HcmStagingQuarantineService,
          useValue: { writeQuarantine: quarantineWrite },
        },
      ],
    }).compile();

    service = moduleRef.get(HcmStagingValidationService);
  });

  it('passes valid active contractor', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.PASSED);
    expect(result.pipelineStatus).toBe(HcmMigrationPipelineStatus.VALIDATED);
    expect(result.responsibleManagerValidationStatus).toBe(HcmResponsibleManagerValidationStatus.VALID);
    expect(result.errors).toHaveLength(0);
    expect(prisma.hcmContractorStaging.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validationStatus: HcmStagingValidationStatus.PASSED,
        }),
      }),
    );
    expect(quarantineWrite).not.toHaveBeenCalled();
  });

  it('quarantines missing sponsor', async () => {
    const payload = { ...validPayload(), sponsor_employee_id: '' };
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(
      stagingRow({ sourcePayloadJson: payload }),
    );

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.QUARANTINED);
    expect(result.errors.some((e) => e.code === HCM_VALIDATION_REASON.MISSING_RESPONSIBLE_MANAGER)).toBe(
      true,
    );
    expect(quarantineWrite).toHaveBeenCalled();
  });

  it('quarantines inactive sponsor when HCM validation enabled', async () => {
    hcmResponsibleManager.responsibleManagerExists.mockResolvedValue(false);
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.QUARANTINED);
    expect(result.errors.some((e) => e.code === HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_INACTIVE)).toBe(
      true,
    );
    expect(result.responsibleManagerValidationStatus).toBe(HcmResponsibleManagerValidationStatus.INACTIVE);
  });

  it('quarantines duplicate HCM person in staging', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());
    prisma.hcmContractorStaging.count.mockResolvedValueOnce(1);

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.QUARANTINED);
    expect(
      result.errors.some((e) => e.code === HCM_VALIDATION_REASON.DUPLICATE_SOURCE_PERSON),
    ).toBe(true);
  });

  it('quarantines employee/contractor collision', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-internal',
      email: 'sam.contractor@example.com',
      userType: UserType.INTERNAL,
    });

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.QUARANTINED);
    expect(
      result.errors.some(
        (e) => e.code === HCM_VALIDATION_REASON.EMPLOYEE_CONTRACTOR_COLLISION,
      ),
    ).toBe(true);
  });

  it('quarantines invalid date range', async () => {
    const payload = {
      ...validPayload(),
      start_date: '2025-01-01',
      end_date: '2024-01-01',
    };
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(
      stagingRow({ sourcePayloadJson: payload }),
    );

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.QUARANTINED);
    expect(result.errors.some((e) => e.code === HCM_VALIDATION_REASON.INVALID_DATE_RANGE)).toBe(
      true,
    );
  });

  it('quarantines overlapping engagement with another staging row', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());
    prisma.hcmContractorStaging.findMany.mockResolvedValueOnce([
      {
        normalizedPayloadJson: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      },
    ]);

    const result = await service.validate({
      stagingId: STAGING_ID,
      organizationId: ORG_ID,
    });

    expect(result.validationStatus).toBe(HcmStagingValidationStatus.QUARANTINED);
    expect(
      result.errors.some((e) => e.code === HCM_VALIDATION_REASON.OVERLAPPING_ENGAGEMENT),
    ).toBe(true);
  });

  it('marks staging row PASSED only after all validations pass', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());

    await service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID });

    const updateCall = prisma.hcmContractorStaging.update.mock.calls.find(
      (c) => c[0].data?.validationStatus === HcmStagingValidationStatus.PASSED,
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[0].data.validationStatus).toBe(HcmStagingValidationStatus.PASSED);
    expect(updateCall[0].data.pipelineStatus).toBe(HcmMigrationPipelineStatus.VALIDATED);
  });

  it('rejects re-validation of PROMOTED staging rows', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(
      stagingRow({ validationStatus: HcmStagingValidationStatus.PROMOTED }),
    );

    await expect(
      service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID }),
    ).rejects.toThrow(/PROMOTED/);
  });

  describe('drift guards — no promotion side effects', () => {
    beforeEach(() => {
      prisma.hcmContractorStaging.findUnique.mockResolvedValue(stagingRow());
    });

    it('does not create Contractor', async () => {
      await service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID });
      expect(prisma.contractor.create).not.toHaveBeenCalled();
    });

    it('does not issue CTR-* (no sequence registry writes)', async () => {
      await service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID });
      expect(prisma.ctrSequenceRegistry.create).not.toHaveBeenCalled();
      expect(prisma.ctrSequenceRegistry.update).not.toHaveBeenCalled();
    });

    it('does not write identity map', async () => {
      await service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID });
      expect(prisma.contractorIdentityMap.create).not.toHaveBeenCalled();
    });

    it('does not publish IGA outbox event', async () => {
      await service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID });
      expect(prisma.igaOutboxEvent.create).not.toHaveBeenCalled();
    });

    it('does not set validation_status to PROMOTED', async () => {
      await service.validate({ stagingId: STAGING_ID, organizationId: ORG_ID });
      const promotedUpdate = prisma.hcmContractorStaging.update.mock.calls.find(
        (c) => c[0].data?.validationStatus === HcmStagingValidationStatus.PROMOTED,
      );
      expect(promotedUpdate).toBeUndefined();
    });
  });
});
