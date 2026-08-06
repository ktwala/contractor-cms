# External Workforce Operating Model v1

> **Product:** External Workforce Platform (EWP). Renamed from *Contractor Operating Model* per [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md). *Contractor Management System (CMS)* is the historical v1 name. Schema/API identifiers remain `Contractor` until a separate migration ADR.

**Status:** `DRAFT` — **v0.5 Sponsor governance lock** — product constitution. **OD-06** and **OD-07** are **LOCKED at doctrine level** (**§25**, **§24**). **v1.0** = formal stakeholder **APPROVED** + gap matrix **Target** completion. **[ADR-EXTID-001](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)** **draft shell** filed; **production binding** of implementations remains gated by **v1.0** unless explicitly waived.

**Purpose:** Default **doctrine** for suppliers, contractors, sponsorship, billing, timesheets, identity, and role surfaces **across configurable deployments**. Engineering must implement this constitution or supersede it via version bump + ADR.

**Related governance assets**

| Asset | Role |
|--------|------|
| [`CURRENT_STATE_DISCOVERY.md`](./CURRENT_STATE_DISCOVERY.md) | Repo-backed **current** behavior |
| Appendix A (same file) | Questions-only discovery / workshop pack |
| [`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](./CURRENT_STATE_VS_TARGET_GAP_MATRIX.md) | Fill **Target** after ratification |
| [`OPERATING_MODEL_DECISION_LOG.md`](./OPERATING_MODEL_DECISION_LOG.md) | **OD register** — owner, status, rationale, interim default, blocked-by |
| [`OPERATING_MODEL_MARKET_BENCHMARK.md`](./OPERATING_MODEL_MARKET_BENCHMARK.md) | **Appendix B** — illustrative market patterns vs our defaults |
| [`ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) | **DRAFT** ADR shell — identity, sponsorship, IGA boundary (**not** production-binding until v1.0) |
| [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) | **V1.0 prep** — sequenced streams, gates, ADR lifecycle (see ADR **§11**) |
| [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) | **Execution** — additive schema design (pre–`PR-EXTID-SCHEMA-1` code) |
| [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) | **Execution** — PR alignment header + drift gate catalog (CI / review) |
| [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) | **Execution** — v1.0 sign-off; doctrine→implementation handoff; **ADR PROPOSED** trigger |
| [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) | **Execution** — PR-EXTID-SCHEMA-1A–1D migration / seed / API safety |
| [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) | **Execution** — **1A** merge gate: what changed / not / deferred / assumptions |
| [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md) | **Execution** — one-time after **§7.4**: doc state parity before **1A** |
| [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md) | Seed / target personas; deprecate → restrict → replace |
| [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md) | Schema **candidates**; additive-first impact register |

**Version**

| Version | Summary |
|---------|---------|
| 0.1 | Skeleton |
| 0.2 | Default doctrine, policy matrix, boundaries, personas, lifecycle, open decisions, roadmap |
| 0.3 | OD-01–05 resolved; decision log; benchmark; schema notes; conflicts; ADR/v1.0 gates |
| **0.4** | **IGA integration boundary:** CMS ≠ IGA; two-plane lifecycle; **access enablement** separate from CMS **ACTIVE**; OD-07 reframed; non-negotiables and §7 corrected |
| **0.5** | **§25 Sponsor governance (OD-06)** + doctrine **LOCK** for OD-06/07; **§24** milestone alias; **§7.1a**; **§20–§23**; **[ADR-EXTID-001](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) draft shell** |

---

## 1. Principles

1. **Current state ≠ target state.** Seeded roles and today’s APIs are inputs, not the constitution.
2. **Supplier and worker are distinct entities.** A contractor (worker record) is not the **Supplier** party under contract; linkage is policy, not identity collapse.
3. **Least privilege by default.** Especially for contractor-facing surfaces and enterprise financial data.
4. **Configurable platform.** Defaults are **product** defaults; loosening or tightening requires explicit configuration and governance review.
5. **PDP complements, not replaces, operational workflow.** Timesheet and invoice approvals remain domain workflows unless extended by ADR.
6. **Accountability over anonymity.** No durable **ACTIVE** external worker without accountable sponsor (**intent**; **§25**; enforcement in schema per **ADR-EXTID-001** post–v1.0 bind).
7. **EWP is not IGA.** The External Workforce Platform is an **upstream authoritative source for external workforce identity context** and governance triggers; it does **not** provision AD accounts, assign SAP roles, issue badges, run SoD, or run certification campaigns unless explicitly integrated as a **caller** to external systems—not as the execution engine of enterprise IGA.
8. **Three planes.** **Workforce** (CMS: who exists, supplier context, approval), **Accountability** (**Sponsor** — business justification; §25), **Access** (IGA: what is provisioned; §24). Sponsor is the **constitutional keystone** between workforce legitimacy and access justification once §25 is enforced in data.

---

## 2. Default product position

**Primary doctrine gate.** Defaults apply unless the policy matrix (§3) allows configuration.

### By default

```text
Is supplier mandatory?
Are contractors supplier resources by default?
Can independent contractors exist?
Is sponsor mandatory?
Is contractor self-service default off?
Is contractor invoice visibility default off?
Is supplier admin supported?
Is physical-only access supported?
```

| Question | Default doctrine | Notes |
|----------|------------------|--------|
| **Is supplier mandatory?** | **Yes.** | Relaxing is high-risk; requires ADR + migration. |
| **Are contractors supplier resources by default?** | **Yes** (canonical external workforce). | Commercial truth: supplier → client org. |
| **Can independent contractors exist?** | **Yes — supported, not default** (OD-05 **RESOLVED**). | See §11; billing branch when enabled. |
| **Is sponsor mandatory?** | **Yes** — see **§25**. **CMS `ACTIVE`** requires **primary sponsor assignment** (HCM employee identity). | **Schema / migration:** implementation backlog; doctrine **LOCKED** in v0.5. |
| **Is contractor self-service default off?** | **Split:** financial/invoice **off**; timesheet **supplier-led default**, self-entry **configurable** (OD-03 **RESOLVED**). | |
| **Is contractor invoice visibility default off?** | **Yes** (OD-01 **RESOLVED**). | Optional tiers: status → redacted → full. |
| **Is contractor login default?** | **Default OFF** for new governed placements (OD-02 **RESOLVED**). | Optional `User` for self-service when policy allows. |
| **Is supplier admin supported?** | **Target ON** (product maturity); **interim OFF** until portal MVP (OD-04 **RESOLVED**). | |
| **Is physical-only access supported?** | **Not executed inside core CMS.** | Physical/badge **provisioning** is **IGA**; CMS may record **access intent** and reflect status (§24). |

---

## 3. Configurable policy matrix

| Policy | Default | Configurable | Rationale / guardrail |
|--------|---------|--------------|------------------------|
| Supplier required (standard path) | Yes | Yes (restricted) | Nullable supplier → billing + RLS risk. |
| Sponsor required for workforce-approved placement | **Yes** (§25) | Limited | Doctrine **LOCKED** v0.5; schema + enforcement = implementation / ADR. |
| **IGA dependency before CMS ACTIVE** | **No** (default: do not block commercial truth on IGA) | Yes | **Dangerous if true globally**—see §24. May require IGA before **ACCESS_ENABLED** only. |
| Contractor enterprise **invoice** visibility | **No** | Yes (tiers) | OD-01. |
| Contractor **login** | **OFF** default | Yes | OD-02. |
| Contractor **timesheet self-entry** | **OFF** (supplier-led) | Yes | OD-03. |
| **Supplier portal** | **OFF** until MVP; **target ON** | Yes | OD-04. |
| Independent contractor archetype | **Off** | Yes (supported) | OD-05. |
| Badge-only / physical-only record | Off | Yes | IGA-led execution. |
| Client Contractor Admin (internal) | On | Yes | |
| PDP strictness | Deployment choice | Yes | Auditable. |

---

## 4. Non-negotiable governance controls

```text
No active external worker without accountable sponsor
Workforce legitimacy (CMS) and access provision outcome (IGA) must never be conflated
No active worker beyond contract_end
No privileged external identity without elevated governance
Supplier and worker are distinct entities
CMS must never pretend access succeeded; IGA must never invent worker legitimacy
```

| Control | Meaning |
|---------|--------|
| **No active external worker without accountable sponsor** | **Primary sponsor** (HCM employee identity) required for **CMS `ACTIVE`** — **§25** (doctrine **LOCKED** v0.5; data enforcement = backlog). |
| **Workforce vs access — never conflated** | **CMS `ACTIVE`** (workforce plane) **≠** logical/badge **ENABLED** (access plane). See §7 and §24. |
| **No active worker beyond contract_end** | Engagements must not outlive governed end without exception + audit. |
| **No privileged external identity without elevated governance** | Break-glass / high-risk permissions per security ADRs. |
| **Supplier and worker are distinct entities** | Never conflate identities in model or RBAC. |
| **CMS / IGA honesty** | CMS does not assert provisioning success; IGA does not assert commercial placement legitimacy. |

**Deprecated phrasing (v0.4):** Avoid **“IGA gate”** as shorthand for CMS state. Use **IGA integration boundary** or **access enablement boundary** (§24).

---

## 5. System boundary model

| Domain | Owner of canonical truth | CMS role |
|--------|---------------------------|----------|
| **Supplier** | CMS | Register, validate, lifecycle, documents. |
| **Resource (contractor record)** | CMS | Placement, skills, tax in scope, engagement. |
| **Sponsorship (accountability plane)** | **HCM** (employee master) + **CMS** (placement binding, delegation, lifecycle) | **§25** — sponsor is the bridge between workforce legitimacy and access justification (§24). |
| **External workforce legitimacy** | **CMS** | “Should this person exist in our extended workforce?” — approvals, dates, supplier, sponsor, risk tier, **access intent**. |
| **Compliance** | CMS + engines | SARS, BBBEE, withholding payloads. |
| **Lifecycle (workforce plane)** | CMS (+ HCM refs) | §7.1 |
| **Employee / sponsor identity** | HCM | CMS stores references. |
| **Cost center** | HCM / finance master | Cache IDs on project/engagement. |
| **Logical access, badge, SoD, certification, revocation** | **IGA** | CMS **publishes** events and **consumes** status; does not replace IGA (§24). |
| **Payments / posting** | ERP / AP | Invoice handoff. |

---

## 6. Target personas

| Persona | Charter (summary) |
|---------|-------------------|
| **Supplier Admin** | Supplier master, users when portal on, compliance. |
| **Supplier Manager** | Default timesheet submission path; validates work. |
| **Client Contractor Admin** | Internal ops: suppliers, contracts, engagements, governance. |
| **Sponsor** | Accountable owner for placement. |
| **Finance** | AP, invoice approval, withholding coordination. |
| **Security / IGA** | Access policy, **provisioning execution**, certification (IGA systems). |
| **Platform Admin** | Highest governance; break-glass where supported. |
| **Optional Contractor** | Limited self-service when enabled; no enterprise invoice by default. |

---

## 7. Lifecycle and status (two planes)

### 7.1 CMS — workforce governance plane

**Question CMS answers:** *“Should this external person exist in our governed extended workforce?”*

```text
NOMINATED
SUPPLIER_VALIDATED
CLIENT_VALIDATED
SPONSOR_ASSIGNED
APPROVED
ACTIVE
SUSPENDED
EXPIRED
TERMINATED
```

**v0.5:** Transition to **`ACTIVE`** requires **primary sponsor assignment** per **§25** (doctrine). Until schema ships, enforce via **process + audit**; do not claim data-level enforcement.

### 7.1a Four-way accountability (product language)

| Voice | Says (doctrine) |
|-------|-----------------|
| **Supplier** | “This resource exists (nomination / operational reality).” |
| **CMS** | “This resource is **approved** for our governed extended workforce.” |
| **Sponsor** | “This placement has **accountable business justification** for capability.” |
| **IGA** | “**Approved** access is **provisioned** (or failed / revoked) per enterprise policy.” |

**v0.4 correction:** **`IGA_PROVISIONED` must not appear as a CMS-only lifecycle state** — that conflated planes; IGA outcomes live in **§7.2–§7.3**.

### 7.2 IGA — integration status (downstream)

**Question IGA answers:** *“What did we do about identity and physical/logical access?”*

```text
NOT_REQUIRED
PENDING
SENT
PROVISIONED
FAILED
REVOKED
UNKNOWN
```

### 7.3 Access enablement (product-facing summary)

**Preferred product language:** **access enablement status** (not “IGA gate”).

```text
NOT_REQUIRED
PENDING_IGA
ENABLED
FAILED
REVOKED
```

| Status | Meaning (illustrative) |
|--------|-------------------------|
| **NOT_REQUIRED** | Workforce may be **ACTIVE** with no logical/badge requirement (e.g. logistics-only, supplier manager). |
| **PENDING_IGA** | Workforce approved; provisioning in flight. |
| **ENABLED** | Required access classes satisfied per policy. |
| **FAILED** | **Commercially valid person** (CMS) but **access remediation** required—UI must not collapse workforce truth into failure. |
| **REVOKED** | Access removed; CMS workforce state may still need explicit **TERMINATED** / **SUSPENDED**. |

**Default doctrine (v0.5):** **CMS `ACTIVE`** = workforce approved **and** **primary sponsor assigned** (§25). **`ACCESS_ENABLED`** = sponsor path satisfied **and** IGA path satisfied for the configured **access intent** (§24). CMS **must not** block **`ACTIVE`** on IGA alone; **`ACCESS_ENABLED`** may require IGA success.

**Mapping to today’s schema** = implementation backlog (see §18, §25, ADR-EXTID-001).

---

## 8. Billing doctrine

```text
Supplier bills client
Contractor does not see enterprise invoice by default
Contractor may optionally see limited personal payment status only if configured
```

| Topic | Doctrine |
|-------|----------|
| **Billing principal** | Supplier → client org (AP supplier bill). |
| **Contractor** | No default enterprise invoice; optional tiers (OD-01). |
| **Independent path** | **Supported, not default** (OD-05). |

---

## 9. Timesheet doctrine

```text
Default = Supplier Manager / Supplier Admin owns submission
Configurable = Contractor self-entry
```

| Mode | Behavior |
|------|----------|
| **Default** | Supplier roles when portal on; **internal Client Contractor Admin may proxy** until portal MVP (OD-03). |
| **Configurable** | Contractor self-entry when on; approvals unchanged. |

**Resolved (v0.3):** Internal proxy path is **interim** until supplier portal ships (OD-04).

---

## 10. External identity classes

```text
PHYSICAL_ONLY
LOGICAL_ONLY
PHYSICAL_AND_LOGICAL
PRIVILEGED_EXTERNAL
```

Used with **access intent** and §7.3—not as a substitute for IGA execution.

---

## 11. Contractor archetypes

| Archetype | Supplier | Sponsor | Billing summary | Typical identity class |
|-----------|----------|---------|-------------------|--------------------------|
| **Supplier resource (default)** | Required | Required for workforce-approved **ACTIVE** | Supplier bills client; limited contractor view | LOGICAL or PHYSICAL_AND_LOGICAL |
| **Independent contractor** | Configurable when enabled | Required for **ACTIVE** | Separate billing branch — legal before implement | Often LOGICAL_ONLY |
| **Internal / contingent** | May differ | Client sponsor | May differ AP path | LOGICAL_AND_LOGICAL |

---

## 12. Supplier relationship

- **DIRECT / AGENCY:** commercial definitions for v1.1 legal paragraph.
- **Supplier portal:** **Target ON**; **interim OFF** until MVP (OD-04).

---

## 13. Roles, permissions, and navigation surfaces

- Internal roles first; supplier roles with portal; nav grouping without permission widen.

---

## 14. HCM, IGA, and ERP alignment

- **HCM:** Employee / sponsor truth and worker external IDs.
- **IGA:** Provisioning execution; **boundary** in §24.
- **ERP/AP:** Payments and posting.

---

## 15. Governance and audit

Material lifecycle transitions → audit catalog alignment; PDP changes auditable.

---

## 16. Open decision register (summary)

**Canonical detail:** [`OPERATING_MODEL_DECISION_LOG.md`](./OPERATING_MODEL_DECISION_LOG.md).

| ID | Topic | Status (v0.5) |
|----|-------|----------------|
| OD-01 | Contractor invoice visibility | **RESOLVED** |
| OD-02 | Contractor login | **RESOLVED** |
| OD-03 | Timesheet ownership | **RESOLVED** |
| OD-04 | Supplier portal default | **RESOLVED** |
| OD-05 | Independent contractor | **RESOLVED** |
| **OD-06** | **Sponsor governance** | **LOCKED (doctrine)** — **§25**; schema + migrations = implementation |
| **OD-07** | **IGA boundary & integration** | **LOCKED (doctrine)** — **§24**; buses/APIs = implementation |

---

## 17. Roadmap (constitution to delivery)

```text
Constitution → Schema → HCM → IGA → Nav → Workflow
```

| Phase | Output |
|-------|--------|
| **1. Constitution** | v1.0 ratification (§21); then ADR-EXTID-001 |
| **2. Schema** | Sponsor FKs; workforce lifecycle; **access_enablement** / `iga_integration_status`; `contractor_type` / access intent (§18) |
| **3. HCM** | Sponsor + worker ID resolution |
| **4. IGA** | **Outbound events + inbound status**; optional hard dependency only per **access intent** config |
| **5. Nav** | Persona IA; supplier routes when portal on |
| **6. Workflow** | Optional BPM if beyond controllers |

---

## 18. Schema implication notes (awareness only — not implementation)

| Doctrine area | Likely artifacts (examples) |
|---------------|-----------------------------|
| §2 / §11 archetypes | `contractor_type`; nullable `supplierId` only with OD-05 + ADR |
| §4 / §7 / **§25** sponsor + workforce lifecycle | `sponsor_employee_id`, `sponsor_status`, optional `sponsor_delegate_employee_id`, `placement_workforce_state` |
| **§7.2–§7.3 IGA / access** | `iga_integration_status`; **`access_enablement_status`**; optional `iga_last_sync`, `iga_failure_reason` (display without corrupting CMS **ACTIVE**) |
| §9 / §10 | `access_intent`; portal `User.supplierId` |
| §8 | `invoice_visibility_tier` / RLS helpers |
| §24 events | Outbox or bus contract for **EXTERNAL_PERSON_*** style events (names TBD in ADR) |

---

## 19. Current-state conflict markers

| Topic | Conflict |
|-------|----------|
| **Contractor invoice read** | Seed **`CONTRACTOR`** + org-wide list vs OD-01. |
| **Merged IGA into CMS lifecycle (v0.3 doc)** | **`IGA_PROVISIONED` as CMS state** — **rejected in v0.4**; use two-plane model (§7). |
| **Contractor login** | Demo has login; doctrine default optional (OD-02). |
| **Finance invoice create** | Seed lacks `invoices:create` — verify workflows. |
| **Supplier portal** | No supplier auth — aligns interim OFF (OD-04). |
| **Sponsor** | No sponsor FK in current schema — **expected** until implementation; doctrine **LOCKED** in **§25** (process + audit interim). |

---

## 20. ADR readiness (ADR-EXTID-001)

**Draft and maintain ADR-EXTID-001 — *External Workforce Identity, Sponsorship, and IGA Boundary Doctrine*** when **all doctrine locks** below are **true** (satisfied at **v0.5**):

```text
Invoice doctrine locked
Contractor login doctrine locked
Timesheet doctrine locked
Supplier role doctrine locked
Sponsor baseline locked (OD-06 — §25)
IGA integration boundary locked (OD-07 — §24)
```

**v0.5:** Doctrine criteria for §20 are **met**. **ADR-EXTID-001** is **appropriate to author** (identity payloads, sponsor FK strategy, event contracts, failure semantics). **Binding implementation** (schema PRs, buses, UI) still follows **v1.0 APPROVED** unless leadership explicitly sequences earlier spikes.

**Draft shell (this repo):** [`ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)

**Do not** treat ADR text as permission to skip **v1.0** sign-off for production cutovers without governance approval.

---

## 21. v1.0 ratification criteria

```text
No major OPEN decisions affecting schema/RBAC
Default + configurable policy stable
Governance controls stable
Boundary model stable
```

**v0.5:** No **open doctrine** items remain in §16; **v1.0** = formal **APPROVED** sign-off, gap matrix **Target** completion, and delivery sequencing—not new doctrine discovery.

**Suggested v1.0 prep (before full bind):**

- **[`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)** — reviewed (streams, sequence, anti-disruption).
- **[`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md)** — reviewed (CONTRACTOR / finance / manager paths).
- **[`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md)** — reviewed (additive candidates).
- **[`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md)** — reviewed (canonical fields, anti-patterns, candidate table).
- **[`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md)** — reviewed (PR alignment header + gate IDs).
- **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md)** — **§7** executed (formal v1.0 ratification); **then** advance **ADR-EXTID-001** to **PROPOSED** per record **§1**.
- **[`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md)** — reviewed; attached to **PR-EXTID-SCHEMA-1A–1D** descriptions.
- **[`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md)** — template reviewed; **required** completed copy (or PR section) **before merge of 1A**.
- **[`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)** — executed **after** [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) **§7.4**, **before** opening **PR-EXTID-SCHEMA-1A**.
- **[`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](./CURRENT_STATE_VS_TARGET_GAP_MATRIX.md)** — **Target** column prioritized (repo ↔ doctrine).
- **Migration strategy** approved for sponsor + dual-status fields.
- **Seed / demo role** strategy for known conflicts (e.g. contractor invoice read scope).
- **Invoice scope remediation** path agreed (security + product).

---

## 22. Versioning, ADR, and approval

| ADR | When |
|-----|------|
| **[ADR-EXTID-001](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md)** | **Draft** shell exists at v0.5; **bind** implementation after **v1.0** unless waived |

| Version | Summary |
|---------|---------|
| **0.5** | §25 Sponsor; OD-06/07 **LOCKED**; §7.1a; §20–§23; ADR draft; **EXTID alignment + role matrix + schema register** |
| 0.4 | Two-plane lifecycle; IGA boundary §24; OD-07 reframed; non-negotiables updated |
| 0.3 | OD-01–05 resolved; decision log; benchmark; conflicts; gates |
| **1.0** | **APPROVED** constitution |

### Approval

| Role | Name | Date | Signature / link |
|------|------|------|-------------------|
| Product | | | |
| Architecture | | | |
| Security | | | |

When **APPROVED**: complete [`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](./CURRENT_STATE_VS_TARGET_GAP_MATRIX.md).

---

## 23. What not to do yet

- **Treat ADR-EXTID-001 as production authority** without **v1.0 APPROVED** (unless leadership explicitly waives).
- Nullable `supplierId` without OD-05 + ADR.
- Sponsor migration without **§25 / ADR-EXTID-001** governance sign-off.
- **Conflating CMS `ACTIVE` with IGA success** in UI or API responses.
- Treating seed **CONTRACTOR** `invoices:read` org-wide as compliant with OD-01 long term.

---

## 24. IGA boundary and integration doctrine (OD-07)

*Governance milestone alias:* Some prior planning notes referred to **this IGA section as “§25.”** Canonical numbering is **§24** here; **§25** is reserved for **Sponsor Governance (OD-06)** — **do not renumber** historical references; use this alias for continuity.

**The External Workforce Platform is not IGA.** It is an **upstream authoritative feed** and **governance trigger** for external workforce context. **IGA** is the **provisioning and policy execution engine** for logical accounts, badges, SoD, PAM, certification, and revocation where deployed.

### 24.1 CMS does **not** (by default)

- Provision enterprise directory accounts as the system of record
- Assign SAP / ERP security roles directly
- Issue badges or operate PACS
- Run SoD or certification campaigns
- Replace IGA as the access **executor**

*(Integrated “call IGA API” may exist later; CMS remains **not** the IGA product.)*

### 24.2 CMS **does** (authoritative context to downstream)

Tell downstream systems, via **events and/or APIs**:

```text
This external person exists
This person is workforce-approved (or not)
This person belongs to supplier X
This person has sponsor Y
This person starts on date A; ends on date B
This person may require access class C (physical / logical / none)
This person’s workforce status changed
```

Illustrative event names (final names in ADR):

```text
EXTERNAL_PERSON_CREATED
EXTERNAL_PERSON_APPROVED
EXTERNAL_PERSON_UPDATED
EXTERNAL_PERSON_SUSPENDED
EXTERNAL_PERSON_TERMINATED
CONTRACT_EXTENDED
SPONSOR_CHANGED
```

### 24.3 IGA owns

Identity creation (where applicable), badge provisioning, logical account provisioning, role assignments in target systems, SoD, PAM, certification, revocation.

### 24.4 Two planes (canonical)

| Plane | System | Question |
|-------|--------|----------|
| **1 — Workforce governance** | CMS | **Who exists and why?** |
| **2 — Identity / access** | IGA | **What access do they get?** |

### 24.5 Example scenarios

| Scenario | CMS (workforce) | IGA / access |
|----------|-----------------|--------------|
| **A — No access required** | `ACTIVE` | `NOT_REQUIRED` / enablement **NOT_REQUIRED** |
| **B — Badge only** | `ACTIVE` | `PROVISIONED` (PACS/badge path) |
| **C — SAP consultant** | `ACTIVE` | Logical + badge **ENABLED** when IGA completes |
| **D — IGA failed** | `ACTIVE` (person still legitimate for remediation) | `FAILED`; UI shows **access issue**, not “invalid worker” |

### 24.6 CMS → IGA data contract (illustrative)

```text
external_person_id
supplier_id
person_type
sponsor_employee_id
department
cost_center
contract_start
contract_end
risk_tier
access_intent
identity_required
physical_access_required
logical_access_required
worker_status   # CMS workforce plane
```

### 24.7 IGA → CMS (optional feedback)

```text
iga_correlation_id
provisioning_status
badge_status
logical_status
last_sync
failure_reason
certification_status
```

### 24.8 Strong default (v0.5)

```text
CMS ACTIVE = workforce approved + primary sponsor assigned (§25)
IGA status = separate dimension
ACCESS ENABLED = sponsor accountability satisfied + IGA path satisfied for access_intent (§24)
```

### 24.9 OD-07 — doctrine locked; engineering detail in ADR

OD-07 is **LOCKED** at doctrine level in v0.5. The questions below are **deferred to ADR-EXTID-001** for payload minimums, event matrix, and tenant-specific **access_intent** rules—**not** open constitutional items.

1. Minimum IGA payload per **access intent** class.
2. Which CMS transitions emit outbound events.
3. IGA-before-`ACTIVE` vs IGA-before-`ACCESS_ENABLED` (default: latter only).
4. UI semantics for `FAILED` vs workforce legitimacy.
5. IGA mandatory for all workers vs conditional on `access_intent`.

---

## 25. Sponsor governance doctrine (OD-06)

**Sponsor is the accountability plane** — the bridge between **workforce legitimacy** (CMS) and **access justification** (IGA, §24). Without a sponsor, a resource may be **nominated** but must not reach **`ACTIVE`**.

*Cross-reference:* **§7.1a** (four-way voice), **§24.6** (sponsor fields in CMS → IGA contract).

### 25.1 CMS does **not**

- Replace **HCM** as the system of record for the sponsor’s **employee** master data.
- Perform **certification campaigns** or **SoD** on behalf of enterprise IGA (sponsor may *trigger* reviews; execution is IGA/HR).
- Invent sponsor identity without a resolvable **HCM employee** reference (default).

### 25.2 CMS **does**

- Bind **exactly one primary sponsor** (HCM employee id) to each placement requiring accountability.
- Record **optional delegated approver** for operational workflow; **primary sponsor retains accountability** unless explicitly transferred per policy (future ADR).
- Drive **sponsor lifecycle** alongside workforce lifecycle (§7.1).
- Emit **SPONSOR_CHANGED** (and related) events per §24.2.

### 25.3 Sponsor identity source (default)

```text
HCM employee required
```

CMS stores **`sponsor_employee_id`** (or equivalent FK) resolvable in HCM for the tenant.

### 25.4 Sponsor count (default)

```text
Exactly one primary sponsor
```

Delegates are **optional**; they do not replace accountability unless a governed transfer policy applies.

### 25.5 Sponsor delegation (default)

```text
Optional delegated approver
Primary sponsor retains accountability
```

### 25.6 Sponsor lifecycle — doctrine answers

| Question | Doctrine (v0.5) |
|----------|-------------------|
| **Required before `ACTIVE`?** | **Yes** — **primary sponsor** must be assigned before **`ACTIVE`**. |
| **Required before `ACCESS_ENABLED`?** | **Yes** — **`ACCESS_ENABLED`** requires **sponsor path satisfied** and **IGA path** per §24 / §7.3 (default). |
| **Can `ACTIVE` persist if sponsor missing?** | **No** — invalid configuration; must **suspend**, **revert** to earlier state, or **exception** with audit (implementation defines mechanics). |
| **What if sponsor leaves org?** | **Immediate governance review** — default posture: **suspend access enablement**, **flag placement**, initiate **reassignment** workflow; CMS must not silently retain stale accountability. |

### 25.7 Sponsor controls (accountability ownership)

Sponsor accountability **owns** (business plane, not technical execution):

```text
Access justification
Certification triggers (request, not execute)
Renewal attestation where applicable
Termination trigger (business-initiated end)
```

### 25.8 Sponsor schema implications (illustrative — not migration)

```text
sponsor_employee_id          # FK / stable HCM reference
sponsor_status               # e.g. ACTIVE, TRANSFER_PENDING, REVOKED
sponsor_delegate_employee_id # optional
business_owner_label         # optional display / org-specific
certification_owner_id       # optional; may mirror sponsor
```

### 25.9 Example scenarios

| Scenario | Workforce (CMS) | Access (§7.3) |
|----------|-----------------|---------------|
| **A — Supplier nominated, no sponsor** | Stays **NOMINATED** (or supplier-validated per config) — **not `ACTIVE`**. | **NOT_REQUIRED** or **PENDING** per `access_intent`; not **ENABLED** without sponsor + IGA path when access required. |
| **B — Sponsor assigned, IGA pending** | May reach **`ACTIVE`** when other CMS gates satisfied. | **`PENDING_IGA`** until IGA completes; **not `ENABLED`** until policy satisfied. |
| **C — Sponsor removed / left org** | **Review / suspend** policy — do not treat as healthy **`ACTIVE`** without reassignment. | **REVOKED** or **FAILED** on access plane until remediation. |

### 25.10 OD-06 — doctrine locked

Sponsor rules in this section are **constitutional** for v0.5. Remaining work is **schema, workflow, and ADR-EXTID-001** — not reopening “whether sponsor exists.”

---

## Appendix B — Market benchmark

[`OPERATING_MODEL_MARKET_BENCHMARK.md`](./OPERATING_MODEL_MARKET_BENCHMARK.md).

---

## Changelog (internal)

| Version | Change |
|---------|--------|
| **0.5** | §25 Sponsor + OD-06/07 doctrine lock; §24 IGA boundary; §7.1a; §20–§23; **[ADR-EXTID-001](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) draft**; **EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1** + **ROLE_TRANSITION_MATRIX_V1** + **SCHEMA_IMPACT_REGISTER_V1**; execution add-ons **PR-EXTID-SCHEMA-1_DESIGN** + **IMPLEMENTATION_DRIFT_GATES** + **V1_0_RATIFICATION_RECORD** + **EXTID_MIGRATION_SAFETY_CHECKLIST** + **SCHEMA_DIFF_REVIEW** + **RATIFICATION_STATE_CONSISTENCY_CHECK** |
| **0.4** | IGA boundary doctrine §24; two-plane §7; remove IGA-as-CMS-state; non-negotiables; policy row; schema notes; ADR readiness; OD-07 rename |
| 0.3 | OD-01–05 resolved; decision log; benchmark; conflicts; gates |
| 0.2 | Initial doctrine body |
