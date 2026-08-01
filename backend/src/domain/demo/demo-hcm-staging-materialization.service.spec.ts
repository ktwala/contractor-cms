import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoHcmStagingMaterializationService } from './demo-hcm-staging-materialization.service';

describe('DemoHcmStagingMaterializationService', () => {
  let service: DemoHcmStagingMaterializationService;
  let prisma: {
    hcmContractorStaging: { findMany: jest.Mock; update: jest.Mock };
    contractor: { findFirst: jest.Mock; create: jest.Mock };
    supplier: { findMany: jest.Mock };
  };
  let normalization: { normalize: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      hcmContractorStaging: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      contractor: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      supplier: {
        findMany: jest.fn(),
      },
    };
    normalization = {
      normalize: jest.fn().mockReturnValue({
        email: 'demo.worker.nosup09@demo.local',
        displayName: 'Demo Worker No Supplier',
        supplier: null,
      }),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'DEMO_MODE') return 'true';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    service = new DemoHcmStagingMaterializationService(
      prisma as any,
      config as unknown as ConfigService,
      normalization as any,
    );
  });

  it('skips workers without a vendor link instead of attaching to the first supplier', async () => {
    prisma.hcmContractorStaging.findMany.mockResolvedValue([
      {
        id: 'staging-9',
        sourcePersonId: 'HCM-WORKER-DEMO-009',
        sourcePayloadJson: {},
      },
    ]);
    prisma.contractor.findFirst.mockResolvedValue(null);
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'atlas-supplier',
        companyName: 'Atlas Industrial Services Pty Ltd',
        tradingName: 'Atlas',
        email: 'atlas@demo.local',
      },
    ]);

    const result = await service.materializeVisibleContractors('org-1');

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(prisma.contractor.create).not.toHaveBeenCalled();
  });
});
