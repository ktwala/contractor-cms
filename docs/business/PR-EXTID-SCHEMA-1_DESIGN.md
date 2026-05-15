# PR-EXTID-SCHEMA-1 — Additive schema design (pre-implementation)

**Status:** `DRAFT` — **design only** for **PR-EXTID-SCHEMA-1**. **No** destructive rewrites; **no** production-bound migration until **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7** is complete (doctrine → implementation handoff) **and** **ADR-EXTID-001** advances per that record.

**Purpose:** Lock **canonical data shape** so RBAC, HCM, IGA, and UI programs do not diverge. Schema is **first code wave** after v1.0 ratification because other streams depend on it.

**Upstream:** [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md), [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) **§5**, operating model **§18**, **§25**.

**Downstream:** Phased implementation (**§7** below) — **after** design review **and** [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) **§7** sign-off. Use [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) on every migration PR; **before merge of 1A**, complete [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md).

---

## Design principles

| Principle | Application |
|-------------|----------------|
| **Additive first** | New columns nullable or defaulted until backfill completes. |
| **Nullable where safe** | Prefer `NULL` = “unknown / not yet integrated” over sentinel magic. |
| **Default-safe** | DB defaults and application defaults must not violate doctrine (e.g. do not default `access_enablement_status` to `ENABLED`). |
| **Backward compatible** | Existing APIs continue to function; new fields optional in DTOs until read paths populated. |
| **Seed compatible** | `seed.ts` updated in same PR wave or follow-up with documented interim semantics. |
| **Migration path** | Expand → backfill → enforce (optional third phase), never big-bang delete. |

---

## Anti-patterns (do not)

```text
Hard replace contractor_id as primary correlation key
Delete existing role / permission assumptions in the same PR as first column add
Use iga_provisioned (or similar) as a CMS workforce lifecycle state
Conflate supplier with sponsor (distinct FKs and semantics)
```

---

## 1. Canonical identity fields

| Field | Type (illustrative) | Nullable first? | Notes |
|-------|---------------------|-----------------|--------|
| **`external_person_id`** | UUID / string, stable | Yes until backfill | Outbound correlation for HCM / IGA; may default `= contractor.id` initially. |
| **`person_type`** / **`contractor_type`** | Enum | Yes (`NULL` = legacy / default archetype) | Aligns with independent path (**OD-05**); exact enum in ADR follow-up. |
| **`supplier_resource_id`** | string / UUID, optional | Yes | **Optional** supplier-system resource key when supplier systems expose a distinct worker id; **not** a replacement for `supplierId`. |

---

## 2. Sponsor fields

| Field | Type (illustrative) | Nullable first? | Notes |
|-------|---------------------|-----------------|--------|
| **`sponsor_employee_id`** | string (HCM key) | Yes, then enforce for new `ACTIVE` | Primary sponsor; **§25**. |
| **`sponsor_delegate_employee_id`** | string, optional | Yes | Delegate; primary retains accountability. |
| **`sponsor_status`** | Enum | Yes | e.g. `ACTIVE`, `TRANSFER_PENDING`, `REVOKED` — TBD. |

**Anchor table:** Prefer **`ContractorEngagement`** (placement) vs `Contractor` row — decision: *one sponsor per engagement* (recommended) unless product requires sponsor at contractor-level only; document in implementation PR.

---

## 3. Access intent

| Field | Type | Nullable first? | Notes |
|-------|------|-----------------|--------|
| **`access_intent`** | Enum | Yes | Drives IGA payload shape; maps to constitution **§10**. |
| **`identity_required`** | boolean | Yes | Default `false` until evaluated. |
| **`physical_access_required`** | boolean | Yes | |
| **`logical_access_required`** | boolean | Yes | |

**Rule:** At least one of the three booleans should be consistent with `access_intent`; validation in application layer (Phase 2+).

---

## 4. IGA boundary fields

| Field | Type | Nullable first? | Notes |
|-------|------|-----------------|--------|
| **`iga_integration_status`** | Enum | Yes | Mirrors **§7.2** plane; **not** CMS workforce `ACTIVE`. |
| **`access_enablement_status`** | Enum | Yes | Mirrors **§7.3**; default `NOT_REQUIRED` or `PENDING_IGA` per `access_intent`. |
| **`iga_last_sync_at`** | timestamptz | Yes | Optional operational telemetry. |

---

## 5. Governance fields

| Field | Type | Nullable first? | Notes |
|-------|------|-----------------|--------|
| **`risk_tier`** | Enum or int | Yes | PDP / audit alignment; optional in first migration. |
| **`worker_archetype`** | Enum | Yes | May duplicate `person_type` — **collapse** in implementation if redundant; keep one canonical column. |

---

## 6. Schema candidate register (per-field)

| Field | Candidate | Mandatory later? | Stream | Risk |
|-------|-----------|------------------|--------|------|
| `external_person_id` | Yes | Yes (correlation) | A — Schema | Low if defaulted to `contractor.id` |
| `person_type` | Yes | For OD-05 | A | Medium — legal branching |
| `supplier_resource_id` | Optional | No | A / integrations | Low |
| `sponsor_employee_id` | Yes | Yes for new **ACTIVE** | A → C HCM | High — data quality |
| `sponsor_delegate_employee_id` | Yes | No | A | Low |
| `sponsor_status` | Yes | Yes | A | Medium |
| `access_intent` + booleans | Yes | Yes for IGA | A → D | Medium |
| `iga_integration_status` | Yes | Yes when IGA live | A → D | Medium |
| `access_enablement_status` | Yes | Yes when IGA live | A → D | Medium |
| `iga_last_sync_at` | Yes | No | D | Low |
| `risk_tier` / `worker_archetype` | Optional | TBD | A / PDP | Medium |

---

## 7. Phased PR split (minimize blast radius)

| PR | Scope | Must avoid |
|----|--------|------------|
| **PR-EXTID-SCHEMA-1A** | **Only** Prisma schema + migration: additive fields, nullable + safe defaults. **Merge gate:** completed [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) (PR attachment or `docs/business/` copy). | RBAC, portal, HCM bridge, IGA integration, workflow logic, UI, business rules on new columns, NOT NULL sponsor on legacy, access enforcement |
| **PR-EXTID-SCHEMA-1B** | DTO + API surface (optional fields; read paths tolerate `NULL`) | Breaking required request bodies |
| **PR-EXTID-SCHEMA-1C** | Seed compatibility + benign demo defaults | Seed hard-fail on null new columns |
| **PR-EXTID-SCHEMA-1D** | Encode drift checks (**G-EXTID-***) in CI where applicable | Changing column semantics without ADR |

**1A — explicitly out of scope:** RBAC changes; portal; HCM bridge; IGA publishers/consumers; workflow logic; UI. **1A = structural substrate only.**

**1A outcome:** The model can **represent** doctrine in persisted fields — **enforcement** belongs in **1B+**, RBAC, HCM, and IGA streams (**not** in **1A**).

**Within 1A:** Prisma edits → `db:migrate` (dev) → regenerate client → [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) **§1–3** → **G-EXTID-02** + sponsor/supplier conflation review on diff.

**Governance — earliest enforce on 1A:** **G-EXTID-02** (no IGA lifecycle as CMS state); schema anti-pattern: **no sponsor/supplier conflation** (see design **Anti-patterns**).

**After 1C:** Follow-up PRs may **enforce** sponsor for new `ACTIVE` (application or DB constraint — second wave), coordinated with [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) **G-EXTID-01**.

---

## 8. References

- [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) — **required before merge** of **1A**  
- [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) — post–§7.4, pre–**1A**  
- [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) — handoff gate  
- [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) — per-PR safety  
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) — streams + ladder  
- [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) — CI / review gates  
- [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md) — **STREAM B** / **PR-RBAC-REALIGN-1** after schema columns land  
- [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.3 | **1A** represent-vs-enforce + **RATIFICATION_STATE** pointer |
| 1.2 | **1A** scope discipline + **SCHEMA_DIFF_REVIEW** merge gate; **G-EXTID-02** on 1A |
| 1.1 | **§7** phased 1A–1D; ratification + migration checklist gates |
| 1.0 | Initial design shell — execution governance |
