# PR-CTR-CONNECTOR-1D — Oracle HCM connector health & stale sync

## Objective

Make the Oracle HCM REST connector **operationally truthful** before workforce ops dashboards (1E). File replay success must **not** imply live HCM REST is healthy.

## Health states

| State | Meaning |
| ----- | ------- |
| `HEALTHY` | Last successful **REST** incremental sync |
| `DEGRADED` | Upstream 5xx / timeout / partial REST ingest |
| `STALE` | `oracleHcmLastSuccessfulSyncAt` older than threshold (read-only on `GET /health`) |
| `AUTH_FAILED` | Upstream 401/403 |
| `RATE_LIMITED` | Upstream 429 |
| `DISABLED` | `HCM_ORACLE_REST_ENABLED` is not `true` |
| `UNKNOWN` | REST enabled, no successful REST sync yet |

## Rules

- REST disabled → effective health `DISABLED`
- 401/403 → `AUTH_FAILED`; 429 → `RATE_LIMITED`; 5xx/timeout → `DEGRADED`
- Failed **REST** sync does not advance `oracleHcmLastSuccessfulSyncAt` / cursor
- Failure updates `oracleHcmConnectorHealth` + `oracleHcmConnectorLastError`
- Stale computed on `GET /contractor-sources/oracle-hcm/health` without running sync
- **File import (`REPLAY`) does not update REST connector health or REST checkpoint**
- Connector paths do not promote or activate contractors (staging only)

## Doctrine

```text
File replay success ≠ Oracle HCM REST health
```

## API

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/contractor-sources/oracle-hcm/health` | Read-only effective health |
| `POST` | `/contractor-sources/oracle-hcm/sync` | REST incremental; updates connector state |
| `POST` | `/contractor-sources/oracle-hcm/import` | Staging replay only; returns effective health |

## Config

| Env | Default | Purpose |
| --- | ------- | ------- |
| `HCM_ORACLE_REST_ENABLED` | `false` | REST gate |
| `HCM_ORACLE_STALE_THRESHOLD_HOURS` | `24` | Stale window |

## Tests

- `backend/src/integration/oracle-hcm/__tests__/oracle-hcm-health.util.spec.ts`
- `backend/src/integration/oracle-hcm/__tests__/oracle-hcm-health.service.spec.ts`
- `backend/test/contractor-oracle-hcm-connector-health.e2e-spec.ts`

## Next

- **1E** — telemetry + `/contractor-sources/oracle-hcm/operations`
- **1F** — contractor drift engine
- **1G** — remediation / PDP cascade
