# External Workforce Lifecycle — architecture v1 (complete & frozen)

**Status:** COMPLETE & FROZEN — **stop refining architecture**; execute via build → prove → inspect
**Audience:** Product, architects, demo authors, engineers
**Parent:** [`business/EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md`](./business/EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md)
**Assurance detail:** [`CONTINUOUS_WORKFORCE_ASSURANCE.md`](./CONTINUOUS_WORKFORCE_ASSURANCE.md) · [`DEMO-MTN-ASSURANCE-STORIES.md`](./DEMO-MTN-ASSURANCE-STORIES.md)

---

## Architecture complete

External Workforce Architecture **v1 is complete**. Every capability earned its place by answering a **different business question** — not by adding another dashboard, workflow, status, or review process.

From here: **do not refine this document further** unless customer evidence breaks the model. Execute one assurance domain at a time; prove with MTN data; inspect whether the architecture still holds.

---

## Value proposition

> **EWP continuously assures that operational external workers remain compliant across procurement, HR, workforce governance, and identity governance.**

EWP **orchestrates and assures** across authoritative systems. It does **not** become the master of everything.

---

## Complete lifecycle

```text
Supplier Portal / Oracle HCM
            │
            ▼
     Workforce Discovery
            │
            ▼
   Workforce Assessment
            │
            ▼
 Operational Workforce          ← constitutional boundary
            │
            ▼
Continuous Workforce Assurance
            │
            ▼
     Governance Review
```

---

## Capabilities (frozen)

Each capability exists to answer **exactly one** business question.

| Capability | Business question | Output |
|------------|-------------------|--------|
| **Workforce Discovery** | What external workers exist? | Discovered workforce |
| **Workforce Assessment** | Can this worker become operational? | Readiness findings |
| **Operational Workforce** | Who is operational today? | Governed operational registry |
| **Continuous Workforce Assurance** | Should this worker remain operational? | Assurance findings |
| **Governance Review** | What does the operator need to review? | Decisions and actions |

| Stage | Input | Primary audience |
|-------|-------|------------------|
| Workforce Discovery | Upstream worker evidence (HCM, Portal) | Integration / ops |
| Workforce Assessment | Discovery snapshot | Onboarding / governance ops |
| Operational Workforce | Assessed, governed workers | All operators |
| Continuous Workforce Assurance | Live operational state + observations | Platform (continuous) |
| Governance Review | Assurance findings & decisions | Governance reviewers |

---

## Capability ownership

| Capability | Primary system of truth |
|------------|-------------------------|
| Workforce Discovery | Oracle HCM / Supplier Portal |
| Workforce Assessment | EWP Assessment Engine |
| Operational Workforce | EWP |
| Continuous Workforce Assurance | EWP Assurance Engine |
| Governance Review | EWP Operator Workspace |
| Access remediation | IGA |

EWP consumes observations from authoritative systems, interprets them into findings, and surfaces decisions. **Access remediation executes in IGA** — EWP detects misalignment; IGA owns identity execution unless explicitly integrated.

---

## Doctrine

### Separating Assessment from Assurance

> **Assessment determines whether a worker is ready to become operational. Continuous Workforce Assurance determines whether an operational worker remains fit to stay operational.**

### One capability, one question

> **Every capability exists to answer exactly one business question. When a capability begins answering multiple independent questions, it is a signal that a new capability may be emerging — not that the existing one should expand.**

This explains why Discovery, Assessment, Operational Workforce, Assurance, and Governance Review are separate — and provides a practical test for future design.

### Placement discipline

Before adding scope, ask:

> **Is this about becoming operational, or remaining operational?**

If the answer is not clear, the capability does not have a home yet.

---

## Constitutional rule: Operational Trust is the supplier gateway

**Operational Trust is the gateway between Supplier Governance and Workforce Governance.** A supplier cannot nominate or onboard external workers until Operational Trust has been granted by EWP.

```text
Oracle Supplier Portal     EWP
─────────────────────     ───
Procurement approval  →   Synchronize
                      →   Supplier Assessment
                      →   Operational Trust Review
                      →   Grant Operational Trust
                      →   Supplier may nominate workers
```

| Decision | Owner | Question |
|----------|-------|----------|
| Procurement approval | Oracle Supplier Portal | May this supplier do business? |
| Operational Trust | EWP | May this approved supplier participate in the External Workforce Platform? |

Oracle's responsibility ends at procurement approval. EWP owns Operational Trust, workforce participation configuration, and everything downstream in the workforce lifecycle.

Continuous Workforce Assurance includes **Supplier Assurance**: *Is every operational worker employed by a supplier with Operational Trust?* When trust is revoked, affected workers become assurance findings — not silent registry drift.

---

## Constitutional rule: Operational Workforce is the boundary

**Operational Workforce is the lifecycle boundary.** Everything before it exists to **create** a governed operational worker. Everything after it exists to **assure** that worker remains valid.

```text
Before Operational Workforce          After Operational Workforce
────────────────────────────          ────────────────────────────
Discovery                               Continuous Workforce Assurance
Assessment                              Governance Review
Resolution (readiness remediation)
```

| Side | Nature | Time horizon |
|------|--------|--------------|
| **Before** | Onboarding | Point-in-time (per snapshot) |
| **After** | Continuous governance | Continuous / event-driven |

**Crossing the boundary** requires an ADR, explicit side ownership, and lifecycle gating on any shared UI.

---

## Assurance pipeline (frozen)

```text
Observation  →  Finding  →  Decision  →  Action
 (evidence)      (policy)     (triage)      (execution)
```

| Stage | Owner |
|-------|-------|
| Observation | HCM, Supplier Portal, IGA, EWP registry |
| Finding | EWP Assurance Engine |
| Decision | Assurance policy (configurable) |
| Action | Governance Review operator, or IGA for access |

**Decisions (v1):** `COMPLIANT` · `MONITOR` · `REVIEW_REQUIRED` · `CRITICAL`

Examples and finding catalogs: [`CONTINUOUS_WORKFORCE_ASSURANCE.md`](./CONTINUOUS_WORKFORCE_ASSURANCE.md)

---

## Five assurance domains (frozen)

```text
Accountability Assurance
Supplier Assurance
Engagement Assurance
Workforce Assurance
Access Assurance          ← Phase 2 (requires IGA signals)
```

- One finding → one domain — never two
- Portal **drift** is a detection mechanism, not a sixth domain

---

## Workforce Administration navigation (target)

```text
Workforce Administration
    ├── Workforce Discovery
    ├── Assessment
    ├── Operational Workforce
    └── Governance Review
```

---

## Execution rhythm (from here)

Do **not** refine architecture. Execute:

1. **Implement one assurance domain**
2. **Validate** with realistic MTN data ([`DEMO-MTN-ASSURANCE-STORIES.md`](./DEMO-MTN-ASSURANCE-STORIES.md))
3. **Demonstrate** operator value in Governance Review
4. **Inspect** — does the architecture still hold?
5. **Repeat** for the next domain

Suggested order: Engagement Assurance → Supplier Assurance → Accountability Assurance → Workforce Assurance → Access Assurance (Phase 2, IGA signals).

---

## Implementation gate

| Step | Status |
|------|--------|
| External Workforce Architecture v1 complete & frozen | ✅ |
| Assurance constitution ratified | ✅ |
| Seven demo personas defined | ✅ |
| Personas seeded on operational workers | ☐ |
| First assurance domain implemented + proven | ☐ |
| Governance Review workspace | ☐ |

---

## Amendment process

Architecture changes require an ADR, lifecycle placement answer, and customer evidence. **Default: reject** scope that does not fit a stage or violates one-capability-one-question.

If the model breaks in execution, amend here — do not accumulate undocumented drift.
