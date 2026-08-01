import { BadRequestException } from '@nestjs/common';
import { ContractorWorkforceState } from '@prisma/client';
import {
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS,
  ContractorWorkforceDomainEvent,
} from './contractor-workforce-domain-events.constants';

export const INVALID_CONTRACTOR_WORKFORCE_TRANSITION =
  'INVALID_CONTRACTOR_WORKFORCE_TRANSITION';

export const WORKFORCE_TRANSITION_REASON_REQUIRED =
  'WORKFORCE_TRANSITION_REASON_REQUIRED';

export const WORKFORCE_TRANSITION_AUTHORITY_NOTE_REQUIRED =
  'WORKFORCE_TRANSITION_AUTHORITY_NOTE_REQUIRED';

/** PR-WORKFORCE-BLACKLIST-1 — CMS workforce block sources (not MTN disciplinary workflow). */
export const WORKFORCE_BLACKLIST_SOURCE_STATES: readonly ContractorWorkforceState[] = [
  ContractorWorkforceState.NOMINATED,
  ContractorWorkforceState.PENDING_APPROVAL,
  ContractorWorkforceState.REJECTED,
  ContractorWorkforceState.ACTIVE,
  ContractorWorkforceState.TERMINATED,
];

export function canTransitionToBlacklisted(
  from: ContractorWorkforceState,
): boolean {
  return (
    WORKFORCE_BLACKLIST_SOURCE_STATES.includes(from) &&
    (CONTRACTOR_WORKFORCE_TRANSITIONS[from]?.includes(
      ContractorWorkforceState.BLACKLISTED,
    ) ??
      false)
  );
}

/** PR-WORKFORCE-REVIEW-OUTCOMES-1 — supplier-backed review outcomes (not MTN approval workflow). */
export const CONTRACTOR_WORKFORCE_TRANSITIONS: Readonly<
  Partial<Record<ContractorWorkforceState, readonly ContractorWorkforceState[]>>
> = {
  [ContractorWorkforceState.NOMINATED]: [
    ContractorWorkforceState.PENDING_APPROVAL,
    ContractorWorkforceState.REJECTED,
    ContractorWorkforceState.BLACKLISTED,
  ],
  [ContractorWorkforceState.PENDING_APPROVAL]: [
    ContractorWorkforceState.ACTIVE,
    ContractorWorkforceState.NOMINATED,
    ContractorWorkforceState.REJECTED,
    ContractorWorkforceState.BLACKLISTED,
  ],
  [ContractorWorkforceState.REJECTED]: [
    ContractorWorkforceState.NOMINATED,
    ContractorWorkforceState.BLACKLISTED,
  ],
  [ContractorWorkforceState.ACTIVE]: [
    ContractorWorkforceState.SUSPENDED,
    ContractorWorkforceState.TERMINATED,
    ContractorWorkforceState.BLACKLISTED,
  ],
  [ContractorWorkforceState.SUSPENDED]: [ContractorWorkforceState.ACTIVE],
  [ContractorWorkforceState.TERMINATED]: [
    ContractorWorkforceState.ACTIVE,
    ContractorWorkforceState.BLACKLISTED,
  ],
  [ContractorWorkforceState.BLACKLISTED]: [],
};

/** Transitions that require an operator reason (audit + portal-safe narrative). */
export const WORKFORCE_TRANSITIONS_REQUIRING_REASON: ReadonlyArray<
  readonly [ContractorWorkforceState, ContractorWorkforceState]
> = [
  [ContractorWorkforceState.NOMINATED, ContractorWorkforceState.REJECTED],
  [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.REJECTED],
  [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.NOMINATED],
  [ContractorWorkforceState.REJECTED, ContractorWorkforceState.NOMINATED],
];

/** Any transition to BLACKLISTED requires reason + internal authority note. */
export function requiresWorkforceBlacklistInputs(
  to: ContractorWorkforceState,
): boolean {
  return to === ContractorWorkforceState.BLACKLISTED;
}

export function requiresWorkforceTransitionReason(
  from: ContractorWorkforceState,
  to: ContractorWorkforceState,
): boolean {
  return WORKFORCE_TRANSITIONS_REQUIRING_REASON.some(
    ([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to,
  );
}

export function assertWorkforceTransitionReason(
  from: ContractorWorkforceState,
  to: ContractorWorkforceState,
  reason?: string | null,
): void {
  if (requiresWorkforceBlacklistInputs(to) || requiresWorkforceTransitionReason(from, to)) {
    if (!reason?.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Reason is required for this workforce transition',
        error: 'Bad Request',
        code: WORKFORCE_TRANSITION_REASON_REQUIRED,
        fromState: from,
        toState: to,
      });
    }
  }
}

export function assertWorkforceTransitionAuthorityNote(
  from: ContractorWorkforceState,
  to: ContractorWorkforceState,
  authorityNote?: string | null,
): void {
  if (!requiresWorkforceBlacklistInputs(to)) {
    return;
  }
  if (!authorityNote?.trim()) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Authority note is required when blacklisting a contractor',
      error: 'Bad Request',
      code: WORKFORCE_TRANSITION_AUTHORITY_NOTE_REQUIRED,
      fromState: from,
      toState: to,
    });
  }
}

export function buildWorkforceBlacklistHistoryMetadata(authorityNote: string): Record<string, unknown> {
  return {
    authorityNote: authorityNote.trim(),
    workforceBlock: true,
  };
}

/** Interim bridge until `isActive` is retired (ADR-011 §5). */
export function deriveIsActiveFromWorkforceState(
  state: ContractorWorkforceState,
): boolean {
  return state === ContractorWorkforceState.ACTIVE;
}

/** PR-WORKFORCE-OPS-REVIEW-1 — primary ops advance action for review queue rows. */
export function resolveOpsReviewNextTargetState(
  state: ContractorWorkforceState,
): ContractorWorkforceState | null {
  if (state === ContractorWorkforceState.NOMINATED) {
    return ContractorWorkforceState.PENDING_APPROVAL;
  }
  if (state === ContractorWorkforceState.PENDING_APPROVAL) {
    return ContractorWorkforceState.ACTIVE;
  }
  return null;
}

export const WORKFORCE_OPS_REVIEW_STATES: readonly ContractorWorkforceState[] = [
  ContractorWorkforceState.NOMINATED,
  ContractorWorkforceState.PENDING_APPROVAL,
];

export function resolveWorkforceDomainEvent(
  from: ContractorWorkforceState,
  to: ContractorWorkforceState,
): ContractorWorkforceDomainEvent | null {
  if (from === to) {
    return null;
  }

  if (to === ContractorWorkforceState.REJECTED) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REJECTED;
  }
  if (from === ContractorWorkforceState.REJECTED && to === ContractorWorkforceState.NOMINATED) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATION_REOPENED;
  }
  if (from === ContractorWorkforceState.PENDING_APPROVAL && to === ContractorWorkforceState.NOMINATED) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED;
  }

  if (to === ContractorWorkforceState.BLACKLISTED) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.BLACKLISTED;
  }
  if (to === ContractorWorkforceState.SUSPENDED) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.SUSPENDED;
  }
  if (to === ContractorWorkforceState.TERMINATED) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.TERMINATED;
  }
  if (to === ContractorWorkforceState.ACTIVE) {
    if (from === ContractorWorkforceState.TERMINATED) {
      return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REHIRED;
    }
    if (from === ContractorWorkforceState.SUSPENDED) {
      return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REINSTATED;
    }
    if (
      from === ContractorWorkforceState.NOMINATED ||
      from === ContractorWorkforceState.PENDING_APPROVAL
    ) {
      return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.ACTIVATED;
    }
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.ACTIVATED;
  }
  if (to === ContractorWorkforceState.PENDING_APPROVAL) {
    return CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED;
  }

  return null;
}
