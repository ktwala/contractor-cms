import { Injectable } from '@nestjs/common';
import {
  GovernanceSignalCategory,
  SignalLifecycleState,
  ContractorSourceDriftStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AUDIT_EVENTS } from '../../core/audit/audit-events.constants';
import { DEFAULT_BOOTSTRAP_SIGNAL_TTL_DAYS } from './governance-signal-lifecycle.constants';
import { BootstrapDecaySummaryDto, GovernancePhase } from './dto/contractor-source-drift.dto';

/**
 * PR-GOV-SIGNAL-LIFECYCLE-3 — Bootstrap signal decay service.
 *
 * Evaluates and transitions bootstrap signals through the temporal decay lifecycle:
 *   ACTIVE → DECAYING → ARCHIVED
 *
 * Doctrine:
 *   BOOTSTRAP signals decay after workforce cutover + grace period.
 *   OPERATIONAL signals persist until operator-driven remediation.
 *   Archive = lineage evidence, not operational closure.
 *   Archiving a signal does NOT lift PDP restrictions.
 *
 * Grace period is anchored on workforceMigrationCutoverAt (wall-clock correct),
 * not on when the decay job last ran.
 */
@Injectable()
export class HcmBootstrapDecayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Evaluate and apply decay transitions for all eligible bootstrap signals
   * in the given organization.
   *
   * Eligible signals must have:
   *   - signalCategory = BOOTSTRAP
   *   - suppressAfterCutover = true
   *
   * Called:
   *   1. Automatically after POST /cutover (HcmWorkforceCutoverService)
   *   2. On demand via POST /bootstrap-decay/apply (admin ceremony endpoint)
   */
  async applyDecayForOrganization(
    orgId: string,
    actorUserId: string,
  ): Promise<BootstrapDecaySummaryDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { workforceMigrationCutoverAt: true },
    });

    const cutoverAt = org?.workforceMigrationCutoverAt ?? null;
    const governancePhase = this.deriveGovernancePhase(cutoverAt);

    // No cutover declared — nothing to decay
    if (governancePhase === 'NO_CUTOVER' || !cutoverAt) {
      return this.zeroSummary(orgId, governancePhase, null);
    }

    const now = new Date();
    const decayThreshold = this.computeDecayThreshold(cutoverAt);

    // ── Step 1: ACTIVE → DECAYING ─────────────────────────────────────────
    // All BOOTSTRAP+suppressAfterCutover signals that are still ACTIVE move
    // to DECAYING as soon as cutover is past, regardless of grace period.
    const activatedToDecayingResult = await this.prisma.contractorSourceDrift.updateMany({
      where: {
        organizationId: orgId,
        signalCategory: GovernanceSignalCategory.BOOTSTRAP,
        suppressAfterCutover: true,
        signalLifecycleState: SignalLifecycleState.ACTIVE,
      },
      data: {
        signalLifecycleState: SignalLifecycleState.DECAYING,
        decayStartedAt: now,
      },
    });

    // ── Step 2: DECAYING → ARCHIVED ───────────────────────────────────────
    // Signals that have been decaying and the grace period has expired.
    // Grace period anchored on cutoverAt (not decayStartedAt) for wall-clock
    // correctness — signals archive at the right time regardless of job cadence.
    const retentionUntil = new Date(now);
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

    let decayingToArchivedCount = 0;
    if (now >= decayThreshold) {
      const archivedResult = await this.prisma.contractorSourceDrift.updateMany({
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
          archivedReason: 'POST_CUTOVER_BOOTSTRAP_DECAY',
          retentionUntil,
        },
      });
      decayingToArchivedCount = archivedResult.count;
    }

    // ── Step 3: Count total archived in this org ───────────────────────────
    const totalArchived = await this.prisma.contractorSourceDrift.count({
      where: {
        organizationId: orgId,
        signalCategory: GovernanceSignalCategory.BOOTSTRAP,
        signalLifecycleState: SignalLifecycleState.ARCHIVED,
      },
    });

    // ── Step 4: Audit emission ─────────────────────────────────────────────
    // Emit only when something actually archived — skip on no-op runs.
    // Non-blocking: audit failures must not roll back governance writes.
    if (decayingToArchivedCount > 0) {
      void this.auditService.logAction(
        actorUserId,
        AUDIT_EVENTS.BOOTSTRAP_SIGNAL_ARCHIVED.action,
        'ORGANIZATION',
        orgId,
        {},
        {},
        {
          organizationId: orgId,
          metadata: {
            archivedCount: decayingToArchivedCount,
            archivedReason: 'POST_CUTOVER_BOOTSTRAP_DECAY',
            decayThreshold: decayThreshold.toISOString(),
            governancePhase,
            performedBy: actorUserId,
          },
        },
      );
    }

    return {
      organizationId: orgId,
      governancePhase,
      activatedToDecaying: activatedToDecayingResult.count,
      decayingToArchived: decayingToArchivedCount,
      totalArchived,
      decayThreshold: decayThreshold.toISOString(),
      evaluatedAt: now.toISOString(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Grace period anchor: cutoverAt + DEFAULT_BOOTSTRAP_SIGNAL_TTL_DAYS.
   * Signals transition to ARCHIVED only after this threshold.
   */
  private computeDecayThreshold(cutoverAt: Date): Date {
    const threshold = new Date(cutoverAt);
    threshold.setUTCDate(threshold.getUTCDate() + DEFAULT_BOOTSTRAP_SIGNAL_TTL_DAYS);
    return threshold;
  }

  private deriveGovernancePhase(cutoverAt: Date | null): GovernancePhase {
    if (!cutoverAt) return 'NO_CUTOVER';
    return Date.now() > cutoverAt.getTime() ? 'POST_CUTOVER' : 'PRE_CUTOVER';
  }

  private zeroSummary(
    orgId: string,
    governancePhase: GovernancePhase,
    decayThreshold: Date | null,
  ): BootstrapDecaySummaryDto {
    return {
      organizationId: orgId,
      governancePhase,
      activatedToDecaying: 0,
      decayingToArchived: 0,
      totalArchived: 0,
      decayThreshold: decayThreshold?.toISOString() ?? null,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
