# Workforce Bulk Remediation

This document describes the bulk remediation system — preview-before-apply batch operations for fixing groups of workforce data quality issues at once.

---

## 1. Overview

Bulk remediation extends the single-record remediation loop from:

```
detect → inspect → fix → refresh → verify
```

to:

```
detect → group → preview → apply to many → refresh → verify improvement
```

---

## 2. Supported bulk operations (v1)

| Bulk action | Issue type fixed | Required fix field |
|-------------|-----------------|-------------------|
| Bulk assign manager | `MISSING_MANAGER` | `managerEmployeeId` |
| Bulk assign org unit | `MISSING_ORG_ASSIGNMENT` | `orgUnitId` |
| Bulk assign cost center | `MISSING_COST_CENTER` | `costCenterId` |
| Bulk create assignments | `EMPLOYEE_WITHOUT_ASSIGNMENT` | `orgUnitId` (+ optional `costCenterId`) |
| Bulk create employments | `EMPLOYEE_WITHOUT_EMPLOYMENT` | `legalEntityId` + `payGroupId` (+ optional `country`) |

---

## 3. API contracts

### Preview

```
POST /v1/workforce-remediation/preview
```

Request:

```json
{
  "issueType": "MISSING_MANAGER",
  "filters": {
    "legalEntityId": "le_pb_ls",
    "orgUnitId": "ou_branch_ops"
  },
  "proposedFix": {
    "managerEmployeeId": "emp_0021"
  }
}
```

Response:

```json
{
  "recordsAffected": 12,
  "employees": [
    { "employeeId": "emp_104", "employeeName": "Lineo Thabane", "employeeNo": "E1004", "orgUnitName": "Branch Operations" }
  ],
  "changesPreview": {
    "field": "managerId",
    "label": "Manager",
    "oldValue": null,
    "newValue": "emp_0021",
    "newValueLabel": "Thabo Mokoena"
  },
  "expectedImpact": {
    "issuesResolved": 12,
    "exportBlockersReduced": 12,
    "readinessDeltaEstimate": "+3-5%"
  }
}
```

### Apply

```
POST /v1/workforce-remediation/apply
```

Request:

```json
{
  "issueType": "MISSING_MANAGER",
  "filters": {
    "orgUnitId": "ou_branch_ops"
  },
  "fix": {
    "managerEmployeeId": "emp_0021"
  }
}
```

Response:

```json
{
  "success": true,
  "recordsUpdated": 12,
  "affectedScopes": {
    "legalEntityIds": ["le_pb_ls"],
    "orgUnitIds": ["ou_branch_ops"]
  },
  "auditLogId": "bulk_1710324567890"
}
```

---

## 4. Safety rules

### Rule 1 — Preview required

All bulk operations should preview first. The frontend enforces this by showing the `BulkRemediationPreviewModal` before calling `/apply`.

### Rule 2 — Max batch size

Maximum 200 records per batch. If the affected set exceeds this, the API returns `400 Bad Request` with guidance to apply narrower filters.

### Rule 3 — Permission check

Bulk remediation requires the same write permissions as single-record operations:

- `employee:write` for manager assignment
- `employment_assignment:write` for org/cost center assignments
- `employment:write` for employment creation

### Rule 4 — Audit log required

Every bulk apply is logged to `AuditLog` with:

| Field | Value |
|-------|-------|
| `action` | `BULK_REMEDIATION` |
| `entityType` | `WorkforceRemediation` |
| `entityId` | `bulk_{timestamp}` |
| `newValue` | `{ actionType, recordsAffected, fixApplied, scopes }` |
| `userId` | Authenticated user |

---

## 5. Idempotency

Bulk apply is **not** fully idempotent. Re-running the same apply request may:

- Create duplicate employment assignments (for `BULK_CREATE_ASSIGNMENTS`)
- Create duplicate employments (for `BULK_CREATE_EMPLOYMENTS`)

To mitigate this, the preview step always re-computes affected records from the current issue state. If issues have already been resolved (by a prior apply), the preview will return `recordsAffected: 0`.

---

## 6. Refresh expectations

After a successful bulk apply:

1. Frontend calls `POST /v1/workforce-stats/refresh` to trigger a full stats refresh
2. Issue detection re-runs, auto-resolving fixed issues
3. Readiness snapshots update
4. `BulkRemediationSuccessBanner` shows the outcome

The `affectedScopes` in the apply response indicates which legal entities and org units were touched, enabling future scoped refresh optimization.

---

## 7. Bulk Remediation History

All bulk remediation actions are visible through:

```
GET /v1/workforce-remediation/history
```

This queries the `AuditLog` table for `action = 'BULK_REMEDIATION'`, returning:

| Field | Description |
|-------|-------------|
| `id` | Audit log entry ID |
| `userId` | Who applied the action |
| `actionType` | `BULK_ASSIGN_MANAGER`, `BULK_ASSIGN_ORG_UNIT`, etc. |
| `recordsAffected` | How many records were changed |
| `fixApplied` | The specific fix values |
| `scopes` | Affected legal entities and org units |
| `createdAt` | When the action was applied |

---

## 8. Frontend components

| Component | Purpose |
|-----------|---------|
| `BulkRemediationPreviewModal` | Shows affected employees, change summary, impact estimate, confirmation |
| `BulkRemediationSuccessBanner` | Post-apply feedback with record counts |
| `IssueDrilldownDrawer` (extended) | "Bulk fix" buttons on grouped views, inline fix input |
| `BulkRemediationHistory` page | Full audit trail of past bulk actions |

---

## 9. File layout

```
src/modules/workforce-remediation/
  workforce-remediation.service.ts     — Preview, apply, history, import analysis
  workforce-remediation.controller.ts  — REST endpoints
  workforce-remediation.module.ts
  bulk-remediation.types.ts            — Type definitions
  bulk-remediation.policy.ts           — Safety rules

admin-portal/src/features/workforce-stats/components/
  BulkRemediationPreviewModal.tsx
  BulkRemediationSuccessBanner.tsx

admin-portal/src/pages/
  BulkRemediationHistory.tsx
```
