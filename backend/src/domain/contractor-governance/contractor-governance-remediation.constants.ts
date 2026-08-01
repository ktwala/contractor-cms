import {
  ContractorGovernanceRemediationType,
  ContractorSourceDriftType,
} from '@prisma/client';

export const GOVERNANCE_REMEDIATION_DUE_HOURS_CRITICAL = 24;

/** Downstream governance contract event types (Soffid / IGA / PAM consumers). */
export const GOVERNANCE_REMEDIATION_EVENT_TYPES = {
  LIFECYCLE_CONFLICT: 'CONTRACTOR_GOVERNANCE_LIFECYCLE_CONFLICT',
  /** Legacy event id — canonical finding: MISSING_INTERNAL_ACCOUNTABILITY */
  MISSING_RESPONSIBLE_MANAGER: 'EXTERNAL_WORKER_RESPONSIBLE_MANAGER_MISSING',
  CORRELATION_CONFLICT: 'CONTRACTOR_GOVERNANCE_CORRELATION_CONFLICT',
  SUPPLIER_LINK_MISSING: 'CONTRACTOR_GOVERNANCE_SUPPLIER_LINK_MISSING',
  WORKER_SOURCE_DRIFT: 'CONTRACTOR_GOVERNANCE_WORKER_SOURCE_DRIFT',
} as const;

export function remediationTypeForDrift(
  driftType: ContractorSourceDriftType,
): ContractorGovernanceRemediationType {
  switch (driftType) {
    case ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT:
    case ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER:
      return ContractorGovernanceRemediationType.PDP_RESTRICTION;
    case ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT:
    case ContractorSourceDriftType.DUPLICATE_PERSON_ANCHOR:
      return ContractorGovernanceRemediationType.CORRELATION_REVIEW;
    case ContractorSourceDriftType.SUPPLIER_LINK_MISSING:
      return ContractorGovernanceRemediationType.SUPPLIER_LINK_REPAIR;
    case ContractorSourceDriftType.CHECKPOINT_GAP:
      return ContractorGovernanceRemediationType.ACCESS_REVIEW_REQUIRED;
    default:
      return ContractorGovernanceRemediationType.ACCESS_REVIEW_REQUIRED;
  }
}

export function eventTypeForDrift(driftType: ContractorSourceDriftType): string {
  switch (driftType) {
    case ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT:
      return GOVERNANCE_REMEDIATION_EVENT_TYPES.LIFECYCLE_CONFLICT;
    case ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER:
      return GOVERNANCE_REMEDIATION_EVENT_TYPES.MISSING_RESPONSIBLE_MANAGER;
    case ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT:
    case ContractorSourceDriftType.DUPLICATE_PERSON_ANCHOR:
      return GOVERNANCE_REMEDIATION_EVENT_TYPES.CORRELATION_CONFLICT;
    case ContractorSourceDriftType.SUPPLIER_LINK_MISSING:
      return GOVERNANCE_REMEDIATION_EVENT_TYPES.SUPPLIER_LINK_MISSING;
    default:
      return GOVERNANCE_REMEDIATION_EVENT_TYPES.WORKER_SOURCE_DRIFT;
  }
}

export function recommendedActionsForDrift(
  driftType: ContractorSourceDriftType,
): string[] {
  switch (driftType) {
    case ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT:
      return ['PDP_RESTRICTION', 'GOVERNANCE_REVIEW', 'TERMINATION_VALIDATION'];
    case ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER:
      return [
        'PDP_RESTRICTION',
        'ASSIGN_SPONSOR',
        'ENGAGEMENT_REVIEW',
        'GOVERNANCE_REVIEW',
      ];
    case ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT:
      return ['BOOTSTRAP_IDENTITY_REVIEW', 'MANUAL_MATCH_RESOLUTION'];
    case ContractorSourceDriftType.SUPPLIER_LINK_MISSING:
      return ['RESOLVE_SUPPLIER_LINK', 'ASSIGN_GOVERNED_SUPPLIER'];
    default:
      return ['GOVERNANCE_REVIEW'];
  }
}

export function shouldApplyPdpRestrictions(
  driftType: ContractorSourceDriftType,
): boolean {
  return (
    driftType === ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT ||
    driftType === ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER
  );
}
