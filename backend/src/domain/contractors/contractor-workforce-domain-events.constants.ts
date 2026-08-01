/**
 * PR-WORKFORCE-STATE-MODEL-1 — workforce plane domain events (stubs; handlers TBD).
 * @see docs/business/ADR-011-Contractor-Workforce-Administration-Plane.md
 */
export const CONTRACTOR_WORKFORCE_DOMAIN_EVENTS = {
  NOMINATED: 'ContractorNominated',
  ACTIVATED: 'ContractorActivated',
  EXTENDED: 'ContractExtended',
  SUSPENDED: 'ContractorSuspended',
  REINSTATED: 'ContractorReinstated',
  TERMINATED: 'ContractorTerminated',
  BLACKLISTED: 'ContractorBlacklisted',
  REHIRED: 'ContractorRehired',
  REJECTED: 'ContractorRejected',
  NOMINATION_REOPENED: 'ContractorNominationReopened',
} as const;

export type ContractorWorkforceDomainEvent =
  (typeof CONTRACTOR_WORKFORCE_DOMAIN_EVENTS)[keyof typeof CONTRACTOR_WORKFORCE_DOMAIN_EVENTS];
