# PR-CMS-CONNECTOR-4 — Drift reconciliation engine

## Objective

Formalize **source drift governance**: detect, classify, assign, and resolve — without auto-remediation.

## Drift taxonomy

| Type | Meaning |
| ---- | ------- |
| `SUPPLIER_SOURCE_DRIFT` | Oracle-linked supplier not in `SYNCED` state |
| `SOURCE_RECORD_MISSING` | Governance twin without staging source row |
| `DUPLICATE_EXTERNAL_ID` | Multiple suppliers share Oracle external ID |
| `GOVERNANCE_STATE_CONFLICT` | e.g. `ACTIVE` locally but not `SYNCED` upstream |
| `RECONCILIATION_CONFLICT` | Staging `CONFLICT` or `POSSIBLE_MATCH` |
| `CHECKPOINT_GAP` | Failed sync with checkpoint continuity risk |

## Lifecycle

`DETECTED` → `CLASSIFIED` → `UNDER_REVIEW` → `RESOLVED` → `ARCHIVED`

New records are created as `CLASSIFIED` (severity assigned at detection).

## Severity

`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

Example: `ACTIVE` + not `SYNCED` → `GOVERNANCE_STATE_CONFLICT` / `CRITICAL`.

## Schema

`SupplierSourceDrift` — fingerprinted per org (`organizationId` + `driftFingerprint` unique).

## Detection triggers

- After each successful/partial Oracle sync run
- `POST /supplier-sources/oracle/drift/detect` (manual / periodic)

## APIs

| Method | Path |
| ------ | ---- |
| `GET` | `/supplier-sources/oracle/drift` |
| `GET` | `/supplier-sources/oracle/drift/summary` |
| `GET` | `/supplier-sources/oracle/drift/:id` |
| `POST` | `/supplier-sources/oracle/drift/detect` |
| `POST` | `/supplier-sources/oracle/drift/:id/assign` |
| `POST` | `/supplier-sources/oracle/drift/:id/resolve` |

## Doctrine

- **Drift ≠ immediate mutation**
- Detection and workflow only in this PR (no auto-suspend, no auto-ACTIVE)
- Dashboard shows drift summary + registry on `/supplier-sources/oracle/operations`

## Tests

- `supplier-source-drift-detection.service.spec.ts`
- `supplier-oracle-connector-drift.e2e-spec.ts`

## Deferred (CONNECTOR-4D–4E)

- Escalation automation
- Automated remediation
- OpenBao / AI reconciliation
