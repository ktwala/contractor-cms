import {
  buildOperationalTrustChangedDetail,
  resolveOperationalTrustTransitionKind,
} from '@/lib/operational-trust-events';

describe('operational trust events', () => {
  it('derives transition kind for grant, restore, suspend, and deny', () => {
    expect(resolveOperationalTrustTransitionKind('PENDING_APPROVAL', 'ACTIVE')).toBe('GRANTED');
    expect(resolveOperationalTrustTransitionKind('SUSPENDED', 'ACTIVE')).toBe('RESTORED');
    expect(resolveOperationalTrustTransitionKind('ACTIVE', 'SUSPENDED')).toBe('SUSPENDED');
    expect(resolveOperationalTrustTransitionKind('PENDING_APPROVAL', 'SUSPENDED')).toBe('DENIED');
  });

  it('builds a deterministic change payload', () => {
    const detail = buildOperationalTrustChangedDetail({
      supplierId: 'sup-atlas',
      previousState: 'ACTIVE',
      currentState: 'SUSPENDED',
      reason: 'Wrong supplier suspended during review.',
      changedBy: 'Operations Manager',
      changedAt: '2026-07-08T15:00:00.000Z',
    });

    expect(detail).toEqual({
      supplierId: 'sup-atlas',
      previousState: 'ACTIVE',
      currentState: 'SUSPENDED',
      transitionKind: 'SUSPENDED',
      changedBy: 'Operations Manager',
      changedAt: '2026-07-08T15:00:00.000Z',
      reason: 'Wrong supplier suspended during review.',
    });
  });

  it('marks mistake recovery as RESTORED not GRANTED', () => {
    const detail = buildOperationalTrustChangedDetail({
      supplierId: 'sup-atlas',
      previousState: 'SUSPENDED',
      currentState: 'ACTIVE',
      reason: 'Suspended wrong supplier — restoring immediately.',
      changedBy: 'Operations Manager',
    });

    expect(detail.transitionKind).toBe('RESTORED');
  });
});
