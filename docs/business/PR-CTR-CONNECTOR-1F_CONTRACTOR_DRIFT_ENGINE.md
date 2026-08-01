# PR-CTR-CONNECTOR-1F — Contractor drift engine

## Objective

Detect and govern **identity-governed workforce drift** without auto-remediation.

## Doctrine

- Suppliers are source-reconciled; contractors are **identity-reconciled**
- Drift: detect → classify → govern (no auto-disable, block, or deactivation)

## Drift types

| Type | Severity | Meaning |
|------|----------|---------|
| `UNSPONSORED_CONTRACTOR` | **CRITICAL** | Active CMS contractor, no sponsor — primary `CMS_ONLY` signal |
| `DUPLICATE_PERSON_ANCHOR` | CRITICAL | Multiple contractors share HCM person id |
| `GOVERNANCE_LIFECYCLE_CONFLICT` | **CRITICAL** | Terminated upstream, active in CMS — **`HCM_ONLY` only** |
| `PERSON_CORRELATION_CONFLICT` | HIGH | Bootstrap identity conflict / manual review |
| `SUPPLIER_LINK_MISSING` | HIGH | External worker without supplier link |
| `CHECKPOINT_GAP` | HIGH | Connector checkpoint uncertainty |
| `WORKER_SOURCE_DRIFT` | MEDIUM | Bootstrap lineage note — **`HCM_ONLY` only**; not raised on `CMS_ONLY` |

Authority gates: `contractor-lifecycle-authority.util.ts`. Full doctrine: [CONTRACTOR_BOOTSTRAP_AUTHORITY.md](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md).

## Canonical critical conditions

**`CMS_ONLY` (demo / target):**

```text
Materialized contractor + no CMS sponsor
→ UNSPONSORED_CONTRACTOR (CRITICAL)
```

**`HCM_ONLY` (legacy):**

```text
HCM terminated/ended + contractor.isActive = true
→ GOVERNANCE_LIFECYCLE_CONFLICT (CRITICAL)
```

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/contractor-sources/oracle-hcm/drift` | `contractor-migration:read` |
| GET | `/contractor-sources/oracle-hcm/drift/summary` | `contractor-migration:read` |
| POST | `/contractor-sources/oracle-hcm/drift/detect` | `contractor-migration:manage` |
| POST | `/contractor-sources/oracle-hcm/drift/:id/assign` | `contractor-migration:manage` |
| POST | `/contractor-sources/oracle-hcm/drift/:id/resolve` | `contractor-migration:manage` |

## Detection triggers

- After HCM sync run completes (`OracleHcmSyncService`)
- Manual `POST .../drift/detect`

## UI

`/contractor-sources/oracle-hcm/operations` — **Workforce drift governance** panel with lifecycle conflicts, identity conflicts, supplier linkage, critical aging (>24h), and drift registry table.

## Tests

- `contractor-source-drift-detection.service.spec.ts`
- `contractor-oracle-hcm-drift.e2e-spec.ts`

## Next

**1G** — see [PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md](PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md) (complete).

## See also

- [CONNECTOR_GOVERNANCE_PLATFORM.md](../CONNECTOR_GOVERNANCE_PLATFORM.md)
