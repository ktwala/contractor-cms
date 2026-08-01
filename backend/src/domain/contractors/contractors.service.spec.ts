import { Test } from '@nestjs/testing';
import { ContractorsService } from './contractors.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AccessIntegrationPublishService } from '../access-integration/access-integration-publish.service';
import { ContractorWorkforceStateService } from './contractor-workforce-state.service';
import { ContractorWorkforceHistoryService } from './contractor-workforce-history.service';
import { ContractorWorkforceEventPublisherService } from './contractor-workforce-event-publisher.service';
import { HcmResponsibleManagerLookupService } from '../../core/hcm/hcm-responsible-manager-lookup.service';

describe('ContractorsService', () => {
  let service: ContractorsService;
  let prisma: {
    contractor: { findMany: jest.Mock; count: jest.Mock };
  };

  const auditService = {
    logAction: jest.fn().mockResolvedValue(undefined),
  };

  const accessIntegrationPublish = {
    publishExternalPersonCreated: jest.fn().mockResolvedValue(undefined),
    publishExternalPersonUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const globalAccess: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: null,
    targetOrganizationId: null,
    isGlobalAccess: true,
    effectivePermissions: new Set(['*:*']),
    supplierScopeId: null,
    responsibleManagerEmployeeId: null,
  };

  const workforceStateService = {
    applyTransition: jest.fn(),
    applyLegacyIsActiveChange: jest.fn(),
  };

  const workforceEventPublisher = {
    publishNominationIntakeStub: jest.fn(),
    publishStub: jest.fn(),
  };

  const workforceHistory = {
    recordTransition: jest.fn().mockResolvedValue(undefined),
    listForContractor: jest.fn().mockResolvedValue([]),
  };

  const hcmResponsibleManagerLookup = {
    assertResponsibleManagerReferencesAllowed: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    prisma = {
      contractor: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContractorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: AccessIntegrationPublishService, useValue: accessIntegrationPublish },
        { provide: ContractorWorkforceStateService, useValue: workforceStateService },
        { provide: ContractorWorkforceEventPublisherService, useValue: workforceEventPublisher },
        { provide: ContractorWorkforceHistoryService, useValue: workforceHistory },
        { provide: HcmResponsibleManagerLookupService, useValue: hcmResponsibleManagerLookup },
      ],
    }).compile();

    service = moduleRef.get(ContractorsService);
  });

  it('findAll includes supplier.type in nested select', async () => {
    await service.findAll(globalAccess, { page: 1, limit: 10 } as any);

    expect(prisma.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          supplier: {
            select: {
              id: true,
              type: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    );
  });
});
