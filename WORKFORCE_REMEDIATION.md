# Workforce Remediation Architecture

This document describes the record-by-record and bulk remediation systems in Hubsec Workforce, covering the closed-loop fix workflow, operator tooling, and operational queue.

---

## 1. Remediation philosophy

Remediation follows a strict loop:

```
detect → inspect → fix → refresh → verify
```

The platform never silently corrects data. Every fix is either:

- **User-initiated** — operator navigates to the record and edits it
- **Bulk-applied** — operator previews affected records, confirms, and applies
- **Inference-accepted** — operator reviews a suggestion and explicitly accepts it

All remediation actions are audit-logged.

---

## 2. Remediation routing

### Canonical routing map

Defined in `admin-portal/src/features/workforce-stats/remediation-routes.ts`.

| Issue type | Action label | Destination page |
|------------|-------------|------------------|
| `MISSING_MANAGER` | Assign manager | Manager Hierarchy |
| `MISSING_ORG_ASSIGNMENT` | Assign org unit | Employment Assignments |
| `MISSING_COST_CENTER` | Set cost center | Employment Assignments |
| `MISSING_LEGAL_ENTITY` | Fix employment | Employments |
| `EMPLOYEE_WITHOUT_EMPLOYMENT` | Create employment | Employments |
| `EMPLOYEE_WITHOUT_ASSIGNMENT` | Create assignment | Employment Assignments |
| `EMPLOYEE_EXPORT_BLOCKED` | View export blockers | HR Export |
| `ORG_UNIT_WITHOUT_MANAGER` | Assign manager | Org Structure |
| `COST_CENTER_UNUSED` | Review cost center | Cost Centers |

### Backend enrichment

Every issue from `GET /v1/workforce-issues` includes `recommendedAction`:

```json
{
  "recommendedAction": {
    "label": "Assign org unit",
    "target": "employment_assignments",
    "params": { "employeeId": "emp_2044", "issueType": "MISSING_ORG_ASSIGNMENT" }
  }
}
```

This prevents routing logic duplication and keeps all navigation decisions centralized.

---

## 3. Remediation Queue

### Purpose

The Remediation Queue is the daily operating console for data quality operators. It aggregates all open issues into a single prioritized view with sorting, filtering, assignment, and aging.

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/workforce-issues` | GET | List issues with filters |
| `/v1/workforce-issues/counts` | GET | Aggregated counts by type, severity, blockers |
| `/v1/workforce-issues/grouped` | GET | Issues grouped by entity or type |
| `/v1/workforce-issues/detect` | POST | Trigger full detection scan |
| `/v1/workforce-issues/:id/resolve` | POST | Dismiss an issue |
| `/v1/workforce-issues/:id/reopen` | POST | Reopen a dismissed issue |

### Queue features

| Feature | Description |
|---------|-------------|
| Sort by blocker impact | Export-blocking issues surface first |
| Filter by type/entity/age | Narrow to specific issue categories |
| Issue aging | Days since detection, highlights stale unresolved issues |
| Resolved tracking | "Resolved today" and "Resolved this week" counters |
| Group actions | Navigate to bulk remediation from grouped view |

### Operator workflow

```
1. Open Remediation Queue
2. Sort by "Blocks export" → highest impact first
3. Filter to specific legal entity or org unit
4. Drill into group → view affected employees
5. Fix individually or apply bulk remediation
6. Stats refresh confirms improvement
```

---

## 4. Issue lifecycle

### States

```
DETECTED (resolvedAt = null)
  ↓ user fixes underlying data → re-detection auto-resolves
  ↓ user manually dismisses → resolvedByUserId set
RESOLVED (resolvedAt = timestamp)
  ↓ user reopens → resolvedAt cleared
DETECTED (active again)
```

### Dismiss vs. auto-resolve

- **Auto-resolve**: issue is no longer detected because underlying data was fixed
- **Manual dismiss**: operator explicitly suppresses an issue; it will not re-appear on the next detection run unless reopened
- **Reopen**: clears the dismissed state, making it eligible for detection again

### Idempotency

Issue detection is idempotent. Running `POST /v1/workforce-issues/detect` multiple times produces the same result set. Issues are upserted by `(tenantId, entityType, entityId, issueType)`.

---

## 5. Refresh expectations

After any remediation action (single or bulk):

1. The fix is saved to the database
2. A scoped stats refresh is triggered (`POST /v1/workforce-stats/refresh`)
3. Issue detection re-runs and auto-resolves fixed issues
4. Readiness snapshots update
5. Frontend receives updated counts and readiness scores

### Refresh scope

| Action | Refresh scope |
|--------|--------------|
| Single record fix | Legal entity + overview |
| Bulk fix | All affected legal entities + overview |
| Import publish | Full refresh |

---

## 6. File layout

### Backend

```
src/modules/
  workforce-issues/
    workforce-issues.service.ts     — Detection, query, resolve, reopen
    workforce-issues.controller.ts  — REST endpoints
  workforce-remediation/
    workforce-remediation.service.ts — Bulk preview/apply, import analysis
    workforce-remediation.controller.ts — Bulk remediation + history endpoints
    bulk-remediation.types.ts       — Type definitions
    bulk-remediation.policy.ts      — Safety rules (batch size, field validation)
```

### Frontend

```
admin-portal/src/
  features/workforce-stats/
    components/
      IssueDrilldownDrawer.tsx      — Investigation + bulk fix entry point
      BulkRemediationPreviewModal.tsx — Preview before apply
      BulkRemediationSuccessBanner.tsx — Post-apply feedback
      ImportRemediationPanel.tsx     — Post-import analysis
    remediation-routes.ts           — Canonical routing map
  pages/
    RemediationQueue.tsx            — Daily operating console
    BulkRemediationHistory.tsx      — Audit trail of bulk actions
```
