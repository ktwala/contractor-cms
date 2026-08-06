# PR-WORKFORCE-E2E-UAT-1 — Workforce Administration end-to-end proof

**Status:** COMPLETE
**Builds on:** [`PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md`](./PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md), [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md)

## Guardrail

> This proves **supplier-backed Workforce Administration**, not MTN approval workflow, RDS mapping, or HCM ongoing authority.

Ops actions are CMS workforce-plane transitions (`NOMINATED → PENDING_APPROVAL → ACTIVE`). They are **not** LM / Account Manager approval chains, ServiceNow, or Aveksa.

## What this closes

The workforce plane now has a **demonstrable baseline** across both audiences:

| Audience | Question answered |
|----------|-------------------|
| **Supplier** | What happened to my worker nomination? |
| **Ops** | What state is this contractor in, and how did they get here? |

## UAT flow (checklist)

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 0 | Seed | Demo supplier + active contract | `Demo Supplier Ltd`, contract `DEMO-SEED-001` |
| 1 | Supplier | `POST /supplier-portal/contractors` (nominate) | `workforceState = NOMINATED`, `isActive = false` |
| 2 | Supplier | `GET /supplier-portal/contractors/:id/workforce-history` | `null → NOMINATED`, source `SUPPLIER_PORTAL` |
| 3 | Ops | `GET /contractors/workforce-review` | Row visible at `NOMINATED` with placement intent |
| 4 | Ops | `PATCH /contractors/:id/workforce-transition` → `PENDING_APPROVAL` | Ops review advance (not MTN approval) |
| 5 | Ops | `PATCH /contractors/:id/workforce-transition` → `ACTIVE` | Registry active |
| 6 | Supplier | Timeline read again | `NOMINATED → PENDING_APPROVAL → ACTIVE` (source `OPS`) |
| 7 | Ops | `GET /contractors/:id` | `workforceState = ACTIVE`, `isActive = true` |
| 8 | Either | Audit + domain stubs | Present (stub publisher via audit) |
| 9 | Supplier | Attempt workforce transition | **403** — suppliers may not advance state |

## Demo personas (seed)

| Role | Email | Password |
|------|-------|----------|
| Supplier admin | `supplier.admin@ewp.demo` | `SupplierAdmin123!` |
| Ops (EWP admin) | `ops.admin@ewp.demo` | `Admin123!` |

Contract for nomination: `GET /supplier-portal/contracts` → `DEMO-SEED-001`.

## Automated proof

| Artifact | Purpose |
|----------|---------|
| [`backend/test/workforce-administration-uat.e2e-spec.ts`](../../backend/test/workforce-administration-uat.e2e-spec.ts) | CI e2e — full flow + audit/domain stub assertions |
| [`scripts/validate-workforce-uat.sh`](../../scripts/validate-workforce-uat.sh) | Local/demo API walkthrough against seeded environment |

```bash
# E2E (requires test database)
cd backend && npm run test:e2e -- workforce-administration-uat.e2e-spec.ts

# Demo API proof (requires running API + seed)
./scripts/validate-workforce-uat.sh
```

## Three truths (verified indirectly)

| Artifact | Verified by |
|----------|-------------|
| **Workforce history** | Supplier + ops timeline endpoints |
| **Audit** | `CONTRACTOR_WORKFORCE_STATE_CHANGED`, `CONTRACTOR_WORKFORCE_DOMAIN_EVENT` rows |
| **Domain events** | Stub audit entries with `metadata.stub: true` |

## Explicitly not in scope

- MTN RDS mapping
- Reject / send-back workflow
- Blacklist path
- HCM bootstrap timeline (separate proof — [`PR-WORKFORCE-HCM-HISTORY-1.md`](./PR-WORKFORCE-HCM-HISTORY-1.md))
- Backfill of pre-plane contractors

## Next branch options (after baseline)

With happy path, exception outcomes, and policy block proven:

1. **RDS mapping** — map external requirements to workforce plane paths
2. **`acquisitionModel` ADR** — independent contractor path

## UI walkthrough (manual)

1. Supplier portal → **Contractors** → **Nominate contractor**
2. Open contractor detail → confirm **Workforce timeline** shows nomination
3. Ops → **Contractors → Workforce review** → submit for review → activate
4. Supplier refreshes detail → full timeline visible
5. Ops contractor registry → `ACTIVE` badge
