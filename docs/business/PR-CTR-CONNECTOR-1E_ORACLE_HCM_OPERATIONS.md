# PR-CTR-CONNECTOR-1E — Workforce telemetry + operations surface

## Objective

Introduce **Workforce Governance Operations** — identity-governed observability separate from supplier connector ops.

## Doctrine

- Successful import ≠ governance completion
- Successful file replay ≠ healthy REST connector
- Correlation confidence must be operationally visible

## API

| Method | Path | Permission |
| ------ | ---- | ---------- |
| `GET` | `/contractor-sources/oracle-hcm/telemetry` | `contractor-migration:read` |
| `GET` | `/contractor-sources/oracle-hcm/dashboard` | `contractor-migration:read` |
| `GET` | `/contractor-sources/oracle-hcm/sync-runs` | `contractor-migration:read` |

## Telemetry categories

- **Connector** — sync-run ledger aggregates, staging backlog
- **Correlation** — HIGH/LOW/MANUAL_REVIEW/CONFLICT/UNLINKED from `HcmContractorStaging`
- **Governance** — pending verification, active/blocked HCM-linked contractors, terminated-upstream-but-active, missing supplier links
- **Operational risk** — stale connector, failed runs, checkpoint gaps, identity conflicts

## UI

`/contractor-sources/oracle-hcm/operations` — visible for `HCM_ONLY` and `HYBRID` tenants with `contractor-migration:read`.

Panels: connector health, workforce sync, correlation governance, governance lifecycle, operational risk, recent sync runs.

## Tests

- `hcm-connector-telemetry.service.spec.ts`
- `hcm-connector-operations-dashboard.service.spec.ts`
- `hcm-workforce-risk.util.spec.ts`
- `contractor-oracle-hcm-telemetry.e2e-spec.ts`

## Follow-on

- **1F** — contractor drift engine (`PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md`)
- **1G** — remediation / PDP cascade
