# Supplier governance operations (UI, API, evidence authority)

> **Audience:** UAT, demos, solution architecture, engineering.
> **Language / lifecycle:** [`SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md`](SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md) — snapshot-centric UI rules (read before changing labels)
> **Demo playbook:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md) · **Personas:** [`GOVERNANCE_TEST_PERSONAS.md`](GOVERNANCE_TEST_PERSONAS.md)

## Doctrine (one line)

```text
Oracle Procurement = supplier master + procurement onboarding
CMS = operational trust (approve, suspend, PDP, restrictions)
```

This is the **supplier** half of the platform story: *operationalize trust after enterprise ingestion* — paired with contractor bootstrap authority in [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md).

Sync and **create governance record** must **not** set `ACTIVE`. Operational trust is a separate CMS decision.

---

## Authoritative capability (freeze after live inspection)

> **Supplier Governance owns Operational Trust, Workforce Impact, and Integrity. Everything else consumes it.**

Supplier Governance is **architecturally complete (frozen)** only after live Inspections 7–10 pass in [`DEMO-MTN-STORY.md`](DEMO-MTN-STORY.md):

```text
Inspection 7  — live workforce impact projection
Inspection 8  — negative authority across downstream surfaces
Inspection 9  — full-arrow suspend/restore propagation
Inspection 10 — integrity endpoint PASS, 5/5 invariants, 0 violations
```

Until those pass, treat Supplier Governance as **complete in code, pending live verification**.

| Layer | Role |
| ----- | ---- |
| `SupplierOperationalTrustService` | Trust evidence, workforce impact findings, integrity evaluation |
| `GET /suppliers/operational-trust/workforce-impact` | Live projection for Workforce Discovery (`workersAssessedPopulation`, `populationScope`) |
| `GET /suppliers/operational-trust/integrity` | Governance Integrity — evaluates 5 Supplier Governance business invariants (`integrity: PASS \| FAIL`) |
| `assertSupplierOperationalTrustGranted()` | Shared enforcement for mutations (workers, contracts, promotion) |
| `SupplierRuleEvaluator` (PDP) | Policy hold when trust not granted |
| Dashboards / Assurance / Reporting | Observe and project — **never** redefine trust |

Same pattern as Joiner (identity lifecycle) and Mover (organisational change): **authoritative truth earned once, consumed everywhere**.

**Assessed workforce — dual lens:** one HCM staging population, two questions — worker findings (*what is wrong with this worker?*) vs supplier consequences (*which supplier decision affects these workers?*). See [`DEMO-MTN-STORY.md`](DEMO-MTN-STORY.md).

**Supplier Assurance (after freeze):** observational only — pending trust, suspended trust, workers affected by Operational Trust, integrity violations, trust aging, review due. No new workflow logic, no parallel readiness calculation, no redefining Operational Trust.

**Policy Evaluation:** consumes governance truths (Operational Trust, worker readiness, contracts) and returns Permit / Restrict / Deny — it does not own supplier, worker, or contract state. See [`POLICY_EVALUATION.md`](POLICY_EVALUATION.md).

**Freeze discipline:** (1) establish authoritative ownership, (2) eliminate parallel truth, (3) prove live projection, (4) prove integrity through invariants, (5) freeze the capability, (6) build observational capabilities (Assurance) on top.

---

## Evidence authority policy

CMS does not always re-collect procurement onboarding documents. Policy is derived from `Organization.supplierAuthorityMode` (see `backend/src/domain/suppliers/supplier-evidence-policy.ts`).

| `supplierAuthorityMode` | Policy mode | Approval evidence gate |
|-------------------------|-------------|-------------------------|
| `CMS_ONLY` | `CMS_FULL` | Full CMS jurisdiction checklist required |
| `ORACLE_ONLY` | `ORACLE_PROCUREMENT_TRUSTED` | Synced Oracle-linked suppliers inherit procurement onboarding; CMS gates **operational trust** only |
| `HYBRID` | `CMS_SUPPLEMENTAL` | CMS checklist still required today (partial upstream trust — future refinement) |

**Procurement-trusted** (all must hold):

- `sourceSystem = ORACLE_SUPPLIER_SAAS`
- `externalSupplierId` present
- `sourceSyncStatus = SYNCED`

Effects when trusted:

- `GET /suppliers/approvals` → `evidenceComplete: true` for eligible rows
- `PATCH /suppliers/:id/status` → `ACTIVE` allowed without CMS document uploads
- PDP `SupplierRuleEvaluator` does not hold on `MISSING_REQUIRED_DOCS` for trusted suppliers
- Dashboard **Pending governance** bucket counts all `PENDING_APPROVAL` Oracle-linked suppliers (not “missing CMS docs”)

**Portal note:** Supplier portal users on `ORACLE_ONLY` tenants may still upload supplemental CMS documents; that is not the primary gate for ops approval in the demo tenant.

### Target vocabulary (future, not DB enums today)

| Concept | Today | Future label |
|---------|--------|--------------|
| Imported | `PENDING_APPROVAL` + synced | `SYNCED` / procurement verified |
| Awaiting CMS trust | `PENDING_APPROVAL` | Pending operational trust |
| Trusted | `ACTIVE` | Operationally active |
| Held | `SUSPENDED` | Governance hold |

---

## Governance overview tiles (`/suppliers`)

Shown when `supplierAuthorityMode` is `ORACLE_ONLY` or `HYBRID`. Tiles are **navigation controls**, not static KPIs.

| Tile (ORACLE_ONLY label) | Tile (CMS_ONLY / filter) | Action |
|--------------------------|---------------------------|--------|
| Synced | Synced | `/suppliers?governanceBucket=synced` |
| Pending governance | Pending evidence | `/suppliers/approvals` |
| Active | Active | `/suppliers?governanceBucket=active` |
| Suspended | Suspended | `/suppliers?governanceBucket=suspended` |

For `CMS_ONLY`-style evidence gating, pending-evidence drill-down uses:

`/suppliers/approvals?evidenceIncomplete=true`

**Supplier sync** (`/supplier-sources/oracle/operations`) — governance queue section links **Pending governance** to the approvals queue; other tiles link to drift sections where applicable.

### List filter API

```http
GET /suppliers?governanceBucket=synced|pending_evidence|active|suspended&page=1&limit=100
```

Requires `suppliers:read`. `pending_evidence` applies in-memory evidence evaluation (same rules as dashboard).

---

## Approvals queue

| Item | Value |
|------|--------|
| Route | `/suppliers/approvals` |
| Permission | `suppliers:approve` **or** `suppliers:suspend` |
| API | `GET /suppliers/approvals` |
| Query | `?evidenceIncomplete=true` — only rows blocked on CMS evidence (non–Oracle-trusted) |

**Approve** → `PATCH /suppliers/:id/status` `{ "targetStatus": "ACTIVE" }`
**Reject** → `{ "targetStatus": "SUSPENDED", "reason": "..." }` (reason required)

Demo operator: `workforce.import@ewp.demo` / `GovOps123!` (`GOVERNANCE_OPERATIONS_ADMIN` includes `suppliers:approve` and `suppliers:suspend`).

After role bundle changes, **re-seed** and **log out / log in** so JWT `effectivePermissions` refresh.

---

## Governance dashboard API

```http
GET /suppliers/governance-dashboard
```

Returns `buckets`: `{ synced, pendingEvidence, active, suspended }`, `oracleLinkedTotal`, connector health.

| Bucket | Definition |
|--------|------------|
| **synced** | Oracle-linked, `sourceSyncStatus = SYNCED` |
| **pendingEvidence** | Oracle-linked `PENDING_APPROVAL` with incomplete CMS evidence **or**, under `ORACLE_ONLY`, all `PENDING_APPROVAL` awaiting operational trust |
| **active** | Oracle-linked, `status = ACTIVE` |
| **suspended** | Oracle-linked, `status = SUSPENDED` |

---

## End-to-end demo sequence (supplier)

1. `/supplier-sources/oracle/operations` — **Sync demo Oracle suppliers**
2. **Create governance record** for `ORCL-SUP-DEMO-001` → `PENDING_APPROVAL`
3. `/suppliers` — click **Pending governance** → approvals queue
4. **Approve** without CMS evidence upload (`ORACLE_ONLY` tenant)
5. `/suppliers?governanceBucket=active` — supplier appears as operationally trusted

---

## Implementation map

| Area | Path |
|------|------|
| Evidence policy | `backend/src/domain/suppliers/supplier-evidence-policy.ts` |
| Governance filters | `backend/src/domain/suppliers/supplier-governance-query.util.ts` |
| Dashboard service | `backend/src/domain/suppliers/supplier-governance-dashboard.service.ts` |
| List + queue | `backend/src/domain/suppliers/suppliers.service.ts` |
| Role bundle | `backend/src/core/auth/seed-system-role-bundles.ts` (`GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS`) |
| Overview UI | `frontend/components/suppliers/SupplierGovernanceDashboard.tsx` |
| Navigation helpers | `frontend/lib/supplier-governance-navigation.ts` |
| Approvals UI | `frontend/components/suppliers/SupplierApprovalsQueue.tsx` |
| Suppliers list filter | `frontend/app/suppliers/page.tsx` |

---

## Related

- [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md) — parallel doctrine for workforce (HCM bootstrap, CMS authority)
- [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md) — platform doctrine
- [`business/CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md`](business/CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md) — constitution
- [`business/PR-CMS-GOV-1E_PERSONA_E2E_AND_DRIFT.md`](business/PR-CMS-GOV-1E_PERSONA_E2E_AND_DRIFT.md) — PR slice
- [`business/PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md`](business/PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md) — lifecycle + queue
