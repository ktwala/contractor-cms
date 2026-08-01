import {
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
} from '@prisma/client';
import {
  isPortalSafeWorkforceReason,
  presentSupplierPortalWorkforceTimeline,
} from './supplier-portal-workforce-timeline.util';

describe('presentSupplierPortalWorkforceTimeline', () => {
  it('returns business narrative fields only (no ops metadata)', () => {
    const entries = presentSupplierPortalWorkforceTimeline([
      {
        id: 'hist-1',
        contractorId: 'c-1',
        organizationId: 'org-1',
        fromState: null,
        toState: ContractorWorkforceState.NOMINATED,
        transitionLabel: 'Nominated',
        occurredAt: new Date('2026-01-01T10:00:00Z'),
        effectiveAt: null,
        actorUserId: 'ops-user',
        reason: 'Internal ops note',
        source: ContractorWorkforceHistorySource.SUPPLIER_PORTAL,
        metadata: { stagingId: 'secret' },
      },
    ]);

    expect(entries[0]).not.toHaveProperty('actorUserId');
    expect(entries[0]).not.toHaveProperty('metadata');
    expect(entries[0].reason).toBeUndefined();
  });

  it('includes portal-safe reasons for review outcomes', () => {
    expect(
      isPortalSafeWorkforceReason(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.REJECTED,
      ),
    ).toBe(true);

    const entries = presentSupplierPortalWorkforceTimeline([
      {
        id: 'hist-2',
        contractorId: 'c-1',
        organizationId: 'org-1',
        fromState: ContractorWorkforceState.NOMINATED,
        toState: ContractorWorkforceState.REJECTED,
        transitionLabel: 'Rejected',
        occurredAt: new Date('2026-01-02T10:00:00Z'),
        effectiveAt: null,
        actorUserId: 'ops-user',
        reason: 'Missing sponsor assignment',
        source: ContractorWorkforceHistorySource.OPS,
        metadata: null,
      },
    ]);

    expect(entries[0].reason).toBe('Missing sponsor assignment');
  });

  it('shows Blacklisted label without reason or authority note on portal timeline', () => {
    const entries = presentSupplierPortalWorkforceTimeline([
      {
        id: 'hist-3',
        contractorId: 'c-1',
        organizationId: 'org-1',
        fromState: ContractorWorkforceState.NOMINATED,
        toState: ContractorWorkforceState.BLACKLISTED,
        transitionLabel: 'Blacklisted',
        occurredAt: new Date('2026-01-03T10:00:00Z'),
        effectiveAt: null,
        actorUserId: 'ops-user',
        reason: 'Internal policy breach',
        source: ContractorWorkforceHistorySource.OPS,
        metadata: { authorityNote: 'Ops director ref OPS-1', workforceBlock: true },
      },
    ]);

    expect(entries[0].transitionLabel).toBe('Blacklisted');
    expect(entries[0].reason).toBeUndefined();
  });
});
