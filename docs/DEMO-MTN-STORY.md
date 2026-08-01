# MTN demo story — five suppliers, forty workers

**Audience:** EWP connector demos for MTN  
**Single source of truth:** `backend/src/domain/demo/demo-mtn-story.constants.ts`  
**Fixtures:** `backend/test/fixtures/oracle-procurement/demo-mtn-suppliers.json`, `oracle-hcm/demo-mtn-workers.json`

This replaces generic “Supplier A / Demo Supplier” data with a believable supplier ecosystem: industry, region, contact person, framework agreements, engagements, and scoped supplier portal admins.

---

## Clean MTN run order

```bash
docker compose up -d mock-oracle backend
docker compose restart mock-oracle
# Greenfield connector baseline (run from repo root or backend/)
npm run docker:reset:connector-demo
# Equivalent: docker compose exec backend npm run reset:connector-demo
```

Login as `workforce.import@ewp.demo` / `GovOps123!` (or `ops.admin@ewp.demo` with supplier-approve permissions).

```text
Supplier Synchronization
→ Synchronize suppliers
→ Confirm SYNC-00001 = 5 supplier records discovered
→ Assess suppliers
→ Governance: 5 synchronized suppliers (3 governed · 1 pending · 1 suspended)

Workforce Discovery
→ Discover workforce
→ Confirm DISC-00001 = 40 workers discovered
→ Assess workforce
→ Supplier reconciliation: 2 unresolved supplier references (BlueSky · Mandla)

→ Complete MTN demo story (5 suppliers)
```

### Expected workforce assessment counts

| Finding | Count |
| ------- | ----: |
| Operationally ready | 32 |
| Missing supplier | 1 |
| No Responsible Manager assigned | 2 |
| Duplicate worker | 1 |
| Manual review | 2 |
| Unlinked worker | 1 |

Governance scenarios are baked into Oracle HCM fixture metadata; demo correlation overrides apply in `DEMO_MODE`. Assessment finding labels follow [`INTERNAL_ACCOUNTABILITY_MODEL.md`](./INTERNAL_ACCOUNTABILITY_MODEL.md) (MTN: **Responsible Manager**).

### Expected supplier governance counts (after Assess suppliers)

Oracle Supplier Portal remains **5 suppliers**. Governance manages those five; reconciliation is separate.

| Governance signal | Expected |
| ----------------- | -------: |
| Synchronized | 5 |
| Operational Trust Granted | 3 |
| Operational Trust Pending | 1 (Horizon — Oracle approved, EWP trust pending) |
| Operational Trust Suspended | 1 |

**Supplier reconciliation** (Workforce Discovery tab — not Supplier Synchronization): unresolved supplier references from Oracle HCM:

| Supplier reference | Observed in | Problem | Recommended action |
| ------------------ | ----------- | ------- | ------------------ |
| BlueSky Field Services | Oracle HCM | Possible match with Vertex Projects | Confirm supplier match |
| Mandla Projects (Pty) Ltd | Oracle HCM | No matching supplier in Oracle Supplier Portal | Create or associate supplier |

Workers: Nathan Price (BlueSky), Emma Martin (Mandla). Reconciliation exists because workforce records reference supplier names that cannot yet be linked to the supplier master — not because supplier synchronization failed.

**One-sentence demo line:** *Supplier reconciliation exists because some workers reference supplier names that cannot yet be confidently linked to Oracle Supplier Portal.*

### Operational Trust (Horizon)

After **Assess suppliers**, open **Operational Trust Queue**. Horizon appears because it is **approved in Oracle Procurement** but **Operational Trust is pending** in EWP — not because procurement approval is missing.

| | Horizon Staffing |
|--|------------------|
| Oracle Procurement | Approved |
| Operational Trust | Pending |
| Reason | Approved in Oracle but not yet enabled for EWP workforce participation |
| Action | Grant Operational Trust |

**Grant Operational Trust** transitions Horizon to **Operational Trust Granted**, removes it from the queue, and updates Governance tiles. The decision is auditable on the supplier detail page (who, when, reason). Decisions persist — demo materialization does not reset operator grants.

### Operational Trust Queue vs Management

| Workspace | Purpose | Contains |
| --------- | ------- | -------- |
| **Operational Trust Queue** (`/suppliers/approvals`) | Pending decisions only | Horizon (Pending) |
| **Operational Trust Management** (`/suppliers/operational-trust`) | Lifecycle for reviewed suppliers | Granted · Suspended (Ubuntu) |

Workforce Discovery readiness tiles distinguish **Pending supplier decision** from **Suspended supplier**. After Horizon is granted, the queue may be empty while Ubuntu workers remain blocked — that is expected. Operator resolve path for Ubuntu is **Restore Operational Trust** on Management, not the empty Queue.

| | Ubuntu Field Services |
|--|-----------------------|
| Oracle Procurement | Approved |
| Operational Trust | Suspended |
| Workforce finding | Suspended supplier |
| Action | Restore Operational Trust (Management) |

### Supplier Governance inspection (before Assurance)

Prove the lifecycle is bidirectional and **consistent across every workspace** — do not build Supplier Assurance until these pass without manual refresh.

**Completion criterion:** the platform sustains an arbitrary mix of Granted, Pending, and Suspended suppliers, and every workspace tells the same story without contradiction. After that, Supplier Assurance asks observational questions over an already coherent state model — not new workflow logic.

#### Mixed-state baseline (after Assess suppliers, before operator changes)

Leave the platform in this state and walk every workspace. Counts must match supplier governance, not arbitrary fixtures.

| Supplier | Oracle Procurement | Operational Trust |
| -------- | ------------------ | ----------------- |
| Atlas | Approved | Granted |
| Nexa | Approved | Granted |
| Vertex | Approved | Granted |
| Horizon | Approved | Pending |
| Ubuntu | Approved | Suspended |

| Workspace | Expected |
| --------- | -------- |
| **Suppliers** tiles | Granted **3** · Pending **1** · Suspended **1** |
| **Operational Trust Queue** | Horizon only |
| **Operational Trust Management — Granted** | Atlas, Nexa, Vertex |
| **Operational Trust Management — Suspended** | Ubuntu |
| **Workforce Discovery — Supplier Governance Impact** | Horizon **9** affected · Ubuntu **6** affected (from `GET /suppliers/operational-trust/workforce-impact`, live — not assessment snapshot) |
| **Workforce Discovery — Workers not yet operational** | Unique count (each worker once) |
| **Workforce Discovery — Readiness reasons detected** | Sum of overlapping reasons (may exceed workers not yet operational) |
| **External Workers** supplier list | Atlas, Nexa, Vertex selectable · Ubuntu and Horizon blocked |

**Inspection 1 — Ubuntu restore:** Management → Restore → verify all surfaces agree (Granted 4, Suspended 0, Workforce **Suspended supplier** 0, yellow blocks gone). Oracle Procurement stays Approved throughout.

**Inspection 2 — Audit:** Ubuntu detail history opens without error and reads Granted → Suspended → Restored (not generic Approved). Management **Last decision** column shows Restored / by actor so the table itself distinguishes Ubuntu from Atlas without opening History.

**Inspection 3 — Authority:** Oracle unchanged; only EWP Operational Trust changed.

**Inspection 4 — Re-suspend Atlas:** Management Granted tab → Suspend Atlas → verify Granted 3, Suspended 1, Workforce blocks appear, External Workers blocked, audit records reason.

**Inspection 5 — Horizon grant:** Queue → Grant → queue empty, Horizon workers unblock (Pending supplier decision → 0).

**Inspection 6 — Mistake recovery (reversibility):** Atlas is Granted. Suspend Atlas (everything blocks). Immediately realize the mistake and **Restore** Atlas. Verify the platform behaves as if nothing is corrupted:

```text
Granted → Suspended → Restored
```

- Audit preserved: Granted → Suspended → Restored (chronological, not overwritten)
- Atlas workers unblocked; counts restored to mixed-state baseline
- Queue unchanged (still Horizon only)
- Oracle Procurement still Approved for Atlas

**Inspection 7 — Live supplier impact projection (ownership boundary):** Start mixed state (Atlas Granted, Horizon Pending, Ubuntu Suspended). Suspend Atlas in Operational Trust Management **without rerunning workforce assessment**. Verify Workforce Discovery **Supplier Governance Impact** immediately shows Atlas with affected workers; restore Atlas and verify the card disappears. Impact must come from Supplier Governance (`operational-trust/workforce-impact`), not a stale assessment snapshot.

#### Assessed workforce — dual lens (one population)

Workforce Discovery shows **one assessed HCM staging population** through two lenses:

```text
Assessed HCM staging workers
                │
      ┌─────────┴─────────┐
      │                   │
      ▼                   ▼
Worker Assessment     Supplier Governance
Findings              Consequences
(No manager,          (Operational Trust,
 Unlinked, etc.)      Workers affected by this decision)
```

| Lens | Question |
| ---- | -------- |
| **Worker Assessment** | *What is wrong with this worker?* |
| **Supplier Governance** | *Which supplier decision is affecting these workers?* |

Neither owns a different worker population. The workforce-impact API makes this explicit:

```text
workersAssessedPopulation   — same count as readiness assessment
populationScope             — "Assessed HCM staging workers (same population as worker assessment findings)"
```

Assurance, Reporting, and future dashboards must treat impact findings as a **projection over the assessed population**, not a separate cohort.

#### Constitutional ownership layers

```text
Supplier Governance
-------------------
Owns: Operational Trust, supplier impact projections

        ↓ consumes

Workforce Governance
--------------------
Owns: Worker readiness, worker-level findings

        ↓ combines

Operational Readiness (Workforce Discovery)
-------------------------------------------
Projects both lenses over the same assessed population
```

#### Ownership boundary

```text
Supplier Governance (owns Operational Trust + affected worker counts)
        │
        ▼
GET /suppliers/operational-trust/workforce-impact
        │
        ▼
Workforce Discovery displays Supplier Governance Impact cards (live projection)
```

Workforce Discovery does **not** recompute supplier trust impact. Readiness reason tiles cover workforce-side findings only; supplier trust appears exclusively under **Supplier Governance Impact**.

#### Authoritative capability (Joiner / Mover pattern)

| Capability | Owns authoritative truth | Everyone else consumes |
| ---------- | ------------------------ | ---------------------- |
| Joiner | Identity lifecycle | Governance |
| Mover | Organisational change | Governance |
| **Supplier Governance** | **Operational Trust** | Workforce Discovery, External Workers, Contracts, Promotion, PDP, Assurance |

**Authoritative service:** `SupplierOperationalTrustService`  
**Workforce impact projection:** `GET /suppliers/operational-trust/workforce-impact`  
**Enforcement helper:** `assertSupplierOperationalTrustGranted()` — downstream capabilities **consume** supplier `status` (Operational Trust), they do not redefine it.

**Inspection 8 — Negative authority:** Atlas Granted. Suspend Atlas. Every downstream capability must **refuse** Atlas immediately — without rerunning Discovery or Assessment. Verify:

| Surface | Expected when Atlas suspended |
| ------- | ----------------------------- |
| Workforce Discovery — Supplier Governance Impact | Atlas card with affected workers |
| External Workers — create | Atlas not selectable / blocked |
| Contracts — create | Atlas labelled blocked; API rejects |
| Workforce nominate (supplier portal) | Rejected |
| HCM promotion / materialization | Skipped or `SUPPLIER_OPERATIONAL_TRUST_NOT_GRANTED` |
| PDP-gated ops actions | HOLD — Operational Trust not granted |
| Supplier Governance tiles / Management | Atlas on Suspended tab |

Restore Atlas — every refusal reverses immediately.

**Inspection 9 — Full propagation (constitutional):** Suspend Atlas. Every arrow below must change **live** (no refresh, no reassessment). Restore — every arrow changes back.

```text
Oracle Procurement
        │
        ▼
Synchronize suppliers
        │
        ▼
Supplier Governance (Operational Trust)
        ├──────────────► Workforce Discovery (Supplier Governance Impact)
        ├──────────────► External Workers
        ├──────────────► Contracts
        ├──────────────► Engagements / nominate
        ├──────────────► Promotion / materialization
        ├──────────────► Supplier tiles & Management
        └──────────────► Reporting projections (when built)
```

If any arrow does not react, that surface still **owns** supplier trust state instead of **consuming** Supplier Governance.

**Inspection 10 — Governance Integrity (constitutional guard):** Inspections 7–9 prove **projection** (Supplier Governance changes → everyone updates). Inspection 10 proves **integrity** (the platform cannot remain internally inconsistent).

Evaluate via:

```text
GET /suppliers/operational-trust/integrity
```

Healthy demo response:

```text
Integrity: PASS
Evaluated invariants: 5
Violations: 0
```

#### Supplier Governance invariants (business truths)

| # | Invariant |
| - | --------- |
| 1 | Operational worker ⇒ Supplier Operational Trust = Granted |
| 2 | Supplier Operational Trust = Suspended ⇒ Operational workers = 0 |
| 3 | Supplier Operational Trust = Pending ⇒ Operational workers = 0 |
| 4 | Operational Trust Granted ⇒ Supplier exists in Oracle synchronization snapshot |
| 5 | Supplier removed from Oracle ⇒ Operational Trust cannot remain Granted indefinitely |

These are **business truths**, not implementation rules. The integrity endpoint evaluates whether the Supplier Governance constitution still holds.

**Stress-test:** Suspend Atlas while an Atlas worker is operational (if one exists). Either the worker is restricted automatically **or** integrity returns `FAIL` with violations on invariants 1 and 2. A silent impossible state means a downstream capability cached supplier state instead of consuming Supplier Governance.

#### Governance Integrity pattern (platform)

Inspection 10 is the first **integrity inspection**. Joiner and Mover will eventually expose the same pattern:

```text
Governance Integrity
├── Identity invariants      (Joiner)
├── Employment invariants    (Joiner / Mover)
├── Supplier invariants      (Supplier Governance — this capability)
└── Assignment invariants    (Mover)
```

#### Workforce Discovery projection (separate from Supplier Governance freeze)

Supplier Governance may pass Inspections 7–10 while the **Workforce Discovery Governance tab** still mixes populations if denominators are unclear. Three dimensions — **not additive**:

| Dimension | Question | Population |
| --------- | -------- | ---------- |
| Worker assessment | What is wrong with this worker? | Assessed HCM **staging** workers (discovery snapshot) |
| External governance | Which supplier decision affects these workers? | Supplier projection over same staging population |
| Workforce resolution | What tasks close workforce gaps? | Open **task records**; Policy Evaluation restrict decisions shown as outcomes |
| Operational workforce state | What lifecycle state is each materialized worker in? | Materialized HCM **CMS registry** contractors (`Restricted by policy` = Policy Evaluation outcome) |

`Workers not yet operational (40)` and `Operationally ready (23)` are **different populations** — staging vs registry. They must not be reconciled into one total.

#### Freeze gate (live checks required)

Declare Supplier Governance **frozen** only after these four inspections pass **live** in the MTN demo:

| Inspection | Proves | Pass criterion |
| ---------- | ------ | -------------- |
| **7** | Live workforce impact projection | Suspend Atlas without reassessment → Supplier Governance Impact updates immediately; restore → card disappears |
| **8** | Negative authority | Suspend Atlas → every downstream surface refuses Atlas immediately (Workforce Discovery, External Workers, Contracts, nominate, promotion, PDP, tiles) |
| **9** | Full-arrow propagation | Suspend → every arrow from Supplier Governance changes live; restore → all change back (no refresh, no reassessment) |
| **10** | Governance Integrity | `GET /suppliers/operational-trust/integrity` → `integrity: PASS`, **5/5 invariants**, **0 violations** |

Reset: `npm run docker:reset:connector-demo` · Login: `workforce.import@ewp.demo` / `GovOps123!`

#### Architectural truth (frozen doctrine)

> **Supplier Governance owns Operational Trust, Workforce Impact, and Integrity. Everything else consumes it.**

No downstream capability may redefine Operational Trust, calculate parallel supplier readiness, or cache supplier trust state instead of consuming Supplier Governance.

#### Freeze declaration

When Inspections 7–10 pass without contradiction:

```text
SUPPLIER GOVERNANCE — ARCHITECTURALLY COMPLETE (FROZEN)
```

From that point:

- **Workforce Discovery** may **display** workforce impact — not own affected-worker counts.
- **Reporting** may **summarize** and **project** — not calculate parallel supplier readiness.
- **Supplier Assurance** may **observe and report only** (see below) — not compensate for governance gaps.

Operational Trust is earned once in Supplier Governance, then consumed everywhere. New work either extends Supplier Governance within its existing boundaries, or consumes it as an authoritative capability.

Surfaces that must update live after any trust transition: Suppliers, Supplier Synchronization tiles, Operational Trust Management, Workforce Discovery External Governance Dependencies, External Workers supplier list, Contracts supplier list, supplier detail evidence.

#### Supplier Assurance (after freeze — observational only)

Supplier Assurance projects from Supplier Governance. It **observes and reports**:

```text
Pending trust
Suspended trust
Workers affected by Operational Trust
Integrity violations
Trust aging
Review due
```

**Not allowed:** new workflow logic, parallel readiness calculation, redefining Operational Trust, or owning supplier trust state.

```text
Supplier Governance                    Supplier Assurance
├── Operational Trust        ────────► Pending trust
├── Workforce Impact         ────────► Affected workers
└── Integrity                ────────► Integrity violations
                               also ► Suspended trust, trust aging, review due
```

#### Cross-surface event contract

Trust transitions broadcast `ewp:operational-trust-changed` with a deterministic payload so subscribers need not guess what changed:

```ts
{
  supplierId: string;
  previousState: SupplierTrustStatus;
  currentState: SupplierTrustStatus;
  transitionKind: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';
  changedBy?: string;
  changedAt: string; // ISO
  reason?: string;
}
```

Implementation: `frontend/lib/operational-trust-events.ts`.

**External Workforce Architecture v1 (COMPLETE & FROZEN):** [`EXTERNAL_WORKFORCE_LIFECYCLE.md`](./EXTERNAL_WORKFORCE_LIFECYCLE.md) — stop refining architecture; execute assurance domains via build → prove → inspect.

**Continuous Workforce Assurance** (post-operational) — constitution ratified, workspace not built:

- [`CONTINUOUS_WORKFORCE_ASSURANCE.md`](./CONTINUOUS_WORKFORCE_ASSURANCE.md)
- [`DEMO-MTN-ASSURANCE-STORIES.md`](./DEMO-MTN-ASSURANCE-STORIES.md)

---

## Suppliers

| Supplier | Type | Workers | Engagement | Portal admin |
| -------- | ---- | ------: | ---------- | ------------ |
| Atlas Consulting | Professional Services | 8 | Network Modernisation | `supplier.admin@atlas.demo` |
| Nexa Technologies | IT Services | 10 | OSS/BSS Transformation | `supplier.admin@nexa.demo` |
| Ubuntu Field Services | Field Operations | 6 | Regional Field Rollout | `supplier.admin@ubuntu.demo` |
| Vertex Projects | Project Delivery | 7 | Data Centre Migration | `supplier.admin@vertex.demo` |
| Horizon Staffing | Labour Broker | 9 | Managed Contractor Pool | `supplier.admin@horizon.demo` |

**Password (all portal admins):** `SupplierAdmin123!`

Each portal admin sees **only their supplier’s workforce** after **Complete MTN demo story** binds membership.

---

## Troubleshooting

**Sync shows 2 suppliers instead of 5** (`ORCL-SUP-DEMO-*` instead of `ORCL-SUP-MTN-*`): the mock Oracle container is still running old code from before the MTN fixture change.

**Sync fails with `fetch failed`:** the backend cannot reach `mock-oracle` on the Docker network (container orphaned from compose). Fix:

```bash
docker compose up -d --force-recreate mock-oracle backend
curl -s http://localhost:3000/api/v1/health/demo-config
# expect "mockOracleReachable": true
```

Then restart mock-oracle if fixtures changed on disk:

```bash
docker compose restart mock-oracle
npm run docker:reset:connector-demo
```

---

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run generate:mtn-demo-fixtures` | Regenerate JSON fixtures from constants |
| `npm run seed:mtn-demo-story` | CLI equivalent of **Complete MTN demo story** |
| `npm run docker:seed:mtn-demo-story` | Same, inside Docker backend container |

**Prerequisites:** DEMO org seeded (`npm run db:seed`), supplier sync + HCM discovery completed.

---

## Contracts

Each supplier receives one active **Supplier Framework Agreement**:

- Status: **Active**
- Start: **2026-01-01**
- End: **2027-12-31**
- Numbers: `MTN-FWA-001` … `MTN-FWA-005`

---

## Legacy paths

- `demo-two-suppliers.json` / `demo-ten-contractors.json` remain for migration UAT (`SEED_HCM_COMPARISON_ANCHORS=true`).
- `POST …/demo/complete-supplier-setup` — Atlas-only API helper (not exposed in the MTN demo UI).

---

## Related docs

- [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md) — six-act presenter flow  
- [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md) — all demo logins  
- [`WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md`](./WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md)  
- [`SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md`](./SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md)
