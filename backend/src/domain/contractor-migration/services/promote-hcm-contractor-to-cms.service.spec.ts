import { Test } from '@nestjs/testing';
import {
  AcquisitionModel,
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
  HcmMigrationPipelineStatus,
  HcmResponsibleManagerValidationStatus,
  HcmStagingValidationStatus,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AccessIntegrationPublishService } from '../../access-integration/access-integration-publish.service';
import {
  HCM_BOOTSTRAP_WORKFORCE_HISTORY_REASON,
} from '../../contractors/contractor-workforce-history.constants';
import { ContractorWorkforceHistoryService } from '../../contractors/contractor-workforce-history.service';
import { PROMOTION_ERROR } from '../constants/promotion-error-codes';
import { HcmContractorNormalizationService } from './hcm-contractor-normalization.service';
import { CtrSequenceService } from './ctr-sequence.service';
import { PromoteHcmContractorToCmsService } from './promote-hcm-contractor-to-cms.service';

const STAGING_ID = 'staging-promote-1';
const ORG_ID = 'org-1';
const BATCH_ID = 'batch-1';
const SUPPLIER_ID = 'supplier-1';
const CONTRACT_ID = 'contract-1';

function passedStagingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STAGING_ID,
    organizationId: ORG_ID,
    migrationBatchId: BATCH_ID,
    sourcePersonId: 'hcm-9001',
    sourcePersonNumber: 'PN-9001',
    sourcePayloadJson: {
      first_name: 'Pat',
      last_name: 'Promote',
      email: 'pat.promote@example.com',
      worker_type: 'Contingent Worker',
      start_date: '2024-01-01',
      sponsor_employee_id: 'ewp:emp:responsible-manager-valid',
      assignment_status: 'Active',
      vendor_name: 'Acme Vendor',
    },
    sourceHash: 'hash-promote',
    normalizedPayloadJson: {
      sourcePersonId: 'hcm-9001',
      sourcePersonNumber: 'PN-9001',
      email: 'pat.promote@example.com',
      workerType: 'Contingent Worker',
      displayName: 'Pat Promote',
      startDate: '2024-01-01',
      responsibleManagerEmployeeId: 'ewp:emp:responsible-manager-valid',
      assignmentStatus: 'Active',
      supplier: 'Acme Vendor',
    },
    pipelineStatus: HcmMigrationPipelineStatus.VALIDATED,
    validationStatus: HcmStagingValidationStatus.PASSED,
    responsibleManagerValidationStatus: HcmResponsibleManagerValidationStatus.VALID,
    ...overrides,
  };
}

describe('PromoteHcmContractorToCmsService (PR-CTR-5)', () => {
  let service: PromoteHcmContractorToCmsService;
  let tx: Record<string, any>;
  let prisma: {
    hcmContractorStaging: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let ctrIssue: jest.Mock;
  let publishAcquisitionMigratedIntent: jest.Mock;
  let recordWorkforceHistory: jest.Mock;
  let transactionFailed = false;

  beforeEach(async () => {
    transactionFailed = false;
    tx = {
      hcmContractorStaging: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
      organization: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ code: 'LSO' }),
        findUnique: jest.fn(),
      },
      supplier: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: SUPPLIER_ID, companyName: 'Acme Vendor', tradingName: null, status: 'ACTIVE' },
          ]),
        findFirst: jest.fn(),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: SUPPLIER_ID, companyName: 'Acme Vendor', tradingName: null, status: 'ACTIVE' }),
      },
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'contractor-new', ...data }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'existing-c', ...data }),
        ),
      },
      supplierContract: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: CONTRACT_ID, supplierId: SUPPLIER_ID }),
      },
      contractorEngagement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'engagement-new', contractorId: 'contractor-new' }),
        update: jest.fn(),
      },
      contractorIdentityMap: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      contractorMigrationAudit: {
        create: jest.fn().mockResolvedValue({}),
      },
      ctrSequenceRegistry: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    prisma = {
      hcmContractorStaging: {
        findUnique: jest.fn().mockResolvedValue(passedStagingRow()),
      },
      $transaction: jest.fn(async (fn) => {
        try {
          return await fn(tx);
        } catch (e) {
          transactionFailed = true;
          throw e;
        }
      }),
    };

    ctrIssue = jest.fn().mockResolvedValue('CTR-LSO-00000001');
    publishAcquisitionMigratedIntent = jest.fn().mockResolvedValue(undefined);
    recordWorkforceHistory = jest.fn().mockResolvedValue({ id: 'history-1' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PromoteHcmContractorToCmsService,
        HcmContractorNormalizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CtrSequenceService, useValue: { issueNext: ctrIssue } },
        {
          provide: AccessIntegrationPublishService,
          useValue: { publishAcquisitionMigratedIntent },
        },
        {
          provide: ContractorWorkforceHistoryService,
          useValue: { recordTransition: recordWorkforceHistory },
        },
      ],
    }).compile();

    service = moduleRef.get(PromoteHcmContractorToCmsService);
    tx.hcmContractorStaging.findUnique.mockResolvedValue(passedStagingRow());
  });

  it('rejects PENDING / FAILED / QUARANTINED', async () => {
    for (const status of [
      HcmStagingValidationStatus.PENDING,
      HcmStagingValidationStatus.FAILED,
      HcmStagingValidationStatus.QUARANTINED,
    ]) {
      prisma.hcmContractorStaging.findUnique.mockResolvedValue(
        passedStagingRow({ validationStatus: status }),
      );
      const result = await service.execute(STAGING_ID);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(PROMOTION_ERROR.NOT_PASSED);
    }
  });

  it('rejects already PROMOTED', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(
      passedStagingRow({
        validationStatus: HcmStagingValidationStatus.PROMOTED,
        pipelineStatus: HcmMigrationPipelineStatus.PROMOTED,
      }),
    );

    const result = await service.execute(STAGING_ID);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(PROMOTION_ERROR.ALREADY_PROMOTED);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks missing VALID sponsor', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(
      passedStagingRow({
        responsibleManagerValidationStatus: HcmResponsibleManagerValidationStatus.MISSING,
      }),
    );

    const result = await service.execute(STAGING_ID);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(PROMOTION_ERROR.RESPONSIBLE_MANAGER_NOT_VALID);
  });

  it('issues CTR-* once on promote', async () => {
    const result = await service.execute(STAGING_ID);
    expect(result.success).toBe(true);
    expect(result.contractorBusinessId).toBe('CTR-LSO-00000001');
    expect(ctrIssue).toHaveBeenCalledTimes(1);
  });

  it('does not issue CTR-* when contractor already has business id', async () => {
    tx.contractor.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where?.legacySourcePersonId === 'hcm-9001') {
        return Promise.resolve({
          id: 'existing-c',
          contractorBusinessId: 'CTR-LSO-00000099',
          legacySourcePersonId: 'hcm-9001',
        });
      }
      return Promise.resolve(null);
    });

    const result = await service.execute(STAGING_ID);
    expect(result.contractorBusinessId).toBe('CTR-LSO-00000099');
    expect(ctrIssue).not.toHaveBeenCalled();
  });

  it('creates contractor, engagement, and identity map', async () => {
    await service.execute(STAGING_ID);

    expect(tx.contractor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acquisitionModel: AcquisitionModel.SUPPLIER,
          supplierId: SUPPLIER_ID,
        }),
      }),
    );
    expect(tx.contractorEngagement.create).toHaveBeenCalled();
    expect(tx.contractorIdentityMap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          contractorBusinessId: 'CTR-LSO-00000001',
          legacyHcmPersonId: 'hcm-9001',
        }),
      }),
    );
  });

  it('writes migration audit', async () => {
    await service.execute(STAGING_ID);
    expect(tx.contractorMigrationAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PROMOTED',
          stagingId: STAGING_ID,
          contractorId: 'contractor-new',
        }),
      }),
    );
  });

  it('records HCM bootstrap workforce history on successful promote', async () => {
    await service.execute(STAGING_ID);

    expect(recordWorkforceHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        contractorId: 'contractor-new',
        organizationId: ORG_ID,
        fromState: null,
        toState: ContractorWorkforceState.ACTIVE,
        reason: HCM_BOOTSTRAP_WORKFORCE_HISTORY_REASON,
        source: ContractorWorkforceHistorySource.HCM_BOOTSTRAP,
        effectiveAt: new Date('2024-01-01'),
        metadata: expect.objectContaining({
          stagingId: STAGING_ID,
          migrationBatchId: BATCH_ID,
          sourcePersonId: 'hcm-9001',
          sourcePersonNumber: 'PN-9001',
          engagementId: 'engagement-new',
          hcmBootstrap: true,
        }),
      }),
    );
  });

  it('does not record workforce history on dry-run', async () => {
    await service.execute(STAGING_ID, { dryRun: true });
    expect(recordWorkforceHistory).not.toHaveBeenCalled();
  });

  it('does not record workforce history when promote is rejected', async () => {
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(
      passedStagingRow({
        validationStatus: HcmStagingValidationStatus.PROMOTED,
        pipelineStatus: HcmMigrationPipelineStatus.PROMOTED,
      }),
    );

    await service.execute(STAGING_ID);
    expect(recordWorkforceHistory).not.toHaveBeenCalled();
  });

  it('marks staging row PROMOTED only after success', async () => {
    await service.execute(STAGING_ID);

    expect(tx.hcmContractorStaging.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validationStatus: HcmStagingValidationStatus.PROMOTED,
          pipelineStatus: HcmMigrationPipelineStatus.PROMOTED,
          issuedContractorBusinessId: 'CTR-LSO-00000001',
        }),
      }),
    );
  });

  it('advances pipeline to IGA_PUBLISHED when publishToIga is true', async () => {
    await service.execute(STAGING_ID);

    expect(tx.hcmContractorStaging.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pipelineStatus: HcmMigrationPipelineStatus.IGA_PUBLISHED,
        }),
      }),
    );
    expect(tx.contractorMigrationAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'IGA_PUBLISHED',
        }),
      }),
    );
  });

  it('leaves pipeline at PROMOTED when publishToIga is false', async () => {
    await service.execute(STAGING_ID, { publishToIga: false });

    const pipelineUpdates = tx.hcmContractorStaging.update.mock.calls.map(
      (call: [{ data: { pipelineStatus?: string } }]) =>
        call[0].data.pipelineStatus,
    );
    expect(pipelineUpdates).toEqual([HcmMigrationPipelineStatus.PROMOTED]);
    expect(pipelineUpdates).not.toContain(HcmMigrationPipelineStatus.IGA_PUBLISHED);
  });

  it('publishes IGA outbox event only after success', async () => {
    await service.execute(STAGING_ID);

    expect(publishAcquisitionMigratedIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        cmsContractorId: 'contractor-new',
        contractorBusinessId: 'CTR-LSO-00000001',
        legacyHcmPersonId: 'hcm-9001',
        responsibleManagerEmployeeId: 'ewp:emp:responsible-manager-valid',
        migrationBatchId: BATCH_ID,
        organizationId: ORG_ID,
      }),
    );
  });

  it('skips IGA publish when publishToIga is false', async () => {
    await service.execute(STAGING_ID, { publishToIga: false });
    expect(publishAcquisitionMigratedIntent).not.toHaveBeenCalled();
  });

  it('runs in transaction', async () => {
    await service.execute(STAGING_ID);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('promotes HCM row without vendor as INDEPENDENT (no supplierId)', async () => {
    const independentRow = passedStagingRow({
      normalizedPayloadJson: {
        sourcePersonId: 'hcm-9001',
        sourcePersonNumber: 'PN-9001',
        email: 'pat.promote@example.com',
        workerType: 'Contingent Worker',
        displayName: 'Pat Promote',
        startDate: '2024-01-01',
        responsibleManagerEmployeeId: 'ewp:emp:responsible-manager-valid',
        assignmentStatus: 'Active',
      },
      sourcePayloadJson: {
        first_name: 'Pat',
        last_name: 'Promote',
        email: 'pat.promote@example.com',
        sponsor_employee_id: 'ewp:emp:responsible-manager-valid',
      },
    });
    prisma.hcmContractorStaging.findUnique.mockResolvedValue(independentRow);
    tx.hcmContractorStaging.findUnique.mockResolvedValue(independentRow);

    await service.execute(STAGING_ID);

    expect(tx.contractor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          acquisitionModel: AcquisitionModel.INDEPENDENT,
          supplierId: null,
        }),
      }),
    );
    expect(tx.supplierContract.findFirst).not.toHaveBeenCalled();
    expect(tx.contractorEngagement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responsibleManagerEmployeeId: 'ewp:emp:responsible-manager-valid',
        }),
      }),
    );
    expect(tx.contractorEngagement.create.mock.calls[0][0].data).not.toHaveProperty(
      'contractId',
    );
  });

  it('does not mark PROMOTED when transaction fails mid-flight', async () => {
    tx.contractorEngagement.create.mockRejectedValueOnce(new Error('boom'));
    await expect(service.execute(STAGING_ID)).rejects.toThrow();
    expect(transactionFailed).toBe(true);
    expect(recordWorkforceHistory).not.toHaveBeenCalled();
    const promotedUpdate = tx.hcmContractorStaging.update.mock.calls.find(
      (c: [{ data?: { validationStatus?: string } }]) =>
        c[0]?.data?.validationStatus === HcmStagingValidationStatus.PROMOTED,
    );
    expect(promotedUpdate).toBeUndefined();
    expect(publishAcquisitionMigratedIntent).not.toHaveBeenCalled();
  });
});
