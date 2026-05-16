# Audit Intelligence Event Catalog

This document serves as the canonical contract for all Security Operations and Audit Intelligence events emitted by the platform. The platform utilizes a strictly governed, backend-sovereign audit capability.

## Principles

1. **Strict Governance**: Audit events must use canonical action strings defined in `backend/src/core/audit/audit-events.constants.ts`. Ad-hoc strings are blocked by CI drift gates.
2. **Backend Sovereign**: Frontend client code never submits audit events. The backend generates audit events synchronously with the database mutation, deriving identity directly from the authenticated session context (`req.user`).
3. **Immutability**: Audit records are insert-only. No system actor can mutate or delete an audit log.

## Required Fields

When instrumenting a domain controller or service, the `AuditService.logAction` method requires the following contextual fields:

- **actorUserId**: The authenticated identity performing the action (derived securely from `AccessContext`). `null` represents a system execution.
- **action**: The canonical string identifier from the catalog (e.g., `ROLE_CREATED`).
- **targetType**: The domain object type being mutated (e.g., `User`, `Role`, `Invoice`).
- **targetId**: The UUID of the domain object being mutated.
- **before** / **after**: (Optional but highly recommended) The state of the object before and after the mutation for point-in-time reconstruction.
- **organizationId**: The specific tenant context where the action occurred. Crucial for isolation tracking.
- **severity**: Usually auto-derived from the catalog, but can be elevated (e.g., to `CRITICAL` via anomaly detection).
- **tags**: Contextual flags (e.g., `SPOOF_ATTEMPT`, `ANOMALY_RATE_LIMIT`) attached by security middleware.

## Severity Classifications

| Severity | Description | Alerting Profile |
| :--- | :--- | :--- |
| **CRITICAL** | Indicators of compromise, spoofing attempts, or active attacks. | Paged immediately to SOC / Orchestrator |
| **HIGH** | Major privileged mutations (e.g., deleting a role). | Active review required by Security |
| **WARNING** | Standard privileged mutations (e.g., assigning a role, updating permissions). | Passive monitoring / Daily review |
| **INFO** | Standard business mutations (e.g., creating an invoice, approving a timesheet). | Retained for compliance only |
| **LOW** | System noise or background maintenance. | Dropped from active index after 30 days |

## Canonical Event Catalog

The following is the exhaustive list of governed audit events. 

### Authentication & Sessions
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `LOGIN_SUCCESS` | INFO | Auth Controller | Standard user authentication. |
| `LOGIN_FAILED` | WARNING | Auth Controller | Failed authentication attempt (bad password, deactivated). |
| `ACCESS_DENIED_403` | WARNING/CRITICAL | PermissionsGuard | Attempted access to a route without required permissions. Automatically elevates to `CRITICAL` + `ANOMALY_RATE_LIMIT` upon 10+ failures in 5m. |
| `VALIDATION_SPOOF_400` | CRITICAL | HttpExceptionFilter | Detection of malicious parameter injection (e.g., `organizationId` spoofing attempt in query). Auto-tagged `SPOOF_ATTEMPT`. |

### Role & Permission Management
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `ROLE_CREATED` | INFO | Roles Service | A custom role was created. |
| `ROLE_UPDATED` | WARNING | Roles Service | A role's permissions or details were modified. |
| `ROLE_DELETED` | CRITICAL | Roles Service | A custom role was permanently removed. |
| `ROLE_ASSIGNED` | WARNING | Users/Roles Service | A role was assigned to an identity. |
| `ROLE_REMOVED` | WARNING | Users/Roles Service | A role was revoked from an identity. |
| `USER_ROLES_REPLACED` | WARNING | Users Service | Complete wipe and replacement of a user's role bindings. |
| `USER_ROLES_ADDED` | WARNING | Users Service | Addition of new roles to a user. |
| `USER_ROLE_REMOVED` | WARNING | Users Service | Revocation of a specific role from a user. |

### Identity Management (Users)
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `USER_CREATED` | INFO | Users Service | New internal or admin identity provisioned. |
| `USER_UPDATED` | INFO | Users Service | User profile or details modified. |
| `USER_DEACTIVATED` | WARNING | Users Service | User account suspended/deactivated. |

### Core Business Domains (Contractors & Suppliers)
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `SUPPLIER_CREATED` | INFO | Suppliers Service | New supplier entity onboarded. |
| `SUPPLIER_UPDATED` | INFO | Suppliers Service | Supplier profile modified. |
| `SUPPLIER_DELETED` | HIGH | Suppliers Service | Supplier permanently deleted. |
| `CONTRACTOR_CREATED` | INFO | Contractors Service | New contractor identity created. |
| `CONTRACTOR_UPDATED` | INFO | Contractors Service | Contractor details modified. |
| `CONTRACTOR_DELETED` | HIGH | Contractors Service | Contractor permanently deleted. |

### Core Business Domains (Financials)
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `INVOICE_SUBMITTED` | INFO | Invoices Service | Draft invoice submitted for approval. |
| `INVOICE_APPROVED` | INFO | Invoices Service | Invoice verified and approved. |
| `INVOICE_REJECTED` | WARNING | Invoices Service | Invoice explicitly rejected. |
| `INVOICE_PAID` | INFO | Invoices Service | Invoice marked as completed/paid. |
| `TIMESHEET_SUBMITTED` | INFO | Timesheets Service | Contractor timesheet submitted. |
| `TIMESHEET_APPROVED` | INFO | Timesheets Service | Timesheet approved by manager. |
| `TIMESHEET_REJECTED` | WARNING | Timesheets Service | Timesheet explicitly rejected. |

### EXTID integration feed (PR-EXTID-EVENT-FEED-1)
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `EXTID_EVENTS_LISTED` | INFO | Extid Events Service | Integration client listed outbox events (pull feed). |
| `EXTID_EVENT_READ` | INFO | Extid Events Service | Integration client read a single outbox event. |
| `EXTID_EVENT_ACKED` | INFO | Extid Events Service | Integration client acknowledged event (deliveryStatus → SENT). |
| `EXTID_EVENT_FAILED` | WARNING | Extid Events Service | Integration client marked event failed with reason. |

### System & Operations
| Action | Default Severity | Emitting Component | Description |
| :--- | :--- | :--- | :--- |
| `AUDIT_EXPORTED` | WARNING | Audit Controller | Security administrator downloaded raw CSV of the audit index. |

---

## Anti-Drift Enforcement

If you need to introduce a new event:
1. Define it in `backend/src/core/audit/audit-events.constants.ts`.
2. Add it to this catalog.
3. Ensure your PR satisfies the `security-drift-check.sh` CI gate.
