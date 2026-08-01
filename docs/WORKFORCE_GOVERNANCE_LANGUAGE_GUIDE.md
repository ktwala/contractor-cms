# Workforce Governance Language Guide

**Status:** Draft — process-first vocabulary for HCM connector UI and ops narrative  
**Audience:** Product, demo authors, engineers changing labels  
**Rule:** Language emerges from the **business process**, not from UI polish. Do not rename labels in code until a control on this page passes.

**Parent pattern (read first):**

- [`docs/EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md`](./EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md) — why snapshots exist, connector vs EWP roles, proven pattern (HCM + Procurement; not universal doctrine)

**Related (do not supersede):**

- [`docs/EXTERNAL_WORKFORCE_LIFECYCLE.md`](./EXTERNAL_WORKFORCE_LIFECYCLE.md) — **FROZEN** complete lifecycle; Operational Workforce boundary; becoming vs remaining operational
- [`docs/CONTINUOUS_WORKFORCE_ASSURANCE.md`](./CONTINUOUS_WORKFORCE_ASSURANCE.md) — assurance domains, observation → finding → decision → action
- [`docs/INTERNAL_ACCOUNTABILITY_MODEL.md`](./INTERNAL_ACCOUNTABILITY_MODEL.md) — **canonical platform concept** (Responsible Manager = MTN display label)
- [`docs/business/EXTERNAL_WORKFORCE_VOCABULARY.md`](./business/EXTERNAL_WORKFORCE_VOCABULARY.md) — frozen product vocabulary (External Worker, EWP, capabilities)
- [`docs/SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md`](./SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md) — parallel supplier connector vocabulary (Oracle Procurement)
- [`frontend/lib/external-workforce-labels.ts`](../frontend/lib/external-workforce-labels.ts) — current UI constants (implementation lags this guide until deliberately updated)

---

## 1. Lifecycle

Workforce Discovery applies the [External Source Governance Pattern](./EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md) to Oracle HCM. Each stage owns distinct words — do not mix them on one screen.

```text
Discover          Connector acquires evidence (Oracle HCM → EWP staging)
    ↓
Snapshot          Immutable discovery run (e.g. DISC-00015)
    ↓
Assess            EWP evaluates the snapshot (workforce resolution, completeness, policy checks)
    ↓
Govern            Operational decisions required before trust (findings, remediation)
    ↓
Operationalize    Worker can participate in EWP operations (subject to engagement / internal accountability rules)
    ↓
Cutover           (Optional) Oracle HCM is no longer the operational authority for this workforce
```

**Implementation note:** Code and schema may still say *import*, *sync*, *materialize*, *active*. This guide defines **user-facing** language only.

### Assessment lifecycle (discovery snapshot → assessment)

Each successful **discovery run** produces a snapshot (e.g. `DISC-00015`). **Workforce assessment** consumes exactly one snapshot — the latest unassessed discovery.

| Phase | Operator sees | Action |
|-------|---------------|--------|
| **Discovery pending** | No successful discovery run yet | Discover workforce (Overview) |
| **Assessment pending** | New snapshot ready (e.g. `DISC-00016`) | **Assess workforce** (Governance) |
| **Assessment current** | Up to date for latest snapshot | No assessment button — show last assessed time + snapshot ref |

**Rules:**

- Do not label assessment as a *scan* in operator UI — use **Assess workforce**.
- Assessment findings must cite the snapshot: *Based on discovery snapshot DISC-00015*.
- Re-running assessment against the same snapshot is blocked (409) — there is nothing new to assess.
- Discovery alone does not run assessment; assessment is an explicit pipeline stage after discovery completes.

**Supplier Synchronization** applies the same discipline with sync snapshots (`SYNC-00015`). Full rules: [`SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md`](./SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md).

| Workforce Discovery | Supplier Synchronization |
|---------------------|---------------------------|
| Discover workforce | Synchronize suppliers |
| `DISC-00015` | `SYNC-00015` |
| Assess workforce | Assess suppliers |
| Discovery pending | Synchronization pending |

---

## 2. Page purpose

Every tab on **Workforce Discovery** (today: Workforce Import) answers **one question**. If a metric or card does not support that question, it belongs on another tab.

| Tab | Question it answers | Does *not* belong here |
|-----|---------------------|-------------------------|
| **Overview** | Did we successfully **discover** the workforce from Oracle HCM? | Governance findings, readiness, remediation queues |
| **Discovery History** *(today: Import History)* | What happened during each **discovery run**? | Operational actions, cutover state |
| **Governance** | Which discovered workers are **not yet operationally trusted**, and why? | Connector health, raw discovery counts |
| **Cutover** | Has **operational authority** moved from Oracle HCM to EWP? | Day-to-day governance tiles |

### Overview — allowed content

| Element | Belongs? |
|---------|----------|
| Connector health | ✔ |
| Latest discovery run | ✔ |
| Workers discovered (staging upserts / ledger) | ✔ |
| Missing supplier links | ✘ → Governance |
| Pending verification | ✘ → Governance |
| Worker linking required | ✘ → Governance |
| Duplicate worker | ✘ → Governance |

### Governance — allowed content

**Before assessment completes** (snapshot exists, assess pending): Assessment status + **awaiting assessment count only**. No correlation, readiness breakdown, findings counts, or remediation.

**After assessment completes** (findings tied to snapshot): full sections below.

| Element | After assessment? |
|---------|-------------------|
| Assessment status | ✔ always |
| Awaiting assessment (count from snapshot) | ✔ before assess |
| Workforce resolution / correlation tiles | ✔ after assess only |
| Missing supplier / duplicate / unlinked | ✔ after assess only |
| Assessment findings (drift) | ✔ after assess only |
| Operational actions (assign, resolve) | ✔ after assess only |
| Operational workforce (ready / blocked / etc.) | ✔ after assess only |
| Connector operational risk (stale / failed runs) | ✔ after assess only |

---

## 2b. Metric ownership (lifecycle)

Each metric has **one owning stage**. UI must not show a metric before that stage completes. See [`EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md`](./EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md) for connector vs EWP roles.

| Metric | Discovery | Assessment | Readiness | Resolution | Operational |
|--------|:---------:|:----------:|:---------:|:----------:|:-----------:|
| Workers discovered / awaiting assessment | ✓ | | | | |
| High / low confidence correlation | | ✓ | | | |
| Unlinked workers | | ✓ | ✓ | | |
| Duplicate worker | | ✓ | ✓ | | |
| Missing supplier link | | ✓ | ✓ | ✓ (task) | |
| No Responsible Manager assigned | | ✓ | ✓ | ✓ (task) | |
| Manual review required | | ✓ | ✓ | ✓ | |
| Assessment findings (drift registry) | | ✓ | | | |
| Operationally ready / blocked / restricted / exited | | | ✓ | | ✓ |

**Governance tab layout (post-assessment):**

| Section | Question | Metrics |
|---------|----------|---------|
| Assessment findings | What did assessment discover? | Drift registry tied to snapshot |
| Workforce readiness | Why can't the worker be trusted? | Missing supplier, no Responsible Manager, duplicate, unlinked, manual review |
| Resolution | What tasks close readiness gaps? | Active resolution tasks |
| Operational workforce | What lifecycle state are they in? | Operationally ready, blocked, restricted, suspended/inactive, exited |

Order: **Assessment status → Findings → Readiness → Resolution → Operational workforce**.

**Snapshot History tab** answers one question: *What workforce evidence snapshots did we acquire?* Centre on `DISC-*` snapshots — not connector duration cards. Connector execution metrics belong in collapsible technical details or Administration → Connectors.

**Presenter script (Workforce Discovery → Governance):**

| Step | Screen | Say |
|------|--------|-----|
| 1 | Overview → **Discover workforce** | *Oracle gives us workforce facts; we capture an immutable snapshot.* |
| 2 | Governance (before assess) | *Nothing is trusted yet — only how many records await assessment.* |
| 3 | **Assess workforce** | *Now EWP evaluates that snapshot for operational trust.* |
| 4 | Workforce readiness | *These numbers explain why workers are not trusted yet.* |
| 5 | Operational workforce | *These numbers show governed lifecycle state — not the reasons.* |
| 6 | Resolution | *These are the tasks that close readiness gaps.* |
| 7 | Assessment findings *(optional)* | *Registered gaps tied to the snapshot — evidence for resolution.* |

Skip **Connector operational risk** for executive audiences.

**API rule:** Dashboard and telemetry endpoints return zero assessment/correlation/governance/drift/remediation/operational-workforce telemetry until `lifecyclePhase === ASSESSMENT_CURRENT`. Connector sync telemetry and health remain available after discovery.

**UI rule:** On Governance tab, if `lifecyclePhase === ASSESSMENT_PENDING`, render only Assessment status and a single **Awaiting assessment** tile (`latestDiscoveryRun.importedCount`). Hide all assessment-derived tiles until `ASSESSMENT_CURRENT`.

**Stages inside EWP assess (conceptual — today partially fused in backend):**

| Sub-activity | Produces |
|--------------|----------|
| Correlation | High/low confidence, unlinked, duplicate, conflicts |
| Readiness summary | Operationally ready, blocked, missing supplier, no Responsible Manager |
| Findings (drift) | Registry rows tied to snapshot |
| Resolution | Operational actions, remediation tasks |

**Backend rule:** `GET /contractor-sources/oracle-hcm/dashboard` and `/telemetry` zero correlation, governance, operational workforce, drift summary, and remediation summary until `lifecyclePhase === ASSESSMENT_CURRENT`. Connector sync telemetry and health remain available after discovery. Correlation may still compute internally on ingest; assessment gates what the API exposes.

---

## 2. Page purpose

Language must respect **product boundaries**, not just read well in the UI.

### Rule: EWP governs workers — not identities

> EWP governs workers, suppliers, internal accountability (Responsible Manager), contracts, and engagements.
>
> It does **not** govern identities.

Avoid terminology that belongs to **Identity Governance (IGA)** unless EWP is explicitly consuming identity information from an IGA platform.

| Domain | Belongs to | EWP examples |
|--------|------------|--------------|
| **Identity** | IGA / IAM | AD user, SAP user, email correlation, identity stitching |
| **Worker** | EWP | External worker, supplier placement, Responsible Manager, contract, engagement |
| **Employment** | HCM | Person, employment record, position, organization |

**Do not use:** Identity resolution, identity linking, identity correlation (in workforce governance UI).

**Use instead:** Workforce resolution, worker linking *(with subtitle)*, operational resolution.

### Rule: Supplier master ≠ EWP supplier governance

Oracle Procurement / Supplier Portal remains supplier master. EWP synchronizes metadata and governs participation. (Same discipline as Supplier Synchronization.)

### Three kinds of "linking" (do not collapse)

**Identity linking (IGA)**

```text
Oracle HCM Person → Azure AD User → SAP User → Email
```

Purpose: one human, many identities.

**Workforce linking (EWP)**

```text
Imported worker → Supplier → Responsible Manager → Contract → Engagement
```

Purpose: one worker, operational context.

**Employment linking (HCM)**

```text
Person → Employment record → Position → Organization
```

Purpose: employment relationship.

The Governance tab **Workforce Resolution** section addresses workforce linking only.

---

## 3. Internal accountability (Responsible Manager)

**Canonical model:** [Internal Accountability](./INTERNAL_ACCOUNTABILITY_MODEL.md) — who inside the organization is accountable for this external worker.

**Default operator label (MTN demo):** **Responsible Manager**

### Legacy implementation (renamed July 2026)

Schema, APIs, drift enums, and IGA events now use **responsible manager** identifiers (`responsibleManagerEmployeeId`, `MISSING_RESPONSIBLE_MANAGER`, etc.). See [`INTERNAL_ACCOUNTABILITY_MODEL.md`](./INTERNAL_ACCOUNTABILITY_MODEL.md).

| Context | Use | Do not use |
|---------|-----|------------|
| Assessment finding (count tile) | **No Responsible Manager assigned** | Unsponsored, Missing sponsor |
| Inline worker detail | **Responsible Manager not assigned** | Not assigned (alone), Sponsor |
| Resolution task | **Assign a Responsible Manager** | Assign sponsor |
| Drift registry row | **No Responsible Manager assigned** | Unsponsored external worker |

**Why not "Sponsor" in UI?** Executive sponsor, budget sponsor, project sponsor, and business sponsor mean different things in different organizations. **Responsible Manager** answers one governance question without assuming an HR model.

**Tenant configurability (future):** Display label may be configured per customer (Line Manager, Engagement Manager, Supervisor, Sponsor) without changing Internal Accountability in the platform model.

**Optional inbox feature:** The legacy `sponsor@` demo inbox and `Sponsor Accountability` nav remain separate — reference-only HCM employee scope, not the operator-facing assessment label.

---

## 4. Vocabulary

Each term maps to **one** lifecycle stage. If two stages need the same word, the vocabulary is wrong.

| Term | Stage | Meaning |
|------|-------|---------|
| **Discovery** | Discover | Oracle HCM knows this worker exists; EWP has received or upserted staging evidence |
| **Discovery run** | Discover | One connector execution (sync/import) with ledger counts |
| **Workers discovered** | Discover | Staging records processed in a run — not registry headcount |
| **Assessment** | Assess | EWP evaluated the worker (linking, completeness, policy checks) |
| **Awaiting assessment** | Assess | Discovered but not yet fully evaluated for operational trust |
| **Assessment findings** | Assess / Govern | Structured outcomes of assessment (was: governance signal) |
| **Governance** | Govern | A decision is required — missing supplier, duplicate, no Responsible Manager, policy restriction |
| **Workforce resolution** | Govern / Assess | Imported worker not yet linked to operational context (supplier, Responsible Manager, duplicate review) |
| **Unlinked workers** | Govern | Discovered records awaiting workforce resolution |
| **Operational** | Operationalize | Worker can participate operationally in EWP |
| **Operationally ready** | Operationalize | Trusted for operational participation (was: active imported) |
| **Operational actions** | Govern / Operationalize | Assess, assign Responsible Manager, resolve drift — human remediation |
| **Cutover** | Cutover | Oracle HCM is no longer operational authority; EWP owns lifecycle |

### Deprecated interchangeability (do not mix)

These words describe **different** concepts. Never use them as synonyms in UI copy.

| Word | Actually means | Common misuse |
|------|----------------|---------------|
| Imported | Discovered into staging | "Imported = operational" |
| Active | Registry/workforce state | "Active = discovered" |
| Pending verification | Assessment incomplete | Shown on Overview |
| Linked | Workforce context resolved | Same as "governed" or "identity resolved" |
| Reviewed | Ops decision taken | Same as "assessed" |
| Governed | Trust + policy satisfied | Same as "discovered" |

---

## 5. Proposed label mapping (when we rename)

Apply only after page-purpose checks pass. Prefer plain language over jargon.

| Current (UI / demo) | Proposed | Stage |
|---------------------|----------|-------|
| Workforce Import | Workforce Discovery | Discover |
| Import Workforce / Sync | Discover workforce | Discover |
| Import History | Discovery History | Discover |
| Governance snapshot | Workforce readiness | Assess |
| Pending verification | Awaiting assessment | Assess |
| Active (imported) | Operationally ready | Operationalize |
| Worker linking required | Unlinked workers / Workforce resolution | Govern |
| Worker Linking (section) | Workforce Resolution | Govern |
| Identity resolution | ❌ Avoid — IGA terminology | — |
| Governance signal | Assessment findings | Assess / Govern |
| Governance actions | Operational actions | Govern |
| Workforce governance scan | ❌ Avoid — use **Assess workforce** | Assess |

**Nav / capability names** stay aligned with [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./business/EXTERNAL_WORKFORCE_VOCABULARY.md) until an ADR explicitly changes them.

---

## 6. Label change checklist

Before merging any UI string change:

1. **Which lifecycle stage** does this label belong to?
2. **Which page question** does it help answer?
3. **Is the same concept** already named differently on another tab? (If yes, fix placement first.)
4. **Does it collide** with frozen product vocabulary (External Worker, capability names) **or IGA terminology (identity, correlation, stitching)?**
5. **Would an MTN ops lead** say this phrase in a meeting without explanation?

If any answer is unclear, do not rename — move the metric or clarify the process first.

---

## 7. Demo and reset (operational)

Discovery demos start from an **empty greenfield registry** (default MTN path):

```bash
npm run docker:reset:connector-demo
```

First discovery: **Records discovered 10 · Matched 0 · New/unmatched 10**.

Migration / duplicate / conflict lineage UAT (hidden comparison anchors — **not** the MTN sales default):

```bash
npm run docker:reset:connector-demo:migration
# SEED_HCM_COMPARISON_ANCHORS=true npm run reset:connector-demo
```

Then run the lifecycle in order: **Discover → Assess/Govern → Operationalize → Cutover**. Supplier nomination is a separate track (Supplier Synchronization); do not conflate HCM discovery metrics with supplier portal setup.

See [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md) and [`CONNECTOR_DEMO_UAT.md`](./CONNECTOR_DEMO_UAT.md).

---

## 8. Success criterion

MTN operations adopts the model when people say:

- "Workers **awaiting assessment**"
- "**Operationally ready** workers"

—not "imported" and "active" as if they meant the same thing.

That adoption is evidence the language matches the process, not that the UI was polished.

---

## 9. UI audit (implemented)

Audit date: July 2026. Source: `frontend/components/contractor-sources/workforce-import/*`.

### Overview — *Did discovery succeed?*

| Element | Verdict | Action |
|---------|---------|--------|
| Connector health | ✔ | Kept |
| Discover workforce action | ✔ | Renamed from Import Workforce; scan removed from Overview |
| Latest discovery run | ✔ | Renamed from Latest import; removed Pending review |
| Workers discovered / Failed | ✔ | Renamed from Imported / Failed |
| Governance snapshot tiles | ✘ | **Removed** from Overview |
| Pending verification | ✘ | Moved to Governance → Workforce readiness |
| Unsponsored workers | ✘ | Moved to Governance → **No Responsible Manager assigned** |
| Missing supplier links | ✘ | Moved to Governance |
| Worker linking required | ✘ | Moved to Governance → Unlinked workers |
| Duplicate worker | ✘ | Added to Governance readiness (correlation conflicts) |

### Discovery History — *What happened each run?*

| Element | Verdict | Action |
|---------|---------|--------|
| Discovery ledger / statistics | ✔ | Renamed from import/sync language |
| Recent discovery runs table | ✔ | Renamed columns; resolution failures (not identity) |

### Governance — *Why not operationally trusted?*

| Element | Verdict | Action |
|---------|---------|--------|
| Workforce readiness (top tiles) | ✔ | **Added** — absorbs Overview snapshot |
| Workforce Resolution section | ✔ | Renamed from Worker Linking; subtitle clarifies EWP vs IGA |
| Operational workforce counts | ✔ | Active (imported) → Operationally ready |
| Assessment findings (drift) | ✔ | Renamed from governance scan section title |
| Operational actions | ✔ | Renamed from Governance actions |
| Operational risk | ✔ | Kept; failed sync → failed discovery runs |
| Assess workforce | ✔ | Governance tab only; conditional on new snapshot |

### Cutover — *Authority moved to EWP?*

| Element | Verdict | Action |
|---------|---------|--------|
| Cutover panel / lineage toggle | ✔ | Unchanged |
| Historical evidence copy | ✔ | Points to Discovery History |

### Nav / page title

| Current (was) | Now |
|---------------|-----|
| Workforce Import | Workforce Discovery |
| Import History tab | Discovery History |
