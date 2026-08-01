import {
  AcquisitionModel,
  ContractorWorkforceState,
  EngagementModel,
  WorkerClassification,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ContractorsService } from './contractors.service';

describe('ADR-013 acquireIndependent', () => {
  const targetOrgId = 'org-1';
  const accessContext = {
    actorUserId: 'user-1',
    targetOrganizationId: targetOrgId,
    isGlobalAccess: false,
    supplierScopeId: null,
  } as never;

  const baseDto = {
    firstName: 'Indy',
    lastName: 'Worker',
    email: 'indy@example.com',
    workerClassification: WorkerClassification.INDEPENDENT_CONTRACTOR,
    engagementModel: EngagementModel.DIRECT,
    taxResidency: 'ZA',
    engagement: {
      role: 'Advisor',
      startDate: '2026-06-01',
      rateType: 'HOURLY',
      rateAmount: 900,
      responsibleManagerEmployeeId: 'hcm:sponsor-1',
    },
  } as const;

  it('creates INDEPENDENT worker at NOMINATED without supplierId', async () => {
    const createdContractor = {
      id: 'ctr-ind-1',
      organizationId: targetOrgId,
      supplierId: null,
      acquisitionModel: AcquisitionModel.INDEPENDENT,
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
          supplier: null,
          acquisitionModel: AcquisitionModel.INDEPENDENT,
        }),
      },
      contractorEngagement: {
        create: jest.fn().mockResolvedValue({ id: 'eng-ind-1' }),
      },
    };

    const prisma = {
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const auditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    const accessIntegrationPublish = {
      publishExternalPersonCreated: jest.fn().mockResolvedValue(undefined),
    };
    const workforceStateService = { applyTransition: jest.fn() };
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

    const result = await service.acquireIndependent(accessContext, baseDto as never);

    expect(tx.contractor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: targetOrgId,
          acquisitionModel: AcquisitionModel.INDEPENDENT,
          workforceState: ContractorWorkforceState.NOMINATED,
        }),
      }),
    );
    expect(tx.contractor.create.mock.calls[0][0].data).not.toHaveProperty('supplierId');
    expect(tx.contractorEngagement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responsibleManagerEmployeeId: 'hcm:sponsor-1',
        }),
      }),
    );
    expect(tx.contractorEngagement.create.mock.calls[0][0].data).not.toHaveProperty(
      'contractId',
    );
    expect(result.acquisitionModel).toBe(AcquisitionModel.INDEPENDENT);
  });

  it('rejects supplier portal scope', async () => {
    const service = new ContractorsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.acquireIndependent(
        {
          actorUserId: 'user-1',
          targetOrganizationId: targetOrgId,
          isGlobalAccess: false,
          supplierScopeId: 'sup-1',
        } as never,
        baseDto as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
