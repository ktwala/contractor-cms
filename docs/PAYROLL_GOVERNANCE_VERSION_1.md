# Payroll Governance — Version 1 Release Declaration

**Document type:** Release-grade governance baseline declaration  
**Audience:** PMO, internal audit, architecture review, engineering leadership  
**Status:** **v1 baseline locked** (see statement below) — **PR-PAYROLL-V1-2** updated the declaration to include the **CONTAINER** vertical and **META-2** registry footprint alongside **GOV-1 … GOV-7**. **PR-PAYROLL-V1-2A:** **`check:payroll-governance-constitution-drift`** asserts this file retains **PR-PAYROLL-V1-2** and the single-line footprint **GOV-1 … GOV-7 + CONTAINER + META-2**.

This document is **not** a product feature spec. It records **what maturity exists today** for payroll governance in this repository, **how it is frozen**, and **where intentional future work remains**.

---

## v1 baseline locked — statement

**Payroll governance Version 1** is **baseline locked** as a coherent system:

```txt
GOV-1 … GOV-7
+
CONTAINER  (tax-year payroll shell — PR-PAYROLL-CONTAINER-* / PR-PAYROLL-CONTAINER-META-1)
+
META-2     (executable constitution drift — PR-PAYRUN-GOV-META-2-LOCK)
```

**Single-line v1 footprint (META-2 / PR-PAYROLL-V1-2A drift anchor):** GOV-1 … GOV-7 + CONTAINER + META-2

- **Runtime — GOV verticals:** **GOV-1** (import integrity) through **GOV-7** (policy change governance) are implemented with pillar documentation, **LOCK** programs where applicable, automated tests, **drift** scripts, and **CI** enforcement.
- **Runtime — CONTAINER vertical:** The **tax-year `Payroll` shell** (PayGroup → Payroll → PayPeriod linkage, lifecycle preview, audited close/archive, **PR-PAYROLL-CONTAINER-4-LOCK**) is implemented with [`PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md), **`check:payroll-container-drift`**, policy tests, admin UI, and **CI** — and is **constitutionally indexed** under **PR-PAYROLL-CONTAINER-META-1** (see Master Index **CONTAINER** row and constitution).
- **Supervisory:** The **[`PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md)** is the single operating map from **GOV-1 … GOV-7** and **CONTAINER** to docs, drift, tests, CI, permissions, routes, and ownership.
- **Constitutional:** **[`PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md)** (**GOV-META-1**) defines how governance artifacts and LOCK programs may change.
- **Executable compliance:** **`check:payroll-governance-constitution-drift`** (**GOV-META-2**, **PR-PAYRUN-GOV-META-2-LOCK**) machine-checks that the slice registry (**GOV-1 … GOV-7** + **CONTAINER**), Master Index, constitution, `package.json`, and CI wiring stay aligned.

New work that **expands** governed payroll surface area must remain **constitution-compliant** (doc + drift + tests + CI + LOCK + Master Index + META-2 registry, in one change-set unless explicitly staged per charter).

---

## Governance maturity achieved (four layers)

| Layer | Scope | Primary artifacts |
|-------|--------|---------------------|
| **1 — Payroll operations** | **GOV-1 → GOV-7** and **CONTAINER** | Pillar docs (e.g. execution, 3A–3D, post-impact, control plane, **[`PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md)**); services, gates, audits |
| **2 — Governance control plane** | Supervisory rollups, portfolio, evidence export | [`PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md); **GOV-5A–5C** |
| **3 — Constitutional doctrine** | How governance itself evolves | **GOV-META-1** + **PR-PAYROLL-CONTAINER-META-1** — [`PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md) |
| **4 — Executable constitutional compliance** | Machine-checked framework health | **GOV-META-2** + **PR-PAYRUN-GOV-META-2-LOCK** — [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts) (registry: **GOV-1 … GOV-7** + **CONTAINER**) |

---

## GOV + CONTAINER layers complete (v1 scope)

The **numbered GOV program** for payroll in v1 runs **GOV-1 … GOV-7** with the subdivisions and LOCK families described in the Master Index and control plane (including **GOV-3A–3D**, **GOV-5A–5C**, **GOV-6A–6C**, **GOV-7A / 7B / 7B-2**).

The **CONTAINER** vertical (**tax-year payroll shell**) is **in v1 scope** as a first-class pillar: [`PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md), **PR-PAYROLL-CONTAINER-4-LOCK**, **`check:payroll-container-drift`**, Master Index **CONTAINER** section, and **PR-PAYROLL-CONTAINER-META-1** in the constitution. It is **not** a side program outside Version 1.

Canonical map: [`PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md).

---

## Constitutional baseline (frozen)

- **Amendment and supersession:** [`PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md) §§2–3, §7.
- **Audit doctrine:** same file §6 — no claimed governance without automated evidence or a time-boxed, documented exception.
- **META-2-LOCK:** same file — constitution drift baseline locked (v1); CI must run **`npm run check:payroll-container-drift`** before **`npm run check:payroll-governance-constitution-drift`** (see Master Index CI anchor).

---

## Known deferred roadmap (post–v1 / GOV-8+)

The following are **explicitly not required for v1 closure**; they remain **product and governance roadmap**, to be introduced only with a **new or extended GOV slice** (or a **material expansion of CONTAINER** treated as a program change), full **LOCK**, drift, tests, CI, and Master Index + META-2 registry updates per the constitution.

- **New major GOV numbers (e.g. GOV-8+):** reserved for materially new governance **verticals** beyond the **GOV-1…7 + CONTAINER** footprint already in v1. Naming follows **GOV-*n*** and **PR-PAYRUN-GOV-*** conventions. (**CONTAINER** is **not** “future GOV-8”; it is the dedicated **PR-PAYROLL-CONTAINER-*** program indexed in v1.)
- **Control plane “Further work”** (representative, not exhaustive): dedicated audit workspace, PMO maturity scoring, saved filters / views; scheduled PMO packs, multi-period workbooks, audit log annex; richer policy impact simulation (counterfactual replay, payload TTL); approver-role split, SLA / escalation, multi-party approval — see roadmap callouts in [`PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md).

Deferred items **do not** weaken v1: they are **out of scope** until adopted under charter.

---

## Governance philosophy (v1)

1. **Payroll truth is operational and provable** — gates, reconciliations, closed-period rules, and policy-backed thresholds are enforced in code and backed by tests and drift.
2. **Supervision is first-class** — leadership and audit can reason about health without reverse-engineering every module.
3. **Changing the rules is a governed act** — policy registry, impact preview, hash, acknowledgement, draft / approve / reject / cancel / activate, and audit form one chain (**GOV-6 / GOV-7**).
4. **The framework is self-policing** — META-2 ensures the **map** and the **machinery** do not silently diverge, including the **CONTAINER** registry row alongside **GOV-1 … GOV-7**.

---

## Practical use of this declaration

| Stakeholder | Use |
|-------------|-----|
| **PMO** | Attach to release / milestone evidence; cite **v1 baseline locked** for program sequencing. |
| **Audit** | Anchor control lineage: Master Index → pillar LOCK → drift → CI → tests. |
| **Architecture review** | Treat **GOV-1…7** + **CONTAINER** + **META-1** + **META-2-LOCK** as the **non-negotiable** architecture for payroll governance in this repo until a formal v2 declaration supersedes this document. |
| **Executive** | Single-page assurance: payroll is not only “feature complete” on governance paths, but **constitutionally** and **machine-checked** at build time. |

---

## References

| Artifact | Role |
|----------|------|
| [`PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md) | Operating map (**GOV-1 … GOV-7** + **CONTAINER**) |
| [`PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md) | CONTAINER pillar + **PR-PAYROLL-CONTAINER-4-LOCK** |
| [`PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md) | GOV-META-1 + **PR-PAYROLL-CONTAINER-META-1** + META-2-LOCK |
| [`PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md) | GOV-5 … GOV-7 depth + roadmap notes |
| [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts) | META-2 registry + checks (**GOV** + **CONTAINER**) |
| [`scripts/check_payroll_container_drift.ts`](../scripts/check_payroll_container_drift.ts) | CONTAINER doctrine drift |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Drift + container drift before META-2 in `lint-and-test` |

---

*End of Payroll Governance Version 1 Release Declaration.*
