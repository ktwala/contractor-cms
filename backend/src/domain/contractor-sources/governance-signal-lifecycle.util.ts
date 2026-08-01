import {
  ContractorSourceDriftStatus,
  GovernanceSignalCategory,
  SignalLifecycleState,
  Prisma,
} from '@prisma/client';
import {
  CONTRACTOR_DRIFT_SIGNAL_CLASSIFICATION,
  DEFAULT_BOOTSTRAP_SIGNAL_TTL_DAYS,
  GovernanceSignalClassification,
} from './governance-signal-lifecycle.constants';
import { ContractorSourceDriftType } from '@prisma/client';
import { OPEN_CONTRACTOR_DRIFT_STATUSES } from './contractor-source-drift.util';

export function classifyContractorDriftSignal(
  driftType: ContractorSourceDriftType,
): GovernanceSignalClassification {
  return CONTRACTOR_DRIFT_SIGNAL_CLASSIFICATION[driftType];
}

export function resolveBootstrapExpiresAt(detectedAt: Date): Date {
  const expires = new Date(detectedAt);
  expires.setUTCDate(expires.getUTCDate() + DEFAULT_BOOTSTRAP_SIGNAL_TTL_DAYS);
  return expires;
}

export function buildContractorDriftLifecycleFields(
  driftType: ContractorSourceDriftType,
  detectedAt: Date,
): GovernanceSignalClassification & { expiresAt: Date | null } {
  const classification = classifyContractorDriftSignal(driftType);
  const expiresAt =
    classification.signalCategory === GovernanceSignalCategory.BOOTSTRAP
      ? resolveBootstrapExpiresAt(detectedAt)
      : null;
  return { ...classification, expiresAt };
}

export type WorkforceCutoverContext = {
  workforceMigrationCutoverAt: Date | null;
};

export function isPastWorkforceCutover(ctx: WorkforceCutoverContext): boolean {
  if (!ctx.workforceMigrationCutoverAt) return false;
  return Date.now() > ctx.workforceMigrationCutoverAt.getTime();
}

/**
 * Build Prisma WHERE for the default operational governance view.
 *
 * When operationalOnly=true (default):
 *   - Post-cutover: show OPERATIONAL signals + non-suppressed BOOTSTRAP signals
 *   - Exclude ARCHIVED bootstrap signals (PR-GOV-SIGNAL-LIFECYCLE-3)
 *   - Pre/no-cutover: show everything
 *
 * When operationalOnly=false ("Show migration lineage"):
 *   - Show all signals including DECAYING and ARCHIVED bootstrap rows
 *   - These get visual de-emphasis markers in the UI
 */
export function buildOperationalDriftVisibilityWhere(
  organizationId: string,
  ctx: WorkforceCutoverContext,
  operationalOnly: boolean,
): Prisma.ContractorSourceDriftWhereInput {
  const base: Prisma.ContractorSourceDriftWhereInput = { organizationId };

  if (!operationalOnly || !isPastWorkforceCutover(ctx)) {
    return base;
  }

  // Post-cutover + operationalOnly=true:
  // Show operational signals freely, and bootstrap only if not suppressed AND not archived.
  return {
    ...base,
    OR: [
      { signalCategory: GovernanceSignalCategory.OPERATIONAL },
      {
        signalCategory: GovernanceSignalCategory.BOOTSTRAP,
        suppressAfterCutover: false,
      },
      {
        signalCategory: GovernanceSignalCategory.BOOTSTRAP,
        suppressAfterCutover: true,
        signalLifecycleState: {
          not: SignalLifecycleState.ARCHIVED,
        },
      },
    ],
  };
}

export function buildOpenOperationalDriftWhere(
  organizationId: string,
  ctx: WorkforceCutoverContext,
  operationalOnly = true,
): Prisma.ContractorSourceDriftWhereInput {
  return {
    ...buildOperationalDriftVisibilityWhere(organizationId, ctx, operationalOnly),
    status: { in: OPEN_CONTRACTOR_DRIFT_STATUSES },
  };
}
