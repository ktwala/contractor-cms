import { IgaIntegrationPlaneStatus } from '@prisma/client';
import { AccessIntegrationWorkforceReactionService } from './access-integration-workforce-reaction.service';
import { AccessIntegrationPublishService } from './access-integration-publish.service';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from '../contractors/contractor-workforce-domain-events.constants';

describe('AccessIntegrationWorkforceReactionService (PR-ACCESS-INTEGRATION-WORKFORCE-REACTIONS-1)', () => {
  let service: AccessIntegrationWorkforceReactionService;
  let publishSuspended: jest.Mock;
  let publishTerminated: jest.Mock;
  let publishRestore: jest.Mock;
  let tx: Record<string, any>;

  const contractorRow = {
    id: 'c-1',
    supplierId: 's-1',
    externalPersonId: 'ext-1',
    personType: null,
    workerArchetype: null,
    accessIntent: null,
    riskTier: null,
    igaIntegrationStatus: IgaIntegrationPlaneStatus.IGA_UNKNOWN,
  };

  beforeEach(() => {
    publishSuspended = jest.fn().mockResolvedValue(undefined);
    publishTerminated = jest.fn().mockResolvedValue(undefined);
    publishRestore = jest.fn().mockResolvedValue(undefined);

    tx = {
      contractor: {
        findUnique: jest.fn().mockResolvedValue(contractorRow),
      },
      contractorEngagement: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'eng-1',
          responsibleManagerEmployeeId: 'sp-1',
          responsibleManagerStatus: null,
        }),
      },
    };

    service = new AccessIntegrationWorkforceReactionService({
      publishWorkforceSuspendedAccessIntent: publishSuspended,
      publishWorkforceTerminatedAccessIntent: publishTerminated,
      publishWorkforceAccessRestoreIntent: publishRestore,
    } as unknown as AccessIntegrationPublishService);
  });

  it('publishes suspended access intent on Worker Suspended', async () => {
    await service.reactToWorkforceDomainEvent({
      tx: tx as never,
      contractorId: 'c-1',
      organizationId: 'org-1',
      domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.SUSPENDED,
    });

    expect(publishSuspended).toHaveBeenCalledTimes(1);
    expect(publishTerminated).not.toHaveBeenCalled();
  });

  it('publishes terminated access intent on Worker Terminated', async () => {
    await service.reactToWorkforceDomainEvent({
      tx: tx as never,
      contractorId: 'c-1',
      organizationId: 'org-1',
      domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.TERMINATED,
    });

    expect(publishTerminated).toHaveBeenCalledTimes(1);
  });

  it('publishes terminated access intent on Worker Blacklisted', async () => {
    await service.reactToWorkforceDomainEvent({
      tx: tx as never,
      contractorId: 'c-1',
      organizationId: 'org-1',
      domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.BLACKLISTED,
    });

    expect(publishTerminated).toHaveBeenCalledTimes(1);
  });

  it('publishes restore intent on Worker Activated', async () => {
    await service.reactToWorkforceDomainEvent({
      tx: tx as never,
      contractorId: 'c-1',
      organizationId: 'org-1',
      domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.ACTIVATED,
    });

    expect(publishRestore).toHaveBeenCalledTimes(1);
  });

  it('does not publish on nomination events', async () => {
    await service.reactToWorkforceDomainEvent({
      tx: tx as never,
      contractorId: 'c-1',
      organizationId: 'org-1',
      domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED,
    });

    expect(publishSuspended).not.toHaveBeenCalled();
    expect(publishTerminated).not.toHaveBeenCalled();
    expect(publishRestore).not.toHaveBeenCalled();
  });
});
