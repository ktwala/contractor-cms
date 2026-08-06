# CAP-WORKFORCE-ADMINISTRATION

**Capability:** Workforce Administration
**Platform:** External Workforce Platform (EWP)
**Version:** 1.0
**Status:** RATIFIED — authoritative contract (May 2026)
**Normative:** This document uses **SHALL** / **SHALL NOT** as defined in RFC 2119.

> **Reference CAP.** First closed HEM loop — template for all future `CAP-*` documents. See [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](../EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md).

**Implementation identifiers (non-normative):** Schema field `Contractor.workforceState`; API routes are one projection.

---

## Dependencies

Architectural decisions — **why** this capability exists. Normative rules remain in this CAP.

| ADR | Role |
|-----|------|
| [`ADR-011`](../ADR-011-Contractor-Workforce-Administration-Plane.md) | Workforce bounded context; event reaction matrix; `isActive` bridge |
| [`ADR-012`](../ADR-012-External-Workforce-Platform-Naming.md) | External Workforce Platform identity; External Worker vocabulary |

**Reading chain:**

| Question | Document |
|----------|----------|
| Why does it exist? | ADR-011, ADR-012 |
| What must it do? | **This CAP (v1.0)** |
| How was it built? | §11 Maturity — PR evidence |
| Does it conform? | [`CERT-WORKFORCE-ADMINISTRATION.md`](./CERT-WORKFORCE-ADMINISTRATION.md) *(when certified)* |

---

## 1. Purpose

Workforce Administration **SHALL** establish and maintain the authoritative workforce relationship between the enterprise and an External Worker.

It **SHALL** record what workforce state the worker is in, how that state changed, and which policy blocks apply — independently of supplier trust, engagement placement, identity acquisition channels, access provisioning, or workflow orchestration.

---

## 2. Business question

> **What is this External Worker's current workforce relationship with the enterprise?**

Every element of this capability **SHALL** exist only to answer that question.

---

## 3. Capability boundaries

### 3.1 Owns

Workforce Administration **SHALL** own:

| Concern | Description |
|---------|-------------|
| **Workforce state** | Exactly one current state per External Worker record |
| **Workforce transitions** | Permitted state changes via declared commands |
| **Workforce history** | Immutable business record of transitions |
| **Workforce policy** | Blocks and terminal states (e.g. blacklist) |
| **Workforce events** | Past-tense facts emitted after successful transitions |

### 3.2 Does not own

Workforce Administration **SHALL NOT** own:

| Concern | Owned by |
|---------|----------|
| Supplier operational trust | Supplier Administration |
| Supplier portal membership | Supplier Administration |
| Engagement dates, placement, sponsor assignment | Engagement Administration |
| Identity bootstrap, staging, promote, CTR correlation | Identity Acquisition |
| Access provisioning or revocation execution | Access Integration |
| Drift detection and remediation workflow | Governance |
| Approval chains, notifications, task routing | Workflow Orchestration |
| HCM ongoing employment authority post-cutover | External enterprise HR (CMS bootstrap only via Identity Acquisition) |

Workforce Administration **SHALL NOT** call IGA, ServiceNow, Aveksa, or HCM push endpoints directly. It **SHALL** emit events for other capabilities to react.

---

## 4. Authoritative objects

Business objects — not database tables.

| Object | Definition |
|--------|------------|
| **Workforce Relationship** | The enterprise's current workforce standing with one External Worker |
| **Workforce State** | The single enumerated value describing that standing at a point in time |
| **Workforce Transition** | An authorized change from one Workforce State to another |
| **Workforce History Entry** | An immutable record of one successful Workforce Transition (or initial materialization) |
| **Workforce Policy Block** | A terminal or blocking rule that prevents further transitions or intake |

Implementation **MAY** map these to `Contractor`, `ContractorWorkforceHistory`, and related persistence.

---

## 5. Authoritative state machine

### 5.1 Workforce states (Capability Version 1)

Workforce Administration **SHALL** support exactly these Workforce States:

| State | Meaning |
|-------|---------|
| `NOMINATED` | Intake captured; not yet workforce-approved |
| `PENDING_APPROVAL` | Submitted for enterprise review |
| `REJECTED` | Nomination closed by review outcome |
| `ACTIVE` | Workforce-approved; may exist without access enabled |
| `SUSPENDED` | Temporarily ineligible; engagement dates may remain |
| `TERMINATED` | Workforce relationship ended |
| `BLACKLISTED` | Policy block; do-not-rehire / dismissal flag |

### 5.2 Permitted transitions

A Workforce Transition **SHALL** occur only along the following edges. Any other transition **SHALL NOT** be permitted in Capability Version 1.

| From | To (permitted) |
|------|----------------|
| *(initial)* | `NOMINATED`, `ACTIVE` *(bootstrap only — see Identity Acquisition integration)* |
| `NOMINATED` | `PENDING_APPROVAL`, `REJECTED`, `BLACKLISTED` |
| `PENDING_APPROVAL` | `ACTIVE`, `NOMINATED`, `REJECTED`, `BLACKLISTED` |
| `REJECTED` | `NOMINATED`, `BLACKLISTED` |
| `ACTIVE` | `SUSPENDED`, `TERMINATED`, `BLACKLISTED` |
| `SUSPENDED` | `ACTIVE` |
| `TERMINATED` | `ACTIVE`, `BLACKLISTED` |
| `BLACKLISTED` | *(none — terminal in Capability Version 1)* |

### 5.3 Derived compatibility attribute

Implementation **SHALL** maintain a derived compatibility flag equivalent to `isActive`.

**Rule:** `isActive` **SHALL** be `true` if and only if Workforce State is `ACTIVE`. All other states **SHALL** yield `isActive = false`.

`isActive` **SHALL NOT** be treated as the authoritative Workforce State.

---

## 6. Commands

Business commands. **SHALL NOT** reference UI controls, HTTP methods, or product names.

| Command | Effect (normative) |
|---------|-------------------|
| **Nominate External Worker** | Establish or record initial Workforce Relationship at `NOMINATED` |
| **Submit for Review** | Transition `NOMINATED` → `PENDING_APPROVAL` |
| **Activate External Worker** | Transition to `ACTIVE` from an permitted prior state |
| **Return Nomination to Supplier** | Transition `PENDING_APPROVAL` → `NOMINATED` |
| **Reject Nomination** | Transition to `REJECTED` from `NOMINATED` or `PENDING_APPROVAL` |
| **Reopen Nomination** | Transition `REJECTED` → `NOMINATED` |
| **Suspend External Worker** | Transition `ACTIVE` → `SUSPENDED` |
| **Reinstate External Worker** | Transition `SUSPENDED` → `ACTIVE` |
| **Terminate External Worker** | Transition `ACTIVE` → `TERMINATED` |
| **Rehire External Worker** | Transition `TERMINATED` → `ACTIVE` |
| **Blacklist External Worker** | Transition to `BLACKLISTED` from a permitted prior state |
| **Bootstrap Workforce Relationship** | Record initial materialization (e.g. `null → ACTIVE` or `null → NOMINATED`) under Identity Acquisition authority |

Each command **SHALL** map to exactly one permitted Workforce Transition (or initial history entry). Direct mutation of Workforce State without a command **SHALL NOT** be permitted except where explicitly delegated to **Bootstrap Workforce Relationship**.

### 6.1 Command inputs (Capability Version 1)

| Command category | Required inputs |
|------------------|-----------------|
| **Reject Nomination**, **Return Nomination to Supplier**, **Reopen Nomination** | Reason **SHALL** be supplied |
| **Blacklist External Worker** | Reason and authority note **SHALL** be supplied; authority note **SHALL NOT** be exposed on supplier-facing read models |

Other commands **MAY** accept optional reason at implementation discretion until a future capability revision normatively requires them.

---

## 7. Policies

Capability policies — distinct from §12 invariants; operational rules enforced at command time.

| ID | Policy |
|----|--------|
| **P-01** | Only `ACTIVE` **SHALL** derive operational activation (`isActive = true`). |
| **P-02** | `BLACKLISTED` **SHALL** be terminal in Capability Version 1. |
| **P-03** | Supplier-scoped actors **SHALL NOT** execute workforce state advancement commands except **Nominate External Worker**. |
| **P-04** | Transitions listed in §5.2 **SHALL** be the only permitted transitions. |
| **P-05** | **Reject Nomination**, **Return Nomination to Supplier**, and **Reopen Nomination** **SHALL** require a reason. |
| **P-06** | **Blacklist External Worker** **SHALL** require a reason and an internal authority note. |
| **P-07** | Workforce History **SHALL** be append-only; entries **SHALL NOT** be updated or deleted after creation. |
| **P-08** | Transition labels **SHALL** be derived at read time from `fromState → toState`; they **SHALL NOT** be stored as a separate authoritative event type on the history record. |
| **P-09** | `BLACKLISTED` External Workers **SHALL NOT** appear on supplier operational lists (policy concealment). |
| **P-10** | Supplier-facing read models for blacklist **SHALL** expose at most the state label; they **SHALL NOT** expose reason or authority note. |
| **P-11** | Cross-lifecycle enforcement (blocking nominate, promote, reopen when blacklisted at identity level) **SHALL** be extended in future increments — see §11. |
| **P-12** | External Workers with acquisition authority `INDEPENDENT` **SHALL NOT** transition to `ACTIVE` unless a primary sponsor exists on engagement substrate ([`ADR-013`](../ADR-013-External-Worker-Acquisition-Model.md); enforced in implementation — policy owner Workforce, not Identity Acquisition). |

---

## 8. Events

Business facts Workforce Administration **SHALL** emit after a successful command. Event names **SHALL** be past tense.

| Event | Typical command outcome |
|-------|---------------------------|
| **Worker Nominated** | Nominate; Submit for Review; Return to Supplier |
| **Worker Activated** | Activate from nomination path |
| **Worker Rejected** | Reject Nomination |
| **Nomination Reopened** | Reopen Nomination |
| **Worker Suspended** | Suspend External Worker |
| **Worker Reinstated** | Reinstate External Worker |
| **Worker Terminated** | Terminate External Worker |
| **Worker Rehired** | Rehire External Worker |
| **Worker Blacklisted** | Blacklist External Worker |
| **Contract Extended** | *(Reserved — owned jointly with Engagement Administration; not workforce state change)* |

Events **SHALL** be facts, not commands. Other capabilities **SHALL** subscribe; Workforce Administration **SHALL NOT** perform their side effects inline.

---

## 9. Read models

Projections of Workforce Administration data. Products **MAY** surface these; the capability **SHALL NOT** define UI.

| Read model | Audience | Content |
|------------|----------|---------|
| **Operations Review Queue** | Enterprise operators | External Workers in `NOMINATED` or `PENDING_APPROVAL` awaiting review actions |
| **Rejected Nominations List** | Enterprise operators | External Workers in `REJECTED` eligible for reopen or blacklist |
| **Policy Block Candidates** | Enterprise operators | External Workers in `ACTIVE` or `TERMINATED` eligible for blacklist |
| **Supplier Workforce Timeline** | Supplier-scoped actors | Append-only Workforce History with portal-safe redaction |
| **External Worker Registry View** | Authorized enterprise actors | Current Workforce State and derived activation |
| **Workforce History (full)** | Enterprise operators | Complete history including internal metadata |

Read models **SHALL** respect actor scope (supplier ring-fence, ops elevation).

---

## 10. Integrations

Responsibilities only — no adapter implementation.

### 10.1 Consumes

| Capability | Consumption |
|--------------|-------------|
| **Supplier Administration** | Supplier scope for nominate and supplier read models |
| **Identity Acquisition** | Bootstrap materialization authority; future promote-path validation against policy blocks |

### 10.2 Produces

| Capability | Production |
|--------------|------------|
| **Access Integration** | Events triggering suspend / revoke / restore intent |
| **Engagement Administration** | Events triggering engagement open / close / extend reactions |
| **Governance** | Signals on material workforce changes |
| **Workflow Orchestration** | Events suitable for future approval and notification routing |
| **Reporting & Projections** | History and state for operational dashboards |

Workforce Administration **SHALL** persist three truths on every successful command:

1. **Workforce History** — business truth
2. **Audit record** — operational truth (who changed persistence)
3. **Domain event** — integration truth (stub or live publisher)

History **SHALL** be written in the same atomic unit of work as Workforce State change, before audit and event emission.

---

## 11. Maturity and evidence

Implementation conformance **SHALL** be demonstrated by evidence — not by this specification changing when code ships.

| Capability element | Status | Evidence |
|--------------------|--------|----------|
| State model | Implemented | [`PR-WORKFORCE-STATE-MODEL-1`](../PR-WORKFORCE-STATE-MODEL-1.md) |
| Transition model | Implemented | [`PR-WORKFORCE-TRANSITIONS-1`](../PR-WORKFORCE-TRANSITIONS-1.md) |
| Nominate command | Implemented | [`PR-WORKFORCE-NOMINATE-1`](../PR-WORKFORCE-NOMINATE-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1`](../PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md) |
| Ops review projection | Implemented | [`PR-WORKFORCE-OPS-REVIEW-1`](../PR-WORKFORCE-OPS-REVIEW-1.md) |
| Timeline foundation | Implemented | [`PR-WORKFORCE-TIMELINE-FOUNDATION-1`](../PR-WORKFORCE-TIMELINE-FOUNDATION-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1`](../PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md) |
| Bootstrap history | Implemented | [`PR-WORKFORCE-HCM-HISTORY-1`](../PR-WORKFORCE-HCM-HISTORY-1.md) |
| Review outcomes commands | Implemented | [`PR-WORKFORCE-REVIEW-OUTCOMES-1`](../PR-WORKFORCE-REVIEW-OUTCOMES-1.md) |
| Independent authority → ACTIVE sponsor gate | Implemented | [`PR-IDENTITY-ACQUISITION-MODEL-2`](../PR-IDENTITY-ACQUISITION-MODEL-2.md) · CAP §7 P-12 |
| Policy block (blacklist) | Implemented | [`PR-WORKFORCE-BLACKLIST-1`](../PR-WORKFORCE-BLACKLIST-1.md) |
| End-to-end proof | Implemented | [`PR-WORKFORCE-E2E-UAT-1`](../PR-WORKFORCE-E2E-UAT-1.md) |
| Cross-intake enforcement | Planned | — |
| Access reactions | Planned | — |
| Workflow orchestration integration | Planned | — |
| Un-blacklist / Capability Version 2 | Out of scope | Explicitly excluded until future revision |

**Certification:** [`CERT-WORKFORCE-ADMINISTRATION.md`](./CERT-WORKFORCE-ADMINISTRATION.md) **v1.0 PASS** (May 2026) — PARTIAL rows match Planned scope above.

**Customer mapping (non-normative):** MTN RDS FE004, FE009–FE014 — [`PR-WORKFORCE-RDS-MAPPING-1`](../PR-WORKFORCE-RDS-MAPPING-1.md)

---

## 12. Capability invariants

Laws that **SHALL** hold for any conforming implementation of Capability Version 1.

1. Every External Worker **SHALL** have exactly one current Workforce State.
2. `isActive` **SHALL** be a derived compatibility attribute and **SHALL NOT** be treated as the authoritative Workforce State.
3. Every successful Workforce Transition **SHALL** append exactly one immutable Workforce History entry.
4. Workforce History **SHALL NOT** be modified or deleted after creation.
5. Workforce Administration **SHALL NOT** directly provision or revoke access.
6. Workforce Administration **SHALL NOT** own supplier lifecycle state.
7. Workforce Administration **SHALL NOT** own engagement lifecycle state.
8. `BLACKLISTED` **SHALL** be terminal in Capability Version 1 unless explicitly revised by a future capability version.
9. Supplier-scoped actors **SHALL NOT** advance Workforce State except via **Nominate External Worker**.
10. Commands **SHALL** precede Workforce State mutation; ad hoc state writes **SHALL NOT** be permitted outside **Bootstrap Workforce Relationship** and documented legacy bridges until removed.
11. A `BLACKLISTED` External Worker **SHALL NOT** transition to any other Workforce State in Capability Version 1.
12. Ops review advance **SHALL** mean permitted transitions only — not an external MTN approval engine, ServiceNow workflow, or LM chain.
13. External Workers with acquisition authority `INDEPENDENT` **SHALL NOT** reach `ACTIVE` without a primary sponsor on engagement substrate (§7 P-12).

---

## Document control

| Version | Change |
|---------|--------|
| **1.0** | Initial authoritative contract — May 2026 |

Changes to this document **SHALL** represent **capability contract revisions** and **SHALL** increment the capability version (e.g. v1.0 → v2.0). Implementation changes **SHALL NOT** require a version bump unless normative text in §1–§10 or §12 changes.

PRs **SHALL** cite `CAP-WORKFORCE-ADMINISTRATION v1.0` and list affected § until a new version is ratified.

---

## Template notice (for subsequent CAP-* authors)

Copy sections **Dependencies + 1–12** in order. Replace capability name, boundaries, state machine, commands, policies, invariants, and evidence table. Do **not** copy Workforce-specific content into other capabilities. Do **not** embed PR prose in §1–§10 or §12. List PRs **only** in §11.
