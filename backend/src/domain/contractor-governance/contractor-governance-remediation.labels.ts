import {
  ContractorGovernanceRemediationType,
  ContractorSourceDriftType,
} from '@prisma/client';

/** Operator-facing labels — aligned with docs/POLICY_EVALUATION.md */
const POLICY_RESTRICTION_LABEL = 'Restricted by policy';

/**
 * Operator-facing labels — DB enums stay stable; UI/docs use operational governance language.
 */
const REMEDIATION_TYPE_LABELS: Record<ContractorGovernanceRemediationType, string> = {
  PDP_RESTRICTION: POLICY_RESTRICTION_LABEL,
  ACCESS_REVIEW_REQUIRED: 'Operational legitimacy review',
  CORRELATION_REVIEW: 'Bootstrap identity review',
  SUPPLIER_LINK_REPAIR: 'Supplier link resolution',
  TERMINATION_VALIDATION: 'Contractor status validation (CMS)',
};

const DRIFT_TYPE_LABELS: Partial<Record<ContractorSourceDriftType, string>> = {
  MISSING_RESPONSIBLE_MANAGER: 'No Responsible Manager assigned',
  SUPPLIER_LINK_MISSING: 'Missing supplier link',
  PERSON_CORRELATION_CONFLICT: 'Bootstrap identity conflict',
  DUPLICATE_PERSON_ANCHOR: 'Duplicate person anchor',
  GOVERNANCE_LIFECYCLE_CONFLICT: 'Lifecycle conflict (legacy)',
  WORKER_SOURCE_DRIFT: 'Bootstrap lineage note (informational)',
  CHECKPOINT_GAP: 'Connector checkpoint gap',
};

export function formatRemediationTypeLabel(
  type: ContractorGovernanceRemediationType,
): string {
  return REMEDIATION_TYPE_LABELS[type] ?? type;
}

export function formatDriftTypeLabel(type: string | undefined | null): string {
  if (!type) return '—';
  return DRIFT_TYPE_LABELS[type as ContractorSourceDriftType] ?? type.replace(/_/g, ' ').toLowerCase();
}
