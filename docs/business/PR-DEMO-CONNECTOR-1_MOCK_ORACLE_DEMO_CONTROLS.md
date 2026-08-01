# PR-DEMO-CONNECTOR-1 — Mock Oracle source APIs + demo sync controls

## Goal

```text
We are not preloading outcomes.
We reset the tenant, then ingest from a mock Oracle API through the same connector path used for real Oracle.
```

**Key line:** Oracle provides source truth; CMS governs operational trust.

```text
Mock Oracle API
→ connector sync
→ staging + correlation (bootstrap)
→ CMS governance record (suppliers)
→ HCM workforce bootstrap → CMS contractor registry
→ CMS governance scan
→ operational governance remediation
→ PDP restriction
```

## Components

| Piece | Location |
|-------|----------|
| Mock upstream | `mock-oracle/server.js` — port `8080` |
| Connector env | `backend/.env.example`, `docker-compose.yml` |
| Demo UI bars | `SupplierConnectorDemoBar`, `HcmConnectorDemoBar` |
| Reset only | `npm run seed:connector-demo` (no `--import`) |
| Playbook | [`../CONNECTOR_DEMO_UAT.md`](../CONNECTOR_DEMO_UAT.md) |

## Mock routes

| Route | Fixture |
|-------|---------|
| `GET /mock-oracle/procurement/suppliers` | `demo-two-suppliers.json` |
| `GET /mock-oracle/hcm/workers` | `demo-ten-contractors.json` |

## Setup (Docker)

```bash
docker compose up -d
docker compose exec backend npm run reset:connector-demo   # greenfield re-reset (default)
docker compose exec backend npm run reset:connector-demo:migration   # migration/conflict UAT only
```

Open `http://localhost:3001` — mock Oracle is `mock-oracle:8080` inside compose; backend REST is pre-wired.

Do not use `SEED_GOVERNANCE_FIXTURES=true` for live demos (pre-loads sync/drift).

## Demo flow

### Step 0 — Reset (greenfield default)

```bash
npm run seed:connector-demo
```

Message: *We reset the tenant only. No suppliers or contractors exist yet — first HCM discovery will show 10 records, 0 matches.*

Migration / conflict lineage demo (hidden comparison anchors): `SEED_HCM_COMPARISON_ANCHORS=true npm run seed:connector-demo`

### Step 1 — Supplier ingestion + operational trust (UI)

`/supplier-sources/oracle/operations` → **Sync demo Oracle suppliers** → **Create governance record** → `PENDING_APPROVAL`  
→ `/suppliers/approvals` (or **Pending governance** tile on `/suppliers`) → **Approve** → `ACTIVE`  
(`ORACLE_ONLY`: no CMS evidence re-upload when Oracle-linked + synced — see [`../SUPPLIER_GOVERNANCE_OPERATIONS.md`](../SUPPLIER_GOVERNANCE_OPERATIONS.md))

### Step 2 — HCM bootstrap (UI)

`/contractor-sources/oracle-hcm/operations` → **Import demo HCM workers** (staging + materialize CMS contractors)

### Step 3 — CMS governance scan + remediation

**Run CMS governance scan** → `UNSPONSORED_CONTRACTOR` on `HCM-WORKER-DEMO-008` → operational governance remediation → PDP restriction; contractor stays **ACTIVE** until CMS resolves sponsor assignment.

## UI gating

Demo buttons visible when:

```text
NEXT_PUBLIC_DEMO_MODE=true
or NODE_ENV !== production
```

Requires `suppliers:update` / `contractor-migration:manage`.

## Deprecated

`npm run seed:connector-demo -- --import` — warns and does not ingest. Use mock REST + UI sync instead.

## See also

- [`../CONNECTOR_GOVERNANCE_PLATFORM.md`](../CONNECTOR_GOVERNANCE_PLATFORM.md)
- [`../SUPPLIER_GOVERNANCE_OPERATIONS.md`](../SUPPLIER_GOVERNANCE_OPERATIONS.md)
- [`CONNECTOR_GOVERNANCE_INDEX.md`](CONNECTOR_GOVERNANCE_INDEX.md)
