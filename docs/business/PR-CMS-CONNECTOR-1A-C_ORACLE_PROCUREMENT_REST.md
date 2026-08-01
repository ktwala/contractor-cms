# PR-CMS-CONNECTOR-1A-C — Oracle Procurement REST, sync ledger, replay-safe staging

**Status:** COMPLETE (slices 1A–1C)

## Doctrine

```txt
Oracle connector imports source truth into staging; CMS promotion governs operational trust.
```

## Scope (this PR)

| Slice | Deliverable |
| ----- | ----------- |
| 1A | `HttpOracleProcurementRestClient` + mapper → `NormalizedOracleSupplierRecord` |
| 1B | `SupplierSourceSyncRun` + org checkpoint fields |
| 1C | `SupplierStagingWriterService` idempotent upsert |

**Deferred:** dashboards, OpenBao, outage UI, admin replay UI, auto drift remediation (CONNECTOR-1D–1H).

## API

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/supplier-sources/oracle/import` | Mock/file payload → staging (+ `syncRunId`) |
| POST | `/supplier-sources/oracle/sync` | Incremental REST sync (when enabled) |

## Schema

- `SupplierSourceSyncRun` — ledger per import/sync batch
- `Organization.oracleSupplierLastSuccessfulSyncAt` / `oracleSupplierLastCursor` / connector health fields

## Env (REST sync)

```bash
ORACLE_PROCUREMENT_REST_ENABLED=true
ORACLE_PROCUREMENT_REST_BASE_URL=https://...
ORACLE_PROCUREMENT_REST_SUPPLIERS_PATH=/fscmRestApi/resources/11.13.18.05/suppliers
ORACLE_PROCUREMENT_REST_USERNAME=...
ORACLE_PROCUREMENT_REST_PASSWORD=...
```

## Tests

```bash
cd backend && npm run test:unit -- --testPathPatterns="oracle-procurement|supplier-staging-writer"
cd backend && npm run test:e2e -- --testPathPatterns=supplier-oracle-connector
npm run drift:integration
```

## Replay rule

```txt
Same organizationId + ORACLE_SUPPLIER_SAAS + externalSupplierId
→ staging upsert (no duplicate row)
→ promotion still required for governance twin
→ never ACTIVE from connector
```
