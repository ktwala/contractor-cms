# PR-CMS-CONNECTOR-1D–1E — Oracle connector health & stale sync

## Objective

Make the Oracle Procurement connector **operationally truthful** when upstream is unavailable, delayed, or stale — without implying Oracle is healthy from import/staging alone.

## Health states

| State | Meaning |
| ----- | ------- |
| `HEALTHY` | Last successful sync recorded |
| `DEGRADED` | Upstream 5xx / timeout / partial ingest |
| `STALE` | `last_successful_sync_at` older than threshold (evaluated without sync) |
| `AUTH_FAILED` | Upstream 401/403 |
| `RATE_LIMITED` | Upstream 429 |
| `DISABLED` | `ORACLE_PROCUREMENT_REST_ENABLED` is not `true` |
| `UNKNOWN` | No successful sync yet |

## Rules

- REST disabled → effective health `DISABLED` (mock import may still land in staging)
- 401/403 → `AUTH_FAILED`; 429 → `RATE_LIMITED`; 5xx/timeout → `DEGRADED`
- Failed sync **does not** advance `oracleSupplierLastSuccessfulSyncAt` / cursor
- Failure updates `oracleSupplierConnectorHealth` + `oracleSupplierConnectorLastError`
- Stale detection runs on `GET /supplier-sources/oracle/health` and governance dashboard

## API

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/supplier-sources/oracle/health` | Read-only; no sync |
| `POST` | `/supplier-sources/oracle/sync` | Incremental REST; returns `connectorHealth` |
| `POST` | `/supplier-sources/oracle/import` | Mock/replay staging only |

## Config

| Env | Default | Purpose |
| --- | ------- | ------- |
| `ORACLE_PROCUREMENT_REST_ENABLED` | `false` | REST gate |
| `ORACLE_PROCUREMENT_STALE_THRESHOLD_HOURS` | `24` | Stale window |

## Tests

- `backend/src/integration/oracle-procurement/__tests__/oracle-procurement-health.util.spec.ts`
- `backend/src/integration/oracle-procurement/__tests__/oracle-procurement-health.service.spec.ts`
- `backend/test/supplier-oracle-connector-health.e2e-spec.ts`
- `npm run drift:integration`

## Deferred

**CONNECTOR-1H** — OpenBao secret wiring (after health semantics locked).
