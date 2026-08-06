# Hubsec Engineering Method (HEM)

**Status:** PLANNED — **do not author HEM-1.0 from the EWP repo**
**First validated reference implementation:** [External Workforce Platform](../business/EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — Era 5 complete (May 2026)

Organisation-level standards (`HEM-1.0.md`, HEM Laws, Engineering Constitution) **SHALL** wait until a **second product** (e.g. GovOps) applies the same sequence. Extract what is universal then; until then, [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](../business/EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) is the working reference.

---

## What HEM is

**Hubsec Engineering Method (HEM)** is Hubsec's **engineering discipline** — the means of producing products. It is **not** a product.

```text
Hubsec Engineering Method (HEM)
        │
        ├── External Workforce Platform      ← first closed loop (this repo)
        ├── GovOps
        ├── Database Guard
        ├── Identity Platform
        └── …
```

Products are **outcomes**. HEM is how they are built.

---

## Three independent assets (do not collapse)

| Asset | What it is | Example |
|-------|------------|---------|
| **1. Product** | What customers buy / use | External Workforce Platform |
| **2. Capability architecture** | Stable internal structure of a product | Workforce Administration, Supplier Administration, … |
| **3. Engineering method** | How Hubsec builds products | HEM — Domain Recovery → … → Customer Projection |

EWP **applies** HEM. It does not **define** HEM. When HEM-1.0 is ratified at Hubsec level, EWP docs **SHALL** say: *Built according to HEM 1.0.*

---

## Planned Hubsec-level corpus (future)

Not under EWP. Not under GovOps. At organisation level:

```text
hubsec-engineering/
    HEM-1.0.md
    ADR-Philosophy.md
    Capability-Specification-Standard.md
    Certification-Standard.md
    Product-Projection-Standard.md
```

Until then, [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](../business/EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) is the **working reference** for HEM as exercised on EWP.

---

## Validation milestone

| Milestone | Meaning |
|-----------|---------|
| **First product (EWP)** | Proves HEM can produce a closed loop |
| **Second product** | Proves HEM is repeatable — **the real methodology validation** |
| **Third capability on same product** | Proves the method fades into practice |

---

## In-repo reference artifacts (EWP)

| Doc | Role |
|-----|------|
| [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](../business/EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) | HEM as applied to EWP |
| [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](../business/capabilities/CAP-WORKFORCE-ADMINISTRATION.md) | Reference CAP template |
| [`capabilities/CERT-WORKFORCE-ADMINISTRATION.md`](../business/capabilities/CERT-WORKFORCE-ADMINISTRATION.md) | Reference CERT template |
