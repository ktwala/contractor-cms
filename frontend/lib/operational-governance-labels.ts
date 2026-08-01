/** Operator-facing labels — keep in sync with backend remediation.labels.ts
 *  Drift type enums are legacy (MISSING_RESPONSIBLE_MANAGER); canonical: MISSING_INTERNAL_ACCOUNTABILITY
 *  — see docs/INTERNAL_ACCOUNTABILITY_MODEL.md
 */

import { POLICY_EVALUATION_LABELS } from './policy-evaluation-labels';

const REMEDIATION_TYPE_LABELS: Record<string, string> = {
  PDP_RESTRICTION: POLICY_EVALUATION_LABELS.remediationTypeRestricted,
  ACCESS_REVIEW_REQUIRED: 'Operational legitimacy review',
  CORRELATION_REVIEW: 'Worker linking review',
  SUPPLIER_LINK_REPAIR: 'Supplier link resolution',
  TERMINATION_VALIDATION: 'External worker status validation',
  SPONSOR_ASSIGNMENT: 'Assign a Responsible Manager',
};

const DRIFT_TYPE_LABELS: Record<string, string> = {
  MISSING_RESPONSIBLE_MANAGER: 'No Responsible Manager assigned',
  SUPPLIER_LINK_MISSING: 'Missing supplier link',
  PERSON_CORRELATION_CONFLICT: 'Worker linking conflict',
  DUPLICATE_PERSON_ANCHOR: 'Duplicate worker record',
  GOVERNANCE_LIFECYCLE_CONFLICT: 'Lifecycle conflict (legacy)',
  WORKER_SOURCE_DRIFT: 'Import lineage note (informational)',
  CHECKPOINT_GAP: 'Connector checkpoint gap',
};

export function formatRemediationTypeLabel(type: string): string {
  return REMEDIATION_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase();
}

export function formatDriftTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return DRIFT_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase();
}
