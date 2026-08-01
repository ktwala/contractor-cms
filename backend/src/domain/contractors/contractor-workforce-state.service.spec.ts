import { AcquisitionModel, ContractorWorkforceState } from '@prisma/client';
import { ContractorWorkforceStateService } from './contractor-workforce-state.service';
import { ContractorWorkforceEventPublisherService } from './contractor-workforce-event-publisher.service';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from './contractor-workforce-domain-events.constants';

describe('ContractorWorkforceStateService', () => {
  const contractorId = 'ctr-1';
  const accessContext = {
    actorUserId: 'user-1',
    targetOrganizationId: 'org-1',
  } as never;

  it('applyTransition updates workforceState and syncs isActive', async () => {
    const existing = {
      id: contractorId,
      organizationId: 'org-1',
      supplierId: 'sup-1',
      acquisitionModel: AcquisitionModel.SUPPLIER,
      workforceState: ContractorWorkforceState.ACTIVE,
      isActive: true,
    };
    const updated = {
      ...existing,
      workforceState: ContractorWorkforceState.TERMINATED,
      isActive: false,
    };

    const tx = {
      contractor: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(updated),
      },
      supplier: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const auditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    const eventPublisher = { publishStub: jest.fn().mockResolvedValue(undefined) };
    const workforceHistory = { recordTransition: jest.fn().mockResolvedValue(undefined) };
    const accessIntegrationWorkforceReaction = {
      reactToWorkforceDomainEvent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ContractorWorkforceStateService(
      prisma as never,
      auditService as never,
      eventPublisher as never,
      workforceHistory as never,
      accessIntegrationWorkforceReaction as never,
    );

    const result = await service.applyTransition({
      accessContext,
      contractorId,
      targetState: ContractorWorkforceState.TERMINATED,
      reason: 'test',
    });

    expect(result.workforceState).toBe(ContractorWorkforceState.TERMINATED);
    expect(result.isActive).toBe(false);
    expect(auditService.logAction).toHaveBeenCalledWith(
      'user-1',
      'CONTRACTOR_WORKFORCE_STATE_CHANGED',
      'Contractor',
      contractorId,
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ organizationId: 'org-1' }),
    );
    expect(eventPublisher.publishStub).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.TERMINATED,
      }),
    );
    expect(workforceHistory.recordTransition).toHaveBeenCalled();
    expect(accessIntegrationWorkforceReaction.reactToWorkforceDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.TERMINATED,
        contractorId,
      }),
    );
  });
});
