import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AUDIT_EVENTS } from '../../core/audit/audit-events.constants';
import {
  GovernancePhase,
  WorkforceCutoverResponseDto,
} from './dto/contractor-source-drift.dto';
import { HcmBootstrapDecayService } from './hcm-bootstrap-decay.service';

/**
 * PR-GOV-SIGNAL-LIFECYCLE-2 — Workforce cutover ceremony service.
 *
 * Cutover is the moment CMS takes over as the operational authority for contractor
 * governance. This service owns:
 *   - Invariant enforcement (cannot declare cutover before governance exists)
 *   - The actual write to org.workforceMigrationCutoverAt
 *   - Mandatory audit emission for every set/clear action
 *
 * Doctrine: HCM bootstraps; CMS governs operational trust.
 *            Cutover must be explicit, invariant-guarded, and audit-traceable.
 */
@Injectable()
export class HcmWorkforceCutoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly decayService: HcmBootstrapDecayService,
  ) {}

  async getCutover(orgId: string): Promise<WorkforceCutoverResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { workforceMigrationCutoverAt: true, updatedAt: true },
    });

    const cutoverAt = org?.workforceMigrationCutoverAt ?? null;
    return {
      workforceMigrationCutoverAt: cutoverAt?.toISOString() ?? null,
      updatedAt: (org?.updatedAt ?? new Date()).toISOString(),
      governancePhase: this.deriveGovernancePhase(cutoverAt),
    };
  }

  /**
   * Set or clear the workforce migration cutover date.
   *
   * Invariants enforced when setting (not clearing):
   *   1. At least one successful HCM sync run must have completed.
   *   2. At least one contractor must be materialized in the registry.
   *
   * These guards prevent declaring "post-cutover" before governance actually
   * exists — which would silently suppress bootstrap lineage with nothing to
   * show in operational view.
   */
  async setCutover(
    orgId: string,
    cutoverAt: string | null,
    actorUserId: string,
  ): Promise<WorkforceCutoverResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        workforceMigrationCutoverAt: true,
        oracleHcmLastSuccessfulSyncAt: true,
        updatedAt: true,
      },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const previousCutoverAt = org.workforceMigrationCutoverAt;

    // ── Invariant guards (setting only — clearing is always permitted) ─────
    if (cutoverAt !== null) {
      if (!org.oracleHcmLastSuccessfulSyncAt) {
        throw new BadRequestException(
          'Cannot declare workforce cutover before the first successful HCM import. ' +
            'Run at least one successful Oracle HCM sync before declaring cutover.',
        );
      }

      const suppliersWithCount = await this.prisma.supplier.findMany({
        where: { organizationId: orgId },
        select: {
          _count: {
            select: { contractors: true },
          },
        },
      });
      const materializedContractorCount = suppliersWithCount.reduce(
        (sum, s) => sum + s._count.contractors,
        0,
      );
      if (materializedContractorCount === 0) {
        throw new BadRequestException(
          'Cannot declare workforce cutover with no materialized contractors. ' +
            'Materialize contractors from staging before declaring cutover.',
        );
      }
    }

    // ── Write ──────────────────────────────────────────────────────────────
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        workforceMigrationCutoverAt: cutoverAt ? new Date(cutoverAt) : null,
      },
      select: { workforceMigrationCutoverAt: true, updatedAt: true },
    });

    const newCutoverAt = updated.workforceMigrationCutoverAt;
    const governancePhase = this.deriveGovernancePhase(newCutoverAt);
    const isClearing = cutoverAt === null;

    // ── Audit emission ─────────────────────────────────────────────────────
    // Non-blocking — audit failures must not roll back the governance write.
    // Consistent with platform-wide AuditService behaviour.
    const auditAction = isClearing
      ? AUDIT_EVENTS.WORKFORCE_CUTOVER_CLEARED.action
      : AUDIT_EVENTS.WORKFORCE_CUTOVER_SET.action;

    void this.auditService.logAction(
      actorUserId,
      auditAction,
      'ORGANIZATION',
      orgId,
      { workforceMigrationCutoverAt: previousCutoverAt?.toISOString() ?? null },
      { workforceMigrationCutoverAt: newCutoverAt?.toISOString() ?? null },
      {
        organizationId: orgId,
        metadata: {
          reason: 'manual governance cutover ceremony',
          governancePhase,
          performedBy: actorUserId,
        },
      },
    );

    // Trigger decay evaluation as part of the cutover ceremony — fire-and-forget.
    // Non-blocking: decay failures must not roll back the governance write.
    void this.decayService.applyDecayForOrganization(orgId, actorUserId);

    return {
      workforceMigrationCutoverAt: newCutoverAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
      governancePhase,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Derive the governance phase from a nullable cutover timestamp.
   *
   *   null          → NO_CUTOVER   (bootstrap lineage visible by default)
   *   future date   → PRE_CUTOVER  (cutover declared, bootstrap governance still active)
   *   past date     → POST_CUTOVER (operational governance prioritized)
   */
  private deriveGovernancePhase(cutoverAt: Date | null): GovernancePhase {
    if (!cutoverAt) return 'NO_CUTOVER';
    return Date.now() > cutoverAt.getTime() ? 'POST_CUTOVER' : 'PRE_CUTOVER';
  }
}
