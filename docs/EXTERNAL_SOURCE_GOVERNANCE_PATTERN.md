# External Source Governance Pattern

**Also referred to as:** Connector Governance Pattern  
**Status:** Draft — evidence from two production connectors; not a universal architecture mandate  
**Audience:** Product, solution architecture, demo authors, engineering

**Related:**

- [`WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md`](./WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md) — workforce-specific vocabulary and UI rules (Oracle HCM)
- [`SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md`](./SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md) — supplier-specific vocabulary and UI rules (Oracle Procurement / Supplier Portal)
- [`CONNECTOR_GOVERNANCE_PLATFORM.md`](./CONNECTOR_GOVERNANCE_PLATFORM.md) — technical reference (APIs, drift, remediation, PDP)
- [`frontend/lib/external-workforce-labels.ts`](../frontend/lib/external-workforce-labels.ts) / [`frontend/lib/supplier-synchronization-labels.ts`](../frontend/lib/supplier-synchronization-labels.ts) — operator-facing labels

---

## Why this pattern exists

> **Operational governance decisions in EWP are always traceable to an immutable evidence snapshot acquired from an authoritative source.**

That single principle explains:

- why snapshots exist
- why assessments are tied to snapshots
- why reassessment is blocked until new evidence exists
- why governance findings reference a snapshot ID (`DISC-…`, `SYNC-…`)
- why cutover does not delete historical evidence

---

## What we claim (and do not)

Every external authoritative source integrated into EWP can follow the **same governance discipline after evidence acquisition** — where we have implemented it.

This document describes that discipline — not every possible future integration. We have **demonstrated** the pattern twice (Oracle HCM, Oracle Procurement). We **evaluate** additional sources against it rather than forcing them into it before evidence exists.

If a third source needs an extra stage (for example **Normalize** between snapshot and assess), that is a learning — not a broken architecture.

**Internally:** treat this as a proven governance pattern (and, where useful, a platform design reference).  
**Externally:** do **not** call it a “platform capability.” Say:

> **This is the governance pattern EWP uses when integrating authoritative business systems.**

“Governance pattern” reads as a repeatable operational method. “Platform capability” reads as unfinished architecture.

---

## Three layers (separation of concerns)

```text
Business layer
────────────────────────────
Oracle HCM              → employment / workforce records
Oracle Procurement      → supplier master
Future authoritative sources

            │

Connector layer (adapter)
────────────────────────────
Acquire evidence
Create immutable snapshot
(Discover · Synchronize · Capture)

            │

EWP governance layer
────────────────────────────
Assess
Govern
Operationalize
Cutover (optional)
```

The connector is an **adapter**. EWP is the **operational governance platform**. Those are different responsibilities — do not collapse them in copy, diagrams, or demos.

### Upstream ownership (unchanged design decisions)

**Oracle HCM** owns employment. **EWP** owns operational readiness and operational lifecycle for external workers after evidence is acquired.

```text
Oracle HCM     →  employment truth
EWP            →  operational readiness → operational lifecycle
```

**Supplier Portal / Oracle Procurement** owns supplier master. **EWP** owns supplier **participation** in the external workforce programme — not duplicate supplier mastery.

```text
Supplier Portal  →  supplier master
EWP              →  supplier participation / operational trust
```

Nothing in this pattern weakens those boundaries.

---

## Lifecycle

```text
Connector acquires evidence
          ↓
Connector creates immutable snapshot
          ↓
EWP assesses the snapshot
          ↓
EWP governs findings
          ↓
EWP operationalizes trusted records
          ↓
(Optional)
Operational cutover
```

| Stage | Who acts | Operator-facing question |
|-------|----------|---------------------------|
| **Acquire evidence** | Connector | Did we successfully pull from the upstream system? |
| **Snapshot** | Connector | Which run produced this evidence? (immutable reference) |
| **Assess** | EWP | Has EWP evaluated this snapshot for operational trust? |
| **Govern** | EWP | What decisions or remediations are required before trust? |
| **Operationalize** | EWP | Which records can participate in EWP operations? |
| **Cutover** *(optional)* | EWP | Has operational authority moved off the upstream system? |

**Govern** is the umbrella stage for operational decisions (approval, sponsor assignment, policy restrictions, drift resolution). Do not split it prematurely into sub-brands in platform narrative.

---

## What this document deliberately avoids

1. **Doctrine on sight** — Discovering a pattern and immediately declaring it universal. We document what is **proven**, then extend.
2. **Connector / EWP conflation** — Acquisition and snapshot creation belong to the connector; assessment, governance, and operationalization belong to EWP.
3. **Premature “Govern” fragmentation** — Assessment findings and human remediation are part of **Govern**, not separate product stories unless the UI needs a distinct tab.

---

## Evidence today (two enterprise sources)

| Source | Connector (evidence + snapshot) | Snapshot ref | EWP (assess) |
|--------|----------------------------------|--------------|--------------|
| **Oracle HCM** | Discover workforce | `DISC-00015` | Assess workforce |
| **Oracle Procurement** | Synchronize suppliers | `SYNC-00015` | Assess suppliers |

**Control rule (both):** EWP assesses a snapshot once. Repeat assessment is blocked until a **new** snapshot exists — there is nothing new to evaluate.

Implementation tracks last-assessed snapshot on the organization (`workforceLastAssessedDiscoveryRunId`, `supplierLastAssessedSyncRunId`). Assessment is not a free-floating “scan” button.

---

## Room for falsification (how the pattern evolves)

A future connector might require:

```text
Acquire → Snapshot → Normalize → Assess
```

instead of:

```text
Acquire → Snapshot → Assess
```

That does not invalidate what HCM and Procurement proved. It refines the pattern for that source. Mature disciplines evolve by **learning**, not by retroactive doctrine.

When evaluating a new source, ask whether the gap is a **missing stage** or a **different discipline entirely**. Document the outcome either way.

---

## MTN / enterprise narrative (recommended)

**Architectural position (stronger than “we integrate Oracle”):**

> EWP operationalizes authoritative business data **without becoming its master.**

For MTN, that translates concretely:

- **Oracle HCM** continues to manage workforce / employment records.
- **Oracle Procurement** continues to manage supplier records.
- **EWP** creates **governed operational views** of those records for contractor and supplier participation in the external workforce programme.

Enterprises are protective of systems of record. EWP respects upstream mastery; it adds operational governance on top of evidence, not replacement.

**Consistency (without overclaiming):**

> We've implemented the same governance discipline across two very different enterprise sources — Oracle HCM and Oracle Procurement. That consistency is deliberate. As we onboard additional authoritative sources, we will evaluate whether they fit the same discipline rather than forcing them into it.

**Demo lines:**

- *Workforce:* EWP does not blindly activate imported workers. It discovers workforce evidence from HCM, assesses that discovery snapshot, and only then exposes governance findings for operational resolution.
- *Suppliers:* EWP does not blindly trust synced metadata. It synchronizes supplier evidence from Procurement, assesses that sync snapshot, and only then exposes reconciliation findings for operational resolution.

---

## When to elevate confidence

| Stage | What you can say |
|-------|------------------|
| **Today (two connectors)** | Proven **governance pattern** for authoritative integrations |
| **After more independent proofs** | Candidate for a broader **platform principle** — earned, not assumed |

Do not skip the proof step.

---

## Connector vs EWP (language)

| Say | Do not say |
|-----|------------|
| Connector acquired evidence / created snapshot | EWP acquired evidence *(when meaning connector ingest)* |
| EWP assesses the snapshot | Connector ran governance scan |
| Findings based on snapshot `DISC-…` / `SYNC-…` | Findings with no snapshot context |
| Govern operational trust | Replace upstream master |
| Governance pattern for authoritative integrations | Platform capability *(external audiences)* |

See [`CONNECTOR_GOVERNANCE_PLATFORM.md`](./CONNECTOR_GOVERNANCE_PLATFORM.md) for supplier vs contractor authority asymmetry and technical detail.

---

## When to apply this pattern to a new source

Before adopting the pattern for another connector, answer:

1. Is there a clear **evidence acquisition** event that can produce an immutable **snapshot**?
2. Can EWP **assess** that snapshot independently of acquisition?
3. Are **governance findings** tied to the assessed snapshot for auditability?
4. Is repeat assessment **blocked** when the snapshot is unchanged?

If any answer is no, document the exception — do not stretch vocabulary to fit.

---

## Label checklist (cross-connector)

1. Which lifecycle stage does this string belong to?
2. Is the actor **connector** or **EWP**?
3. Does UI cite the snapshot when showing findings?
4. Is assessment conditional on a new snapshot?
5. Would an ops lead say this phrase without explanation?

If unclear, fix process or placement before renaming UI copy.
