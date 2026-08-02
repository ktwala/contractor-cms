import { ContractorWorkforceState, EngagementModel, WorkerClassification, AcquisitionModel } from '@prisma/client';
import { ContractorsService } from './contractors.service';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from './contractor-workforce-domain-events.constants';
import { ContractorWorkforceEventPublisherService } from './contractor-workforce-event-publisher.service';

describe('PR-WORKFORCE-NOMINATE-1 nominate intake', () => {
  const targetOrgId = 'org-1';
  const accessContext = {
    actorUserId: 'user-1',
    targetOrganizationId: targetOrgId,
    isGlobalAccess: false,
  } as never;

  const baseDto = {
    supplierId: 'sup-1',
    firstName: 'Nom',
    lastName: 'Inee',
    email: 'nominee@example.com',
    workerClassification: WorkerClassification.SUPPLIER_CONTRACTOR,
    engagementModel: EngagementModel.AGENCY,
    taxResidency: 'ZA',
    engagement: {
      contractId: 'contract-1',
      role: 'Developer',
      startDate: '2026-06-01',
      rateType: 'HOURLY',
      rateAmount: 500,
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
    },
  } as const;

  it('creates contractor at NOMINATED with placement intent and emits intake stub', async () => {
    const createdContractor = {
      id: 'ctr-nom-1',
      ...baseDto,
      workforceState: ContractorWorkforceState.NOMINATED,
      isActive: false,
      workerClassification: baseDto.workerClassification,
      engagementModel: baseDto.engagementModel,
    };

    const tx = {
      contractor: {
        create: jest.fn().mockResolvedValue(createdContractor),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...createdContractor,
          supplier: { id: 'sup-1', type: 'COMPANY' },
        }),
      },
      contractorEngagement: {
        create: jest.fn().mockResolvedValue({ id: 'eng-1' }),
      },
    };

    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sup-1', status: 'ACTIVE' }),
      },
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      supplierContract: {
        findFirst: jest.fn().mockResolvedValue({ id: 'contract-1', status: 'ACTIVE' }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const auditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    const accessIntegrationPublish = {
      publishExternalPersonCreated: jest.fn().mockResolvedValue(undefined),
    };
    const workforceStateService = {
      applyTransition: jest.fn(),
      applyLegacyIsActiveChange: jest.fn(),
    };
    const workforceEventPublisher = {
      publishNominationIntakeStub: jest.fn().mockResolvedValue(undefined),
    };
    const workforceHistory = {
      recordTransition: jest.fn().mockResolvedValue(undefined),
    };
    const hcmResponsibleManagerLookup = {
      assertResponsibleManagerReferencesAllowed: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ContractorsService(
      prisma as never,
      auditService as never,
      accessIntegrationPublish as never,
      workforceStateService as never,
      workforceEventPublisher as never,
      workforceHistory as never,
      hcmResponsibleManagerLookup as never,
    );

    const result = await service.nominate(accessContext, baseDto as never);

    expect(tx.contractor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acquisitionModel: AcquisitionModel.SUPPLIER,
          workforceState: ContractorWorkforceState.NOMINATED,
          isActive: false,
        }),
      }),
    );
    expect(tx.contractorEngagement.create).toHaveBeenCalled();
    expect(workforceHistory.recordTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        fromState: null,
        toState: ContractorWorkforceState.NOMINATED,
      }),
    );
    expect(workforceEventPublisher.publishNominationIntakeStub).toHaveBeenCalledWith(
      expect.objectContaining({
        contractorId: 'ctr-nom-1',
        engagementId: 'eng-1',
        responsibleManagerEmployeeId: 'hcm:sponsor-1',
      }),
    );
    expect(result.workforceState).toBe(ContractorWorkforceState.NOMINATED);
  });

  it('publishNominationIntakeStub uses ContractorNominated domain event', async () => {
    const auditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    const publisher = new ContractorWorkforceEventPublisherService(auditService as never);

    await publisher.publishNominationIntakeStub({
      contractorId: 'ctr-1',
      organizationId: 'org-1',
      actorUserId: 'user-1',
      reason: 'supplier intake',
    });

    expect(auditService.logAction).toHaveBeenCalledWith(
      'user-1',
      'CONTRACTOR_WORKFORCE_DOMAIN_EVENT',
      'Contractor',
      'ctr-1',
      null,
      { workforceState: ContractorWorkforceState.NOMINATED },
      expect.objectContaining({
        metadata: expect.objectContaining({
          domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED,
          intake: true,
          toState: ContractorWorkforceState.NOMINATED,
        }),
      }),
    );
  });
});
