# External Workforce Platform — Capability Engineering Model

**Status:** **STABLE BASELINE** — Era 5 complete (May 2026). **Operational mode:** apply via [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — do not extend methodology docs in this repo.  
**Applies:** Hubsec Engineering Method (HEM) — [`../hubsec-engineering/README.md`](../hubsec-engineering/README.md)  
**Methodology (frozen):** [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md)

> **EWP is the first validated reference implementation of HEM.** HEM is the engineering discipline; EWP is a product outcome. Do not conflate them.

---

## Three independent assets

| # | Asset | Role |
|---|-------|------|
| **1** | **Product** — External Workforce Platform | What customers buy |
| **2** | **Capability architecture** — Supplier, Workforce, Engagement, … | Product's stable internal structure |
| **3** | **Engineering method** — HEM | How Hubsec builds products |

These **SHALL** remain independent. Capability maps and CAPs belong to asset **2**. HEM belongs to asset **3**. Customer RDS mappings belong to **customer projection** — not to the method.

---

## HEM — engineering discipline (not a product)

```text
Hubsec Engineering Method (HEM)
        │
        ├── External Workforce Platform   ← first closed loop (this repo)
        ├── GovOps
        ├── Database Guard
        ├── Identity Platform
        └── …
```

One discipline. Many products. GovOps **applies** the same method — it does not get its own methodology fork.

When Hubsec-level **`HEM-1.0.md`** is ratified, every product **SHALL** declare: *Built according to HEM 1.0.*

---

## Four concerns (clean chain)

Most organisations mix these. HEM **SHALL** keep them separate.

| Concern | Question |
|---------|----------|
| **Business** | What enduring problem exists? |
| **Capability** | What business responsibility owns that problem? |
| **Product** | How do users experience that capability? |
| **Customer** | Which of my requirements map here? |

```text
Business → Capability → Product → Customer
```

Customer requirements **SHALL NOT** redefine capabilities without a CAP version change.

---

## Governance hierarchy

Each level answers a different question. None **SHALL** replace another.

| Level | Name | Question |
|------:|------|----------|
| **0** | Engineering method | How do we build? |
| **1** | Capability | What does the business own? |
| **2** | Capability specification (CAP) | What must always be true? |
| **3** | Implementation | How is it built today? |
| **4** | Evidence (PR) | What changed? |
| **5** | Certification (CERT) | Does implementation **survive falsification** of the CAP? |
| **6** | Customer mapping | Which external requirements trace here? |

---

## Primary governance question

Before *"Can we implement it?"* ask:

> **Does this require a capability version change?**

| Answer | Activity |
|--------|----------|
| **No** | Implementation — cite CAP § in PR |
| **Yes** | Contract revision — CAP version bump **first** |

This prevents architectural drift by forcing every change to declare: **implementing the contract** vs **changing the contract**.

---

## Closed engineering loop (complete on EWP)

Exercised end-to-end on Workforce Administration — first proof that HEM works for one product.

```text
Business Problem
        ↓
Domain Recovery
        ↓
Capability Recovery
        ↓
Capability Specification (CAP)
        ↓
Implementation
        ↓
Evidence (PR)
        ↓
Certification (CERT)
        ↓
Product Projection
        ↓
Customer Traceability
```

**Second product** (e.g. GovOps applying the same sequence with minimal process change) validates HEM as a **discipline**, not a one-off.

---

## Stable engineering unit: the Capability

Within a product, the **Capability** is the stable unit — not features, modules, or UI.

```text
Capability
        ├── ADR     (why)
        ├── CAP     (contract — versioned)
        ├── Code
        ├── PR      (evidence)
        ├── UAT
        ├── CERT    (conformance)
        └── Customer mapping
```

---

## Four artifacts = four knowledge types

| Artifact | Knowledge type | Question |
|----------|----------------|----------|
| **ADR** | Architectural decision | Why? |
| **CAP** | Business contract | What must always be true? |
| **PR** | Implementation evidence | What changed? |
| **CERT** | Falsification evidence | Does implementation survive attempts to break the CAP? |

```text
ADR → CAP → PR → CERT
```

---

## Capability versioning

CAP text within a version **SHALL** be immutable except errata. Contract changes **SHALL** increment version (v1.0 → v2.0).

PRs **SHALL** state `Implements: CAP-* vX.Y` — not "changes the capability" in prose alone.

---

## Mandatory PR rule

> No implementation PR may change capability behaviour unless it identifies CAP section(s) implemented or modified.

See [`capabilities/README.md`](./capabilities/README.md) for the required traceability block.

---

## CAP and CERT standards

| Standard | Reference in this repo |
|----------|------------------------|
| CAP template | [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) |
| CERT template | [`capabilities/CERT-WORKFORCE-ADMINISTRATION.md`](./capabilities/CERT-WORKFORCE-ADMINISTRATION.md) |

### CERT falsification (by architectural responsibility)

CERT **falsifies the responsibility** — inherited from [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md). All capabilities sharing a responsibility use the **same** primary falsification strategy.

```text
Architectural Responsibility → Responsibility CERT Strategy → CAP CERT (instantiation evidence)
```

| Responsibility | Falsification question |
|----------------|------------------------|
| **Authoritative** | Can anyone else own this truth? |
| **Gateway** | Did it stop at transfer/projection? |
| **Cross-cutting** | Did it accidentally create truth? |

Cross-cutting nuances: Workflow — *process state* authority; Governance — *judgement* replacing truth.

Conformance § tables remain in each `CERT-*`; the **primary gate** is responsibility falsification.

Future Hubsec-level: `Capability-Specification-Standard.md`, `Certification-Standard.md` under [`hubsec-engineering/`](../hubsec-engineering/README.md).

---

## HEM and other practices

HEM does not replace DDD, RFCs, ADRs, or event-driven design. It **combines** them into a coherent discipline for how Hubsec specifies, implements, certifies, and projects products.

---

## Rules for EWP engineers

1. Start from the **capability map** (asset 2).
2. Ask **capability version change?** before implementing customer asks.
3. Read **CAP-* (correct version)** before behaviour changes.
4. **Cite CAP §** in every behaviour-changing PR.
5. **CERT-*** at maturity gates — **falsify the architectural responsibility** ([`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md)); stack-agnostic.
6. Customer mappings last (RDS, SOW) — level 6 only.

**Do not create** Hubsec-level HEM-1.0, HEM Laws, or Engineering Constitution from this repo until a **second product** (e.g. GovOps) applies the same sequence. Extract universal standards then — not before.

---

## EWP stable baseline (Era 5 complete)

> **External Workforce Platform is now capability-driven rather than requirement-driven.**

| Level | Status |
|-------|--------|
| Product identity | ✅ EWP ([`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md)) |
| Capability architecture | ✅ Defined (this map) |
| Capability map | ✅ Primary engineering artifact |
| Workforce capability | ✅ [`CAP-WORKFORCE-ADMINISTRATION`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) v1.0 |
| Workforce implementation | ✅ Mature baseline |
| Workforce evidence | ✅ PR chain complete |
| Workforce certification | ✅ [`CERT-WORKFORCE-ADMINISTRATION`](./capabilities/CERT-WORKFORCE-ADMINISTRATION.md) v1.0 PASS (May 2026) |
| Access Integration CAP | ✅ [`CAP-ACCESS-INTEGRATION`](./capabilities/CAP-ACCESS-INTEGRATION.md) v1.0 RATIFIED — gateway validated |
| Identity certification | ✅ [`CERT-IDENTITY-ACQUISITION`](./capabilities/CERT-IDENTITY-ACQUISITION.md) v1.0 PASS (May 2026) |
| Access Integration certification | ✅ [`CERT-ACCESS-INTEGRATION`](./capabilities/CERT-ACCESS-INTEGRATION.md) v1.0 PASS (May 2026) |
| Reporting certification | ✅ [`CERT-REPORTING-PROJECTIONS`](./capabilities/CERT-REPORTING-PROJECTIONS.md) v1.0 PASS (May 2026) — Gateway negative proof |
| MTN traceability | ✅ [`PR-WORKFORCE-RDS-MAPPING-1`](./PR-WORKFORCE-RDS-MAPPING-1.md) |

**Proof sequence (next):** falsify **Cross-cutting** (predicted) — CAP Workflow → CERT → CAP Governance → CERT. Authoritative and Gateway responsibilities are **validated**; Cross-cutting is **not yet**. See [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md).

**Roadmap (stable):**

```text
Capability → Capability Specification → Implementation PR → Customer Traceability
```

Not: `Customer Requirement → Feature`.

**Next documents (capability-driven only):** `CAP-SUPPLIER-ADMINISTRATION`, `CAP-ENGAGEMENT-ADMINISTRATION`, … — extend the platform, not the methodology.

---

## References

| Doc | Role |
|-----|------|
| [`../hubsec-engineering/README.md`](../hubsec-engineering/README.md) | Planned HEM-1.0 home |
| [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) | **Source of truth** — start here |
| [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) | Reference CAP |
| [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md) | EWP product identity |
