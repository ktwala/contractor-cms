# Supplier Governance Language Guide

**Status:** Draft — process-first vocabulary for Oracle Procurement / Supplier Portal connector UI and ops narrative
**Audience:** Product, demo authors, engineers changing labels
**Rule:** Language emerges from the **business process**, not from UI polish. **Do not rename labels in code until this guide’s page-purpose and metric-ownership rules pass.**

**Parent pattern (read first):**

- [`docs/EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md`](./EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md) — why snapshots exist, connector vs EWP roles, proven pattern (HCM + Procurement)

**Related (do not supersede):**

- [`docs/SUPPLIER_GOVERNANCE_OPERATIONS.md`](./SUPPLIER_GOVERNANCE_OPERATIONS.md) — approvals queue, evidence authority, API routes
- [`docs/WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md`](./WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md) — parallel discipline for Oracle HCM (Workforce Discovery)
- [`docs/CONNECTOR_DEMO_UAT.md`](./CONNECTOR_DEMO_UAT.md) — demo playbook
- [`frontend/lib/supplier-synchronization-labels.ts`](../frontend/lib/supplier-synchronization-labels.ts) — current UI constants (**implementation lags this guide** until deliberately updated)

---

## 0. Locked doctrine (five concepts)

Each concept maps to **one** lifecycle stage. Do not collapse them in UI copy, demos, or architecture narrative.

```text
Supplier Synchronization   = evidence acquisition (Oracle Supplier Portal → EWP)
Supplier Snapshot          = what Oracle Supplier Portal reported (immutable run, e.g. SYNC-00001)
Supplier Assessment        = whether EWP can trust/govern supplier participation for this snapshot
Supplier Governance        = approvals, promotion, membership, readiness, reconciliation tasks
Operational Supplier       = approved supplier usable in EWP (registry ACTIVE, portal, contracts)
```

**Upstream mastery (unchanged):**

```text
Oracle Supplier Portal / Procurement  →  supplier master
EWP                                   →  supplier participation / operational trust
```

Synchronization **does not** mean operational trust. Assessment **does not** mean approval. Governance **does not** mean discovery succeeded.

---

## 1. Forbidden MTN-facing terms

These words belong in engineering docs, schema, and code — **never** in operator UI, demo scripts, or MTN-facing architecture decks.

| Forbidden (MTN-facing) | Why | Say instead |
|------------------------|-----|-------------|
| **CMS** | Internal product name; MTN has never seen it | **EWP**, **supplier registry**, **governance record** |
| **staging** | Implementation store, not business evidence | **evidence**, **snapshot**, **records discovered** |
| **ledger** | Connector accounting, not business meaning | **snapshot**, **this synchronization run** |
| **upsert** | Database operation | **discovered**, **captured**, **synchronized** |
| **processed** | Ambiguous (staging? registry? operational?) | **supplier records discovered**, **failed** |
| **sync totals** | Lifetime connector counters, not snapshot evidence | **records discovered in this snapshot** |

**Also avoid on Snapshot History / Overview:**

- *Matched to existing CMS supplier*
- *New to staging*
- *Audit trail* (when meaning operational registry counts)
- *Synchronization statistics (ledger total)*

Correlation counters (`matched`, `new`) may exist in backend ingest — they describe **registry reconciliation during acquisition**, not “operational suppliers.” On **greenfield** first sync, prefer **Records discovered: 2 · Failed: 0** and hide match breakdown until assessment or migration UAT.

---

## 2. Lifecycle

Supplier Synchronization applies the [External Source Governance Pattern](./EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md) to Oracle Procurement / Supplier Portal.

```text
Synchronize       Connector acquires evidence (Oracle Supplier Portal → EWP)
    ↓
Snapshot          Immutable sync run (e.g. SYNC-00001)
    ↓
Assess            EWP evaluates the snapshot (reconciliation, readiness, policy checks)
    ↓
Govern            Operational decisions before trust (findings, promotion, approvals)
    ↓
Operationalize    Supplier can participate in EWP (approved, portal, contracts)
```

**Implementation note:** Code and schema may still say *sync*, *import*, *staging*, *promote*, *active*. This guide defines **user-facing** language only.

### Assessment lifecycle (sync snapshot → assessment)

Each successful **synchronization run** produces a snapshot (e.g. `SYNC-00001`). **Supplier assessment** consumes exactly one snapshot — the latest unassessed synchronization.

| Phase | Operator sees | Action |
|-------|---------------|--------|
| **Synchronization pending** | No successful sync run yet | **Synchronize suppliers** (Overview) |
| **Assessment pending** | New snapshot ready (e.g. `SYNC-00002`) | **Assess suppliers** (Governance) |
| **Assessment current** | Up to date for latest snapshot | No assessment button — show last assessed time + snapshot ref |

**Rules:**

- Do not label assessment as a *scan* in operator UI — use **Assess suppliers**.
- Assessment findings must cite the snapshot: *Based on supplier snapshot SYNC-00001*.
- Re-running assessment against the same snapshot is blocked (409) — there is nothing new to assess.
- Synchronization alone does not run assessment; assessment is an explicit pipeline stage after sync completes.

### Cross-connector mapping (Workforce ↔ Supplier)

| Workforce Discovery | Supplier Synchronization |
|-----------------------|---------------------------|
| Discover workforce | Synchronize suppliers |
| `DISC-00015` | `SYNC-00015` |
| Assess workforce | Assess suppliers |
| Discovery pending | Synchronization pending |
| Discovery History | **Snapshot History** |
| Operationally ready worker | Operational supplier |

---

## 3. Page purpose

Every tab on **Supplier Synchronization** (`/supplier-sources/oracle/operations`) answers **one question**. If a metric or card does not support that question, it belongs on another tab or on `/suppliers`.

| Tab | Question it answers | Does *not* belong here |
|-----|---------------------|-------------------------|
| **Overview** | What is the **latest supplier evidence snapshot**? | Operational supplier counts, approval queues, promotion queue |
| **Snapshot History** *(today: Sync History)* | **What supplier evidence snapshots did we acquire?** | Active suppliers, synced registry totals, governance tiles |
| **Governance** | Which suppliers are **not yet operationally trusted**, and why? | Connector ledger totals, lifetime sync statistics |
| **Reconciliation** | What Supplier Portal changes need human matching since last sync? | *(Post-assessment only — same discipline as Workforce Resolution)* |

---

## 4. Snapshot History tab (target layout)

**Rename tab:** `Sync History` → **Snapshot History**

**Single question:** *What supplier evidence snapshots did we acquire?*

### Required sections (in order)

**1. Latest supplier snapshot**

```text
SYNC-00001

Created          [timestamp]
Source           Oracle Supplier Portal
Status           Succeeded
Assessment       Pending | Assessed | Not assessed

Supplier records discovered    2
Failed                         0
```

**2. What changed in this snapshot** *(when per-snapshot deltas exist)*

For greenfield / v1, show only honest acquisition counts:

```text
Supplier records discovered    2
Failed                         0
```

Do **not** show lifetime ledger totals or “matched to existing registry” on greenfield MTN demos.

**3. Discovery exceptions**

```text
None
```

Or, when applicable:

```text
1 duplicate supplier ID
2 missing mandatory fields
```

Discovery exceptions = records Oracle sent that could not be reconciled during **this snapshot** — not governance resolution tasks.

**4. Previous snapshots**

Table: `SYNC-00001`, `SYNC-00002`, … with created date, records discovered, assessment label.

**5. Technical details** *(collapsed `<details>`)*

Connector execution only:

```text
Total runs · Succeeded · Failed · Partial · Last duration · Staging backlog
```

Same placement as Workforce Discovery History — **not** visible by default for MTN exec demos.

### Remove from Snapshot History (move or delete)

| Current element | Verdict | Destination |
|-----------------|---------|-------------|
| Synchronization ledger (prominent grid) | ✘ | Technical details (collapsed) |
| Synchronization statistics (ledger totals) | ✘ | Remove — duplicates Overview; wrong lifecycle |
| Recent sync runs (full engineering table) | ✘ | Previous snapshots + technical details |
| Audit trail (Oracle-linked · synced · active) | ✘ | **Governance** tab or `/suppliers` |

---

## 5. Overview tab (target)

**Question:** *What is the latest supplier evidence snapshot?*

| Element | Belongs? |
|---------|----------|
| Synchronize suppliers action | ✔ |
| Latest snapshot summary (`SYNC-*`, records discovered, assessment status) | ✔ |
| Connector health | ✘ → Administration / technical details (optional footnote) |
| Governance snapshot tiles (pending approvals, conflicts, promotion) | ✘ → **Governance** |
| Pending governance count on Overview | ✘ → **Governance** |
| Ledger / lifetime sync totals | ✘ |

**Greenfield first sync — say:**

```text
Oracle Supplier Portal reported 2 suppliers.
Snapshot SYNC-00001 is ready for assessment.
```

**Do not say:**

```text
Matched to existing CMS supplier = 0
New to staging = 2
Processed 2 staging records
```

---

## 6. Governance tab (target)

**Question:** *Which suppliers can EWP trust and govern?*

### Before assessment completes

Render **only**:

- Assessment status
- Single **Awaiting assessment** tile (count from latest snapshot — supplier records discovered)
- Placeholder for assessment findings

Hide: pending approvals breakdown, reconciliation conflicts, promotion queue age, operational supplier counts.

### After assessment completes

Order (parallel to Workforce Governance):

| Section | Question | Metrics |
|---------|----------|---------|
| **Assessment status** | Is assessment current for latest snapshot? | Up to date / pending + `SYNC-*` ref |
| **Assessment findings** | What did assessment discover? | Drift / reconciliation findings tied to snapshot |
| **Supplier readiness** | Why can't suppliers participate yet? | Pending governance, matching required, conflicts, awaiting promotion |
| **Resolution** | What tasks close readiness gaps? | Promotion, portal membership, approval queue links |
| **Operational suppliers** | Who is usable in EWP today? | Oracle-linked, synced, **active** (registry) |

**Move here from History / Overview:**

- Oracle-linked supplier count
- Synced / active registry buckets
- Promotion queue
- Pending approvals / governance review tiles
- Portal membership setup (demo controls stay on Governance)

**API rule (target — mirror Workforce):** Dashboard and telemetry endpoints return zero governance/reconciliation/drift/bucket telemetry until `lifecyclePhase === ASSESSMENT_CURRENT`. Connector sync telemetry for the **latest snapshot** remains available after synchronization.

**UI rule:** If `lifecyclePhase === ASSESSMENT_PENDING`, Governance shows assessment status + awaiting assessment only.

---

## 7. Metric ownership (lifecycle)

Each metric has **one owning stage**. UI must not show a metric before that stage completes.

| Metric | Synchronize / Snapshot | Assessment | Readiness | Resolution | Operational |
|--------|:----------------------:|:----------:|:---------:|:----------:|:-----------:|
| Supplier records discovered | ✓ | | | | |
| Failed (acquisition) | ✓ | | | | |
| Awaiting assessment | | ✓ | | | |
| Supplier matching required | | ✓ | ✓ | ✓ | |
| Reconciliation conflicts | | ✓ | ✓ | ✓ | |
| Awaiting promotion | | ✓ | ✓ | ✓ | |
| Assessment findings (drift) | | ✓ | | | |
| Pending governance / approvals | | | ✓ | ✓ | |
| Oracle-linked / synced (registry) | | | | | ✓ |
| **Active** operational suppliers | | | | | ✓ |
| Portal membership / contracts | | | | ✓ | ✓ |

**Greenfield first sync (MTN default):**

| Metric | Expected on Snapshot History |
|--------|-------------------------------|
| Supplier records discovered | 2 |
| Failed | 0 |
| Assessment | Pending |
| Matched to existing EWP supplier | *(hidden or 0 — do not headline)* |
| Active operational suppliers | *(Governance only, after assessment — 0 until approved)* |

---

## 8. Vocabulary

| Term | Stage | Meaning |
|------|-------|---------|
| **Supplier Synchronization** | Synchronize | EWP acquired supplier metadata evidence from Oracle Supplier Portal |
| **Supplier snapshot** | Snapshot | Immutable evidence from one successful sync run (`SYNC-*`) |
| **Supplier records discovered** | Snapshot | Records Oracle reported in this snapshot — **not** registry headcount |
| **Discovery exceptions** | Snapshot | Records that failed validation or reconciliation during acquisition |
| **Supplier assessment** | Assess | EWP evaluated the snapshot for operational trust gaps |
| **Awaiting assessment** | Assess | Snapshot exists; assessment not yet run |
| **Assessment findings** | Assess / Govern | Structured outcomes tied to snapshot |
| **Supplier readiness** | Govern | Why a supplier cannot participate yet |
| **Supplier reconciliation** | Govern | Human review of possible matches / conflicts *(post-assessment)* |
| **Create governance record** | Govern | Link Oracle evidence to an EWP supplier registry row *(not “promote twin”)* |
| **Operational supplier** | Operationalize | Approved, usable in EWP (`ACTIVE`, portal, contracts) |

### Deprecated interchangeability (do not mix)

| Word | Actually means | Common misuse |
|------|----------------|---------------|
| Synchronized | Evidence acquired | "Synchronized = operationally trusted" |
| Synced (registry) | Linked to Oracle + evidence current | "Synced = active" |
| Active | Operational supplier in registry | "Active = discovered" |
| Processed | Staging upsert count | "Processed = suppliers in EWP" |
| Promoted | Governance record created | "Promoted = approved" |
| Matched | Staging row linked to registry row during ingest | "Matched = operational supplier" |

---

## 9. Proposed label mapping (apply after UI placement)

Apply only after Snapshot History and Governance placement match §4–§6.

| Current (UI / code) | Proposed | Stage |
|---------------------|----------|-------|
| Sync History (tab) | **Snapshot History** | Snapshot |
| Synchronization ledger | *(removed — technical details only)* | — |
| Synchronization statistics | *(removed)* | — |
| Staging records processed | **Supplier records discovered** | Snapshot |
| Matched to existing CMS supplier | **Matched to existing EWP supplier** *(migration UAT only)* | Snapshot |
| New to staging, no CMS match | **New / unmatched** *(migration UAT only)* | Snapshot |
| Processed (run column) | **Records discovered** | Snapshot |
| Audit trail | *(remove from History)* | — |
| Governance snapshot (Overview) | *(move to Governance)* | Govern |
| Promote twin / promote supplier | **Create governance record** / **Start supplier governance** | Govern |
| Supplier readiness assessment | **Assess suppliers** | Assess |

Nav title **Supplier Synchronization** remains — it names the connector surface, not the lifecycle stage verb.

---

## 10. Presenter script (Supplier Synchronization → Governance)

| Step | Screen | Say |
|------|--------|-----|
| 0 | *(prep)* | `npm run docker:reset:connector-demo` — greenfield baseline |
| 1 | Overview → **Synchronize suppliers** | *Oracle Supplier Portal told us these suppliers exist — we captured snapshot SYNC-00001.* |
| 2 | Snapshot History | *This is our evidence archive — not connector milliseconds.* |
| 3 | Governance (before assess) | *Nothing is trusted yet — only how many records await assessment.* |
| 4 | **Assess suppliers** | *Assessment evaluates that snapshot for operational trust.* |
| 5 | Supplier readiness | *These explain why suppliers cannot participate yet.* |
| 6 | Resolution | *Create governance record, approve, portal setup — tasks that close gaps.* |
| 7 | Operational suppliers | *These are suppliers EWP can use operationally.* |

Skip **Technical details** and connector health for executive audiences.

---

## 11. Label change checklist

Before merging any UI string change:

1. **Which lifecycle stage** does this label belong to? (§0)
2. **Which page question** does it help answer? (§3)
3. **Is the same concept** already named differently on another tab?
4. **Does it use a forbidden term?** (§1)
5. **Would an MTN ops lead** say this phrase in a meeting without explanation?

If any answer is unclear, do not rename — move the metric or clarify the process first.

---

## 12. Demo and reset

Supplier and workforce demos share the same greenfield reset:

```bash
npm run docker:reset:connector-demo
```

**Supplier path (after reset):**

1. Synchronize suppliers → Snapshot `SYNC-00001`, **2 records discovered**, assessment pending
2. Assess suppliers → findings / readiness on Governance
3. Create governance record → approve on `/suppliers/approvals` → **operational supplier**

Do not conflate **supplier records discovered** (snapshot) with **active operational suppliers** (registry).

See [`CONNECTOR_DEMO_UAT.md`](./CONNECTOR_DEMO_UAT.md) and [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md).

---

## 13. Success criterion

MTN operations adopts the model when people say:

- "Supplier snapshot **awaiting assessment**"
- "**Operational suppliers**" (not "synced suppliers" meaning trusted)

—not "processed staging rows" or "CMS matched" as if they meant operational trust.

---

## 14. UI audit (implemented — July 2026)

Audit baseline: July 2026. Source: `frontend/components/supplier-sources/supplier-sync/*`.

**Implementation order applied:**

1. Backend: `supplierDiscoverySnapshotHistory[]` on dashboard DTO (`listSnapshotHistory`)
2. API gating: zero governance/bucket/drift telemetry until `ASSESSMENT_CURRENT`
3. Snapshot History tab rebuilt from snapshot panels
4. Overview governance leak removed
5. Labels updated per §9 (CMS/staging/ledger removed from operator UI)

### Snapshot History — *What supplier evidence snapshots did we acquire?*

| Element | Verdict | Action |
|---------|---------|--------|
| Latest supplier snapshot (`SYNC-*`) | ✔ | **Added** — centre of tab |
| Supplier records discovered / Failed | ✔ | **Added** — per snapshot |
| Discovery exceptions | ✔ | **Added** |
| Previous snapshots table | ✔ | **Added** — replaces recent sync runs |
| Technical details (collapsed) | ✔ | **Added** — connector execution metrics |
| Synchronization ledger (prominent) | ✘ | **Removed** |
| Synchronization statistics (ledger totals) | ✘ | **Removed** |
| Audit trail (active/synced counts) | ✘ | **Moved** → Governance (post-assessment) |
| CMS / staging / ledger / processed copy | ✘ | **Removed** |

### Overview — *Latest supplier evidence snapshot?*

| Element | Verdict | Action |
|---------|---------|--------|
| Synchronize suppliers action | ✔ | Kept |
| Latest snapshot summary | ✔ | **Added** |
| Governance snapshot tiles | ✘ | **Removed** |
| Connector health (prominent) | ✘ | **Removed** |

### Governance — *Which suppliers can EWP trust?*

| Element | Verdict | Action |
|---------|---------|--------|
| Assessment status + Assess suppliers | ✔ | Kept; gate outputs |
| Awaiting assessment (pre-assess only) | ✔ | Kept |
| Governance review tiles | ✔ | **Post-assessment only** |
| Operational suppliers | ✔ | **Added** — post-assessment |
| Approval queue / portal / demo helper | ✔ | **Post-assessment only** |

### Nav

| Current | Target |
|---------|--------|
| Sync History | **Snapshot History** ✔ |
