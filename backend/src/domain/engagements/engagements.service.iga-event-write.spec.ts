import { Test } from '@nestjs/testing';
import {
  IgaIntegrationPlaneStatus,
  SponsorAccountabilityStatus,
} from '@prisma/client';
import { EngagementsService } from './engagements.service';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmSponsorLookupService } from '../../core/hcm/hcm-sponsor-lookup.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';

describe('EngagementsService IGA event writes (PR-IGA-EVENT-WRITE-1)', () => {
  let service: EngagementsService;
  let persistSponsorAssigned: jest.Mock;
  let txEngagementCreate: jest.Mock;
  let txEngagementUpdate: jest.Mock;

  const contractorRow = {
    id: 'c-1',
    supplierId: 's-1',
    externalPersonId: null,
    personType: null,
    workerArchetype: null,
    accessIntent: null,
    riskTier: null,
    igaIntegrationStatus: IgaIntegrationPlaneStatus.IGA_UNKNOWN,
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    persistSponsorAssigned = jest.fn().mockResolvedValue(undefined);

    const createdEngagement = {
      id: 'eng-1',
      contractorId: 'c-1',
      sponsorEmployeeId: 'hcm:sponsor-1',
      sponsorStatus: SponsorAccountabilityStatus.SPONSOR_ASSIGNED,
    };

    txEngagementCreate = jest.fn().mockResolvedValue(createdEngagement);
    txEngagementUpdate = jest.fn().mockResolvedValue({
      ...createdEngagement,
      sponsorEmployeeId: 'hcm:sponsor-2',
    });

    const tx = {
      contractorEngagement: {
        create: txEngagementCreate,
        update: txEngagementUpdate,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'eng-1',
          sponsorEmployeeId: 'hcm:sponsor-1',
          sponsorStatus: SponsorAccountabilityStatus.SPONSOR_ASSIGNED,
          contractor: contractorRow,
          contract: { id: 'ct-1' },
          project: null,
        }),
      },
      contractor: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(contractorRow),
      },
    };

    const prisma = {
      contractor: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', isActive: true }) },
      supplierContract: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ct-1', status: 'ACTIVE' }),
      },
      project: { findFirst: jest.fn() },
      contractorEngagement: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'eng-1',
          contractorId: 'c-1',
          sponsorEmployeeId: null,
          sponsorDelegateEmployeeId: null,
          sponsorStatus: null,
          startDate: new Date('2026-01-01'),
          endDate: null,
        }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EngagementsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: HcmSponsorLookupService,
          useValue: { assertSponsorReferencesAllowed: jest.fn() },
        },
        {
          provide: IgaWorkforceEventWriter,
          useValue: { persistSponsorAssigned: persistSponsorAssigned },
        },
      ],
    }).compile();

    service = moduleRef.get(EngagementsService);
  });

  it('create with sponsor writes SPONSOR_ASSIGNED outbox event', async () => {
    await service.create(orgId, {
      contractorId: 'c-1',
      contractId: 'ct-1',
      role: 'Dev',
      startDate: '2026-01-01',
      rateType: 'HOURLY',
      rateAmount: 100,
      sponsorEmployeeId: 'hcm:sponsor-1',
    } as any);

    expect(persistSponsorAssigned).toHaveBeenCalledTimes(1);
    expect(persistSponsorAssigned.mock.calls[0][1]).toMatchObject({
      id: 'eng-1',
      sponsorEmployeeId: 'hcm:sponsor-1',
    });
  });

  it('update changing primary sponsor writes SPONSOR_ASSIGNED outbox event', async () => {
    await service.update(orgId, 'eng-1', {
      sponsorEmployeeId: 'hcm:sponsor-2',
    } as any);

    expect(persistSponsorAssigned).toHaveBeenCalledTimes(1);
  });

  it('update without sponsor change does not write SPONSOR_ASSIGNED', async () => {
    const prisma = (service as any).prisma;
    prisma.contractorEngagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      contractorId: 'c-1',
      sponsorEmployeeId: 'hcm:sponsor-1',
      sponsorDelegateEmployeeId: null,
      sponsorStatus: SponsorAccountabilityStatus.SPONSOR_ASSIGNED,
      startDate: new Date('2026-01-01'),
      endDate: null,
    });
    txEngagementUpdate.mockResolvedValue({
      id: 'eng-1',
      contractorId: 'c-1',
      sponsorEmployeeId: 'hcm:sponsor-1',
      sponsorStatus: SponsorAccountabilityStatus.SPONSOR_ACTIVE,
    });

    await service.update(orgId, 'eng-1', {
      sponsorStatus: SponsorAccountabilityStatus.SPONSOR_ACTIVE,
    } as any);

    expect(persistSponsorAssigned).not.toHaveBeenCalled();
  });
});
