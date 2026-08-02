/**
 * Canonical Audit Events Catalog
 *
 * This acts as the single source of truth for all security and operational audit logging.
 * Drift gates will enforce that only these events are used when calling AuditService.logAction.
 */

export const AUDIT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

export type AuditSeverity = typeof AUDIT_SEVERITY[keyof typeof AUDIT_SEVERITY];

export const AUDIT_TAGS = {
  SPOOF_ATTEMPT: 'SPOOF_ATTEMPT',
  ANOMALY_RATE_LIMIT: 'ANOMALY_RATE_LIMIT',
  HIGH_PRIVILEGE: 'HIGH_PRIVILEGE',
  CROSS_TENANT: 'CROSS_TENANT',
  WILDCARD_ASSIGNMENT: 'WILDCARD_ASSIGNMENT',
  VALIDATION_FAILURE: 'VALIDATION_FAILURE',
} as const;

export const AUDIT_EVENTS = {
  // Authentication & Session
  LOGIN_SUCCESS: { action: 'LOGIN_SUCCESS', defaultSeverity: AUDIT_SEVERITY.INFO },
  LOGIN_FAILED: { action: 'LOGIN_FAILED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  ACCESS_DENIED_403: { action: 'ACCESS_DENIED_403', defaultSeverity: AUDIT_SEVERITY.WARNING },
  VALIDATION_SPOOF_400: { action: 'VALIDATION_SPOOF_400', defaultSeverity: AUDIT_SEVERITY.CRITICAL },

  // User Management
  USER_CREATED: { action: 'USER_CREATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  USER_UPDATED: { action: 'USER_UPDATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  USER_DEACTIVATED: { action: 'USER_DEACTIVATED', defaultSeverity: AUDIT_SEVERITY.WARNING },

  // Role & Permission Management
  ROLE_CREATED: { action: 'ROLE_CREATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  ROLE_UPDATED: { action: 'ROLE_UPDATED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  ROLE_DELETED: { action: 'ROLE_DELETED', defaultSeverity: AUDIT_SEVERITY.CRITICAL },
  ROLE_ASSIGNED: { action: 'ROLE_ASSIGNED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  ROLE_REMOVED: { action: 'ROLE_REMOVED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  USER_ROLES_REPLACED: { action: 'USER_ROLES_REPLACED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  USER_ROLES_ADDED: { action: 'USER_ROLES_ADDED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  USER_ROLE_REMOVED: { action: 'USER_ROLE_REMOVED', defaultSeverity: AUDIT_SEVERITY.WARNING },

  // Core Business Entities
  SUPPLIER_CREATED: { action: 'SUPPLIER_CREATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  SUPPLIER_UPDATED: { action: 'SUPPLIER_UPDATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  SUPPLIER_DELETED: { action: 'SUPPLIER_DELETED', defaultSeverity: AUDIT_SEVERITY.CRITICAL },
  SUPPLIER_STATUS_CHANGED: {
    action: 'SUPPLIER_STATUS_CHANGED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_SUBMITTED_FOR_APPROVAL: {
    action: 'SUPPLIER_SUBMITTED_FOR_APPROVAL',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_APPROVED: { action: 'SUPPLIER_APPROVED', defaultSeverity: AUDIT_SEVERITY.INFO },
  SUPPLIER_REJECTED: {
    action: 'SUPPLIER_REJECTED',
    defaultSeverity: AUDIT_SEVERITY.WARNING,
  },
  SUPPLIER_SUSPENDED: {
    action: 'SUPPLIER_SUSPENDED',
    defaultSeverity: AUDIT_SEVERITY.WARNING,
  },
  SUPPLIER_OFFBOARDED: {
    action: 'SUPPLIER_OFFBOARDED',
    defaultSeverity: AUDIT_SEVERITY.WARNING,
  },
  SUPPLIER_ARCHIVED: {
    action: 'SUPPLIER_ARCHIVED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_DOCUMENT_ADDED: {
    action: 'SUPPLIER_DOCUMENT_ADDED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_DOCUMENT_UPDATED: {
    action: 'SUPPLIER_DOCUMENT_UPDATED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_DOCUMENT_EXPIRED: {
    action: 'SUPPLIER_DOCUMENT_EXPIRED',
    defaultSeverity: AUDIT_SEVERITY.WARNING,
  },
  SUPPLIER_SOURCE_ORACLE_IMPORTED: {
    action: 'SUPPLIER_SOURCE_ORACLE_IMPORTED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  CONTRACTOR_SOURCE_HCM_IMPORTED: {
    action: 'CONTRACTOR_SOURCE_HCM_IMPORTED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  CONTRACTOR_GOVERNANCE_REMEDIATION_EVENT_EMITTED: {
    action: 'CONTRACTOR_GOVERNANCE_REMEDIATION_EVENT_EMITTED',
    defaultSeverity: AUDIT_SEVERITY.WARNING,
  },
  CONTRACTOR_GOVERNANCE_REMEDIATION_ACKNOWLEDGED: {
    action: 'CONTRACTOR_GOVERNANCE_REMEDIATION_ACKNOWLEDGED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  CONTRACTOR_GOVERNANCE_REMEDIATION_VERIFIED: {
    action: 'CONTRACTOR_GOVERNANCE_REMEDIATION_VERIFIED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  CONTRACTOR_GOVERNANCE_REMEDIATION_CLOSED: {
    action: 'CONTRACTOR_GOVERNANCE_REMEDIATION_CLOSED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_GOVERNANCE_TWIN_CREATED: {
    action: 'SUPPLIER_GOVERNANCE_TWIN_CREATED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_GOVERNANCE_TWIN_LINKED: {
    action: 'SUPPLIER_GOVERNANCE_TWIN_LINKED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  SUPPLIER_GOVERNANCE_TWIN_PROMOTED: {
    action: 'SUPPLIER_GOVERNANCE_TWIN_PROMOTED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },

  CONTRACTOR_CREATED: { action: 'CONTRACTOR_CREATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  // PR-CTR-CMS-AUTHORITY-1 — distinguishes CMS-native creation from HCM-bootstrapped materialization.
  // Fired in addition to CONTRACTOR_CREATED when the actor creates a contractor directly in CMS
  // (not via HCM import/materialization). metadata.missingResponsibleManagerAtCreation=true when no sponsor at
  // the time of creation — governance scan will raise MISSING_RESPONSIBLE_MANAGER until sponsor assigned.
  CONTRACTOR_CREATED_IN_CMS: { action: 'CONTRACTOR_CREATED_IN_CMS', defaultSeverity: AUDIT_SEVERITY.INFO },
  // PR-WORKFORCE-NOMINATE-1 — fired alongside CONTRACTOR_CREATED when the worker is acquired through
  // the independent channel (nominate intake), not via HCM bootstrap. Records acquisition model,
  // workforce intake classification, and engagement details for audit trail.
  CONTRACTOR_ACQUIRED_INDEPENDENT: { action: 'CONTRACTOR_ACQUIRED_INDEPENDENT', defaultSeverity: AUDIT_SEVERITY.INFO },
  CONTRACTOR_UPDATED: { action: 'CONTRACTOR_UPDATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  CONTRACTOR_DELETED: { action: 'CONTRACTOR_DELETED', defaultSeverity: AUDIT_SEVERITY.CRITICAL },
  CONTRACTOR_WORKFORCE_STATE_CHANGED: {
    action: 'CONTRACTOR_WORKFORCE_STATE_CHANGED',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },
  /** Stub domain-event envelope until workforce bus handlers ship (PR-WORKFORCE-STATE-MODEL-1). */
  CONTRACTOR_WORKFORCE_DOMAIN_EVENT: {
    action: 'CONTRACTOR_WORKFORCE_DOMAIN_EVENT',
    defaultSeverity: AUDIT_SEVERITY.INFO,
  },

  // Transactions
  INVOICE_SUBMITTED: { action: 'INVOICE_SUBMITTED', defaultSeverity: AUDIT_SEVERITY.INFO },
  INVOICE_APPROVED: { action: 'INVOICE_APPROVED', defaultSeverity: AUDIT_SEVERITY.INFO },
  INVOICE_REJECTED: { action: 'INVOICE_REJECTED', defaultSeverity: AUDIT_SEVERITY.WARNING },
  INVOICE_PAID: { action: 'INVOICE_PAID', defaultSeverity: AUDIT_SEVERITY.INFO },

  TIMESHEET_SUBMITTED: { action: 'TIMESHEET_SUBMITTED', defaultSeverity: AUDIT_SEVERITY.INFO },
  TIMESHEET_APPROVED: { action: 'TIMESHEET_APPROVED', defaultSeverity: AUDIT_SEVERITY.INFO },
  TIMESHEET_REJECTED: { action: 'TIMESHEET_REJECTED', defaultSeverity: AUDIT_SEVERITY.WARNING },

  // Settings & Configuration
  SECURITY_SETTINGS_CHANGED: { action: 'SECURITY_SETTINGS_CHANGED', defaultSeverity: AUDIT_SEVERITY.CRITICAL },

  // PR-GOV-SIGNAL-LIFECYCLE-2 — Workforce migration cutover ceremony
  // These events fire when an admin explicitly declares or clears the workforce cutover date.
  // Cutover changes governance visibility semantics (operational vs bootstrap priority),
  // making it audit-mandatory for RCA, attestation, and executive reporting.
  WORKFORCE_CUTOVER_SET: { action: 'WORKFORCE_CUTOVER_SET', defaultSeverity: AUDIT_SEVERITY.INFO },
  WORKFORCE_CUTOVER_CLEARED: { action: 'WORKFORCE_CUTOVER_CLEARED', defaultSeverity: AUDIT_SEVERITY.INFO },

  // PR-GOV-SIGNAL-LIFECYCLE-3 — bootstrap signal decay provenance
  // One event per decay batch (not per signal) — archivedCount in metadata.
  BOOTSTRAP_SIGNAL_ARCHIVED: { action: 'BOOTSTRAP_SIGNAL_ARCHIVED', defaultSeverity: AUDIT_SEVERITY.INFO },

  // PR-EXTID-EVENT-FEED-1 — integration pull API (IGA/middleware consumes)
  EXTID_EVENTS_LISTED: { action: 'EXTID_EVENTS_LISTED', defaultSeverity: AUDIT_SEVERITY.INFO },
  EXTID_EVENT_READ: { action: 'EXTID_EVENT_READ', defaultSeverity: AUDIT_SEVERITY.INFO },
  EXTID_EVENT_ACKED: { action: 'EXTID_EVENT_ACKED', defaultSeverity: AUDIT_SEVERITY.INFO },
  EXTID_EVENT_FAILED: { action: 'EXTID_EVENT_FAILED', defaultSeverity: AUDIT_SEVERITY.WARNING },
} as const;

export function isKnownAuditEvent(action: string): boolean {
  return Object.values(AUDIT_EVENTS).some(event => event.action === action);
}
