import type { ContractorWorkforceDomainEvent } from '../contractors/contractor-workforce-domain-events.constants';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from '../contractors/contractor-workforce-domain-events.constants';

/** CAP-ACCESS-INTEGRATION §10.1 — workforce facts that form access intent (not all domain events). */
export const WORKFORCE_ACCESS_REVOKE_EVENTS = new Set<ContractorWorkforceDomainEvent>([
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.SUSPENDED,
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.TERMINATED,
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.BLACKLISTED,
]);

export const WORKFORCE_ACCESS_RESTORE_EVENTS = new Set<ContractorWorkforceDomainEvent>([
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.ACTIVATED,
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REINSTATED,
  CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REHIRED,
]);

export function isWorkforceAccessRevokeEvent(
  event: ContractorWorkforceDomainEvent,
): boolean {
  return WORKFORCE_ACCESS_REVOKE_EVENTS.has(event);
}

export function isWorkforceAccessRestoreEvent(
  event: ContractorWorkforceDomainEvent,
): boolean {
  return WORKFORCE_ACCESS_RESTORE_EVENTS.has(event);
}

export function shouldPublishWorkforceAccessIntent(
  event: ContractorWorkforceDomainEvent,
): boolean {
  return isWorkforceAccessRevokeEvent(event) || isWorkforceAccessRestoreEvent(event);
}
