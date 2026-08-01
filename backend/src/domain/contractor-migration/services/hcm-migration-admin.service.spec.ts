import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { SourceIntegrationService } from '../../../integration/source-integration.service';
import { HcmMigrationAdminService } from './hcm-migration-admin.service';
import { HcmMigrationWorkshopService } from './hcm-migration-workshop.service';

describe('HcmMigrationAdminService', () => {
  let service: HcmMigrationAdminService;
  const prisma = {
    contractorMigrationBatch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    hcmContractorStaging: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    hcmContractorQuarantine: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const sourceIntegration = {
    bootstrapContractorsFromFile: jest.fn(),
    bootstrapContractorsFromOracleRest: jest.fn(),
  };
  const workshop = {
    validateBatch: jest.fn(),
    promoteBatch: jest.fn(),
  };
  const accessContext = { targetOrganizationId: 'org-1' } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmMigrationAdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: SourceIntegrationService, useValue: sourceIntegration },
        { provide: HcmMigrationWorkshopService, useValue: workshop },
      ],
    }).compile();

    service = module.get(HcmMigrationAdminService);
  });

  it('ingestFile delegates to source integration adapter boundary', async () => {
    sourceIntegration.bootstrapContractorsFromFile.mockResolvedValue({
      migrationBatchId: 'b1',
    });
    const dto = { format: 'json' as const, content: '[]' };
    await service.ingestFile(accessContext, 'org-1', dto);
    expect(sourceIntegration.bootstrapContractorsFromFile).toHaveBeenCalledWith(
      accessContext,
      'org-1',
      dto,
    );
  });

  it('getBatch throws when batch is outside org', async () => {
    prisma.contractorMigrationBatch.findFirst.mockResolvedValue(null);
    await expect(service.getBatch('org-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('validateBatch delegates to workshop', async () => {
    prisma.contractorMigrationBatch.findFirst.mockResolvedValue({ id: 'b1' });
    workshop.validateBatch.mockResolvedValue([
      {
        stagingId: 's1',
        sourcePersonId: 'p1',
        validationStatus: 'PASSED',
        errorCount: 0,
      },
    ]);

    const result = await service.validateBatch('org-1', 'b1');
    expect(workshop.validateBatch).toHaveBeenCalledWith('org-1', 'b1');
    expect(result.validated).toBe(1);
  });

  it('promoteBatch delegates to workshop with options', async () => {
    prisma.contractorMigrationBatch.findFirst.mockResolvedValue({ id: 'b1' });
    workshop.promoteBatch.mockResolvedValue([
      { stagingId: 's1', success: true, contractorBusinessId: 'CTR-X-1' },
    ]);

    const result = await service.promoteBatch('org-1', 'b1', {
      publishToIga: false,
      dryRun: true,
    });
    expect(workshop.promoteBatch).toHaveBeenCalledWith('org-1', 'b1', {
      publishToIga: false,
      dryRun: true,
    });
    expect(result.attempted).toBe(1);
  });
});
