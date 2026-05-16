# ADR-EXTID-001 — External Workforce Identity, Sponsorship, and IGA Boundary Doctrine

**Status:** `DRAFT` — Doctrine locked at [`CONTRACTOR_OPERATING_MODEL_V1`](../business/CONTRACTOR_OPERATING_MODEL_V1.md) **v0.5**; **implementation binding** deferred until **[`V1_0_RATIFICATION_RECORD.md`](../business/V1_0_RATIFICATION_RECORD.md) §7** is complete and this ADR advances to **PROPOSED** per that record **§1** (unless leadership explicitly waives).

**Doctrine → implementation handoff:** When the operating model is ratified to **v1.0**, complete the ratification record and update this document’s **Status** line to **PROPOSED** using the exact template in [`V1_0_RATIFICATION_RECORD.md`](../business/V1_0_RATIFICATION_RECORD.md) **§1**.

**ADR scope boundary:** This ADR defines **constitutional architecture** and integration contracts at the **pattern** level — **not** implementation sequencing, migration runbooks, or integration-specific IGA configuration.

**Date:** May 2026  

---

## 1. Context

Contractor CMS has evolved beyond a simple contractor registry into a **governed external workforce** platform with:

- Clear **separation of Supplier (commercial party)** and **worker (contractor record)** — never conflated as identities.
- **Sponsor governance** (accountability plane) — business justification between workforce legitimacy and access requests.
- **CMS ≠ IGA** — Contractor CMS is an **upstream authoritative feed** and governance trigger; it does **not** replace enterprise IGA for provisioning, SoD, certification, or badge/PACS execution.
- **HCM dependency** for **sponsor employee identity** (and broader org hierarchy where integrated).
- A **three-plane model** documented in the operating constitution: **workforce** (CMS), **accountability** (sponsor), **access** (IGA) — see [`CONTRACTOR_OPERATING_MODEL_V1.md`](../business/CONTRACTOR_OPERATING_MODEL_V1.md) **§7**, **§24**, **§25**.

This ADR **codifies** those boundaries for security and platform architecture so schema, events, RBAC, and integrations can align without doctrine drift.

---

## 2. Decision

### 2.1 CMS governs (authoritative in product scope)

- **Workforce legitimacy** — who may exist in the governed extended workforce and under what commercial controls.
- **Supplier** context — Supplier party, contracts, and operational relationship to the client org.
- **Sponsor** binding — **primary** sponsor (HCM employee reference), optional delegate; accountability for capability need.
- **Lifecycle** — workforce plane states (nomination through termination) per constitution.
- **Compliance** — tax classification, BBBEE, withholding payloads, and product-scope compliance artifacts.
- **Access intent** — classification of whether / what class of physical or logical access is required (input to IGA, not execution).

### 2.2 HCM governs (system of record)

- **Sponsor identity** — employee master for the accountable sponsor (CMS stores references, not duplicate HR truth long-term).
- **Org hierarchy** — department, position, manager chain where applicable and integrated.

### 2.3 IGA governs (execution engine)

- **Provisioning** of logical identities in target systems.
- **Badge** / physical access where in scope for the deployment.
- **Logical access** grants and revocations per enterprise policy.
- **Certification** campaigns and **SoD** enforcement **in IGA systems** — CMS may **trigger** or **signal**; IGA **executes**.

---

## 3. Non-negotiables

```text
No CMS ACTIVE without primary sponsor (per operating model §25)
No ACCESS_ENABLED without configured sponsor path + IGA path when access is required
CMS must not imply access provisioning success
IGA must not imply workforce / commercial legitimacy
Supplier and worker are distinct entities
```

---

## 4. State model (conceptual)

### 4.1 Workforce states (CMS plane)

As defined in the operating constitution (e.g. `NOMINATED` … `TERMINATED`). **Do not** merge IGA provisioning milestones into this plane.

### 4.2 IGA integration states (downstream)

Illustrative: `NOT_REQUIRED`, `PENDING`, `SENT`, `PROVISIONED`, `FAILED`, `REVOKED`, `UNKNOWN` — exact enum is an **implementation** decision post–v1.0 bind.

### 4.3 Access enablement states (product-facing)

Illustrative: `NOT_REQUIRED`, `PENDING_IGA`, `ENABLED`, `FAILED`, `REVOKED` — aligns with [`CONTRACTOR_OPERATING_MODEL_V1.md`](../business/CONTRACTOR_OPERATING_MODEL_V1.md) **§7.3**.

---

## 5. Schema implications (high-level only)

Illustrative fields / concepts — **no migration commitment** in this ADR:

```text
external_person_id           # stable CMS identifier for outbound correlation
person_type / contractor_type
sponsor_employee_id            # HCM-resolvable primary sponsor
sponsor_status
sponsor_delegate_employee_id   # optional
access_intent
iga_integration_status
access_enablement_status
```

**Avoid in this ADR:** column-level migrations, backfill strategy, index plans, or Prisma migration filenames.

---

## 6. Event doctrine (CMS outbound — contract substrate)

**Implemented in** [`backend/src/core/iga/`](../../backend/src/core/iga/): **PR-IGA-EVENT-CONTRACT-1** (`IgaEventBuilder`, `IgaOutboundExternalWorkforceEventV1`) — authoritative event names and payload shape; **PR-IGA-OUTBOX-1** durable `IgaOutboxEvent` rows; **PR-IGA-EVENT-WRITE-1** mutation-triggered transactional saves; **PR-IGA-DISPATCHER-1** `IgaOutboxDispatcherService.processPending` via stub `IgaDeliveryProvider` (SENT/FAILED); **PR-IGA-DISPATCH-SCHEDULER-1** optional interval worker (disabled by default). Message bus, webhooks, and vendor connectors remain future PRs.

Canonical names (v1):

```text
EXTERNAL_PERSON_CREATED
EXTERNAL_PERSON_UPDATED
EXTERNAL_PERSON_SPONSOR_ASSIGNED
EXTERNAL_PERSON_SPONSOR_REMOVED
EXTERNAL_PERSON_SUSPENDED
EXTERNAL_PERSON_TERMINATED
```

**Supersedes (illustrative only):** earlier draft names in this section such as `SPONSOR_ASSIGNED` / `EXTERNAL_PERSON_APPROVED` — align outbound integrations on the v1 catalog above.

Additional lifecycle or commercial events (e.g. contract extension) remain documented in the operating model **§24.2** until folded into a bus catalog ADR.

---

## 7. Consequences

### Positive

- **Enterprise-grade** separation of workforce truth, accountability, and access execution.
- Clear **HCM / IGA bridge** roles and ownership.
- **Configurable** deployments without collapsing planes in UI or API semantics.
- **Governance-safe** evolution: doctrine → ADR → implementation.

### Tradeoffs

- Higher **conceptual and integration** complexity.
- **Sponsor dependency** for healthy `ACTIVE` placements — operational discipline required.
- **Reliance on external** HCM and IGA maturity and contracts.

---

## 8. Deferred (explicitly out of scope for this draft)

```text
Exact schema migrations and FK graphs
API payload versioning and compatibility policy
Supplier portal MVP delivery order
Badge provider and PACS specifics
Per-supplier IGA connector behavior
RBAC matrix realignment detail (covered in dedicated PRs / ADRs)
Invoice row-scope remediation (tracked via gap matrix + implementation PRs)
```

---

## 9. v1.0 constitution bind — prerequisites (suggested)

Before advancing this ADR to **PROPOSED** (see **§11**) and treating **EXTID schema PRs** as **authority-bound** implementation:

- **[`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](../business/EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)** — reviewed (streams, sequence, anti-disruption).
- **[`ROLE_TRANSITION_MATRIX_V1.md`](../business/ROLE_TRANSITION_MATRIX_V1.md)** — reviewed (role transition strategy).
- **[`SCHEMA_IMPACT_REGISTER_V1.md`](../business/SCHEMA_IMPACT_REGISTER_V1.md)** — reviewed (additive schema candidates).
- **[`PR-EXTID-SCHEMA-1_DESIGN.md`](../business/PR-EXTID-SCHEMA-1_DESIGN.md)** — reviewed (pre-implementation additive schema).
- **[`IMPLEMENTATION_DRIFT_GATES.md`](../business/IMPLEMENTATION_DRIFT_GATES.md)** — reviewed (PR alignment header + drift gates).
- **[`V1_0_RATIFICATION_RECORD.md`](../business/V1_0_RATIFICATION_RECORD.md)** — **§7** executed (constitution **v1.0**); triggers **PROPOSED** for this ADR.
- **[`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](../business/EXTID_MIGRATION_SAFETY_CHECKLIST.md)** — reviewed for schema PR readiness.
- **[`SCHEMA_DIFF_REVIEW.md`](../business/SCHEMA_DIFF_REVIEW.md)** — reviewed; **1A** PR includes completed diff review before merge.
- **ADR** advanced per alignment plan **§8** (`DRAFT` → `PROPOSED` → `ACCEPTED`) with signatories.
- **[`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](../business/CURRENT_STATE_VS_TARGET_GAP_MATRIX.md)** — **Target** column prioritized for repo ↔ doctrine gaps.
- **Migration strategy** approved for sponsor + dual-status fields.
- **Seed / demo role** strategy for conflicts (e.g. contractor invoice read scope).
- **Invoice scope remediation** path agreed (security + product).

**ACCEPTED** (final bind) follows program **production acceptance** criteria — see **§11**.

---

## 10. References

| Document | Role |
|----------|------|
| [`CONTRACTOR_OPERATING_MODEL_V1.md`](../business/CONTRACTOR_OPERATING_MODEL_V1.md) | Product constitution — **§24** (IGA boundary), **§25** (sponsor), **§20–§23** (ADR bind rules) |
| [`OPERATING_MODEL_DECISION_LOG.md`](../business/OPERATING_MODEL_DECISION_LOG.md) | OD-06 / OD-07 doctrine lock record |
| [`OPERATING_MODEL_MARKET_BENCHMARK.md`](../business/OPERATING_MODEL_MARKET_BENCHMARK.md) | Workshop-oriented market patterns |
| [`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](../business/CURRENT_STATE_VS_TARGET_GAP_MATRIX.md) | Current vs target gaps |
| [`SCHEMA_IMPACT_REGISTER_V1.md`](../business/SCHEMA_IMPACT_REGISTER_V1.md) | Additive schema impact register |
| [`IMPLEMENTATION_DRIFT_GATES.md`](../business/IMPLEMENTATION_DRIFT_GATES.md) | PR alignment header + EXTID drift gate catalog |
| [`PR-EXTID-SCHEMA-1_DESIGN.md`](../business/PR-EXTID-SCHEMA-1_DESIGN.md) | Additive schema design for **PR-EXTID-SCHEMA-1** |
| [`V1_0_RATIFICATION_RECORD.md`](../business/V1_0_RATIFICATION_RECORD.md) | v1.0 sign-off; ADR **PROPOSED** trigger |
| [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](../business/EXTID_MIGRATION_SAFETY_CHECKLIST.md) | Schema PR migration safety |
| [`SCHEMA_DIFF_REVIEW.md`](../business/SCHEMA_DIFF_REVIEW.md) | **1A** merge gate — what changed / not / deferred |
| [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](../business/EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) | Implementation sequencing and gates |
| [`backend/src/core/iga/`](../../backend/src/core/iga/) | **PR-IGA-EVENT-CONTRACT-1** — outbound event **payload contract** (v1); no transport or IGA execution |

---

## 11. ADR status lifecycle (recommended)

| State | Meaning |
|-------|---------|
| **DRAFT** | Shell filed; doctrine locked at operating model **v0.5**. |
| **PROPOSED** | **[`V1_0_RATIFICATION_RECORD.md`](../business/V1_0_RATIFICATION_RECORD.md) §7** complete — **CONTRACTOR_OPERATING_MODEL_V1** ratified **v1.0**; paste **Status** line from record **§1**. Architecture **governs implementation** during rollout; not the same as final enterprise acceptance. |
| **ACCEPTED** | Program-defined **production acceptance** (deployed patterns, IGA/HCM readiness, or explicit sign-off). Use for “final bind” beyond **PROPOSED**. |

**Do not** skip **PROPOSED** if multiple teams must acknowledge scope.

**Operational rule:** **Do not** merge **PR-EXTID-SCHEMA-1A** until **PROPOSED** is in effect (ratification record executed), unless an explicit **waiver** is recorded in the ratification record or decision log.

---

## 12. Likely follow-on workstreams (not commitments)

Naming convention for engineering planning only (see also [`PR-EXTID-SCHEMA-1_DESIGN.md`](../business/PR-EXTID-SCHEMA-1_DESIGN.md) **§7** before coding):

```text
PR-EXTID-SCHEMA-1_DESIGN (document — filed in docs/business)
PR-EXTID-SCHEMA-1A (Prisma — additive only)
PR-EXTID-SCHEMA-1B (DTO / API)
PR-EXTID-SCHEMA-1C (Seed)
PR-EXTID-SCHEMA-1D (Drift encode)
PR-RBAC-REALIGN-1
PR-HCM-SPONSOR-BRIDGE-1
PR-IGA-EVENT-CONTRACT-1
PR-IGA-OUTBOX-1
PR-IGA-EVENT-WRITE-1
PR-IGA-DISPATCHER-1
PR-IGA-DISPATCH-SCHEDULER-1
PR-IGA-CONNECTOR-1
PR-NAV-IA-1
```

Order and scope are decided at **v1.0 bind** and backlog prioritization — **not** by this ADR alone.

---

## Changelog

| Version | Note |
|---------|------|
| 0.1 | Draft shell — post **operating model v0.5** doctrine lock |
| 0.5 | **SCHEMA_DIFF_REVIEW** + **§9** prerequisite for **1A** merge; **§10** reference row |
| 0.4 | **§11** lifecycle: **PROPOSED** = [`V1_0_RATIFICATION_RECORD.md`](../business/V1_0_RATIFICATION_RECORD.md) §7; **ACCEPTED** = production acceptance; **§12** ladder **1A–1D**; **§9–§10** ratification record + **EXTID_MIGRATION_SAFETY_CHECKLIST**; header ties handoff to ratification record |
| 0.3 | **§12** ladder: design doc + **PR-RBAC-REALIGN-1** order; **§11 PROPOSED** prerequisites + **§10** references: **PR-EXTID-SCHEMA-1_DESIGN**, **IMPLEMENTATION_DRIFT_GATES**; **§9** prerequisite bullets for same |
| 0.2 | §9 prerequisites + references: alignment plan, role matrix, schema register; **§11** ADR lifecycle (renumbered from draft §12) |
