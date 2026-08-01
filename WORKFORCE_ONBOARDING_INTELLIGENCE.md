# Workforce Onboarding Intelligence

This document describes the onboarding intelligence layer — the integration of the issue detection and remediation systems with the data import pipeline to accelerate customer onboarding.

---

## 1. Overview

Onboarding intelligence extends the data health system into the import workflow:

```
Import publish → Issue detection → Onboarding analysis → Fix-now shortcuts → Remediation → Readiness improvement
```

After an import completes, the platform immediately analyzes the imported data for quality issues and presents actionable remediation paths, eliminating the gap between "data is loaded" and "data is correct."

---

## 2. Import analysis endpoint

```
GET /v1/workforce-remediation/import-analysis/:jobId
```

Response:

```json
{
  "jobId": "job_abc123",
  "datasetType": "EMPLOYEES",
  "status": "PUBLISHED",
  "recordsPublished": 400,
  "totalIssues": 47,
  "issuesDetected": {
    "missingManager": 22,
    "missingOrgAssignment": 14,
    "missingCostCenter": 9,
    "missingLegalEntity": 2,
    "employeeWithoutEmployment": 0,
    "employeeWithoutAssignment": 0
  },
  "readinessEstimate": "78%",
  "recommendedActions": [
    { "issueType": "MISSING_MANAGER", "label": "Assign managers", "count": 22 },
    { "issueType": "MISSING_ORG_ASSIGNMENT", "label": "Create org assignments", "count": 14 }
  ]
}
```

### Analysis logic

1. Fetch the import job record to determine dataset type and published row count
2. Query the current open issue state (from `WorkforceIssue`, not from the import rows)
3. Compute readiness estimate from active employee count and blocker count
4. Build recommended actions from non-zero issue types, ordered by count

### Design decision: global issue state, not import-scoped

The analysis endpoint returns the **global** issue state at the time of query, not issues scoped to the specific import job. This is intentional:

- Import may introduce issues that cross-reference existing data (e.g., imported employees lack managers that should have been in a previous import)
- The operator needs the full picture, not just import-specific problems
- This aligns with the source-of-truth principle: all issues come from `WorkforceIssue`

---

## 3. Dataset health indicators

The `ImportRemediationPanel` displays dataset health as colored pills:

| Status | Color | Meaning |
|--------|-------|---------|
| `COMPLETE` | Green | No issues detected for this dataset |
| `PARTIAL` | Yellow | Some issues detected |
| `INCOMPLETE` | Orange | Significant gaps |
| `MISSING` | Red | Critical data missing |

### Dataset health mapping

| Dataset | "Not complete" condition |
|---------|------------------------|
| Employees | `missingManager > 0` |
| Employments | `employeeWithoutEmployment > 0` |
| Assignments | `missingOrgAssignment > 0` OR `employeeWithoutAssignment > 0` |
| Managers | `missingManager > 0` |
| Cost Centers | `missingCostCenter > 0` |

---

## 4. Post-import trigger flow

### Bootstrap Organisation

After a bootstrap import completes:

1. Import pipeline processes all datasets
2. Completion page shows `ImportRemediationPanel` with analysis
3. Each issue type has a "Fix now" button
4. "Fix now" navigates to `/workforce/overview?drilldown={issueType}` opening the issue drilldown

### Data Import Detail

After any individual import job is published:

1. Job detail page shows `ImportRemediationPanel`
2. Same "Fix now" flow as above

### Auto-trigger sequence

```
Import publish
  → detectAllIssues() runs
  → OrgUnitManagerInference generates suggestions
  → Stats refresh updates readiness snapshots
  → Frontend shows analysis panel with current state
```

---

## 5. Fix-now navigation

"Fix now" buttons connect directly to the existing remediation system:

1. Click "Fix now" on a specific issue type
2. Navigate to `/workforce/overview?drilldown={issueType}`
3. `IssueDrilldownDrawer` opens showing the grouped issue view
4. Operator can fix individually or use bulk remediation
5. Stats refresh confirms improvement

This reuses the existing investigation and remediation components, adding no new one-off flows.

---

## 6. Readiness estimate calculation

```
readinessEstimate = ((activeEmployees - exportBlockers) / activeEmployees) × 100
```

This is a quick-compute estimate shown immediately in the import panel. The full readiness scoring (with weighted dimensions) is computed during the background stats refresh and shown on the Overview and Legal Entity pages.

---

## 7. Integration points

| Component | Location | What it does |
|-----------|----------|-------------|
| `ImportRemediationPanel` | Bootstrap Organisation (completion step) | Shows analysis + fix-now after bootstrap |
| `ImportRemediationPanel` | Data Import Detail (published jobs) | Shows analysis + fix-now after any import |
| `IssueDrilldownDrawer` | All stats pages | Investigation + bulk fix entry point |
| `WorkforceRemediationService.getImportAnalysis()` | Backend | Computes the analysis response |

---

## 8. File layout

```
src/modules/workforce-remediation/
  workforce-remediation.service.ts    — getImportAnalysis() method

admin-portal/src/features/workforce-stats/components/
  ImportRemediationPanel.tsx          — Analysis panel + dataset health + fix-now
  
admin-portal/src/pages/
  BootstrapOrganisation.tsx           — Integrates ImportRemediationPanel
  DataImportDetail.tsx                — Integrates ImportRemediationPanel
```

---

## 9. Future evolution

### Import-scoped issue tracking

Future versions could tag issues with their originating import job ID, enabling:

- "Issues introduced by this import" view
- Import quality scoring per job
- Regression detection across imports

### Dataset completeness scoring

Move from binary (has issues / no issues) to percentage-based completeness:

- Employees: 95% complete (22 of 400 missing managers)
- Assignments: 88% (14 of 120 missing org unit)

### Onboarding workflow templates

Pre-defined remediation sequences for common onboarding patterns:

1. Fix employments first (highest severity)
2. Then assignments (enables org mapping)
3. Then managers (enables hierarchy)
4. Then cost centers (enables financial mapping)
