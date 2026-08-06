# ADR-013: External Worker Acquisition Model

## Status

**APPROVED** — May 2026

**Depends on:** [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md) (supplier-backed Phase 1 complete; Phase 2 deferred here) · [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md) · [`CAP-IDENTITY-ACQUISITION.md`](./capabilities/CAP-IDENTITY-ACQUISITION.md) **v1.0** (normative acquisition policies)
**Supersedes deferral in:** [`DOMAIN_MODEL_RECOVERY_V1.md`](./DOMAIN_MODEL_RECOVERY_V1.md) §5
**Capability map:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — Foundational backbone; next increment after four CAPs

> **This ADR decides *who is authoritative for bringing an External Worker into EWP* — not *what kind of worker they are*, and not *which intake channel was used*.**

---

## Business concept vs implementation (escape hatch)

**Acquisition Authority** is the business concept that identifies **who is authoritative** for establishing an External Worker within EWP.

| Layer | Name (v1) | Meaning |
|-------|-----------|---------|
| **Business concept** | **Acquisition Authority** | Who may establish this worker? (Supplier organisation · Enterprise · future Partner, …) |
| **Implementation** | `AcquisitionModel` enum + `Contractor.acquisitionModel` | Current persistence of acquisition authority |
| **Not this concept** | Worker Classification, Engagement Model, intake channel | Separate dimensions — see below |

The ADR title and enum name say *Acquisition Model* for historical continuity with ADR-011 Phase 2 deferral. In business architecture, read **`SUPPLIER` / `INDEPENDENT` as acquisition authorities**, not as channels or worker types.

**Evolution (normative intent):** Future capability versions **MAY** rename the implementation field (e.g. `acquisitionAuthority`) to reflect this semantic meaning **without changing the business contract**, provided CAP + ADR revision documents the mapping. New intake channels (Workday, SAP Fieldglass, CSV, API) **SHALL NOT** become new enum values — they are **channels**, not authorities.

Same discipline as [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md): **External Worker** (business) · **`Contractor`** (implementation).

---

## Context

EWP now has four ratified foundational CAPs. **Identity Acquisition** is a **transitional (gateway)** capability: it establishes the canonical External Worker and publishes downstream; it does **not** own an enduring business relationship.

Phase 1 workforce delivery (ADR-011) implemented **supplier-backed intake only**:

- `POST /contractors/nominate` requires `supplierId`
- Supplier Portal nominate uses the same path
- HCM bootstrap promotes workers with supplier correlation where available
- Schema: `Contractor.supplierId` is **required** (non-null)

The platform already behaves as if **not every External Worker shares the same acquisition authority** — but the authority model is implicit, spread across nominate guards, bootstrap correlation, and `WorkerClassification` values such as `INDEPENDENT_CONTRACTOR`.

That conflation is risky:

| Confused question | Correct owner |
|-------------------|---------------|
| Who may bring this worker into EWP? | **Acquisition Authority** (this ADR; `AcquisitionModel` in code) |
| What commercial/worker type label applies? | `WorkerClassification` / taxonomy |
| Is the worker nominated, active, terminated? | Workforce Administration |
| Where are they placed? | Engagement Administration |

**CAP-IDENTITY-ACQUISITION §7 P-01, P-02** require exactly one acquisition channel per episode and declared channel-to-authority mapping. This ADR names the **authority dimension** those policies reference.

### Three dimensions — do not collapse

Identity Acquisition involves three separate concerns. They **SHALL NOT** be merged into one enum or one field.

| Dimension | Question | Examples (illustrative) | Owner |
|-----------|----------|-------------------------|-------|
| **1. Acquisition Authority** | Who has the right to establish this worker? | Supplier · Enterprise · Partner *(future)* | Persisted at canonical creation (`AcquisitionModel` today) |
| **2. Acquisition Channel** | How did they enter? | Supplier Portal · Oracle HCM · CSV · API · Workday *(future)* | Identity Acquisition intake metadata |
| **3. Processing Pipeline** | What processing stages completed? | Discovered → Validated → Correlated → Canonical → Published | Staging / batch pipeline — not workforce lifecycle |

```text
Workday, SAP Fieldglass, Beeline, VMS  →  channels  (not enum values)

Partner, Internal transfer             →  authorities (future enum values — not channels)

Extracted → Promoted → Published       →  pipeline    (not business relationship state)
```

Adding Workday **SHALL** mean a new channel under existing authority rules — not `AcquisitionModel = WORKDAY`.

---

## Decision

### 1. Introduce `AcquisitionModel` as acquisition authority (implementation)

EWP **SHALL** persist explicit **Acquisition Authority** on every External Worker (`Contractor` aggregate) at canonical creation time — implemented as `Contractor.acquisitionModel`.

**Acquisition Authority** answers:

> **Who is authoritative for bringing this External Worker into the External Workforce Platform?**

It **SHALL NOT** answer:

- Worker type (consultant, temporary worker, etc.) — `WorkerClassification`
- Intake channel (HCM, portal, CSV, Workday) — acquisition channel metadata
- Workforce state (nominated, active, …) — Workforce Administration
- Engagement commercial model alone — `EngagementModel`
- IGA or access posture — Access Integration

### 2. Acquisition Authority ≠ Worker Classification

| Dimension | Purpose | Examples |
|-----------|---------|----------|
| **Acquisition Authority** (`AcquisitionModel`) | Who may establish the worker in EWP | `SUPPLIER`, `INDEPENDENT` |
| **Worker Classification** | Taxonomy / reporting / policy inputs | `SUPPLIER_CONTRACTOR`, `INDEPENDENT_CONTRACTOR`, `CONSULTANT`, … |
| **Engagement Model** | Commercial engagement shape | `DIRECT`, `AGENCY` |

An External Worker **MAY** have acquisition authority `SUPPLIER` and `workerClassification = CONSULTANT`.
An External Worker **MAY** have acquisition authority `INDEPENDENT` and `workerClassification = INDEPENDENT_CONTRACTOR`.

Implementation **SHALL NOT** infer acquisition authority from `WorkerClassification` alone.
Implementation **SHALL NOT** overload `EngagementModel` as acquisition authority.
Implementation **SHALL NOT** encode intake channels as `AcquisitionModel` values.

### 3. Capability Version 1 — acquisition authorities

| `AcquisitionModel` | Acquisition Authority | `supplierId` | Typical acquisition channels |
|--------------------|----------------------|--------------|------------------------------|
| **`SUPPLIER`** | Supplier organisation nominates or supplies the worker | **Required** | Supplier Portal nominate; enterprise ops nominate with supplier; HCM promote with resolved supplier link |
| **`INDEPENDENT`** | Enterprise acquires the worker directly — no supplying organisation | **Null** | Enterprise **Acquire Independent Worker**; HCM/bootstrap row without supplier link *(governance quarantine rules)*; future enterprise API intake |

**Workforce rule (not acquisition):** transition to `ACTIVE` for workers with acquisition authority `INDEPENDENT` **SHALL** require a primary sponsor on engagement substrate — normative in [`CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) §7 **P-12**. Identity Acquisition **SHALL** be complete at publish; sponsor gating **SHALL NOT** extend acquisition responsibility.

### 4. Future acquisition authorities (reserved — not v1 schema)

The enum **MAY** be extended with **authority** values only — not channels:

| Reserved value | Intended acquisition authority (illustrative) |
|----------------|-----------------------------------------------|
| `PARTNER` | Partner organisation establishes the worker |
| `INTERNAL_TRANSFER` | Enterprise internal mobility into external workforce register |
| `MERGER_IMPORT` | M&A bulk acquisition episode |
| `LEGACY_MIGRATION` | One-time historical load with reduced channel fidelity |

New values **SHALL** be added only via ADR revision + CAP impact assessment — not ad hoc product flags. Workday, Fieldglass, Beeline, VMS **SHALL** remain channels under one of these authorities.

### 5. Channel ↔ authority mapping (Identity Acquisition)

Every acquisition channel **SHALL** declare compatible acquisition authority at intake (CAP-IDENTITY-ACQUISITION §7 **P-02**).

| Channel (v1 / near-term) | Permitted acquisition authority | Notes |
|--------------------------|-----------------------------------|-------|
| Supplier Portal nominate | `SUPPLIER` only | Channel gate; workforce/engagement delegated per CAP §10.3 |
| `POST /contractors/nominate` | `SUPPLIER` only | Same as portal |
| HCM bootstrap / promote | `SUPPLIER` or `INDEPENDENT` | Derived from supplier correlation — link present → `SUPPLIER`; absent → `INDEPENDENT` |
| **Acquire Independent Worker** | `INDEPENDENT` only | Enterprise direct command — not an extension of nominate |
| CSV / file batch *(planned)* | Declared per batch manifest | Manifest **SHALL** specify authority per row — not channel as authority |

Identity Acquisition **SHALL** reject intake where declared channel conflicts with supplied acquisition authority.

**Publication boundary:** After **Acquire Independent Worker** (or any successful acquire), Identity Acquisition **SHALL** end at publish. Initial workforce state (`NOMINATED`, etc.) **MAY** be recorded in the same transaction via delegation to Workforce Administration — that is workforce intake, not extended acquisition ownership.

### 6. Cross-capability boundaries (unchanged by this ADR)

| Concern | Owner |
|---------|-------|
| Acquisition pipeline stages | Identity Acquisition |
| Acquisition authority + channel mapping | Identity Acquisition *(this ADR)* |
| Workforce state after acquisition | Workforce Administration |
| Sponsor required before `ACTIVE` (independent authority) | Workforce Administration — CAP §7 P-12 |
| Engagement placement + sponsor accountability | Engagement Administration |
| Supplier trust | Supplier Administration |
| Access provision | Access Integration |

Setting `acquisitionModel` **SHALL NOT** activate a worker, assign sponsor accountability, or provision access.

### 7. Schema decision (authorized — implementation PR required)

```text
enum AcquisitionModel {
  SUPPLIER
  INDEPENDENT
}

Contractor.acquisitionModel   AcquisitionModel   @default(SUPPLIER)
Contractor.supplierId         String?            // nullable only when INDEPENDENT
```

**Migration rules:**

1. Backfill existing rows → `acquisitionModel = SUPPLIER` (all current workers are supplier-backed).
2. Keep `supplierId` required until migration PR ships; do not nullable in the same commit as enum add without constraint migration.
3. Add check constraint (application + DB):
   `(acquisitionModel = SUPPLIER AND supplierId IS NOT NULL) OR (acquisitionModel = INDEPENDENT AND supplierId IS NULL)`
   *(exact enforcement in schema PR)*.

**CAP traceability:** Implements CAP-IDENTITY-ACQUISITION §7 **P-01**, **P-02**, §12 invariants 2 and 4.

---

## Consequences

### Positive

- Explicit authority model prevents Identity Acquisition from becoming “generic onboarding”
- Independent contractor path can ship without overloading `WorkerClassification`
- HCM rows without supplier links gain a first-class authority story (`INDEPENDENT`) instead of bootstrap hacks
- Channel rules become testable against CAP policies

### Negative / cost

- Schema migration + API validation across nominate, promote, and future direct-acquire paths
- PDP and governance rules must key off `acquisitionModel` where supplier scope does not apply
- Portal ring-fence logic unchanged for `SUPPLIER`; independent workers require enterprise-only ops surfaces

### Neutral

- Does **not** require a fifth foundational CAP
- Does **not** change workforce state machine (ADR-011)
- Does **not** define MTN approval workflow (Workflow Orchestration — later)

---

## Implementation sequence

| Step | Deliverable | CAP / PR discipline |
|------|-------------|---------------------|
| 1 | **This ADR** | — |
| 2 | Schema: `AcquisitionModel` enum + column; backfill `SUPPLIER` | **PR-IDENTITY-ACQUISITION-MODEL-1 COMPLETE** |
| 3 | Nullable `supplierId` + constraint for `INDEPENDENT` | **PR-IDENTITY-ACQUISITION-MODEL-2 COMPLETE** |
| 4 | Nominate + portal paths: set `acquisitionModel = SUPPLIER` explicitly | **PR-IDENTITY-ACQUISITION-MODEL-1 COMPLETE** |
| 5 | HCM promote: derive model from supplier correlation | **PR-IDENTITY-ACQUISITION-MODEL-1/2 COMPLETE** |
| 6 | Enterprise **Acquire Independent Worker** command + ops UX | **PR-IDENTITY-ACQUISITION-MODEL-2 COMPLETE** (API; UI deferred) |
| 7 | Governance / PDP: independent-path rules | Governance PRs |
| 8 | CERT / e2e: SUPPLIER vs INDEPENDENT intake | CERT-IDENTITY-ACQUISITION when scheduled |

**Do not** implement Step 6 before Steps 2–5 — authority without schema enforcement recreates implicit behaviour.

---

## Relationship to deferred ADR-011 Phase 2

ADR-011 §6 deferred acquisition model to a separate ADR. **This ADR is that decision.** ADR-011 Phase 1 constraints (required `supplierId`) remain in force until Step 3 migration merges.

---

## Approval

| Role | Name | Date |
|------|------|------|
| Product | | |
| Architecture | | May 2026 |

When schema PR merges, update [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md) if present and link PR from CAP-IDENTITY-ACQUISITION §11.

---

## Document control

| Version | Change |
|---------|--------|
| **1.0** | Initial approval — acquisition authority; `AcquisitionModel` implementation — May 2026 |
| **1.0.1** | Clarify business concept (*Acquisition Authority*) vs implementation name; three dimensions; publication boundary; workforce owns P-12 — May 2026 *(documentation refinement, no schema change)* |
