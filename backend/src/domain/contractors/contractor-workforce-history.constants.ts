import { ContractorWorkforceState } from '@prisma/client';

/** Authority channel — how the transition entered the workforce plane. */
export const CONTRACTOR_WORKFORCE_HISTORY_SOURCES = {
  SUPPLIER_PORTAL: 'SUPPLIER_PORTAL',
  OPS: 'OPS',
  HCM_BOOTSTRAP: 'HCM_BOOTSTRAP',
  HCM_SYNC: 'HCM_SYNC',
  SYSTEM: 'SYSTEM',
  LEGACY_BRIDGE: 'LEGACY_BRIDGE',
} as const;

export type ContractorWorkforceHistorySource =
  (typeof CONTRACTOR_WORKFORCE_HISTORY_SOURCES)[keyof typeof CONTRACTOR_WORKFORCE_HISTORY_SOURCES];

/**
 * Derive human-readable transition label from from→to (not stored as eventType).
 * PR-WORKFORCE-TIMELINE-FOUNDATION-1
 */
export function deriveWorkforceTransitionLabel(
  from: ContractorWorkforceState | null,
  to: ContractorWorkforceState,
): string {
  if (from === null) {
    if (to === ContractorWorkforceState.NOMINATED) {
      return 'Nominated';
    }
    if (to === ContractorWorkforceState.ACTIVE) {
      return 'Activated';
    }
    return `Entered ${to.replace(/_/g, ' ').toLowerCase()}`;
  }

  if (
    from === ContractorWorkforceState.NOMINATED &&
    to === ContractorWorkforceState.PENDING_APPROVAL
  ) {
    return 'Submitted for review';
  }

  if (to === ContractorWorkforceState.REJECTED) {
    return 'Rejected';
  }

  if (
    from === ContractorWorkforceState.PENDING_APPROVAL &&
    to === ContractorWorkforceState.NOMINATED
  ) {
    return 'Returned to supplier';
  }

  if (
    from === ContractorWorkforceState.REJECTED &&
    to === ContractorWorkforceState.NOMINATED
  ) {
    return 'Reopened nomination';
  }

  if (to === ContractorWorkforceState.ACTIVE) {
    if (from === ContractorWorkforceState.PENDING_APPROVAL) {
      return 'Activated';
    }
    if (from === ContractorWorkforceState.SUSPENDED) {
      return 'Reinstated';
    }
    if (from === ContractorWorkforceState.TERMINATED) {
      return 'Rehired';
    }
    return 'Activated';
  }

  if (to === ContractorWorkforceState.SUSPENDED) {
    return 'Suspended';
  }
  if (to === ContractorWorkforceState.TERMINATED) {
    return 'Terminated';
  }
  if (to === ContractorWorkforceState.BLACKLISTED) {
    return 'Blacklisted';
  }

  return `${from} → ${to}`;
}

/** PR-WORKFORCE-HCM-HISTORY-1 — default operator-facing reason for promote/materialize. */
export const HCM_BOOTSTRAP_WORKFORCE_HISTORY_REASON =
  'HCM bootstrap materialization into EWP operational workforce';

export type HcmBootstrapHistoryMetadataInput = {
  stagingId: string;
  migrationBatchId?: string | null;
  contractorSourceSyncRunId?: string | null;
  sourcePersonId: string;
  sourcePersonNumber?: string | null;
  engagementId: string;
  legacySourceSystem?: string;
};

export function buildHcmBootstrapHistoryMetadata(
  input: HcmBootstrapHistoryMetadataInput,
): Record<string, unknown> {
  return {
    stagingId: input.stagingId,
    migrationBatchId: input.migrationBatchId ?? null,
    contractorSourceSyncRunId: input.contractorSourceSyncRunId ?? null,
    sourcePersonId: input.sourcePersonId,
    sourcePersonNumber: input.sourcePersonNumber ?? null,
    engagementId: input.engagementId,
    legacySourceSystem: input.legacySourceSystem ?? null,
    hcmBootstrap: true,
  };
}
