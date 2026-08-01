# PR-CMS-CONNECTOR-1F–1G — Connector telemetry & governance observability

## Objective

Make connector operations **measurable** and governance backlog **visible** without inventing optimistic health.

## Principles

- Telemetry is **derived from** `SupplierSourceSyncRun` ledger and staging tables — not inferred.
- Dashboard uses **effective** connector health (STALE/DISABLED rules from 1D–1E).
- **Connector healthy ≠ governance complete**
- **Oracle reachable ≠ supplier operationally trusted**

## API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/supplier-sources/oracle/telemetry` | Aggregated connector + governance + drift metrics |
| `GET` | `/supplier-sources/oracle/dashboard` | Unified ops dashboard (health, telemetry, anomalies, recent runs) |
| `GET` | `/supplier-sources/oracle/sync-runs` | Paginated sync-run history |
| `GET` | `/supplier-sources/oracle/anomalies` | Reconciliation / drift anomaly list |

## UI

- Route: `/supplier-sources/oracle/operations`
- Sidebar: **Oracle connector ops** (Operations group, `suppliers:read`)
- Visible for `ORACLE_ONLY` and `HYBRID` tenant authority modes

## Telemetry fields

### Connector (from sync runs)

`totalSyncRuns`, `successfulSyncRuns`, `failedSyncRuns`, `partialSyncRuns`, `lastSyncDurationMs`, `averageSyncDurationMs`, `recordsImported`, `recordsMatched`, `recordsNew`, `recordsFailed`, `stagingBacklogCount`

### Governance

`pendingEvidenceSuppliers`, `activeSuppliers`, `suspendedSuppliers`, `staleConnectorCount`, `promotionQueueAgeHours`, `unresolvedPossibleMatches`, `reconciliationFailures`

On the sync ops page, **Pending governance** links to `/suppliers/approvals`. Bucket semantics align with [`../SUPPLIER_GOVERNANCE_OPERATIONS.md`](../SUPPLIER_GOVERNANCE_OPERATIONS.md) (on `ORACLE_ONLY`, pending = awaiting operational trust, not missing CMS documents).

### Drift (pre–CONNECTOR-4)

`supplierSourceDriftCount`, `missingSourceRecords`, `duplicateExternalIds`, `promotionFailures`

## Tests

- `backend/src/domain/supplier-sources/__tests__/oracle-connector-telemetry.service.spec.ts`
- `backend/test/supplier-oracle-connector-telemetry.e2e-spec.ts`
- `npm run drift:integration`

## Next

**CONNECTOR-4** — Drift reconciliation engine (with telemetry as observability layer).
