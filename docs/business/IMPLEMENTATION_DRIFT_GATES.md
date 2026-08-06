# Implementation drift gates

**Status:** `DRAFT` — **Architecture execution governance**. Defines **review + CI** expectations so doctrine stays **executable** and the repo does not silently drift from [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md), [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md), [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md), and [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md).

**Purpose:** Complement existing automation ([`scripts/governance-drift-check.ts`](../../scripts/governance-drift-check.ts), [`scripts/security-drift-check.sh`](../../scripts/security-drift-check.sh), catalog verifiers) with **EXTID / sponsor / IGA plane** rules. Many checks below are **candidates** for future script additions — until encoded, they are **mandatory PR checklist** items for relevant PRs.

**Discipline:** Do **not** add new governance **documents** unless **execution-specific** (design, drift gates, PR notes). Strategy lives in the constitution + ADR + alignment plan.

---

## 1. PR alignment header (copy into every EXTID-related PR description)

```text
Aligned to:
- CONTRACTOR_OPERATING_MODEL_V1 §___ (quote subsection) — v1.0 ratified per V1_0_RATIFICATION_RECORD §7 (if post-ratification PR)
- ADR-EXTID-001 §___
- EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1 §___
- V1_0_RATIFICATION_RECORD (if authority-bound EXTID work)
- ROLE_TRANSITION_MATRIX_V1 (if RBAC)
- SCHEMA_IMPACT_REGISTER_V1 / PR-EXTID-SCHEMA-1_DESIGN (if schema)
- EXTID_MIGRATION_SAFETY_CHECKLIST (if schema / migration PR)
- SCHEMA_DIFF_REVIEW (required for PR-EXTID-SCHEMA-1A merge)
- RATIFICATION_STATE_CONSISTENCY_CHECK (PR-EXTID-SCHEMA-1A: completed after §7.4)
- IMPLEMENTATION_DRIFT_GATES (this doc) — gates: ___
```

**Goal:** Make doctrine **traceable** in code review without rereading the entire constitution.

---

## 2. Gate catalog (rules)

| ID | Rule | Severity | Enforcement today | Future automation candidate |
|----|------|----------|---------------------|-----------------------------|
| **G-EXTID-01** | No **`ACTIVE`** (workforce plane) **without** populated **`sponsor_employee_id`** (once schema exists and policy date passed) | Block | Manual review + release notes | Prisma seed check / integration test |
| **G-EXTID-02** | No use of **`IGA_PROVISIONED`** (or equivalent) as a **CMS workforce lifecycle** state | Block | [`scripts/extid-drift-check.ts`](../../scripts/extid-drift-check.ts) | CI: governance + security drift workflows |
| **G-EXTID-03** | No **`CONTRACTOR`** (or worker persona) **enterprise invoice** list without **row scope** or **policy flag** (post–PR-RBAC-REALIGN-1) | Block | RBAC matrix / e2e | `security-drift-check` or dedicated Jest |
| **G-EXTID-04** | No **`ACCESS_ENABLED`** (or equivalent) **without** sponsor path + IGA path when `access_intent` requires access | Block | Manual / integration | Domain service invariant tests |
| **G-EXTID-05** | CMS API responses must **not** equate **IGA FAILED** with **invalid worker** (copy + shape) | Warn | UX review | E2E snapshot / copy lint |
| **G-EXTID-06** | Sidebar / `PROTECTED_ROUTES` changes must match **permission catalog** (existing drift rules) | Block | `security-drift-check.sh` | Existing |
| **G-EXTID-07** | New permissions must appear in **catalog** + `@Permissions` + UI | Block | Catalog scripts / CI | Existing |

---

## 3. Illustrative invariants (examples)

```text
No ACTIVE worker without sponsor field populated (after enforcement phase)
No use of IGA_PROVISIONED as CMS lifecycle
No CONTRACTOR enterprise invoice access unless policy flag / row scope
No sponsor-less ACCESS_ENABLED when access_intent requires logical or physical access
```

---

## 4. Mapping to existing repo automation

| Mechanism | File | Covers |
|-----------|------|--------|
| Governance drift | [`scripts/governance-drift-check.ts`](../../scripts/governance-drift-check.ts) | Docs / PDP precedence / org-context patterns |
| Security drift | [`scripts/security-drift-check.sh`](../../scripts/security-drift-check.sh) | Frontend org spoofing, permission usage |
| RBAC / org context | Backend E2E, `rbac-matrix` | Role surfaces |
| **EXTID-specific** | [`scripts/extid-drift-check.ts`](../../scripts/extid-drift-check.ts) | **G-EXTID-02** + sponsor/supplier placement + additive EXTID columns + tracked `migration.sql` (PR-EXTID-SCHEMA-1D); not G-EXTID-01 enforcement |

---

## 5. When to run what

| Change type | Minimum checks |
|-------------|----------------|
| Post–§7.4 / pre–**1A** | [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) complete |
| Schema / Prisma | `PR-EXTID-SCHEMA-1_DESIGN` alignment + drift doc self-check + `governance-drift-check`; **1A:** [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) complete |
| RBAC / seed | `ROLE_TRANSITION_MATRIX` + catalog scripts + RBAC e2e |
| IGA / events | `ADR-EXTID-001` §6 + alignment plan stream D |

---

## 6. References

- [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) — post–§7.4, pre–**1A**
- [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) — **1A** merge gate
- [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) — doctrine → implementation handoff
- [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) — schema PR safety
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) **§7** gates
- [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md)
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — documentation progression

---

## Changelog

| Version | Note |
|---------|------|
| 1.4 | Alignment header: **RATIFICATION_STATE** for **1A** |
| 1.3 | **§5** when-to-run: post–§7.4 **RATIFICATION_STATE**; refs |
| 1.2 | Alignment header: **SCHEMA_DIFF_REVIEW** for **1A** |
| 1.1 | Alignment header: **V1_0_RATIFICATION_RECORD**, **EXTID_MIGRATION_SAFETY_CHECKLIST**; refs |
| 1.0 | Initial drift gate catalog + PR alignment header |
