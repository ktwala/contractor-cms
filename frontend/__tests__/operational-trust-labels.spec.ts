import {
  OPERATIONAL_TRUST_LABELS,
  OPERATIONAL_TRUST_ROUTES,
  operationalTrustLabel,
  oracleProcurementLabel,
  buildOperationalTrustWorkerBlock,
  formatLastOperationalTrustDecision,
  isOperationalTrustGranted,
  operationalTrustResolutionHref,
} from '@/lib/operational-trust-labels';

describe('operational trust labels', () => {
  it('maps supplier status to full operational trust display', () => {
    expect(operationalTrustLabel('ACTIVE')).toBe('Operational Trust Granted');
    expect(operationalTrustLabel('PENDING_APPROVAL')).toBe('Operational Trust Pending');
    expect(operationalTrustLabel('SUSPENDED')).toBe('Operational Trust Suspended');
  });

  it('shows oracle approved for linked suppliers', () => {
    expect(oracleProcurementLabel('ORCL-SUP-MTN-001')).toBe(
      OPERATIONAL_TRUST_LABELS.oracleApproved,
    );
  });

  it('builds workforce block copy for pending trust and links to supplier administration queue', () => {
    const block = buildOperationalTrustWorkerBlock({
      supplierName: 'Horizon Staffing',
      supplierStatus: 'PENDING_APPROVAL',
      blockedWorkerCount: 9,
    });
    expect(block.heading).toBe('Supplier action required');
    expect(block.operationalTrustLabel).toBe('Operational Trust Pending');
    expect(block.workersBlockedLabel).toBe('9');
    expect(block.action).toBe('Grant Operational Trust');
    expect(block.resolutionHref).toBe(OPERATIONAL_TRUST_ROUTES.queue);
    expect(block.resolutionLinkLabel).toContain('Supplier Administration');
    expect(block.resolutionLinkLabel).toContain('Operational Trust Queue');
  });

  it('builds workforce block for suspended trust and links to supplier administration management', () => {
    const block = buildOperationalTrustWorkerBlock({
      supplierName: 'Ubuntu Field Services',
      supplierStatus: 'SUSPENDED',
      blockedWorkerCount: 6,
    });
    expect(block.operationalTrustLabel).toBe('Operational Trust Suspended');
    expect(block.workersBlockedLabel).toBe('6');
    expect(block.action).toBe('Restore Operational Trust');
    expect(block.resolutionHref).toBe(OPERATIONAL_TRUST_ROUTES.managementSuspended);
    expect(block.resolutionLinkLabel).toContain('Operational Trust Management');
  });

  it('routes suspended suppliers away from the pending queue', () => {
    expect(operationalTrustResolutionHref('SUSPENDED')).toBe(
      OPERATIONAL_TRUST_ROUTES.managementSuspended,
    );
    expect(operationalTrustResolutionHref('PENDING_APPROVAL')).toBe(
      OPERATIONAL_TRUST_ROUTES.queue,
    );
  });

  it('detects granted operational trust', () => {
    expect(isOperationalTrustGranted('ACTIVE')).toBe(true);
    expect(isOperationalTrustGranted('PENDING_APPROVAL')).toBe(false);
  });

  it('formats last decision for Management table without opening History', () => {
    const now = new Date(2026, 6, 8, 12);
    expect(
      formatLastOperationalTrustDecision(
        { kind: 'RESTORED', occurredAt: new Date(2026, 6, 8, 9).toISOString() },
        now,
      ),
    ).toBe('Restored today');
    expect(
      formatLastOperationalTrustDecision(
        { kind: 'GRANTED', occurredAt: new Date(2026, 6, 2, 9).toISOString() },
        now,
      ),
    ).toMatch(/^Granted 2 /);
    expect(formatLastOperationalTrustDecision(null, now)).toBe('—');
  });
});
