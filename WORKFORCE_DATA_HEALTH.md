# Workforce Data Health Architecture

This document describes the closed-loop data quality system built into Hubsec Workforce. It covers the issue model, remediation routing, readiness scoring, and the detect-inspect-fix-refresh-verify workflow.

---

## 1. Architecture overview

The system consists of five layers that work together:

```
Detection → Intelligence → Investigation → Remediation → Verification
```

| Layer | Purpose | Key components |
|-------|---------|----------------|
| **Detection** | Identify workforce data quality issues | `WorkforceIssuesService`, issue detectors |
| **Intelligence** | Score readiness and aggregate statistics | `WorkforceReadinessService`, `WorkforceStatsService`, snapshot tables |
| **Investigation** | Allow users to drill into and understand issues | `IssueDrilldownDrawer`, grouped/flat issue views |
| **Remediation** | Route users to the correct workflow to fix issues | `remediation-routes.ts`, `recommendedAction` metadata |
| **Verification** | Confirm improvements after fixes | `ReadinessDeltaToast`, `RefreshStatusChip`, scoped refresh |

---

## 2. Issue model

### Source of truth

All data quality metrics derive from the `WorkforceIssue` table. This is the single source of truth for:

- Issue counts (total, by type, by severity)
- Grouped issue counts (by legal entity, org unit, etc.)
- Export blocker counts (`blocksExport = true`)
- Readiness blocker input
- Data quality stats on Overview (employeesWithoutManager, etc.)

### Issue types (v1)

| Type | Entity | Severity | Blocks export | Detector |
|------|--------|----------|---------------|----------|
| `MISSING_MANAGER` | EMPLOYEE | WARNING | Yes | `detectEmployeeIssues()` |
| `MISSING_ORG_ASSIGNMENT` | EMPLOYEE | WARNING | Yes | `detectEmployeeIssues()` |
| `MISSING_COST_CENTER` | EMPLOYEE | INFO | No | `detectEmployeeIssues()` |
| `EMPLOYEE_WITHOUT_EMPLOYMENT` | EMPLOYEE | ERROR | Yes | `detectEmployeeIssues()` |
| `ORG_UNIT_WITHOUT_MANAGER` | ORG_UNIT | WARNING | No | `detectOrgUnitIssues()` |
| `ORG_UNIT_WITHOUT_EMPLOYEES` | ORG_UNIT | INFO | No | `detectOrgUnitIssues()` |
| `COST_CENTER_UNUSED` | COST_CENTER | INFO | No | `detectCostCenterIssues()` |
| `EMPLOYEE_EXPORT_BLOCKED` | HR_EXPORT | ERROR | Yes | `detectExportIssues()` |

### Issue lifecycle

```
DETECTED (resolvedAt = null)
  ↓  user resolves or auto-resolved by re-detection
RESOLVED (resolvedAt = timestamp)
```

Issues are upserted on each detection run using the composite key `(tenantId, entityType, entityId, issueType)`. Stale issues (no longer detected) are auto-resolved.

---

## 3. Remediation routing

### Canonical routing map

Defined in `admin-portal/src/features/workforce-stats/remediation-routes.ts` (frontend) and `WorkforceIssuesService.REMEDIATION_MAP` (backend).

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

Every issue returned from `GET /v1/workforce-issues` includes a `recommendedAction` object:

```json
{
  "recommendedAction": {
    "label": "Assign org unit",
    "target": "employment_assignments",
    "params": {
      "employeeId": "emp_2044",
      "issueType": "MISSING_ORG_ASSIGNMENT"
    }
  }
}
```

This prevents UI-level routing logic duplication and ensures consistency.

---

## 4. Readiness scoring

### Dimensions

| Dimension | Weight | Source |
|-----------|--------|--------|
| Manager assignment | 30% | Employee.managerId |
| Employment linkage | 25% | Employee.employments |
| Org assignment | 20% | EmploymentAssignment (active) |
| Cost center mapping | 15% | EmploymentAssignment.costCenterId |
| Identity completeness | 10% | Employee.email, nationalId |

### Scoring formula

```
readinessPercent = Σ (dimensionPercent × dimensionWeight)
```

### Readiness statuses

| Status | Threshold |
|--------|-----------|
| `READY` | >= 90% |
| `WARNING` | >= 70% |
| `BLOCKED` | >= 40% |
| `INCOMPLETE` | < 40% |

### Snapshot tables

Readiness and stats are persisted in snapshot tables for fast rendering:

- `OverviewStatsSnapshot`
- `LegalEntityStatsSnapshot`
- `OrgUnitStatsSnapshot`
- `CostCenterStatsSnapshot`
- `ReadinessSnapshot`

Refreshed by `WorkforceStatsService` on demand and via hourly `@Interval`.

---

## 5. Closed-loop workflow

### User journey

```
1. DETECT — Stats pages surface issue counts and readiness scores
2. INSPECT — Click issue count → IssueDrilldownDrawer opens
3. FIX    — Click recommended action → Navigate to destination page → Edit record
4. REFRESH — Save triggers scoped stats refresh
5. VERIFY  — ReadinessDeltaToast shows improvement (e.g., "issues 22 → 17")
```

### Active remediation loops

| Loop | Entry pages | Fix destination |
|------|-------------|-----------------|
| Missing manager | Overview, Org Structure, Manager Hierarchy | Manager Hierarchy |
| Export blockers | HR Export | Various source workflows |
| Missing org assignment | Overview, HR Export | Employment Assignments |
| Missing cost center | Overview, Cost Centers | Employment Assignments |
| Missing legal entity | HR Export, Overview | Employments |

---

## 6. API surface

### Issues API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/workforce-issues` | GET | List issues with filters (entityType, issueType, severity, legalEntityId, etc.) |
| `/v1/workforce-issues/counts` | GET | Aggregated counts by type, severity, and export blockers |
| `/v1/workforce-issues/grouped` | GET | Issues grouped by legalEntity, orgUnit, severity, entityType, or issueType |
| `/v1/workforce-issues/detect` | POST | Trigger full issue detection scan |
| `/v1/workforce-issues/:id/resolve` | POST | Manually resolve an issue |

### Stats API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/workforce-stats/overview` | GET | Overview dashboard statistics |
| `/v1/workforce-stats/legal-entities` | GET | Per-legal-entity statistics |
| `/v1/workforce-stats/org-units/tree` | GET | Per-org-unit statistics tree |
| `/v1/workforce-stats/cost-centers` | GET | Per-cost-center statistics |
| `/v1/workforce-stats/manager-hierarchy` | GET | Manager coverage statistics |
| `/v1/workforce-stats/hr-export` | GET | Export readiness statistics |
| `/v1/workforce-stats/refresh` | POST | Trigger full stats refresh |

---

## 7. Frontend components

### Shared UI primitives

| Component | Purpose |
|-----------|---------|
| `StatCard` | Single statistic with label, value, optional click handler |
| `StatStrip` | Grid layout for StatCard groups |
| `ReadinessBadge` | Status pill (Ready/Warning/Blocked/Incomplete) |
| `ReadinessBar` | Visual progress bar for readiness |
| `IssueBadge` | Count badge with severity coloring |
| `RestrictedValue` | Indicates permission-restricted data |

### Investigation components

| Component | Purpose |
|-----------|---------|
| `IssueDrilldownDrawer` | Slide-over panel with flat/grouped issue views and remediation actions |
| `ReadinessDeltaToast` | Fixed toast showing before/after improvement |
| `RefreshStatusChip` | Inline refresh status with timestamp |

### Hooks

| Hook | Purpose |
|------|---------|
| `useIssueDrilldown` | Manages drawer open/close state and filter context |
| `useReadinessDelta` | Captures snapshot, compares after refresh, surfaces deltas |
| `useOverviewStats` | Fetches overview statistics |
| `useLegalEntityStats` | Fetches legal entity statistics |
| `useOrgUnitStatsTree` | Fetches org unit statistics |
| `useCostCenterStats` | Fetches cost center statistics |
| `useManagerHierarchyStats` | Fetches manager hierarchy statistics |
| `useHrExportStats` | Fetches HR export statistics |
| `useWorkforceIssues` | Fetches workforce issues with filters |

---

## 8. Source of truth principles

### Rule: All data quality metrics derive from WorkforceIssue

- Issue counts → `WorkforceIssue` table queries
- Export blocker counts → `blocksExport = true` on `WorkforceIssue`
- Data quality stats (missing manager count, missing assignment count, etc.) → derived from `issueCounts.by_type`
- Grouped issues → `WorkforceIssue.groupBy()` queries
- Readiness scoring uses `WorkforceIssue.blocksExport` for the blocker dimension

### Why this matters

If detection logic changes (e.g., a new rule for what counts as "missing org assignment"), it changes in the detector once, and all downstream consumers (counts, readiness, export stats, UI) automatically reflect it.

### Things to watch for

1. Never add a separate raw-table query that replicates detector logic
2. If readiness dimensions need new inputs, add them to the detector first
3. Export blocker status is determined by `blocksExport` on the issue, not by entity type

---

## 9. File layout

### Backend

```
src/modules/
  workforce-issues/
    workforce-issues.service.ts    — Detection engine, remediation map, query APIs
    workforce-issues.controller.ts — REST endpoints
    workforce-issues.module.ts
  workforce-readiness/
    workforce-readiness.service.ts — Readiness scoring, snapshot refresh
    workforce-readiness.module.ts
  workforce-stats/
    workforce-stats.service.ts     — Stats aggregation, refresh orchestration
    workforce-stats.controller.ts  — Stats REST endpoints
    workforce-stats.module.ts
```

### Frontend

```
admin-portal/src/features/workforce-stats/
  api.ts                           — API client functions
  remediation-routes.ts            — Canonical routing map + helpers
  components/
    StatCard.tsx                   — Stat display card
    ReadinessBadge.tsx             — Status badge + progress bar
    IssueBadge.tsx                 — Issue count badge
    RestrictedValue.tsx            — Permission-restricted indicator
    IssueDrilldownDrawer.tsx       — Investigation slide-over panel
    ReadinessDeltaToast.tsx        — Improvement feedback toast + refresh chip
  hooks/
    useOverviewStats.ts
    useLegalEntityStats.ts
    useOrgUnitStatsTree.ts
    useCostCenterStats.ts
    useManagerHierarchyStats.ts
    useHrExportStats.ts
    useWorkforceIssues.ts
    useIssueDrilldown.ts           — Drawer state management
    useReadinessDelta.ts           — Before/after comparison
```

---

## 10. Related documentation

| Document | Content |
|----------|---------|
| [WORKFORCE_REMEDIATION.md](./WORKFORCE_REMEDIATION.md) | Remediation routing, queue, operator workflows, refresh expectations |
| [WORKFORCE_BULK_REMEDIATION.md](./WORKFORCE_BULK_REMEDIATION.md) | Bulk preview/apply operations, safety rules, API contracts, history |
| [WORKFORCE_ONBOARDING_INTELLIGENCE.md](./WORKFORCE_ONBOARDING_INTELLIGENCE.md) | Import analysis, dataset health, fix-now shortcuts, onboarding flow |

## 11. Current system capabilities

### Data Health Engine
- Issue detection with 9 detector rules
- Readiness scoring with 5 weighted dimensions
- Snapshot-backed statistics per legal entity, org unit, cost center

### Remediation Engine
- Record-by-record remediation with canonical routing
- Investigation drawer with grouped and flat views
- Dismiss, reopen, and re-check workflows

### Bulk Remediation Engine
- Preview-before-apply for 5 bulk operation types
- Safety rules (batch size limits, permission checks, audit logging)
- Bulk remediation history and audit trail

### Onboarding Intelligence
- Post-import issue detection trigger
- Import analysis endpoint with readiness estimate
- Dataset health indicators (complete/partial/incomplete/missing)
- Fix-now navigation from import results to remediation

### Remediation Operations Console
- Remediation Queue with sorting, filtering, aging, and assignment
- Legal Entity Readiness Progress tracking
- Bulk Remediation History audit surface
- Resolved-today and resolved-this-week tracking
