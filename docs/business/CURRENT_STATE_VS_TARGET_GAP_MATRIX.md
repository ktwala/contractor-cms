# Current State vs Target — Gap Matrix

**Status:** Template for use **after** **Contractor Operating Model v1** defines target behavior. Until then, keep the **Target** column as `TBD` or link to signed ADRs.

**Companion:** [`CURRENT_STATE_DISCOVERY.md`](./CURRENT_STATE_DISCOVERY.md) (body = internal Q+A; **Appendix A** = verbatim questionnaire for workshops).

**V1.0 ratification prep:** [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md), [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md), [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md). **ADR** draft: [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) (**§11** lifecycle). Fill **Target** after **v1.0 APPROVED**.

---

## How to use

| Column | Owner | Notes |
|---------|--------|------|
| **Area** | PM / Architect | Domain slice |
| **Current** | Engineering | Repo-backed one-liner |
| **Target** | Stakeholders | From Operating Model v1 |
| **Gap** | Joint | Delta in behavior or data |
| **Effort** | Engineering | S / M / L (t-shirt) |
| **Risk** | Eng + Security | Data, auth, migration |
| **Recommended sequence** | Architect | Dependency order |

Do not fill **Target** from implementation guesses alone.

---

## Gap matrix (initial rows — current known only)

| Area | Current | Target | Gap | Effort | Risk | Recommended sequence |
|------|---------|--------|-----|--------|------|------------------------|
| Invoice list scope | Org-wide for any `invoices:read` | TBD | Contractor may see others’ invoices | TBD | **High** (privacy) | After target: API + UI scope |
| Invoice create vs approve | Seed: FINANCE has approve, not create | TBD | Demo story vs AP workflow | TBD | Med | After target: seed + permissions |
| Supplier login | No `User.supplierId` | TBD | Entire persona + RLS | TBD | High | After portal constitution |
| Sponsor | Not in schema | TBD | New FKs + UX + PDP subjects | TBD | Med–High | After org model |
| Contractor archetypes | `DIRECT`/`AGENCY` + single worker enum value | TBD | Enum / type table + rules | TBD | Med | Constitution then migration |
| HCM org structure | `costCenterId` strings, no manager graph | TBD | Master data + sync | TBD | Med | Phased with HCM adapter |
| IGA provisioning | No dedicated outbound IGA module | TBD | Events, idempotency, retries | TBD | High | Platform initiative |
| PDP vs workflow | Policy + exceptions; not BPM | TBD | Chain orchestration | TBD | Med | Only if target requires BPM |
| Dashboard routing | Role name + `analytics:read` | TBD | Archetype-aware home | TBD | Low–Med | After RBAC + model |

---

## Blank rows (copy block for workshop)

| Area | Current | Target | Gap | Effort | Risk | Recommended sequence |
|------|---------|--------|-----|--------|------|------------------------|
| | | | | | | |
| | | | | | | |
| | | | | | | |

---

## Sign-off

| Version | Date | Author |
|---------|------|--------|
| 0.1 | — | Engineering (repo audit) |

When Operating Model v1 is approved, bump to **1.0** and fill **Target** for each row.
