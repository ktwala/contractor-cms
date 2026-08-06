# EXTID Implementation Alignment Plan v1

**Status:** `DRAFT` — **V1.0 ratification preparation** (controlled transition to implementation architecture). **Not** additional doctrine discovery.

**Purpose:** Convert **current repo truth** into a **sequenced, doctrine-aligned** roadmap so engineering can align with [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) **v0.5** and [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) **without** destabilizing existing product surfaces.

**Architecture execution discipline:** **Do not** add new governance **documents** unless they are **execution-specific** (e.g. schema design for an upcoming PR, drift-gate catalog). Strategy stays in the constitution, ADR, and this plan; avoid parallel “strategy” files.

**Companion artifacts**

| Artifact | Role |
|----------|------|
| [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) | **Design-only** additive schema — canonical fields, anti-patterns, per-field candidate table (**before** `PR-EXTID-SCHEMA-1` code) |
| [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) | PR alignment header template + drift gate catalog (CI / review) |
| [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) | **Execution** — v1.0 sign-off; doctrine→implementation handoff; ADR → **PROPOSED** trigger |
| [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) | **Execution** — PR-EXTID-SCHEMA-1A–1D migration / seed / API safety |
| [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) | **Execution** — **1A** merge gate (diff narrative) |
| [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) | **Execution** — one-time pre–**1A** doc state parity (after §7.4) |
| [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md) | Seed / target personas and permission migration |
| [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md) | Field-level impact and additive schema candidates |
| [`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](./CURRENT_STATE_VS_TARGET_GAP_MATRIX.md) | Target column fill driven by this plan |
| [`OPERATING_MODEL_DECISION_LOG.md`](./OPERATING_MODEL_DECISION_LOG.md) | OD lock record |

**Implementation maturity classes** (use in tickets and PR titles)

| Class | Meaning |
|-------|--------|
| **Doctrine locked** | Behavior defined in operating model / ADR; no code change required to “lock.” |
| **Schema candidate** | Field or table approved for additive design; migration not yet production-bound. |
| **Production bound** | Merged + released under **v1.0 ratification** + **ADR PROPOSED** (or **ACCEPTED**) per [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) and gates (or explicit waiver). |

---

## 1. Executive objective

```text
Align current External Workforce Platform with ADR-EXTID-001 and CONTRACTOR_OPERATING_MODEL_V1 without destabilizing existing product surfaces.
```

---

## 2. Current-state conflicts (explicit)

Derived from [`CURRENT_STATE_DISCOVERY.md`](./CURRENT_STATE_DISCOVERY.md) and operating model **§19**. These are **non-compliant** with doctrine until remediated (not “bugs” in isolation—they are **governance debt**).

| Conflict | Evidence / risk |
|----------|-----------------|
| **CONTRACTOR invoice visibility** | Seed **`invoices:read`** + org-wide `InvoicesService` list vs **OD-01** / **§8** (default OFF enterprise invoice; row scope required). |
| **No sponsor baseline** | No `sponsor_employee_id` (or equivalent) on placement / engagement path vs **§25**. |
| **No supplier portal** | No `User.supplierId` / supplier auth vs **OD-04** target (interim OFF is OK). |
| **No `external_person_id`** | Outbound correlation to IGA/HCM not first-class vs **ADR-EXTID-001 §5**. |
| **No `access_intent`** | Cannot express physical-only / logical / none vs **§10**, **§24**. |
| **No IGA boundary fields** | No `iga_integration_status` / `access_enablement_status` vs **§7.2–§7.3**. |
| **No HCM sponsor bridge** | Sponsor identity not validated against HCM vs **§25.3**. |

---

## 3. Migration streams

### STREAM A — Schema (additive first)

Likely concepts (detail in [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md)):

```text
external_person_id
person_type / contractor_type
sponsor_employee_id
sponsor_status
sponsor_delegate_employee_id
access_intent
iga_integration_status
access_enablement_status
```

### STREAM B — RBAC

See [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md).

Likely:

```text
Remove / rescope CONTRACTOR invoices:read (org-wide)
Add Supplier Admin (when portal)
Add Sponsor-facing capabilities (internal user + sponsor binding, not “ghost admin”)
```

### STREAM C — HCM

```text
Sponsor validation (resolve sponsor_employee_id)
department (where required)
cost_center (enrichment / validation vs Project.engagement caches)
```

### STREAM D — IGA

```text
Event outbox (or bus publisher)
Outbound payload contract (per ADR §6)
Inbound status sync (failure semantics per §24)
```

### STREAM E — UI / NAV

```text
Supplier portal routes (gated)
Sponsor attestation / reassignment UX (internal)
Governance-aligned dashboards (permission-only grouping)
```

---

## 4. Sequence (phased — not all at once)

| Phase | Focus | Rationale |
|-------|--------|-----------|
| **1** | **Schema design + additive expansion (STREAM A)** | Canonical shape first — RBAC, HCM, IGA, and UI depend on it; avoid duplicate sponsor logic and integration inconsistency. **Design** lives in [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md); **implementation** = `PR-EXTID-SCHEMA-1` (nullable-first, no destructive rewrites). |
| **2** | **RBAC conflict remediation (STREAM B)** | CONTRACTOR invoice scope, Supplier Admin / Sponsor bundles — **PR-RBAC-REALIGN-1**; may overlap late schema implementation but **not** before additive columns exist where policy flags need persistence. |
| **3** | **Sponsor + HCM bridge (STREAM C)** | Accountability plane enforcement in data. |
| **4** | **IGA event model (STREAM D)** | After sponsor correlation id stable enough for payloads. |
| **5** | **Portal / UX (STREAM E)** | Supplier portal and sponsor-heavy UX last unless spike proves dependency inversion. |

**Post–v1.0 ratification — suggested execution ladder**

```text
V1.0 Ratification ([`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7.3 complete; §7.4 steps 1–4)
ADR-EXTID-001 → PROPOSED (header line per ratification record)
[`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) (§7.4 step 5 — before code)
PR-EXTID-SCHEMA-1A (Prisma — additive only; see checklist + SCHEMA_DIFF_REVIEW)
PR-EXTID-SCHEMA-1B (DTO / API)
PR-EXTID-SCHEMA-1C (Seed)
PR-EXTID-SCHEMA-1D (Drift encode — begin G-EXTID-02) — or combined with 1C if low risk
PR-RBAC-REALIGN-1
PR-HCM-SPONSOR-BRIDGE-1
PR-IGA-EVENT-CONTRACT-1
PR-NAV-IA-1
```

Parallel **documentation-only** updates (gap matrix, seed notes) should trail each phase, not lead risky code.

---

## 5. Anti-disruption principles

```text
No hard schema break without ADR amendment + migration plan
No forced supplier portal before MVP
No direct IGA coupling in core request path before contract tests
No role removals without migration path (deprecate → restrict → replace)
```

---

## 6. Backward compatibility — example: CONTRACTOR role

| Strategy | Meaning |
|-----------|---------|
| **Deprecate** | Document seed role as non-conformant; avoid new tenants inheriting bad bundle. |
| **Restrict** | Narrow `invoices:read` to row-scope API + UI **before** removing permission entirely. |
| **Replace** | Introduce **External Worker** (or equivalent) persona with least-privilege bundle. |

**Not:** immediate destructive removal of `CONTRACTOR` in production-like environments without comms and migration.

---

## 7. Governance gates (before each stream)

Require (minimum):

- **PR alignment header** — every EXTID-related PR description includes the block in [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) **§1** (trace doctrine ↔ code).
- **ADR alignment** — change still fits [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) (or explicit ADR revision).
- **Decision log alignment** — no silent contradiction of **LOCKED** OD rows.
- **Gap closure note** — row updated in [`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](./CURRENT_STATE_VS_TARGET_GAP_MATRIX.md).
- **Drift checks** — `governance-drift-check`, `security-drift-check`, catalog verifiers as applicable; **EXTID-specific** gates in [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) **§2** (manual until scripted). **PR-EXTID-SCHEMA-1A merge:** completed [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md).

---

## 8. ADR progression (recommended)

| ADR state | When | ADR reference |
|-----------|------|----------------|
| **DRAFT** | Now (shell filed). | [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) **§11** |
| **PROPOSED** | **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7** complete (constitution **v1.0**); paste header line from record **§1**. | **§11** |
| **ACCEPTED** | Program-defined **production acceptance** of deployed patterns (or explicit enterprise sign-off). | **§11** |

**Suggested progression**

```text
v0.5 Doctrine Lock
ADR Draft
Implementation Alignment Plan (this document) + Role Matrix + Schema Register
PR-EXTID-SCHEMA-1_DESIGN + IMPLEMENTATION_DRIFT_GATES + V1_0_RATIFICATION_RECORD (§7) + EXTID_MIGRATION_SAFETY_CHECKLIST + RATIFICATION_STATE_CONSISTENCY_CHECK (template ready)
V1.0 Constitution Ratification (record §7.3 + §7.4 executed)
ADR Proposed (per record §1)
RATIFICATION_STATE_CONSISTENCY_CHECK (signed — before 1A)
PR-EXTID-SCHEMA-1A → 1B → 1C → 1D (implementation; production-bound per gate)
PR-RBAC-REALIGN-1 → PR-HCM-SPONSOR-BRIDGE-1 → PR-IGA-EVENT-CONTRACT-1 → PR-NAV-IA-1
ADR Accepted
```

---

## 9. V1.0 ratification package (must-have checklist)

Before **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7** sign-off and **ADR** → **PROPOSED** (per record **§1**):

```text
Implementation alignment plan (this document) — reviewed
PR-EXTID-SCHEMA-1_DESIGN — reviewed (additive schema, candidate table)
IMPLEMENTATION_DRIFT_GATES — reviewed (alignment header + gate catalog)
EXTID_MIGRATION_SAFETY_CHECKLIST — reviewed (schema PR readiness)
V1_0_RATIFICATION_RECORD — §7 sign-offs completed (doctrine → implementation)
Conflict remediation plan (esp. CONTRACTOR invoice scope) — agreed
Migration sequencing approved (1A–1D)
Role transition strategy (ROLE_TRANSITION_MATRIX_V1)
Seed update strategy
```

**ADR → ACCEPTED** remains a **separate** program milestone (see **§8** table).

**After §7.4:** complete [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) (step **5** in ratification record **§7.4**) **before** **PR-EXTID-SCHEMA-1A**.

---

## 10. References

- [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md)
- [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md)
- [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)
- [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md)
- [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)
- [`CURRENT_STATE_DISCOVERY.md`](./CURRENT_STATE_DISCOVERY.md)
- [`OPERATING_MODEL_MARKET_BENCHMARK.md`](./OPERATING_MODEL_MARKET_BENCHMARK.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.4 | **RATIFICATION_STATE_CONSISTENCY_CHECK**; ladder + **§8** progression; companion row; **§9** post–§7.4 note |
| 1.3 | **§7** merge gate: **SCHEMA_DIFF_REVIEW** for **1A** |
| 1.2 | **V1_0_RATIFICATION_RECORD** + **EXTID_MIGRATION_SAFETY_CHECKLIST**; ladder **1A–1D**; progression block ties ratification §7 to ADR **PROPOSED** |
| 1.1 | Schema-first **§4** sequence + execution ladder; companion **PR-EXTID-SCHEMA-1_DESIGN** + **IMPLEMENTATION_DRIFT_GATES**; **§7** PR alignment header; execution discipline (no new strategy docs) |
| 1.0 | Initial alignment plan — controlled transition package |
