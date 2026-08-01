# CAP-ENGAGEMENT-ADMINISTRATION

**Capability:** Engagement Administration  
**Platform:** External Workforce Platform (EWP)  
**Version:** 1.0  
**Status:** RATIFIED — authoritative contract (May 2026)  
**Normative:** This document uses **SHALL** / **SHALL NOT** as defined in RFC 2119.

> **Third operational CAP.** Codifies placement, commercial framework, labour recording, billing, and sponsor accountability at engagement scope.

**Implementation identifiers (non-normative):** `ContractorEngagement`, `SupplierContract`, `Timesheet`, `Invoice`, `Project`; API routes under `/engagements`, `/contracts`, `/timesheets`, `/invoices`, `/projects`, `/sponsor-tasks`.

---

## Dependencies

| ADR / doctrine | Role |
|----------------|------|
| [`EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md`](../EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md) §7–§9, §25 | Placement, billing, timesheet, and sponsor accountability doctrine |
| [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) | Sponsor substrate vs IGA execution boundary *(draft — not production-binding until operating model v1.0)* |
| [`ADR-012`](../ADR-012-External-Workforce-Platform-Naming.md) | External Workforce Platform identity |

**Reading chain:**

| Question | Document |
|----------|----------|
| Why does it exist? | Operating model §7–§9, §25; ADR-EXTID-001 |
| What must it do? | **This CAP (v1.0)** |
| How was it built? | §11 Maturity — PR evidence |
| Does it conform? | [`CERT-ENGAGEMENT-ADMINISTRATION.md`](./CERT-ENGAGEMENT-ADMINISTRATION.md) *(when certified)* |

---

## 1. Purpose

Engagement Administration **SHALL** establish and maintain **where** an External Worker is commercially and operationally placed: supplier agreement context, role, dates, rates, optional project assignment, labour records, supplier billing, and **placement-level sponsor accountability**.

It **SHALL** answer commercial and operational placement questions — independently of supplier operational trust, workforce approval state, identity acquisition, access provisioning, and governance remediation execution.

---

## 2. Business question

> **Where is this External Worker assigned, under what commercial arrangement, and who is accountable for the placement?**

Every element of this capability **SHALL** exist only to answer that question and its operational corollaries (labour recorded, supplier billed, placement dates governed).

---

## 3. Capability boundaries

### 3.1 Owns

| Concern | Description |
|---------|-------------|
| **Supplier contracts** | Commercial framework linking supplier to client organisation |
| **Engagement placement** | Worker-to-contract assignment with role, dates, and rate |
| **Project assignment context** | Optional delivery container for placement, timesheets, and budget attribution |
| **Timesheet records** | Labour periods tied to worker (and optionally project) |
| **Supplier invoices** | Billing records tied to supplier and labour periods |
| **Sponsor accountability (placement)** | Primary sponsor reference, delegate, status, and accountability task inbox |
| **Engagement-scoped read models** | Contracts, engagements, timesheets, invoices, projects, sponsor views |

### 3.2 Does not own

| Concern | Owned by |
|---------|----------|
| Supplier operational trust | Supplier Administration |
| External Worker workforce state | Workforce Administration |
| Identity bootstrap / CTR promote | Identity Acquisition |
| Access provisioning or revocation | Access Integration |
| Drift detection and remediation | Governance |
| Enterprise approval workflow engines | Workflow Orchestration |
| Contractor self-service login policy | Platform configuration *(doctrine in operating model)* |

Engagement Administration **SHALL NOT** approve supplier onboarding or workforce nomination outcomes.

---

## 4. Authoritative objects

| Object | Definition |
|--------|------------|
| **Supplier Contract** | Commercial agreement under which placements may exist |
| **Engagement Placement** | Assignment of one External Worker to one contract for a bounded period |
| **Project** | Optional organisational container for placements and labour attribution |
| **Timesheet** | Record of labour hours (and derived amounts) for a period |
| **Invoice** | Supplier billing document for a period, optionally linked to timesheets |
| **Sponsor Accountability Record** | Placement-level sponsor identifiers and status |
| **Sponsor Accountability Task** | Action item for a sponsor related to a placement |

Implementation **MAY** map these to `SupplierContract`, `ContractorEngagement`, `Project`, `Timesheet`, `Invoice`, `SponsorAccountabilityTask`.

---

## 5. Lifecycle models (Capability Version 1)

Engagement Administration **SHALL NOT** use a single unified state machine across all objects. Each sub-domain **SHALL** use its own lifecycle.

### 5.1 Engagement placement

| Attribute | Rule |
|-----------|------|
| **Active flag** | `isActive` **SHALL** indicate whether the placement is currently operational |
| **Dates** | `startDate` **SHALL** be set; `endDate` **MAY** bound the placement |
| **Contract link** | Every placement **SHALL** reference exactly one Supplier Contract |
| **Worker link** | Every placement **SHALL** reference exactly one External Worker |

### 5.2 Supplier contract

Contracts **SHALL** carry organisation-scoped identity, type, dates, and status. Contract status **SHALL NOT** substitute for workforce or supplier lifecycle state.

### 5.3 Timesheet

| Status | Meaning |
|--------|---------|
| `DRAFT` | In preparation |
| `SUBMITTED` | Awaiting approval |
| `APPROVED` | Accepted labour record |
| `REJECTED` | Rejected with reason |

Permitted transitions **SHALL** follow: `DRAFT → SUBMITTED → APPROVED | REJECTED` (with resubmit paths at implementation discretion).

### 5.4 Invoice

Invoice status **SHALL** support at minimum draft, submitted, approved, paid, and rejected semantics consistent with implementation enum `InvoiceStatus`.

### 5.5 Project

Projects **SHALL** function as **assignment and budget attribution containers** for engagements and timesheets — not as standalone programme-management products in Capability Version 1.

### 5.6 Sponsor accountability status

Placement **MAY** carry `sponsorEmployeeId`, optional delegate, and `sponsorStatus`. When primary sponsor is cleared, delegate and status **SHALL** be cleared. Status without primary sponsor **SHALL NOT** be permitted.

---

## 6. Commands

| Command | Effect (normative) |
|---------|-------------------|
| **Register Supplier Contract** | Create or maintain commercial framework record |
| **Create Engagement Placement** | Bind worker to contract with role, dates, rate, optional project |
| **Update Engagement Placement** | Modify permitted placement fields including sponsor substrate |
| **Activate / Deactivate Placement** | Set `isActive` within date bounds |
| **Assign Sponsor to Placement** | Set or clear primary sponsor and accountability status |
| **Record Timesheet** | Create or update labour period in `DRAFT` |
| **Submit Timesheet** | `DRAFT → SUBMITTED` |
| **Approve Timesheet** | `SUBMITTED → APPROVED` |
| **Reject Timesheet** | `SUBMITTED → REJECTED` with reason |
| **Register Invoice** | Create supplier billing record |
| **Submit / Approve / Reject Invoice** | Invoice workflow transitions |
| **Register Project** | Create project assignment container |
| **Complete Sponsor Accountability Task** | Close or dismiss inbox item for a placement |
| **Create Placement with Nomination** | Atomic worker nomination + placement intent *(coordinates with Workforce Administration)* |

Commands **SHALL NOT** mutate workforce state or supplier trust directly.

---

## 7. Policies

| ID | Policy |
|----|--------|
| **P-01** | Every Engagement Placement **SHALL** reference a Supplier Contract and External Worker. |
| **P-02** | Project assignment **SHALL** be optional; when present it **SHALL** attribute labour and budget only — not replace engagement as the placement record. |
| **P-03** | Timesheets **SHALL** reference the External Worker; **MAY** reference project and link to invoice. |
| **P-04** | Invoices **SHALL** reference the Supplier; finance-sensitive amounts **SHALL** respect finance visibility permissions. |
| **P-05** | Sponsor-scoped actors **SHALL** see only engagements (and related objects) within sponsor accountability scope. |
| **P-06** | Clearing primary sponsor **SHALL** clear delegate and sponsor status. |
| **P-07** | Sponsor status without primary sponsor id **SHALL NOT** be persisted. |
| **P-08** | Default billing doctrine: supplier bills client; contractor **SHALL NOT** receive enterprise invoice by default *(operating model §8)*. |
| **P-09** | Default timesheet doctrine: supplier-side submission path; internal proxy **MAY** exist until portal maturity *(operating model §9)*. |
| **P-10** | Placement **SHALL NOT** outlive governed contract end without explicit exception *(doctrine — enforcement planned)*. |
| **P-11** | Extension, transfer, and movement between placements **SHALL** be a future increment — see §11. |
| **P-12** | Mandatory sponsor-before-workforce-ACTIVE coupling **SHALL** align with operating model §25 when schema enforcement ships — until then placement sponsor substrate **SHALL** be recordable. |

---

## 8. Events

Engagement Administration **SHALL** emit audit and integration facts including:

| Event | Typical outcome |
|-------|-----------------|
| **Engagement Created / Updated** | Placement or sponsor change |
| **Sponsor Assigned** | Primary sponsor set on placement *(IGA event when enabled)* |
| **Timesheet Submitted / Approved / Rejected** | Labour workflow |
| **Invoice Submitted / Approved / Rejected / Paid** | Billing workflow |
| **Sponsor Task Completed / Dismissed** | Accountability inbox |

Events **SHALL** be facts. Access Integration **MAY** consume sponsor assignment events; Workforce Administration **MAY** consume placement facts for reactions.

---

## 9. Read models

| Read model | Audience | Content |
|------------|----------|---------|
| **Contracts registry** | Enterprise operators | Supplier commercial agreements |
| **Engagements registry** | Enterprise + sponsor-scoped | Placements with role, dates, sponsor |
| **Timesheets queue** | Approvers, finance, suppliers | Labour periods by status |
| **Invoices registry** | Finance, suppliers | Billing status and amounts (redacted per role) |
| **Projects portfolio** | Operators | Assignment containers and utilisation |
| **Sponsor Accountability inbox** | Business sponsors | Open accountability tasks |
| **Overview — Engagement Administration health** | Authorized actors | Expiring contracts, outstanding timesheets/invoices |

Read models **SHALL** respect sponsor scope, supplier portal ring-fence, and finance redaction.

---

## 10. Integrations

### 10.1 Consumes

| Capability | Consumption |
|--------------|-------------|
| **Supplier Administration** | Trusted supplier and contract party context |
| **Workforce Administration** | Worker identity for placement; nomination coordination |
| **Identity Acquisition** | Promoted placement rows with sponsor validation metadata |

### 10.2 Produces

| Capability | Production |
|--------------|------------|
| **Access Integration** | Sponsor assignment signals |
| **Governance** | Placement and billing anomalies |
| **Workflow Orchestration** | Future approval routing hooks |
| **Reporting & Projections** | Utilisation and billing summaries |

---

## 11. Maturity and evidence

| Capability element | Status | Evidence |
|--------------------|--------|----------|
| Engagement CRUD + sponsor substrate | Implemented | [`PR-SPONSOR-GOVERNANCE-1`](../ROLE_TRANSITION_MATRIX_V1.md), [`PR-SPONSOR-RUNTIME-1`](../ROLE_TRANSITION_MATRIX_V1.md), engagements domain |
| Nomination + placement | Implemented | [`PR-WORKFORCE-NOMINATE-1`](../PR-WORKFORCE-NOMINATE-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1`](../PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md) |
| HCM promote placement | Implemented | [`PR-CTR-2_STAGING_SCHEMA.md`](../PR-CTR-2_STAGING_SCHEMA.md), [`PR-CTR-1`](../PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md) |
| Sponsor accountability inbox | Implemented | [`SPONSOR_ACCOUNTABILITY_MODEL.md`](../SPONSOR_ACCOUNTABILITY_MODEL.md) (PR-SPONSOR-TASKS-1) |
| Contracts / timesheets / invoices / projects UI | Implemented | Domain modules + [`PR-CMS-FORMS-1`](../PR-CMS-FORMS-1_REAL_SUPPLIER_FORMS.md) |
| IGA sponsor assigned event | Implemented | PR-IGA-EVENT-WRITE-1 *(see ROLE_TRANSITION_MATRIX_V1)* |
| Extension / transfer / movement | Planned | — |
| Contract-end enforcement | Planned | Operating model §7 |
| Workforce–sponsor mandatory coupling | Planned | Operating model §25 + ADR-EXTID-001 |
| End-to-end CERT | Planned | [`CERT-ENGAGEMENT-ADMINISTRATION.md`](./CERT-ENGAGEMENT-ADMINISTRATION.md) |

**Customer mapping (non-normative):** MTN RDS FE008, FE015–FE016 — [`PR-WORKFORCE-RDS-MAPPING-1.md`](../PR-WORKFORCE-RDS-MAPPING-1.md)

---

## 12. Capability invariants

1. An Engagement Placement **SHALL** reference exactly one External Worker and one Supplier Contract.
2. Engagement Administration **SHALL NOT** own External Worker workforce state.
3. Engagement Administration **SHALL NOT** own supplier operational trust state.
4. Timesheet approval **SHALL NOT** imply workforce activation.
5. Invoice approval **SHALL NOT** imply access enablement.
6. Projects **SHALL** be assignment containers — not a separate delivery bounded context in Capability Version 1.
7. Sponsor accountability tasks **SHALL** relate to a placement, not replace workforce review.
8. Finance fields **SHALL** be redacted unless finance permissions are granted.
9. Sponsor-scoped read models **SHALL** be filtered to accountable placements.
10. Primary sponsor clearance **SHALL** clear delegate and sponsor status.
11. Billing **SHALL** remain supplier-centric by default (operating model §8).
12. Extension, transfer, and movement **SHALL NOT** be ad hoc field edits — they require a future capability revision or dedicated commands.

---

## Document control

| Version | Change |
|---------|--------|
| **1.0** | Initial authoritative contract — codifies delivered engagement domain (May 2026) |

PRs **SHALL** cite `CAP-ENGAGEMENT-ADMINISTRATION v1.0` and list affected § until a new version is ratified.
