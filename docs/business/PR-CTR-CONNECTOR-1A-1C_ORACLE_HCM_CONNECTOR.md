# PR-CTR-CONNECTOR-1A–1C — Oracle HCM operational connector (foundation)

## Objective

Bring contractor synchronization to the same operational maturity baseline as Oracle Procurement suppliers:

- REST client abstraction
- Sync-run ledger with org checkpoints
- Replay-safe org-scoped staging
- Identity correlation on import (not org reconciliation)

## Architecture

```text
Oracle HCM REST / file
    → HttpOracleHcmRestClient
    → ContractorSourceSyncRun (ledger)
    → HcmContractorStaging (org-unique sourcePersonId)
    → ContractorCorrelationService
    → (later) validate → promote → governance twin
```

## Schema

- `ContractorSourceSyncRun` — sync ledger (`correlationFailures` tracked)
- `Organization.oracleHcm*` — checkpoint + connector health
- `HcmContractorStaging` — optional `migrationBatchId`, `contractorSourceSyncRunId`, correlation fields

## Correlation confidence

| Signal | Result |
|--------|--------|
| Legacy HCM person id | `MATCHED` / `HIGH` |
| National ID | `MATCHED` / `HIGH` |
| Email only | `POSSIBLE_MATCH` / `LOW` |
| Multiple candidates | `CONFLICT` / `MANUAL_REVIEW` |
| No match | `NEW` |

## API (`/contractor-sources/oracle-hcm`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/health` | `contractor-migration:read` |
| POST | `/sync` | `contractor-migration:manage` |
| POST | `/import` | `contractor-migration:manage` |
| GET | `/sync-runs` | `contractor-migration:read` |

## Doctrine

- **Identity-governed** — correlation differs from supplier org reconciliation
- **Staging only** — connector does not promote or set contractors ACTIVE
- **Replay-safe** — upsert by `(organizationId, sourceSystem, sourcePersonId)`
- Failed sync does not advance `oracleHcmLastSuccessfulSyncAt`

## Follow-on

- **1D** — health + stale semantics (`PR-CTR-CONNECTOR-1D_ORACLE_HCM_CONNECTOR_HEALTH.md`)
- **1E** — telemetry + workforce ops dashboard UI
- Contractor drift engine
- Governance remediation workflows

## Tests

- `contractor-correlation.service.spec.ts`
- `contractor-oracle-hcm-connector.e2e-spec.ts`
