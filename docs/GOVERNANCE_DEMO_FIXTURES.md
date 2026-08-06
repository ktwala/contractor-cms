# Named governance demo fixtures

> **Preferred demo path:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md) — fixtures served by `npm run mock:oracle`, ingested via UI **Sync demo** buttons.
> This document describes **additional** named fixtures from base seed (`GOV-ORACLE-*`, `GOV-HCM-*`).

Deterministic IDs for demos and UAT. Reseed: `cd backend && npm run db:seed`.

**Login (operations):** `workforce.import@ewp.demo` / `GovOps123!`
**Login (reviewer):** `governance.reviewer@ewp.demo` / `GovReview123!`
**Supplier governance reference:** [`SUPPLIER_GOVERNANCE_OPERATIONS.md`](SUPPLIER_GOVERNANCE_OPERATIONS.md)

**Tenant:** Demo Organization — `ORACLE_ONLY` suppliers. **Live connector demo:** `CMS_ONLY` contractors (HCM bootstrap only). Legacy seed fixtures below require `SEED_GOVERNANCE_FIXTURES=true`.

---

## Supplier Oracle (`/supplier-sources/oracle/operations`)

| Fixture ID | Scenario | Drift / staging |
|------------|----------|-----------------|
| `GOV-ORACLE-PENDING-001` | Pending evidence | `GOVERNANCE_STATE_CONFLICT` (CRITICAL, under review) |
| `GOV-ORACLE-DUP-003` | Duplicate external ID | `DUPLICATE_EXTERNAL_ID` (HIGH, classified) |
| `GOV-ORACLE-POSSIBLE-002` | Possible match | Staging `POSSIBLE_MATCH` |
| `GOV-ORACLE-STALE-004` | Stale connector | Failed sync run + `CHECKPOINT_GAP`; org health `STALE` |
| `GOV-ORACLE-RECON-005` | Reconciliation conflict | Staging `CONFLICT` + `RECONCILIATION_CONFLICT` drift |
| `GOV-ORACLE-HEALTHY-001` | Healthy matched twin | Linked to Demo Supplier Ltd |

### UAT script — supplier

1. Login as **governance.ops@**
2. Open **Supplier sync** (`/supplier-sources/oracle/operations`) — sync + create governance record
3. Open **`/suppliers`** — use overview tiles (Synced / Pending governance / Active / Suspended)
4. **`/suppliers/approvals`** — approve to `ACTIVE` (`ORACLE_ONLY` inherits procurement evidence)
5. Run **Detect drift** on sync page — counts update, no auto-remediation
6. Find `GOV-ORACLE-POSSIBLE-002` in reconciliation / anomalies
7. Assign & resolve `GOV-ORACLE-DUP-003` as **governance.reviewer@**

---

## Workforce Oracle HCM (`/contractor-sources/oracle-hcm/operations`)

**Preferred live demo:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md) — `HCM-WORKER-DEMO-008` unsponsored flagship after bootstrap import + CMS governance scan.

### Legacy seed fixtures (`SEED_GOVERNANCE_FIXTURES=true` only)

| Fixture ID | Scenario | Contractor email |
|------------|----------|------------------|
| `HCM-TERM-ACTIVE-001` | Legacy `HCM_ONLY` lifecycle conflict | `fixture.hcm-term-active@demo.local` |
| `HCM-CONFLICT-002` | Identity / MANUAL_REVIEW conflict | — (staging only) |
| `HCM-LOWCONF-003` | LOW confidence correlation | `fixture.hcm-lowconf@demo.local` |
| `HCM-NOSUP-004` | Missing supplier link | — (drift only) |
| `HCM-HIGHCONF-005` | HIGH confidence matched | `fixture.hcm-highconf@demo.local` |

---

## Permission note

`GOVERNANCE_OPERATIONS_ADMIN` bundles `suppliers:read|update|approve|suspend`, `contractor-migration:read|manage`, and governance read permissions. Users without this bundle may hit `/403` — that is correct RBAC.

Source of truth for IDs: `backend/prisma/governance-demo-fixtures.constants.ts`
