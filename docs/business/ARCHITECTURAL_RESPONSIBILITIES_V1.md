# Architectural Responsibilities v1.0

**Status:** **FROZEN** (May 2026) — changes require ADR  
**Role:** Records the **stable primitives** beneath EWP capabilities: **business truth**, **architectural responsibility**, and the **order in which architecture is discovered**.

> This document **SHALL** remain small. Capability Map, CAPs, and implementation may evolve. These primitives and the discovery sequence should not. **Do not extract to HEM until a second product repeats the same discovery sequence.**

**Review discipline (entry point — protect above all else):**

> If a design discussion cannot identify the business truth being affected, **stop**. The architecture has not yet begun.

**Three questions** (if an engineer can answer these, no architecture meeting is required):

1. **What business truth is changing?**
2. **Who owns that truth?**
3. **What is my capability's relationship to it?** → architectural responsibility

Then proceed to existing CAP → implement → CERT.

Everything else in this document can be **reconstructed** from these questions. If they disappear from engineering culture, no amount of documentation will save the architecture.

This precedes CAP, ADR, implementation, UI, and APIs.

### Programme achievement (May 2026)

The achievement is not the platform or the capability map — it is making architecture **progressively less dependent on the architect**:

```text
Business Truth → Ownership → Responsibility → CAP → Engineer
```

Not: architect designs → engineers consult → architect resolves ambiguity.

### Four discoveries

1. **Business truth** is the invariant — not entities, screens, or services.
2. **Architectural responsibility** is the primitive from which capabilities are derived.
3. **CERT is falsification** — not compliance checking.
4. **Architecture eliminates invalid designs** — it does not invent valid ones. (Exclusion is why discussions converged.)

### What changes now

Foundation documents (`ARCHITECTURAL_RESPONSIBILITIES_V1`, Capability Map, `EWP_ARCHITECTURE`) should change **rarely**. Most commits: `CAP-*`, `PR-*`, `CERT-*`. Frequent revision of foundation docs signals the model has not stabilized; stable foundations + growing implementation signals success.

**Thinking is no longer the bottleneck.** Remaining uncertainty is **empirical** — Workflow and Governance.

---

## Design laws

Two laws generate the responsibility model and every capability:

**Law 1 — Single ownership**

> Every enduring business truth **SHALL** have exactly one authoritative owner.

**Law 2 — Declared relationship**

> Every capability **SHALL** define its relationship to that truth.

| Responsibility | Relationship to truth |
|----------------|----------------------|
| **Authoritative** | **Owns** |
| **Gateway** | **Transfers** (establish, publish, project) |
| **Cross-cutting** | **Consumes** (coordinate around; **SHALL NOT** create or replace) |

Nothing else has appeared in EWP. Laws are about **truths**, not modules.

---

## Primitive: business truth

**Business truth** is the invariant. Responsibility exists because truth exists. Without truth there is nothing to own; without ownership there is no responsibility; without responsibility there is no capability.

```text
Meaning → Truth → Ownership → Responsibility → Capability → Code
```

EWP evolved **semantics-first** — the opposite of service → API → module → documentation. Early confusion (Supplier or Contractor? CMS or HCM?) was symptomatic. Once discussions became *"What truth is being changed?"*, downstream steps became mechanical.

### Reversal of the burden of design

Architecture no longer asks *"How should we structure the system?"* It asks:

> **Given the business truth, what structures are impossible?**

The discovery sequence is deterministic because each step **eliminates possibilities** — it is **progressively constraining**, not additive:

| Step | Eliminates |
|------|------------|
| **Business truth** | Unrelated business concerns |
| **Single owner** | Competing authorities |
| **Architectural responsibility** | Invalid relationships to truth |
| **Capability** | Alternative placements |
| **CAP** | Implementation ambiguity |
| **CERT** | Architectural drift |

Discussions shortened because the architecture left **fewer valid choices**, not because it produced more answers.

---

## Discovery sequence (deterministic)

Implementation varies. **Discovery** does not. Every EWP capability followed the same path — including before it was named:

```text
1. Identify business truth
2. Identify its single owner
3. Determine architectural responsibility
4. Name the capability
5. Write the CAP
6. Implement
```

There is no brainstorm architecture, module decomposition, or "what feels right?" — only derivation.

**Operational question** (steps 1–6):

> **What truth is being changed?**

### Falsification (deliberately separate)

Falsification sits **outside** discovery — not inside it:

```text
Discover → Specify → Implement → Attempt to prove yourself wrong
```

If falsification were part of discovery, architecture would be constantly redesigned. Placed after implementation, the architecture earns confidence only by **surviving reality**. Then repeat from step 1 when a new truth appears.

---

## Deepest stable model

A capability answers **two independent questions**:

1. **What business truth is this about?**
2. **What relationship does this capability have with that truth?** → **Architectural Responsibility**

```text
Business Truth
        ↓
Business Area                    ← human organisation of truths
        ↓
Architectural Responsibility     ← relationship to truth
        ↓
Capability                       ← business concept
        ↓
Capability Contract (CAP)        ← specification
        ↓
Responsibility-specific CERT
        ↓
Implementation
```

**Truth is the invariant.** Area and capability name are labels. Responsibility is the relationship.

### EWP instantiation (examples)

| Business truth | Business area | Responsibility | Capability |
|----------------|---------------|----------------|------------|
| Supplier trust | Supplier | Authoritative | Supplier Administration |
| Workforce relationship | Workforce | Authoritative | Workforce Administration |
| Commercial placement | Engagement | Authoritative | Engagement Administration |
| Identity publication | Identity | Gateway | Identity Acquisition |
| Access intent | Access | Gateway | Access Integration |
| Operational projections | Reporting | Gateway | Reporting & Projections |
| Process coordination | Workflow | Cross-cutting | Workflow Orchestration |
| Truth alignment signals | Governance | Cross-cutting | Governance |

---

## What each responsibility protects

| Responsibility | Protects | Core law |
|----------------|----------|----------|
| **Authoritative** | **Ownership** | Owns business truth; others **SHALL NOT** own it |
| **Gateway** | **Transfer** | Establishes, transfers, or projects business truth; responsibility **ends at handover** |
| **Cross-cutting** | **Consumption** | Consumes and coordinates around business truth; **SHALL NOT** create or replace it |

These are architectural verbs — not implementation labels (publish, read model, API call).

---

## Responsibility contracts (normative)

### Authoritative

- Owns a defined **business truth** until a **command** in that capability changes it.
- Others **SHALL NOT** own, split, or derive enduring truth that supersedes it.

### Gateway

- Establishes, transfers, or projects a business truth for a downstream consumer.
- Responsibility **ends at handover** (publish, projection availability, or equivalent).
- **SHALL NOT** remain the operational source of that truth after handover.

### Cross-cutting

- Consumes and coordinates around business truth across capabilities.
- **SHALL NOT** create or replace truth owned by Authoritative capabilities.
- **SHALL NOT** substitute for Gateway handover.

---

## Responsibility CERT strategies

CERT **falsifies the responsibility** — not CAP prose. Capabilities sharing a responsibility **inherit** the same primary strategy.

| Responsibility | Primary falsification question | Failure mode |
|----------------|-------------------------------|--------------|
| **Authoritative** | Can anyone else own this truth? | **Ownership leakage** |
| **Gateway** | Did it stop at transfer/projection? | **Transfer leakage** |
| **Cross-cutting** | Did it accidentally create truth? | **State** or **judgement leakage** *(see below)* |

```text
Responsibility → Attempt to falsify responsibility contract → Survives?
```

Drift discovered during falsification **corrects** implementation — that is success.

### Methodological falsification (compositional)

How any future responsibility is validated:

```text
Responsibility → Identify temptation → Attempt to violate ownership → Survives? → Validated
```

| Responsibility | Temptation | Failure mode |
|----------------|------------|--------------|
| Authoritative | Enduring ownership elsewhere | Ownership leakage |
| Gateway | Truth retained after handover | Transfer leakage |
| Workflow (Cross-cutting) | Process state as truth | State leakage |
| Governance (Cross-cutting) | Findings as truth | Judgement leakage |

The methodology is compositional. CERT instantiates this loop per capability; the strategy belongs to the responsibility.

### Gateway — one strategy, many truths

All Gateway capabilities (Identity, Access, Reporting, and future gateways) **SHALL** inherit the **same** Gateway falsification strategy.

### Cross-cutting — two expressions, two proofs

Cross-cutting is validated only when **both** expressions survive falsification:

| Expression | Capability | Failure mode | Falsification nuance |
|------------|------------|--------------|----------------------|
| **State** | Workflow Orchestration | **State leakage** | Can Workflow become the authoritative source of **process state**? |
| **Judgement** | Governance | **Judgement leakage** | Can findings (Compliant, Trusted, Healthy, Risk) **replace** authoritative truth? |

Workflow is next **because it exercises state leakage** — not map order. Governance follows as judgement-leakage stress test.

*(Reporting's temptation was Gateway transfer leakage — validated under Gateway.)*

---

## Empirical validation status (May 2026)

| Responsibility | Failure mode | Status |
|----------------|--------------|--------|
| **Authoritative** | Ownership leakage | **Validated** |
| **Gateway** | Transfer leakage | **Validated** |
| **Cross-cutting** (Workflow) | State leakage | **Predicted** |
| **Cross-cutting** (Governance) | Judgement leakage | **Predicted** |

**Precise claim:**

> The model for **Authoritative** and **Gateway** relationships to business truth has been empirically validated. **Cross-cutting** has defined falsification strategies but is **not yet** empirically validated.

After Workflow and Governance survive falsification, the **discovery sequence** is demonstrated across all three responsibilities — not only EWP's capability map. Further work is **repetition** (instantiate, implement, falsify), not conceptual refinement.

---

## Architecture programme — closed (May 2026)

The architecture **no longer discovers itself**. It **governs engineering**. The programme stops here — not when everything is documented, but when:

> **Every new design discussion starts by identifying business truth rather than software structure.**

**Measurable signal:** engineers ask *"What truth is changing?"* before *"Which service?"* — then architecture has become culture, not documentation.

### Three eras (completed → current)

| Era | Dominant question | Outcome |
|-----|-------------------|---------|
| **1 — Discovery** | *What is this?* | Business truths identified (Supplier, Workforce, Engagement, Identity, …) |
| **2 — Decomposition** | *Who owns this truth?* | Capabilities, responsibilities, CAPs, constraints |
| **3 — Empirical validation** | *Can reality break the ownership model?* | CERT falsification; implementation tries to violate laws |

Era 3 continues for Cross-cutting (Workflow, Governance). **No Era 4** — no further abstraction.

### Feature review (success = no architecture workshop)

```text
Feature request
       ↓
What business truth changes?
       ↓
Who owns it?
       ↓
Responsibility?
       ↓
Existing CAP
       ↓
Implement
       ↓
CERT
```

No capability debate. No restructuring. Architecture becomes **invisible**.

### Stability hierarchy (do not reorder)

| Rank | Asset | Stability |
|------|-------|-----------|
| 1 | **Business truth** | Enduring — what exists in the business |
| 2 | **Ownership** | One authoritative owner per enduring truth |
| 3 | **Architectural responsibility** | Relationship to truth |
| 4 | **Capability** | Business realisation (truth + responsibility) |
| 5 | **CAP** | Contractual specification |
| 6 | **Implementation** | One conforming realisation (changes with technology) |
| 7 | **CERT** | Empirical evidence |

Everything below business truth is **derived**. Everything above implementation should **outlive technology**. Everything below implementation **will** change.

**Long-term test:** a new engineer who never read an ADR receives *"Which business truth does this affect?"* as the first review question — architecture survived.

---

## Where to stop

**Stop here.** Not because the model is perfect — because **new abstractions now have a higher chance of weakening it than strengthening it**.

Remaining uncertainty is **empirical**, not conceptual. Workflow will either survive state leakage or it won't. Governance will either survive judgement leakage or it won't. Only implementation and falsification answer those questions.

Let every future capability either **reinforce the method** or **expose its limits**. If Workflow and Governance instantiate as naturally as Workforce, Identity Acquisition, Access Integration, and Reporting did, the discovery sequence will have shown that the same process produces coherent capabilities under different kinds of business truth — validation no amount of additional modelling can replace.

At that point the architecture is no longer the experiment; **the method is**.

---

## No fourth responsibility

Three responsibilities are intentionally minimal. When a fourth is proposed, ask:

| Question | If yes → |
|----------|----------|
| Does it own truth? | **Authoritative** |
| Does it establish, transfer, or project truth? | **Gateway** |
| Does it consume or coordinate around truth? | **Cross-cutting** |
| None of the above? | **Architectural discovery** — rare; serious scrutiny |

Do **not** add responsibility types to fit a feature.

---

## What changed (May 2026)

The programme moved from decomposing a **product** to decomposing **responsibility over business truth**, then to recognising the **discovery sequence** as the repeatable method. Once *what truth is being changed?* became the operating question, ownership, responsibility, CAP, and CERT became increasingly deterministic.

---

## Discovery rule

If a proposed capability does not map to a business truth + one of three responsibilities, that is an **architectural discovery** — not an implementation sprint item. Apply the **discovery sequence** (§ above); do not brainstorm modules.

---

## References

| Doc | Role |
|-----|------|
| [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) | Capabilities organised by business truth |
| [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) | ADR → CAP → PR → CERT chain |
| [`capabilities/README.md`](./capabilities/README.md) | CAP directory |

---

## Document control

| Version | Change |
|---------|--------|
| **1.0** | Frozen — responsibility separated from CAP |
| **1.0** | Review discipline (three questions); four discoveries; architect-independent programme |
