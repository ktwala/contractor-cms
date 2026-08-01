# Hubsec Workforce Platform — Dashboard API Contract

**Version:** v1.0  
**Audience:** Backend, frontend, QA, product  
**Purpose:** Define the API contract for the Hubsec Workforce Admin dashboard so all teams implement the same widget behavior and data model.

---

## 1. Overview

The dashboard is the operational summary page for Hubsec Workforce Admin.

It should answer four questions quickly:

- Is the platform set up?
- What is the current workforce and payroll state?
- What needs attention now?
- Is the platform ready for downstream integration and governance?

The dashboard is not a full reporting surface. It is a lightweight operational cockpit.

---

## 2. Dashboard widgets

The following widgets are in scope:

- Setup Progress
- Workforce Snapshot
- Payroll Snapshot
- Compliance Snapshot
- Pending Approvals
- Data Imports
- HR Export / IGA Readiness
- Quick Actions

Quick Actions is frontend-defined for v1 and does not require an API.

---

## 3. Common API conventions

### Base path

All dashboard APIs are under:

```
/v1/dashboard
```

### Authentication

All dashboard APIs require:

- JWT authentication
- normal admin portal access rules

### Response style

All endpoints return JSON.

### Time format

All timestamps must be ISO 8601 UTC.

Example: `2026-07-01T11:45:00Z`

### Status values

Use uppercase status values consistently.

Examples: `READY`, `IN_PROGRESS`, `NOT_STARTED`, `OPEN`, `COMPLETED`, `FAILED`, `DUE_SOON`, `OVERDUE`

---

## 4. Setup Progress

**Purpose:** Show whether the platform is configured enough for operational use.

### Endpoint

```
GET /v1/setup/status
```

### Response

```json
{
  "summary": {
    "completed": 4,
    "total": 6,
    "is_complete": false
  },
  "items": [
    {
      "key": "legal_entities",
      "label": "Legal Entities",
      "count": 1,
      "status": "READY",
      "href": "/enterprise/legal-entities"
    },
    {
      "key": "org_units",
      "label": "Org Structure",
      "count": 0,
      "status": "IN_PROGRESS",
      "href": "/enterprise/org-structure"
    },
    {
      "key": "cost_centers",
      "label": "Cost Centers",
      "count": 4,
      "status": "READY",
      "href": "/enterprise/cost-centers"
    },
    {
      "key": "employees",
      "label": "Employees",
      "count": 10,
      "status": "READY",
      "href": "/enterprise/employees"
    },
    {
      "key": "employments",
      "label": "Employments",
      "count": 10,
      "status": "READY",
      "href": "/enterprise/employees"
    },
    {
      "key": "hr_export",
      "label": "HR Export (IGA)",
      "count": 10,
      "status": "READY",
      "href": "/enterprise/hr-export"
    }
  ]
}
```

### Rules

- `READY` → count > 0 and dependency satisfied
- `IN_PROGRESS` → partially configured
- `NOT_STARTED` → no relevant records
- widget should be hidden in the UI when `summary.is_complete = true`

---

## 5. Workforce Snapshot

**Purpose:** Show workforce master-data readiness at a glance.

### Endpoint

```
GET /v1/dashboard/workforce-summary
```

### Response

```json
{
  "employees": 400,
  "employments": 400,
  "org_units": 12,
  "cost_centers": 18,
  "legal_entities": 2,
  "positions": 6
}
```

### UI usage

Primary values for v1: Employees, Employments, Org Units, Cost Centers

### Notes

This endpoint should be lightweight and fast.

---

## 6. Payroll Snapshot

**Purpose:** Show current payroll operating state.

### Endpoint

```
GET /v1/dashboard/payroll-summary
```

### Response

```json
{
  "current_period": {
    "label": "Jul 2026",
    "status": "OPEN"
  },
  "pending_approvals": 2,
  "exceptions": 3,
  "payment_batches": 1,
  "next_pay_date": "2026-07-25"
}
```

### Empty/setup response

```json
{
  "current_period": null,
  "pending_approvals": 0,
  "exceptions": 0,
  "payment_batches": 0,
  "next_pay_date": null,
  "setup_required": true
}
```

### Status values

Suggested values for `current_period.status`:

- `UPCOMING`
- `OPEN`
- `PROCESSING`
- `COMPLETED`
- `LOCKED`

---

## 7. Compliance Snapshot

**Purpose:** Show high-level statutory readiness and upcoming deadlines.

### Endpoint

```
GET /v1/dashboard/compliance-summary
```

### Response

```json
{
  "emp201": {
    "status": "DUE_SOON",
    "due_date": "2026-07-07"
  },
  "irp5": {
    "status": "OUT_OF_SEASON"
  },
  "alerts": 1,
  "tax_tables_configured": true
}
```

### Status values

Suggested values: `READY`, `DUE_SOON`, `OVERDUE`, `OUT_OF_SEASON`, `NOT_CONFIGURED`

### Notes

This widget is a summary only. It is not a replacement for the full compliance dashboard.

---

## 8. Pending Approvals Widget

**Purpose:** Surface work requiring immediate action.

### Endpoint

```
GET /v1/dashboard/pending-approvals
```

### Response

```json
{
  "count": 2,
  "items": [
    {
      "id": "apr_001",
      "type": "PAYRUN",
      "title": "July payroll approval",
      "href": "/enterprise/approvals/pending"
    },
    {
      "id": "apr_002",
      "type": "WORKFLOW",
      "title": "Salary change request",
      "href": "/enterprise/approvals/pending"
    }
  ]
}
```

### Empty response

```json
{
  "count": 0,
  "items": []
}
```

### UI behavior

- show count prominently
- show up to 3 items
- if empty, show "No approvals pending"

---

## 9. Data Imports Widget

**Purpose:** Show onboarding/import activity and data quality status.

### Endpoint

```
GET /v1/dashboard/data-imports-summary
```

### Response

```json
{
  "latest_job": {
    "id": "job_123",
    "name": "employees.csv",
    "status": "COMPLETED",
    "submitted_at": "2026-07-01T10:00:00Z"
  },
  "rejected_rows": 3,
  "pending_jobs": 0
}
```

### Empty response

```json
{
  "latest_job": null,
  "rejected_rows": 0,
  "pending_jobs": 0
}
```

### Status values

Suggested values: `PENDING`, `VALIDATING`, `APPROVED`, `PUBLISHED`, `COMPLETED`, `FAILED`

### Notes

This widget should summarize only the most recent or most relevant import state.

---

## 10. HR Export / IGA Readiness Widget

**Purpose:** Show whether the workforce data is ready for downstream HR export and identity lifecycle integration.

### Endpoint

```
GET /v1/dashboard/hr-export-readiness
```

### Response

```json
{
  "status": "READY_WITH_WARNINGS",
  "exportable_employees": 400,
  "warnings": 2,
  "last_validated_at": "2026-07-01T11:45:00Z",
  "issues": [
    {
      "code": "MISSING_MANAGER",
      "count": 2
    }
  ]
}
```

### Status values

- `READY`
- `READY_WITH_WARNINGS`
- `NOT_READY`

### Recommended readiness rules

**READY**

- legal entities exist
- employees exist
- employments exist
- no blocking validation issues

**READY_WITH_WARNINGS**

- export works
- but warnings exist, such as: missing manager, missing job title, missing cost center

**NOT_READY**

- missing critical setup, such as: no legal entities, no employees, no employments
- blocking export validation errors

### Notes

This widget is strategically important and should be prioritized early.

---

## 11. Quick Actions

**Purpose:** Give users clear next actions.

### Endpoint

No API required for v1.

### Suggested frontend model

```javascript
const actions = [
  { label: 'Create Legal Entity', href: '/enterprise/legal-entities' },
  { label: 'Import Employees', href: '/enterprise/data-imports' },
  { label: 'Manage Org Structure', href: '/enterprise/org-structure' },
  { label: 'Open Payroll Checklist', href: '/payroll/checklist' },
  { label: 'Review Pending Approvals', href: '/enterprise/approvals/pending' },
  { label: 'Validate HR Export', href: '/enterprise/hr-export' },
];
```

### Future enhancement

Actions may later be filtered based on: setup state, permissions, role.

---

## 12. Recommended implementation order

### Phase 1

Implement with real data:

- `GET /v1/setup/status`
- `GET /v1/dashboard/workforce-summary`
- `GET /v1/dashboard/payroll-summary`

Use temporary placeholders if needed for:

- compliance summary
- pending approvals
- data imports summary
- HR export readiness

### Phase 2

Implement:

- `GET /v1/dashboard/pending-approvals`
- `GET /v1/dashboard/data-imports-summary`
- `GET /v1/dashboard/hr-export-readiness`

### Phase 3

Implement:

- `GET /v1/dashboard/compliance-summary`
- dynamic quick actions
- richer setup dependency logic

---

## 13. Suggested permissions

| Widget | Minimum visibility (any of) |
|--------|----------------------------|
| Setup Progress | `iam:legal_entities:manage`, `legal_entity:read`, `employee:read`, `hr:read` |
| Workforce Snapshot | `employee:read`, `employment:read` |
| Payroll Snapshot | `payrun:read` |
| Compliance Snapshot | `sars:irp5:read`, `sars:emp201:read`, `sars:emp501:read` |
| Pending Approvals | `iam:users:manage`, `payrun:approve`, workflow approval permissions |
| Data Imports | `data_import:read`, `data_import:write`, `data_import:approve`, `data_import:publish` |
| HR Export / IGA Readiness | `hr:read`, `iam:legal_entities:manage` |

---

## 14. Example dashboard page composition

```jsx
<SetupDashboard />

<div className="grid grid-cols-3 gap-6">
  <WorkforceStats />
  <PayrollSnapshot />
  <ComplianceSnapshot />
</div>

<div className="grid grid-cols-3 gap-6 mt-6">
  <PendingApprovalsWidget />
  <DataImportsWidget />
  <HrExportReadinessWidget />
</div>

<QuickActionsPanel className="mt-6" />
```

---

## 15. Scope awareness

All dashboard operational endpoints are scope-aware:

- **GLOBAL role** → `legalEntityAccess` contains all entities (from auth service) → platform-wide data.
- **LEGAL_ENTITY role** → `legalEntityAccess` contains assigned entities → restricted data.
- **Empty `legalEntityAccess`** (no assignments or bad data) → returns empty/zero data, **NOT** platform-wide. Safe default for misconfigured users.

---

## 16. Summary

This dashboard contract supports the current Hubsec Workforce Platform direction:

- workforce setup and onboarding
- payroll operations
- compliance awareness
- governance and approvals
- downstream HR export and IGA readiness

It is intentionally lightweight and operational rather than report-heavy.
