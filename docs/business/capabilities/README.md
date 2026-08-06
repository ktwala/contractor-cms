# Capability Specifications (`CAP-*`)

**Source of truth:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](../EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — update the map when CAPs or CERTs change
**Reference CAP:** [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) v1.0
**Method (frozen):** [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](../EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md)

> **Operational mode:** New capabilities need **CAP + PRs + CERT** — not new governance document trees.

---

## Closed loop

```text
Capability Map (this capability's row)
        ↓
CAP → Code → PR (cite CAP §) → CERT (falsify **responsibility** over business truth)
```

CERT **survives** falsification → responsibility proven for that increment. Drift discovered during CERT → correct implementation → re-cert if needed.

---

## CERT falsification (by responsibility)

Inherited from [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](../ARCHITECTURAL_RESPONSIBILITIES_V1.md) — **not** per-CAP invention.

```text
Responsibility → falsify responsibility contract → CAP CERT collects evidence
```

| Responsibility | Primary question |
|----------------|------------------|
| Authoritative | Can anyone else own this truth? |
| Gateway | Did it stop at transfer/projection? |
| Cross-cutting | Did it accidentally create truth? |

Cross-cutting requires **two** proofs: Workflow (**state leakage**) and Governance (**judgement leakage**). See [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](../ARCHITECTURAL_RESPONSIBILITIES_V1.md).

---

## Rules

1. **No implementation PR** may change capability behaviour without citing CAP section(s).
2. **No new governance doc** unless the Capability Map + existing CAP/ADR cannot answer the question.
3. **Version bump CAP** when the contract changes — not when implementation catches up.

Example PR block:

```markdown
## CAP traceability

**Capability:** Supplier Administration
**CAP version:** v1.0
**Implements:** CAP §…
```

---

## Specifications (maintain here + link from Capability Map)

| Capability | CAP | CERT | Version |
|------------|-----|------|---------|
| Workforce Administration | [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) | [`CERT-WORKFORCE-ADMINISTRATION.md`](./CERT-WORKFORCE-ADMINISTRATION.md) | **1.0 PASS** |
| Supplier Administration | [`CAP-SUPPLIER-ADMINISTRATION.md`](./CAP-SUPPLIER-ADMINISTRATION.md) | [`CERT-SUPPLIER-ADMINISTRATION.md`](./CERT-SUPPLIER-ADMINISTRATION.md) | **1.0 RATIFIED** |
| Engagement Administration | [`CAP-ENGAGEMENT-ADMINISTRATION.md`](./CAP-ENGAGEMENT-ADMINISTRATION.md) | [`CERT-ENGAGEMENT-ADMINISTRATION.md`](./CERT-ENGAGEMENT-ADMINISTRATION.md) | **1.0 RATIFIED** |
| Identity Acquisition | [`CAP-IDENTITY-ACQUISITION.md`](./CAP-IDENTITY-ACQUISITION.md) | [`CERT-IDENTITY-ACQUISITION.md`](./CERT-IDENTITY-ACQUISITION.md) | **1.0 PASS** |
| Access Integration | [`CAP-ACCESS-INTEGRATION.md`](./CAP-ACCESS-INTEGRATION.md) | [`CERT-ACCESS-INTEGRATION.md`](./CERT-ACCESS-INTEGRATION.md) | **1.0 PASS** |
| Reporting & Projections | [`CAP-REPORTING-PROJECTIONS.md`](./CAP-REPORTING-PROJECTIONS.md) | [`CERT-REPORTING-PROJECTIONS.md`](./CERT-REPORTING-PROJECTIONS.md) | **1.0 PASS** |
| Workflow Orchestration | *Planned* | — | — |
| Governance | *Planned* | — | — |

Copy [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) structure for new CAPs (12 sections + Dependencies).
