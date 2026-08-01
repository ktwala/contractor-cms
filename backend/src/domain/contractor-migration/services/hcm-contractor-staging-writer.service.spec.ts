import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { computeHcmSourceHash } from '../utils/source-hash.util';
import { HcmContractorStagingWriterService } from './hcm-contractor-staging-writer.service';

describe('HcmContractorStagingWriterService (PR-CTR-3)', () => {
  let writer: HcmContractorStagingWriterService;
  let prisma: {
    contractorMigrationBatch: { create: jest.Mock; update: jest.Mock };
    hcmContractorStaging: { findUnique: jest.Mock; create: jest.Mock };
    contractorMigrationAudit: { create: jest.Mock };
    contractor: { create: jest.Mock };
    contractorIdentityMap: { create: jest.Mock };
    ctrSequenceRegistry: { update: jest.Mock };
    igaOutboxEvent: { create: jest.Mock };
  };

  const ORG = 'org-1';
  const BATCH = 'batch-1';

  beforeEach(async () => {
    prisma = {
      contractorMigrationBatch: {
        create: jest.fn().mockResolvedValue({ id: BATCH }),
        update: jest.fn().mockResolvedValue({}),
      },
      hcmContractorStaging: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `staging-${data.sourcePersonId}`, ...data }),
        ),
      },
      contractorMigrationAudit: { create: jest.fn().mockResolvedValue({}) },
      contractor: { create: jest.fn() },
      contractorIdentityMap: { create: jest.fn() },
      ctrSequenceRegistry: { update: jest.fn() },
      igaOutboxEvent: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HcmContractorStagingWriterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    writer = moduleRef.get(HcmContractorStagingWriterService);
  });

  const baseRecord = {
    sourcePersonId: 'hcm-100',
    sourcePersonNumber: 'PN-100',
    sourcePayload: {
      person_id: 'hcm-100',
      email: 'worker@example.com',
      worker_type: 'Contingent Worker',
    },
  };

  it('skips duplicate source_hash in same batch', async () => {
    const hash = computeHcmSourceHash(baseRecord.sourcePayload);
    prisma.hcmContractorStaging.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing', sourceHash: hash });

    const summary = await writer.writeRecords(
      {
        organizationId: ORG,
        migrationBatchId: BATCH,
        sourceSystem: 'ORACLE_HCM',
        dryRun: false,
        extractMode: 'FILE',
      },
      [baseRecord, baseRecord],
    );

    expect(summary.inserted).toBe(1);
    expect(summary.skippedDuplicateHash).toBe(1);
    expect(prisma.hcmContractorStaging.create).toHaveBeenCalledTimes(1);
  });

  it('allows new staging version when source_hash differs for same person', async () => {
    const updated = {
      ...baseRecord,
      sourcePayload: { ...baseRecord.sourcePayload, email: 'updated@example.com' },
    };

    const summary = await writer.writeRecords(
      {
        organizationId: ORG,
        migrationBatchId: BATCH,
        sourceSystem: 'ORACLE_HCM',
        dryRun: false,
        extractMode: 'FILE',
      },
      [baseRecord, updated],
    );

    expect(summary.inserted).toBe(2);
    expect(prisma.hcmContractorStaging.create).toHaveBeenCalledTimes(2);
  });

  it('dry-run produces summary without DB staging writes', async () => {
    const summary = await writer.writeRecords(
      {
        organizationId: ORG,
        migrationBatchId: 'dry-batch',
        sourceSystem: 'ORACLE_HCM',
        dryRun: true,
        extractMode: 'FILE',
      },
      [baseRecord],
    );

    expect(summary.dryRun).toBe(true);
    expect(summary.inserted).toBe(1);
    expect(prisma.hcmContractorStaging.create).not.toHaveBeenCalled();
    expect(prisma.contractorMigrationBatch.create).not.toHaveBeenCalled();
  });

  it('does not write operational CMS tables', async () => {
    await writer.writeRecords(
      {
        organizationId: ORG,
        migrationBatchId: BATCH,
        sourceSystem: 'ORACLE_HCM',
        dryRun: false,
        extractMode: 'FILE',
      },
      [baseRecord],
    );

    expect(prisma.contractor.create).not.toHaveBeenCalled();
    expect(prisma.contractorIdentityMap.create).not.toHaveBeenCalled();
    expect(prisma.ctrSequenceRegistry.update).not.toHaveBeenCalled();
    expect(prisma.igaOutboxEvent.create).not.toHaveBeenCalled();
  });
});
