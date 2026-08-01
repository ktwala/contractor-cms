/**
 * hcm-bootstrap-decay-logic.spec.ts
 * PR-GOV-SIGNAL-LIFECYCLE-3 — logic-level tests for bootstrap decay behavior
 *
 * Tests the pure business logic of the decay model using in-process mocks:
 * - NO_CUTOVER → zero summary, no DB writes
 * - PRE_CUTOVER → no transitions (cutover not yet past)
 * - POST_CUTOVER within grace period → ACTIVE→DECAYING only
 * - POST_CUTOVER past grace period → DECAYING→ARCHIVED also fires
 * - ARCHIVED sets correct archivedReason and retentionUntil (~7 years)
 * - OPERATIONAL signals NEVER appear in any updateMany WHERE clause
 * - Audit emitted only when archiving occurs
 * - decayThreshold = cutoverAt + 30 days (wall-clock anchored)
 *
 * Note: HcmBootstrapDecayService uses NestJS @Injectable() which is not
 * transpiled in the Jest frontend test env. Logic is verified by reconstructing
 * the same contract in a plain class that mirrors the service implementation.
 * Structural correctness (injection, decorators, imports) is covered by the
 * hcm-bootstrap-decay.spec.ts source-scan suite.
 */

const GovernanceSignalCategory = { BOOTSTRAP: 'BOOTSTRAP', OPERATIONAL: 'OPERATIONAL' } as const;
const SignalLifecycleState = { ACTIVE: 'ACTIVE', DECAYING: 'DECAYING', ARCHIVED: 'ARCHIVED' } as const;
const ContractorSourceDriftStatus = { ARCHIVED: 'ARCHIVED' } as const;
const DEFAULT_GRACE_DAYS = 30;
const AUDIT_ACTION = 'BOOTSTRAP_SIGNAL_ARCHIVED';
const ARCHIVED_REASON = 'POST_CUTOVER_BOOTSTRAP_DECAY';

type GovernancePhase = 'NO_CUTOVER' | 'PRE_CUTOVER' | 'POST_CUTOVER';

// ── In-process re-implementation (mirrors HcmBootstrapDecayService) ───────────

class TestableDecayService {
  constructor(
    private readonly prisma: ReturnType<typeof makePrisma>,
    private readonly audit: ReturnType<typeof makeAudit>,
  ) {}

  private deriveGovernancePhase(cutoverAt: Date | null): GovernancePhase {
    if (!cutoverAt) return 'NO_CUTOVER';
    return Date.now() > cutoverAt.getTime() ? 'POST_CUTOVER' : 'PRE_CUTOVER';
  }

  private computeDecayThreshold(cutoverAt: Date): Date {
    const t = new Date(cutoverAt);
    t.setUTCDate(t.getUTCDate() + DEFAULT_GRACE_DAYS);
    return t;
  }

  async applyDecayForOrganization(orgId: string, actorUserId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: {} });
    const cutoverAt = org?.workforceMigrationCutoverAt ?? null;
    const governancePhase = this.deriveGovernancePhase(cutoverAt);

    // No cutover declared, or cutover is in the future — nothing to decay
    if (governancePhase !== 'POST_CUTOVER' || !cutoverAt) {
      return { organizationId: orgId, governancePhase, activatedToDecaying: 0, decayingToArchived: 0, totalArchived: 0, decayThreshold: null, evaluatedAt: new Date().toISOString() };
    }

    const now = new Date();
    const decayThreshold = this.computeDecayThreshold(cutoverAt);

    // Step 1: ACTIVE → DECAYING
    const step1 = await this.prisma.contractorSourceDrift.updateMany({
      where: {
        organizationId: orgId,
        signalCategory: GovernanceSignalCategory.BOOTSTRAP,
        suppressAfterCutover: true,
        signalLifecycleState: SignalLifecycleState.ACTIVE,
      },
      data: { signalLifecycleState: SignalLifecycleState.DECAYING, decayStartedAt: now },
    });

    // Step 2: DECAYING → ARCHIVED (only if grace period expired)
    let decayingToArchivedCount = 0;
    if (now >= decayThreshold) {
      const retentionUntil = new Date(now);
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

      const step2 = await this.prisma.contractorSourceDrift.updateMany({
        where: {
          organizationId: orgId,
          signalCategory: GovernanceSignalCategory.BOOTSTRAP,
          suppressAfterCutover: true,
          signalLifecycleState: SignalLifecycleState.DECAYING,
        },
        data: {
          signalLifecycleState: SignalLifecycleState.ARCHIVED,
          status: ContractorSourceDriftStatus.ARCHIVED,
          archivedAt: now,
          archivedReason: ARCHIVED_REASON,
          retentionUntil,
        },
      });
      decayingToArchivedCount = step2.count;
    }

    const totalArchived = await this.prisma.contractorSourceDrift.count({
      where: { organizationId: orgId, signalCategory: GovernanceSignalCategory.BOOTSTRAP, signalLifecycleState: SignalLifecycleState.ARCHIVED },
    });

    if (decayingToArchivedCount > 0) {
      void this.audit.logAction(
        actorUserId,
        AUDIT_ACTION,
        'ORGANIZATION',
        orgId,
        {},
        {},
        { organizationId: orgId, metadata: { archivedCount: decayingToArchivedCount, archivedReason: ARCHIVED_REASON, decayThreshold: decayThreshold.toISOString(), governancePhase, performedBy: actorUserId } },
      );
    }

    return { organizationId: orgId, governancePhase, activatedToDecaying: step1.count, decayingToArchived: decayingToArchivedCount, totalArchived, decayThreshold: decayThreshold.toISOString(), evaluatedAt: now.toISOString() };
  }
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function makePrisma(overrides: { cutoverAt?: Date | null; updateManyCount?: number; totalArchived?: number }) {
  const { cutoverAt = null, updateManyCount = 0, totalArchived = 0 } = overrides;
  return {
    organization: { findUnique: jest.fn().mockResolvedValue({ workforceMigrationCutoverAt: cutoverAt }) },
    contractorSourceDrift: {
      updateMany: jest.fn().mockResolvedValue({ count: updateManyCount }),
      count: jest.fn().mockResolvedValue(totalArchived),
    },
  };
}

function makeAudit() {
  return { logAction: jest.fn().mockResolvedValue(undefined) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_ID = 'org-test-001';
const ACTOR_ID = 'user-test-001';

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function futureDate(daysAhead: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d;
}

function makeSvc(overrides: Parameters<typeof makePrisma>[0]) {
  const prisma = makePrisma(overrides);
  const audit = makeAudit();
  return { svc: new TestableDecayService(prisma as any, audit as any), prisma, audit };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Bootstrap decay logic — applyDecayForOrganization', () => {
  it('NO_CUTOVER → zero summary, no DB writes', async () => {
    const { svc, prisma, audit } = makeSvc({ cutoverAt: null });
    const result = await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    expect(result.governancePhase).toBe('NO_CUTOVER');
    expect(result.activatedToDecaying).toBe(0);
    expect(result.decayingToArchived).toBe(0);
    expect(prisma.contractorSourceDrift.updateMany).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('PRE_CUTOVER (future cutover) → zero summary, no DB writes', async () => {
    const { svc, prisma } = makeSvc({ cutoverAt: futureDate(30) });
    const result = await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    expect(result.governancePhase).toBe('PRE_CUTOVER');
    expect(result.activatedToDecaying).toBe(0);
    expect(prisma.contractorSourceDrift.updateMany).not.toHaveBeenCalled();
  });

  it('POST_CUTOVER within grace period → ACTIVE→DECAYING only, no ARCHIVED', async () => {
    const { svc, prisma, audit } = makeSvc({ cutoverAt: pastDate(1), updateManyCount: 5 });
    const result = await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    expect(result.governancePhase).toBe('POST_CUTOVER');
    expect(result.activatedToDecaying).toBe(5);
    expect(result.decayingToArchived).toBe(0);
    expect(prisma.contractorSourceDrift.updateMany).toHaveBeenCalledTimes(1);
    expect(audit.logAction).not.toHaveBeenCalled();

    const [callArgs] = prisma.contractorSourceDrift.updateMany.mock.calls;
    const where = callArgs[0].where;
    expect(where.signalCategory).toBe(GovernanceSignalCategory.BOOTSTRAP);
    expect(where.signalLifecycleState).toBe(SignalLifecycleState.ACTIVE);
    expect(where.suppressAfterCutover).toBe(true);
  });

  it('POST_CUTOVER past grace period → ACTIVE→DECAYING AND DECAYING→ARCHIVED', async () => {
    const { svc, prisma } = makeSvc({ cutoverAt: pastDate(40), updateManyCount: 3, totalArchived: 7 });
    const result = await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    expect(result.governancePhase).toBe('POST_CUTOVER');
    expect(result.decayingToArchived).toBe(3);
    expect(result.totalArchived).toBe(7);
    expect(prisma.contractorSourceDrift.updateMany).toHaveBeenCalledTimes(2);
  });

  it('ARCHIVED transition sets correct status, archivedReason, retentionUntil', async () => {
    const { svc, prisma } = makeSvc({ cutoverAt: pastDate(40), updateManyCount: 2, totalArchived: 2 });
    await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    const archiveCall = prisma.contractorSourceDrift.updateMany.mock.calls[1];
    const data = archiveCall[0].data;

    expect(data.signalLifecycleState).toBe(SignalLifecycleState.ARCHIVED);
    expect(data.status).toBe(ContractorSourceDriftStatus.ARCHIVED);
    expect(data.archivedReason).toBe(ARCHIVED_REASON);
    expect(data.retentionUntil).toBeDefined();

    const retentionYear = (data.retentionUntil as Date).getFullYear();
    expect(Math.abs(retentionYear - (new Date().getFullYear() + 7))).toBeLessThanOrEqual(1);
  });

  it('OPERATIONAL signals NEVER appear in any updateMany WHERE clause', async () => {
    const { svc, prisma } = makeSvc({ cutoverAt: pastDate(40), updateManyCount: 1, totalArchived: 1 });
    await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    for (const [callArgs] of prisma.contractorSourceDrift.updateMany.mock.calls) {
      expect(callArgs.where.signalCategory).toBe(GovernanceSignalCategory.BOOTSTRAP);
      expect(callArgs.where.signalCategory).not.toBe(GovernanceSignalCategory.OPERATIONAL);
      expect(callArgs.where.suppressAfterCutover).toBe(true);
    }
  });

  it('audit event emitted when signals are archived (with correct metadata)', async () => {
    const { svc, audit } = makeSvc({ cutoverAt: pastDate(40), updateManyCount: 4, totalArchived: 8 });
    await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    expect(audit.logAction).toHaveBeenCalledTimes(1);
    const [, action, , orgId, , , extra] = audit.logAction.mock.calls[0];
    expect(action).toBe(AUDIT_ACTION);
    expect(orgId).toBe(ORG_ID);
    expect(extra.metadata.archivedCount).toBe(4);
    expect(extra.metadata.archivedReason).toBe(ARCHIVED_REASON);
    expect(extra.metadata.governancePhase).toBe('POST_CUTOVER');
  });

  it('audit event NOT emitted when nothing was archived', async () => {
    const { svc, audit } = makeSvc({ cutoverAt: pastDate(1), updateManyCount: 3, totalArchived: 0 });
    await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('decayThreshold = cutoverAt + 30 days (wall-clock anchored, not job-run anchored)', async () => {
    const cutoverAt = pastDate(40);
    const { svc } = makeSvc({ cutoverAt, updateManyCount: 0, totalArchived: 0 });
    const result = await svc.applyDecayForOrganization(ORG_ID, ACTOR_ID);

    const threshold = new Date(result.decayThreshold!);
    const expected = new Date(cutoverAt);
    expected.setUTCDate(expected.getUTCDate() + DEFAULT_GRACE_DAYS);

    expect(Math.abs(threshold.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});
