# CONTRACTOR_OPERATING_MODEL_V1 — v1.0 ratification record

**Document type:** Execution governance — **authority handoff** from doctrine to controlled implementation.

**Status:** `AWAITING_SIGN_OFF` — **not** effective until **§7** is completed. Until then, [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) remains **v0.5** in the repo; **do not** open production-bound **PR-EXTID-SCHEMA-1A** without this record executed (unless a **waiver** is recorded here or in [`OPERATING_MODEL_DECISION_LOG.md`](./OPERATING_MODEL_DECISION_LOG.md)).

**Purpose:** Formalize that **doctrine is production-governing** at **v1.0**, eliminate **draft drift** on execution decisions, and authorize the **ADR-EXTID-001** → **PROPOSED** step and the **PR-EXTID-SCHEMA-1** phased program.

**Next human step:** Complete **§7** — this is **not** more design; it is **sign-off** (**Governance Authorization Gate**).

---

## 1. Ratification status (effective upon §7)

Upon completion of **§7**, the following **target state** applies:

```text
CONTRACTOR_OPERATING_MODEL_V1 — RATIFIED v1.0
ADR-EXTID-001 — PROPOSED
```

**ADR header line (paste into [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) top status when §7 is done):**

```text
PROPOSED — Ratified by CONTRACTOR_OPERATING_MODEL_V1 v1.0; governs implementation pending production acceptance.
```

**Operating model:** Update [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) document header **Status** to **v1.0 RATIFIED** and bump **Version** table per repo convention.

---

## 2. Ratified scope (confirm)

The organization confirms the following are **binding** for product and engineering (non-exhaustive; full text remains in the constitution and ADR):

| Area | Binding source |
|------|----------------|
| **Workforce plane** | Operating model **§7**, lifecycle / `ACTIVE` semantics |
| **Sponsor plane** | Operating model **§25**, **OD-06** locked |
| **IGA boundary** | Operating model **§24**, **OD-07**; ADR **§2.3**, **§3** |
| **Billing doctrine** | Operating model **§8** and related policy rows |
| **Timesheet doctrine** | Operating model timesheet / engagement sections (as cited in gap matrix) |
| **Worker archetypes** | Operating model personas / **OD-05** path |
| **Role transition** | [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md) |
| **Schema design baseline** | [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) + [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md) |

---

## 3. Deferred (explicitly not blocking v1.0 ratification)

Examples (maintain in backlog / ADR §8 style lists):

```text
Portal MVP (supplier-facing)
Badge supplier specifics
IGA integration-specific payload and connector behavior
Supplier portal UX polish
```

Deferred items **must** still comply with ratified doctrine when implemented; they do not reopen locked ODs without a new ADR or constitution version.

---

## 4. Binding governance sources

All execution work **must** remain aligned to:

```text
CONTRACTOR_OPERATING_MODEL_V1 (v1.0 ratified)
ADR-EXTID-001 (PROPOSED after §7)
PR-EXTID-SCHEMA-1_DESIGN
IMPLEMENTATION_DRIFT_GATES
ROLE_TRANSITION_MATRIX_V1
SCHEMA_IMPACT_REGISTER_V1
EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1
EXTID_MIGRATION_SAFETY_CHECKLIST (for schema PRs)
SCHEMA_DIFF_REVIEW (before merge of PR-EXTID-SCHEMA-1A)
RATIFICATION_STATE_CONSISTENCY_CHECK (after §7.4, before 1A PR)
```

**PR-EXTID-SCHEMA-1A merge:** Also complete [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) (copy or inline in PR) **and** [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) (after §7.4).

---

## 5. PR authority

**Rule:** Every execution PR in the EXTID program carries the **alignment header** from [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) **§1**, citing the **subsections** touched.

**Rule:** **No** Prisma migration or additive schema merge that contradicts [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) without an **ADR revision** or **constitution** bump.

**Rule:** Prefer **schema first, behavior later** — phased delivery per [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) and [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) **§7** (split PRs).

**Schema maturity:** Treat columns as **schema candidates** in the sense of [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) maturity classes until **DTO/API (1B)** completes stable contracts — do not over-interpret **1A** alone as full domain closure.

---

## 6. Drift gate activation plan

Canonical gate definitions: [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) **§2**.

| Phase | Activation focus | Gate IDs (reference) |
|-------|------------------|----------------------|
| **PR-EXTID-SCHEMA-1A** (Prisma only) | No IGA lifecycle misuse in schema or enums; no sponsor/supplier conflation; preserve `contractor_id` / correlation story | **G-EXTID-02** (and design anti-patterns in **PR-EXTID-SCHEMA-1_DESIGN**) |
| **PR-EXTID-SCHEMA-1B** (DTO / API) | Access enablement semantics; no CMS copy equating IGA failure with invalid worker | **G-EXTID-04**, **G-EXTID-05** (as applicable) |
| **PR-EXTID-SCHEMA-1C** (Seed) | Seed re-run safety; no hard fail on legacy nulls | Checklist + **G-EXTID-01** (manual until enforcement date) |
| **PR-EXTID-SCHEMA-1D** (Drift encode) | Automate grep / tests for **G-EXTID-02** first; then catalog per roadmap | **G-EXTID-02** → **G-EXTID-06**, **G-EXTID-07** as scripts land |

**Note:** **G-EXTID-01** (sponsor required for **ACTIVE**) applies after policy/enforcement date — not for initial nullable column landing.

**First philosophy (defaults):** Prefer nullable + safe defaults (e.g. `external_person_id` nullable / backfill path; `sponsor_employee_id` nullable; `iga_integration_status` default **UNKNOWN** or equivalent; `access_enablement_status` default **NOT_REQUIRED** where doctrine allows). **Avoid:** immediate **NOT NULL** sponsor, access-gate enforcement, role remap, workflow logic in **1A**.

---

## 7. Governance Authorization Gate (sign-off)

**§7 is the only step between “governance package complete” and “controlled execution authorized.”** Sign-off means:

- **Doctrine is locked enough for additive schema** — **not** “the entire product is complete,” “portal is shipped,” or “IGA is live.”
- **Authorization is bounded** — see **§7.4** standard line; downstream **RBAC / HCM / IGA / UI** streams remain **separately** gated.

### 7.1 Sign-off semantics (what each role attests)

| Role | Signs (attests to) |
|------|---------------------|
| **Product** | Operating model, personas, **billing doctrine**, **timesheet doctrine**, roadmap alignment with ratified scope (**§2**) and deferred list (**§3**). |
| **Architecture** | Schema direction, **sponsor model**, **HCM boundary**, **IGA boundary**, **phased execution** (1A→1D) per design + alignment plan. |
| **Security / Governance** | **ADR** integrity, **drift gates**, anti-pattern controls (**no CMS/IGA lifecycle conflation**), alignment header + checklist discipline. |

### 7.2 Standard authorization line (all signers acknowledge)

Each signatory confirms the following line (initial in **Signature / link** column or attach memo):

```text
Approved for PR-EXTID-SCHEMA-1A additive schema execution only; downstream RBAC/HCM/IGA streams remain separately gated.
```

### 7.3 Approval register

| Role | Name | Date | Signature / link |
|------|------|------|------------------|
| **Product** | | | |
| **Architecture** | | | |
| **Security / Governance** | | | |

### 7.4 Required document actions (**mandatory** state transition — not optional doc tidy-up)

Execute **steps 1–4** in order; then run **step 5** before opening **PR-EXTID-SCHEMA-1A**.

1. **[`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md)** — **Status:** `v0.5` → **`v1.0 RATIFIED`**; update **Version** / changelog row.  
2. **[`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)** — **Status:** `DRAFT` → **`PROPOSED`** using **§1** template line above.  
3. **[`OPERATING_MODEL_DECISION_LOG.md`](./OPERATING_MODEL_DECISION_LOG.md)** — Record **GOV-EXTID-01** (see **Governance authorization** table); append dated row to decision log **Changelog** per table instructions.  
4. **[`README.md`](../../README.md)** — Doctrine baseline: **production-bound governance active for Schema Stream 1A only** (additive Prisma); downstream streams separately gated; update operating-model table row to **v1.0 RATIFIED** when applicable.  
5. **[`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)** — Complete checklist + sign-off **before** opening **PR-EXTID-SCHEMA-1A** (final drift checkpoint).

### 7.5 Explicitly **not** authorized by §7 alone

**§7 does not** authorize merge of:

```text
RBAC changes (PR-RBAC-REALIGN-1)
Portal / supplier UX
HCM sponsor bridge implementation
IGA integration or event publishers
Workflow or business-rule enforcement on new columns
UI changes that depend on new fields
```

Those remain **separate** PRs and gates after **1A**.

---

## 8. Recommended execution sequence (post–§7)

```text
§7.3 Human sign-off (this document)
§7.4 State transition (steps 1–4)
RATIFICATION_STATE_CONSISTENCY_CHECK (step 5 — before code)
PR-EXTID-SCHEMA-1A (Prisma — additive only; SCHEMA_DIFF_REVIEW + checklist)
PR-EXTID-SCHEMA-1B (DTO / API)
PR-EXTID-SCHEMA-1C (Seed compatibility)
PR-EXTID-SCHEMA-1D (Drift encode — begin G-EXTID-02)
PR-RBAC-REALIGN-1
PR-HCM-SPONSOR-BRIDGE-1
PR-IGA-EVENT-CONTRACT-1
```

**Rationale:** Schema without subsequent **PR-RBAC-REALIGN-1** leaves visible doctrine conflict (e.g. contractor invoice scope); plan both before declaring program “green.”

---

## 9. References

- [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md)
- [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)
- [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md)
- [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md)
- [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.3 | **§7.4** mandatory + step **5** [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md); **§8** ladder |
| 1.2 | **§4** binding list + **§9** refs: **SCHEMA_DIFF_REVIEW**; **§7.4** decision log **GOV-EXTID-01** |
| 1.1 | **§7** = Governance Authorization Gate; sign-off semantics; bounded authorization line; **§7.4** post-sign-off doc actions; **§7.5** exclusions; **1A** diff review + defaults |
| 1.0 | Initial ratification record template |
