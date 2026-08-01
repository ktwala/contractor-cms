/**
 * Canonical domain: Internal Accountability.
 *
 * Who inside the organization is accountable for an external worker?
 * Tenant UI labels (e.g. Responsible Manager) live in frontend vocabulary — not here.
 *
 * Schema/API identifiers use responsibleManager* naming (July 2026 vocabulary rename).
 */
export const INTERNAL_ACCOUNTABILITY_CANONICAL = {
  concept: 'Internal Accountability',
  missingFinding: 'MISSING_INTERNAL_ACCOUNTABILITY',
} as const;

/** Implementation identifiers — aligned with responsible manager vocabulary */
export const INTERNAL_ACCOUNTABILITY_FIELDS = {
  engagementField: 'responsibleManagerEmployeeId',
  delegateField: 'responsibleManagerDelegateEmployeeId',
  statusField: 'responsibleManagerStatus',
  validationField: 'responsibleManagerValidationStatus',
  driftType: 'MISSING_RESPONSIBLE_MANAGER',
  governanceEventType: 'EXTERNAL_WORKER_RESPONSIBLE_MANAGER_MISSING',
  telemetryMissingCount: 'missingResponsibleManagerCount',
} as const;
