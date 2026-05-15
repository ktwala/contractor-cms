# Operating Model Decision Log

**Companion:** [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) — **§25** (Sponsor), **§24** (IGA boundary).

**V1.0 prep package:** [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md), [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md), [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md), [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md), [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md). **ADR** lifecycle **§11:** [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md).

**Purpose:** OD register with ownership, rationale, interim defaults, and blockers.

**v0.5:** **OD-06** and **OD-07** are **LOCKED at doctrine level** in the constitution. Remaining work = **ADR-EXTID-001**, schema, integrations — **not** reopening baseline doctrine without a version bump.

---

## Decision register

| ID | Topic | Decision owner | Status | Rationale | Interim default | Blocked by |
|----|-------|----------------|--------|-----------|-----------------|------------|
| **OD-01** | Contractor invoice visibility | Product + Security | **RESOLVED (v0.3)** | Least privilege for worker persona. | **OFF** enterprise invoice; optional tiers. | API row-scope, UI, seed. |
| **OD-02** | Contractor login | Product + Security | **RESOLVED (v0.3)** | Person record can exist without `User`. | **Default OFF**; optional ON. | Auth UX. |
| **OD-03** | Timesheet ownership | Product + Operations | **RESOLVED (v0.3)** | Supplier-led default. | Supplier roles + internal proxy until portal. | Portal MVP. |
| **OD-04** | Supplier portal default | Product + Architecture | **RESOLVED (v0.3)** | Target ON; staged OFF. | Interim OFF until MVP. | RLS, supplier RBAC. |
| **OD-05** | Independent contractor | Product + Legal | **RESOLVED (v0.3)** | Supported, not default. | Archetype + billing branch when enabled. | Legal + schema. |
| **OD-06** | **Sponsor governance** | Architecture + Product | **LOCKED (doctrine v0.5)** | Sponsor = **accountability plane** between workforce (CMS) and access justification (IGA). | **HCM employee** primary sponsor; **one primary**; optional delegate; **ACTIVE** requires sponsor; see **§25**. | Schema migrations; HCM resolution; workflows in ADR-EXTID-001. |
| **OD-07** | **IGA boundary & integration** | Security + Architecture | **LOCKED (doctrine v0.5)** | CMS ≠ IGA; two planes; **ACCESS_ENABLED** = sponsor + IGA path for `access_intent`; see **§24**. | Process + audit; event stubs until integration. | ADR-EXTID-001; supplier contracts; buses. |

---

## Governance authorization (execution handoff)

| ID | Event | When | Repo actions (assignee) |
|----|--------|------|-------------------------|
| **GOV-EXTID-01** | **CONTRACTOR_OPERATING_MODEL_V1** ratified **v1.0**; **ADR-EXTID-001** → **PROPOSED** | **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7.3** complete | Per ratification record **§7.4:** constitution header; ADR status line; README baseline; add **changelog row below** with date. |

**On completion of GOV-EXTID-01, append a row:**

| Date | Change |
|------|--------|
| *(date)* | **GOV-EXTID-01:** Ratification complete — **CONTRACTOR_OPERATING_MODEL_V1 v1.0 RATIFIED**; **ADR-EXTID-001 PROPOSED**; Schema Stream **1A** authorized (bounded). |

---

## Changelog

| Date | Change |
|------|--------|
| — | v0.3: OD-01–05 resolved |
| — | v0.4: OD-07 reframed (IGA boundary) |
| — | v0.5: OD-06 + OD-07 doctrine **LOCKED** |
| — | **ADR-EXTID-001** draft shell filed (`docs/security/`) |
| — | **GOV-EXTID-01** template + governance authorization table (execute on [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) **§7** completion) |
| — | **V1.0 prep:** alignment plan, role matrix, schema register + ADR **§11** lifecycle |
