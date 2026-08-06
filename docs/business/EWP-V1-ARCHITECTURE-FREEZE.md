# External Workforce Platform — v1 Architecture Freeze

**Status:** **CLOSED FOR V1** (May 2026) · **Architecture programme closed** — governing engineering, not discovering structure
**Source of truth:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — **start every question here**

> Architecture **governs** engineering now. Every feature review starts with business truth — not workshops or restructuring.
> **Stop the architecture programme.** Apply CAPs, PRs, and CERTs. See [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) § Architecture programme — closed.

---

## Operational mode

Discovery is complete. EWP is in **governance mode** (Era 3 — empirical validation):

| Question | Where to look |
|----------|----------------|
| **Which business truth is affected?** | [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) — entry point |
| Where does this belong? | Capability Map → capability tree |
| What must remain true? | `CAP-*` for that capability |
| What changed in code? | PR citing CAP § |
| Did we prove conformance? | `CERT-*` |
| What do we call it? | [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md) |

**Six-month rule:**

> **No new governance document unless an existing artifact in the Capability Map cannot answer the question.**

---

## Four frozen architectures

These layers now reinforce each other. They **SHALL NOT** be re-opened for v1 without an ADR.

### 0. Architectural responsibilities ✅

**Business truth** is the invariant; three **responsibilities** describe the relationship to that truth. Frozen in [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md). CERT strategies belong to responsibilities, not individual CAPs. **Not yet extracted to HEM** — await second-product validation.

### 1. Capability architecture ✅

Top-level capabilities are **stable**:

```text
Overview
Supplier Administration
Workforce Administration
Engagement Administration
Governance
Administration
```

**Gate for any new top-level nav item:**

> Which existing capability cannot own this?

If the proposal cannot answer that, it belongs under an existing capability.

---

### 2. Information architecture ✅

Navigation **SHALL reflect the Capability Map**.

- Do not reorganize the sidebar for shortcuts or feature growth.
- Do not add a top-level section without a capability architecture decision.
- Change navigation only when the capability map changes.

See [`PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md`](./PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md).

**Design test (every new feature):**

> Could an operator predict where this feature lives before searching for it?

Example: *Suspend an external worker* → **Workforce Administration** (not Governance, Engagement, or Supplier).

If the answer is yes, the IA is working.

---

### 3. Vocabulary ✅

| Business | Architecture | Implementation |
|----------|--------------|----------------|
| External Worker | Workforce Administration | `Contractor` |
| External Workforce | External Workforce Platform | `ContractorService` |

See [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md). Changes require ADR.

---

### 4. Capability specification structure ✅

```text
ADR
 ↓
CAP
 ↓
PR
 ↓
CERT
```

**Do not change this chain. Apply it.**

See [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md).

Governance order:

> **CAP changes before capability behaviour changes. Capability changes before navigation changes.**

---

## Overview page — capability health

The platform landing (`/dashboard`, label **Overview**) is a **capability health page** — not a widget dashboard.

It answers:

> **Which business capability needs attention?**

Each visible capability section shows **Healthy** or **Attention** based on actionable backlog (pending approvals, workers under review, expiring contracts, open exceptions, etc.).

Implementation: [`frontend/components/dashboard/CapabilityOverview.tsx`](../../frontend/components/dashboard/CapabilityOverview.tsx).

---

## Where design energy goes now

**Stop investing in horizontal consistency** — it is there.

**Invest in vertical depth** — one capability at a time:

```text
CAP
 ↓
Overview (capability health)
 ↓
Primary objects (Suppliers, External Workers, Engagements, …)
 ↓
Workflows (Approvals, Review, Sync, …)
 ↓
Metrics & certification evidence
```

Deepen **Supplier Administration**, then **Workforce Administration**, then **Engagement Administration**. Do not widen the platform.

**Deferred (not v1):** capability landing pages (click a capability heading → hub of its pages).

---

## v1 closure criteria

Architecture is **closed** when:

- Product identity, vocabulary, capability map, navigation, CAP/PR/CERT chain, and implementation evidence express the **same model**.
- New work cites an existing CAP and slots under an existing capability without nav churn.
- Every new capability **instantiates** Authoritative, Gateway, or Cross-cutting responsibility — not a fourth architectural kind without discovery.

**Responsibility model (May 2026):** Authoritative and Gateway are **empirically validated**. Cross-cutting is **predicted** with a defined proof sequence — see [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md). Do not claim the compositional model is complete until Cross-cutting survives falsification.

If, six months from now, new features absorb without forcing capability map or navigation changes, the architecture has achieved its purpose: **a stable operational model that allows the product to grow.**

---

## Related

| Doc | Frozen asset |
|-----|----------------|
| [`EWP_ARCHITECTURE.md`](./EWP_ARCHITECTURE.md) | Business architecture overview |
| [`EWP_TECHNICAL_ARCHITECTURE.md`](./EWP_TECHNICAL_ARCHITECTURE.md) | Technical architecture (runtime, layers, data, integrations) |
| [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) | Responsibility model + discovery sequence |
| [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) | Capability architecture |
| [`PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md`](./PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md) | Information architecture |
| [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md) | Vocabulary |
| [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) | HEM / ADR→CAP→PR→CERT |
| [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) | Reference CAP (normative) |
