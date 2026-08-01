import { ContractorWorkforceState } from '@prisma/client';
import type { WorkforceHistoryEntry } from '../contractors/contractor-workforce-history.service';

/** Supplier portal read model — business narrative only (no ops metadata). */
export type SupplierPortalWorkforceHistoryEntry = {
  id: string;
  contractorId: string;
  fromState: WorkforceHistoryEntry['fromState'];
  toState: WorkforceHistoryEntry['toState'];
  transitionLabel: string;
  occurredAt: Date;
  effectiveAt: Date | null;
  source: WorkforceHistoryEntry['source'];
  /** Present only for portal-safe review outcomes (reject, send-back, reopen). */
  reason?: string | null;
};

const PORTAL_SAFE_REASON_TRANSITIONS = new Set<string>([
  `${ContractorWorkforceState.NOMINATED}:${ContractorWorkforceState.REJECTED}`,
  `${ContractorWorkforceState.PENDING_APPROVAL}:${ContractorWorkforceState.REJECTED}`,
  `${ContractorWorkforceState.PENDING_APPROVAL}:${ContractorWorkforceState.NOMINATED}`,
  `${ContractorWorkforceState.REJECTED}:${ContractorWorkforceState.NOMINATED}`,
]);

export function isPortalSafeWorkforceReason(
  from: ContractorWorkforceState | null,
  to: ContractorWorkforceState,
): boolean {
  const fromKey = from ?? 'null';
  return PORTAL_SAFE_REASON_TRANSITIONS.has(`${fromKey}:${to}`);
}

export function presentSupplierPortalWorkforceTimeline(
  entries: WorkforceHistoryEntry[],
): SupplierPortalWorkforceHistoryEntry[] {
  return entries.map((entry) => {
    const base: SupplierPortalWorkforceHistoryEntry = {
      id: entry.id,
      contractorId: entry.contractorId,
      fromState: entry.fromState,
      toState: entry.toState,
      transitionLabel: entry.transitionLabel,
      occurredAt: entry.occurredAt,
      effectiveAt: entry.effectiveAt,
      source: entry.source,
    };

    if (
      isPortalSafeWorkforceReason(entry.fromState, entry.toState) &&
      entry.reason?.trim()
    ) {
      base.reason = entry.reason.trim();
    }

    return base;
  });
}
