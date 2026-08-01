import { ContractorWorkforceHistorySource, ContractorWorkforceState } from '@prisma/client';
import { ContractorWorkforceHistoryService } from './contractor-workforce-history.service';
import { ContractorWorkforceStateService } from './contractor-workforce-state.service';

describe('PR-WORKFORCE-TIMELINE-FOUNDATION-1', () => {
  it('records transition rows with derived presentation labels', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'hist-1',
      contractorId: 'ctr-1',
      organizationId: 'org-1',
      fromState: ContractorWorkforceState.NOMINATED,
      toState: ContractorWorkforceState.PENDING_APPROVAL,
      occurredAt: new Date('2026-06-13T10:00:00Z'),
      effectiveAt: null,
      actorUserId: 'user-1',
      reason: 'Evidence verified',
      source: ContractorWorkforceHistorySource.OPS,
      metadata: null,
    });

    const service = new ContractorWorkforceHistoryService({
      contractorWorkforceHistory: { create, findMany: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ contractorWorkforceHistory: { create } }),
      ),
    } as never);

    const entry = await service.recordTransition({
      contractorId: 'ctr-1',
      organizationId: 'org-1',
      fromState: ContractorWorkforceState.NOMINATED,
      toState: ContractorWorkforceState.PENDING_APPROVAL,
      actorUserId: 'user-1',
      reason: 'Evidence verified',
      source: ContractorWorkforceHistorySource.OPS,
    });

    expect(entry.transitionLabel).toBe('Submitted for review');
    expect(create).toHaveBeenCalled();
  });

  it('persists history before audit in transition service transaction', async () => {
    const order: string[] = [];
    const existing = {
      id: 'ctr-1',
      supplierId: 'sup-1',
      workforceState: ContractorWorkforceState.NOMINATED,
      isActive: false,
    };
    const updated = {
      ...existing,
      workforceState: ContractorWorkforceState.PENDING_APPROVAL,
      isActive: false,
    };

    const tx = {
      contractor: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(async () => {
          order.push('update');
          return updated;
        }),
      },
      supplier: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
    };

    const workforceHistory = {
      recordTransition: jest.fn().mockImplementation(async () => {
        order.push('history');
      }),
    };
    const auditService = {
      logAction: jest.fn().mockImplementation(async () => {
        order.push('audit');
      }),
    };
    const eventPublisher = {
      publishStub: jest.fn().mockImplementation(async () => {
        order.push('domain');
      }),
    };

    const accessIntegrationWorkforceReaction = {
      reactToWorkforceDomainEvent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ContractorWorkforceStateService(
      {
        $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      } as never,
      auditService as never,
      eventPublisher as never,
      workforceHistory as never,
      accessIntegrationWorkforceReaction as never,
    );

    await service.applyTransition({
      accessContext: {
        actorUserId: 'user-1',
        targetOrganizationId: 'org-1',
      } as never,
      contractorId: 'ctr-1',
      targetState: ContractorWorkforceState.PENDING_APPROVAL,
      reason: 'Ops review',
      source: ContractorWorkforceHistorySource.OPS,
    });

    expect(order).toEqual(['update', 'history', 'audit', 'domain']);
  });
});
