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

  CONTRACTOR_CREATED: { action: 'CONTRACTOR_CREATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  CONTRACTOR_UPDATED: { action: 'CONTRACTOR_UPDATED', defaultSeverity: AUDIT_SEVERITY.INFO },
  CONTRACTOR_DELETED: { action: 'CONTRACTOR_DELETED', defaultSeverity: AUDIT_SEVERITY.CRITICAL },

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

  // PR-EXTID-EVENT-FEED-1 — integration pull API (IGA/middleware consumes)
  EXTID_EVENTS_LISTED: { action: 'EXTID_EVENTS_LISTED', defaultSeverity: AUDIT_SEVERITY.INFO },
  EXTID_EVENT_READ: { action: 'EXTID_EVENT_READ', defaultSeverity: AUDIT_SEVERITY.INFO },
  EXTID_EVENT_ACKED: { action: 'EXTID_EVENT_ACKED', defaultSeverity: AUDIT_SEVERITY.INFO },
  EXTID_EVENT_FAILED: { action: 'EXTID_EVENT_FAILED', defaultSeverity: AUDIT_SEVERITY.WARNING },
} as const;

export function isKnownAuditEvent(action: string): boolean {
  return Object.values(AUDIT_EVENTS).some(event => event.action === action);
}
