# CAP-SUPPLIER-ADMINISTRATION

**Capability:** Supplier Administration  
**Platform:** External Workforce Platform (EWP)  
**Version:** 1.0  
**Status:** RATIFIED — authoritative contract (May 2026)  
**Normative:** This document uses **SHALL** / **SHALL NOT** as defined in RFC 2119.

> **Second operational CAP.** Codifies delivered supplier lifecycle, evidence, portal, and connector behaviour. See [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) for template discipline.

**Implementation identifiers (non-normative):** Prisma `Supplier.status`; API routes `/suppliers`, `/supplier-portal/*`.

---

## Dependencies

| ADR | Role |
|-----|------|
| [`ADR-002`](../ADR-002-Supplier-Renewal-Governance.md) | Renewal visibility and future enforcement posture |
| [`ADR-012`](../ADR-012-External-Workforce-Platform-Naming.md) | External Workforce Platform identity; supplier as trust boundary for external workers |

**Reading chain:**

| Question | Document |
|----------|----------|
| Why does it exist? | ADR-002, ADR-012 |
| What must it do? | **This CAP (v1.0)** |
| How was it built? | §11 Maturity — PR evidence |
| Does it conform? | [`CERT-SUPPLIER-ADMINISTRATION.md`](./CERT-SUPPLIER-ADMINISTRATION.md) *(when certified)* |

---

## 1. Purpose

Supplier Administration **SHALL** establish and maintain which supplier organisations (and supplier-class individuals) are **operationally trusted** to supply External Workers to the enterprise.

It **SHALL** record supplier lifecycle state, onboarding evidence, portal membership scope, and master-data authority rules — independently of External Worker workforce state, engagement placement, access provisioning, or governance remediation execution.

---

## 2. Business question

> **Which organisations may supply External Workers to this enterprise?**

Every element of this capability **SHALL** exist only to answer that question (and its operational corollaries: *are they approved, suspended, offboarded, and evidenced?*).

---

## 3. Capability boundaries

### 3.1 Owns

Supplier Administration **SHALL** own:

| Concern | Description |
|---------|-------------|
| **Supplier registry** | Authoritative supplier master record within EWP |
| **Supplier lifecycle state** | Exactly one current status per supplier |
| **Supplier transitions** | Permitted status changes via declared commands |
| **Onboarding evidence** | Jurisdiction-aware document checklist and metadata |
| **Supplier approvals** | Enterprise review of `PENDING_APPROVAL` suppliers |
| **Supplier portal scope** | Ring-fenced actor access to one supplier organisation |
| **Master-data authority** | Rules for CMS-native vs upstream-authoritative supplier creation |
| **Supplier audit facts** | Status, document, and approval audit events |

### 3.2 Does not own

Supplier Administration **SHALL NOT** own:

| Concern | Owned by |
|---------|----------|
| External Worker workforce state | Workforce Administration |
| Nominate / activate external workers | Workforce Administration (within supplier scope) |
| Engagement dates, sponsor, commercial placement | Engagement Administration |
| HCM worker bootstrap, CTR promote | Identity Acquisition |
| Oracle procurement **transport** and staging mechanics | Identity Acquisition / connector layer *(supplier record consumption is here)* |
| Drift detection, remediation workflow execution | Governance |
| Access provisioning or revocation | Access Integration |
| Approval chains, notifications, task routing | Workflow Orchestration |
| Invoice / timesheet business rules | Engagement Administration |

Supplier Administration **SHALL NOT** approve or reject External Worker nominations — only **supplier organisation** trust.

---

## 4. Authoritative objects

| Object | Definition |
|--------|------------|
| **Supplier** | An organisation or individual entity that may supply External Workers |
| **Supplier Status** | The single enumerated lifecycle value for operational trust |
| **Supplier Transition** | An authorized change from one Supplier Status to another |
| **Onboarding Evidence Item** | A required or optional document type for a jurisdiction pack |
| **Evidence Checklist** | Evaluation of required evidence for a supplier at a point in time |
| **Supplier Membership** | Portal actor binding to exactly one supplier scope |
| **Supplier Master Authority** | Tenant rule for who may create or mutate competing master records |

Implementation **MAY** map these to `Supplier`, `SupplierDocument`, portal membership tables, and related persistence.

---

## 5. Authoritative state machine

### 5.1 Supplier statuses (Capability Version 1)

| Status | Meaning |
|--------|---------|
| `DRAFT` | Registered in EWP; not yet submitted for enterprise approval |
| `PENDING_APPROVAL` | Submitted; awaiting enterprise review |
| `ACTIVE` | Operationally trusted to supply External Workers |
| `SUSPENDED` | Not trusted; includes rejection from approval queue |
| `OFFBOARDED` | Relationship ended; terminal for operational trust |
| `ARCHIVED` | Historical record; no operational use |

### 5.2 Permitted transitions

| From | To (permitted) |
|------|----------------|
| `DRAFT` | `PENDING_APPROVAL` |
| `PENDING_APPROVAL` | `ACTIVE`, `SUSPENDED` |
| `ACTIVE` | `SUSPENDED`, `OFFBOARDED` |
| `SUSPENDED` | `ACTIVE`, `OFFBOARDED` |
| `OFFBOARDED` | `ARCHIVED` |
| `ARCHIVED` | *(none — terminal in Capability Version 1)* |

Any transition not listed **SHALL NOT** be permitted in Capability Version 1.

**Normative rejection path:** `PENDING_APPROVAL → SUSPENDED` **SHALL** represent enterprise rejection of supplier onboarding (audit fact: Supplier Rejected).

### 5.3 Operational trust attribute

**Rule:** A supplier **SHALL** be considered operationally trusted for workforce intake **if and only if** Supplier Status is `ACTIVE`.

`ACTIVE` **SHALL NOT** imply External Worker workforce approval — only supplier-level trust.

---

## 6. Commands

| Command | Effect (normative) |
|---------|-------------------|
| **Register Supplier** | Create supplier at `DRAFT` when master authority allows |
| **Submit Supplier for Approval** | `DRAFT → PENDING_APPROVAL` |
| **Approve Supplier** | Transition to `ACTIVE` from `PENDING_APPROVAL` or `SUSPENDED` when evidence complete |
| **Reject Supplier** | `PENDING_APPROVAL → SUSPENDED` |
| **Suspend Supplier** | Transition to `SUSPENDED` from permitted prior states |
| **Reinstate Supplier** | `SUSPENDED → ACTIVE` when evidence complete |
| **Offboard Supplier** | Transition to `OFFBOARDED` |
| **Archive Supplier** | `OFFBOARDED → ARCHIVED` |
| **Record Evidence Document** | Add or update onboarding document metadata |
| **Import Supplier Master** | Upsert from upstream connector under tenant authority rules |

Profile field updates **SHALL NOT** change Supplier Status except via the commands above.

### 6.1 Command inputs (Capability Version 1)

| Command | Required inputs |
|---------|-----------------|
| **Reject Supplier**, **Suspend Supplier** (from approval path) | Reason **SHALL** be supplied |
| **Approve Supplier**, **Reinstate Supplier** | Evidence checklist **SHALL** be complete for jurisdiction |
| **Import Supplier Master** | **SHALL** respect `supplierAuthorityMode` and identity immutability rules |

---

## 7. Policies

| ID | Policy |
|----|--------|
| **P-01** | Only `ACTIVE` suppliers **SHALL** be operationally trusted for supplier-scoped workforce intake. |
| **P-02** | **Approve Supplier** and **Reinstate Supplier** **SHALL NOT** succeed when required onboarding evidence is incomplete or expired. |
| **P-03** | Supplier-scoped actors **SHALL NOT** execute **Approve Supplier** or **Reinstate Supplier** for their own supplier (`SUPPLIER_SELF_APPROVAL_FORBIDDEN`). |
| **P-04** | Transitions in §5.2 **SHALL** be the only permitted transitions. |
| **P-05** | **Reject Supplier** **SHALL** require a reason. |
| **P-06** | Evidence requirements **SHALL** be jurisdiction-aware (supported packs **SHALL** be declared in implementation). |
| **P-07** | When `supplierAuthorityMode` is upstream-authoritative, competing CMS master creation **SHALL** be blocked except explicit governance intake permission. |
| **P-08** | Oracle-linked supplier identity fields **SHALL NOT** be mutated from CMS profile update when data authority forbids it. |
| **P-09** | Supplier portal actors **SHALL** be ring-fenced to their supplier membership scope. |
| **P-10** | Finance-sensitive supplier fields **SHALL** be redacted unless finance visibility permissions are granted. |
| **P-11** | Independent (non-supplier) External Worker path **SHALL** be a future increment — see §11. |

---

## 8. Events

Past-tense audit facts Supplier Administration **SHALL** emit on successful commands:

| Event | Typical command outcome |
|-------|-------------------------|
| **Supplier Status Changed** | Any status transition |
| **Supplier Submitted for Approval** | Submit Supplier for Approval |
| **Supplier Approved** | Approve Supplier |
| **Supplier Rejected** | Reject Supplier |
| **Supplier Suspended** | Suspend Supplier |
| **Supplier Offboarded** | Offboard Supplier |
| **Supplier Archived** | Archive Supplier |
| **Supplier Document Added** | Record Evidence Document |
| **Supplier Document Updated** | Update document metadata |
| **Supplier Document Expired** | Evidence expiry detected |

Events **SHALL** be facts, not commands. Governance **MAY** consume status and document events for signals.

---

## 9. Read models

| Read model | Audience | Content |
|------------|----------|---------|
| **Supplier Registry** | Enterprise operators | Searchable supplier master list |
| **Supplier Approval Queue** | Enterprise reviewers | `PENDING_APPROVAL` suppliers with evidence summary |
| **Evidence Checklist** | Enterprise + portal (scoped) | Required items, present / missing / expired |
| **Supplier Portal Profile** | Supplier-scoped actors | Own supplier profile and onboarding status |
| **Supplier Governance Dashboard** | Governance operators | Renewal / risk buckets *(visibility layer)* |
| **Overview — Supplier Administration health** | Authorized actors | Active suppliers, pending approvals *(platform landing)* |

Read models **SHALL** respect actor scope and finance redaction rules.

---

## 10. Integrations

### 10.1 Consumes

| Capability | Consumption |
|--------------|-------------|
| **Identity Acquisition / connectors** | Staged supplier master import; procurement sync |
| **Governance** | Renewal visibility signals *(enforcement planned via ADR-002)* |

### 10.2 Produces

| Capability | Production |
|--------------|------------|
| **Workforce Administration** | Supplier scope for nomination and supplier read models |
| **Engagement Administration** | Trusted supplier context for contracts and placements |
| **Supplier Portal** | Ring-fenced supplier experience |
| **Governance** | Material supplier status changes for drift and signals |
| **Reporting & Projections** | Registry and approval metrics |

Status change **SHALL** write audit record in the same unit of work as Supplier Status mutation.

---

## 11. Maturity and evidence

| Capability element | Status | Evidence |
|--------------------|--------|----------|
| Lifecycle state machine | Implemented | [`PR-CMS-OPERATIONS-1A`](../PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md) |
| Onboarding evidence | Implemented | [`PR-CMS-OPERATIONS-1B`](../PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md), [`PR-CMS-OPERATIONS-1D0`](../PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md) |
| Approval queue | Implemented | [`PR-CMS-OPERATIONS-1C`](../PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md) |
| Portal onboarding + PDP | Implemented | [`PR-CMS-OPERATIONS-1D2`](../PR-CMS-OPERATIONS-1D2_PORTAL_PDP.md) |
| Oracle staging / sync | Implemented | [`PR-CMS-OPERATIONS-1D1`](../PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md), [`PR-CMS-CONNECTOR-1A-C`](../PR-CMS-CONNECTOR-1A-C_ORACLE_PROCUREMENT_REST.md) |
| Master authority | Implemented | PR-CMS-AUTHORITY-1 *(see PR-CMS-OPERATIONS-1)* |
| Supplier portal invoices | Implemented | [`PR-SUPPLIER-PORTAL-INVOICES-1.md`](../PR-SUPPLIER-PORTAL-INVOICES-1.md) |
| Independent supplier path | Planned | — |
| Renewal enforcement | Planned | ADR-002 follow-on |
| End-to-end CERT | Planned | [`CERT-SUPPLIER-ADMINISTRATION.md`](./CERT-SUPPLIER-ADMINISTRATION.md) |

**Customer mapping (non-normative):** MTN RDS FE001 — [`PR-WORKFORCE-RDS-MAPPING-1.md`](../PR-WORKFORCE-RDS-MAPPING-1.md)

---

## 12. Capability invariants

1. Every Supplier **SHALL** have exactly one current Supplier Status.
2. Supplier Status mutation **SHALL** occur only via declared commands (§6).
3. **Approve Supplier** **SHALL NOT** succeed without complete required evidence for the supplier's jurisdiction.
4. Supplier-scoped actors **SHALL NOT** approve their own supplier organisation.
5. Supplier Administration **SHALL NOT** own External Worker workforce state.
6. Supplier Administration **SHALL NOT** directly provision or revoke enterprise access.
7. `OFFBOARDED` **SHALL** be terminal for operational trust until explicitly archived.
8. `ARCHIVED` **SHALL NOT** transition to any other status in Capability Version 1.
9. Portal routes **SHALL** fail closed without supplier membership scope.
10. Upstream-authoritative tenants **SHALL NOT** allow silent competing CMS master creation.
11. Rejection from the approval queue **SHALL** use `PENDING_APPROVAL → SUSPENDED`, not workforce states.
12. Supplier renewal enforcement **SHALL NOT** be conflated with supplier onboarding approval in Capability Version 1.

---

## Document control

| Version | Change |
|---------|--------|
| **1.0** | Initial authoritative contract — codifies delivered supplier operations (May 2026) |

Changes **SHALL** increment capability version. Implementation **SHALL NOT** require version bump unless normative §1–§10 or §12 changes.

PRs **SHALL** cite `CAP-SUPPLIER-ADMINISTRATION v1.0` and list affected § until a new version is ratified.
