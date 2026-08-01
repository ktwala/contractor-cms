import { Test } from '@nestjs/testing';
import {
  IgaIntegrationPlaneStatus,
  ResponsibleManagerAccountabilityStatus,
} from '@prisma/client';
import { EngagementsService } from './engagements.service';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmResponsibleManagerLookupService } from '../../core/hcm/hcm-responsible-manager-lookup.service';
import { AccessIntegrationPublishService } from '../access-integration/access-integration-publish.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

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
  const accessContext: AccessContext = {
    actorUserId: 'mgr-1',
    actorOrganizationId: orgId,
    targetOrganizationId: orgId,
    isGlobalAccess: false,
    effectivePermissions: new Set(['engagements:create']),
    supplierScopeId: null,
    responsibleManagerEmployeeId: null,
  };

  beforeEach(async () => {
    persistSponsorAssigned = jest.fn().mockResolvedValue(undefined);

    const createdEngagement = {
      id: 'eng-1',
      contractorId: 'c-1',
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
      responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
    };

    txEngagementCreate = jest.fn().mockResolvedValue(createdEngagement);
    txEngagementUpdate = jest.fn().mockResolvedValue({
      ...createdEngagement,
      responsibleManagerEmployeeId: 'hcm:sponsor-2',
    });

    const tx = {
      contractorEngagement: {
        create: txEngagementCreate,
        update: txEngagementUpdate,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'eng-1',
          responsibleManagerEmployeeId: 'hcm:sponsor-1',
          responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
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
          responsibleManagerEmployeeId: 'hcm:sponsor-1',
          responsibleManagerDelegateEmployeeId: null,
          responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
          startDate: new Date('2026-01-01'),
          endDate: null,
          contractor: contractorRow,
          contract: { id: 'ct-1', contractNumber: 'C-1', title: 'T', contractType: 'TIME_AND_MATERIALS', status: 'ACTIVE' },
          project: null,
        }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EngagementsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: HcmResponsibleManagerLookupService,
          useValue: { assertResponsibleManagerReferencesAllowed: jest.fn() },
        },
        {
          provide: AccessIntegrationPublishService,
          useValue: { publishSponsorAssigned: persistSponsorAssigned },
        },
      ],
    }).compile();

    service = moduleRef.get(EngagementsService);
  });

  it('create with sponsor writes RESPONSIBLE_MANAGER_ASSIGNED outbox event', async () => {
    await service.create(orgId, {
      contractorId: 'c-1',
      contractId: 'ct-1',
      role: 'Dev',
      startDate: '2026-01-01',
      rateType: 'HOURLY',
      rateAmount: 100,
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
    } as any);

    expect(persistSponsorAssigned).toHaveBeenCalledTimes(1);
    expect(persistSponsorAssigned.mock.calls[0][1]).toMatchObject({
      id: 'eng-1',
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
    });
    expect(persistSponsorAssigned.mock.calls[0][2]).toBe(orgId);
  });

  it('update changing primary sponsor writes RESPONSIBLE_MANAGER_ASSIGNED outbox event', async () => {
    await service.update(accessContext, orgId, 'eng-1', {
      responsibleManagerEmployeeId: 'hcm:sponsor-2',
    } as any);

    expect(persistSponsorAssigned).toHaveBeenCalledTimes(1);
  });

  it('update without sponsor change does not write RESPONSIBLE_MANAGER_ASSIGNED', async () => {
    const prisma = (service as any).prisma;
    prisma.contractorEngagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      contractorId: 'c-1',
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
      responsibleManagerDelegateEmployeeId: null,
      responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      startDate: new Date('2026-01-01'),
      endDate: null,
    });
    txEngagementUpdate.mockResolvedValue({
      id: 'eng-1',
      contractorId: 'c-1',
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
      responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ACTIVE,
    });

    await service.update(accessContext, orgId, 'eng-1', {
      responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ACTIVE,
    } as any);

    expect(persistSponsorAssigned).not.toHaveBeenCalled();
  });
});
