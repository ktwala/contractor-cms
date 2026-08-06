# PR-WORKFORCE-RDS-MAPPING-1 — MTN RDS traceability (documentation only)

**Status:** DOCUMENTATION — **no implementation authorized from this mapping**
**Source:** *HR Contingency worker RDS V001 000* (signed PDF, repo root)
**Builds on:** [`DOMAIN_MODEL_RECOVERY_V1.md`](./DOMAIN_MODEL_RECOVERY_V1.md), [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md), workforce baseline through [`PR-WORKFORCE-BLACKLIST-1.md`](./PR-WORKFORCE-BLACKLIST-1.md)

---

## Guardrail

> **We will not copy the RDS into one large contractor workflow.**

Each RDS line maps to one or more CMS planes — **Workforce**, **Workflow**, **Supplier**, **Identity**, **Engagement**, **Governance**, **Access**, or **Reporting**. The mapping shows MTN what is already proven, what needs extension, and what should be challenged — without reshaping the domain model.

**Proven workforce baseline (May 2026):**

```text
Happy path:     Nominate → Review → Activate
Exception path: Reject / Send back / Reopen
Policy block:   → BLACKLISTED (reason + authority note; ops-only; supplier hidden)
```

Ops review advances state. That is **not** the MTN LM / HRBP approval engine, ServiceNow, or Aveksa.

---

## Roadmap doctrine — RDS stops driving the roadmap

**The question changed.**

| Old framing | New framing |
|-------------|-------------|
| How far are we from the RDS? | Which RDS lines are **already explained** by EWP planes, and which need **genuine new capability**? |
| Build an external workforce platform to match RDS | **Selectively extend** planes already established |

The traceability table is the evidence: **the architecture is no longer the problem.** Remaining work is plane extension — workforce policy, engagement operations, access adapters, workflow orchestration — not a monolithic RDS replica.

**Correct dependency direction:**

```text
Business Capability          ← EXTERNAL_WORKFORCE_CAPABILITY_MAP.md (EWP)
        │
        ▼
Capability Maturity
        │
        ▼
PR Implementation
        │
        ▼
Product Projection         (Supplier Portal, Operations Console, …)
        │
        ▼
RDS Traceability           (MTN external back-reference only)
```

**Incorrect dependency directions (retired):**

```text
RDS → Roadmap → Implementation
Product → Features
```

Each implementation PR is **capability-scoped first** (e.g. `PR-WORKFORCE-BLACKLIST-ENFORCE-1` → Workforce Administration). Product projections and RDS rows (e.g. FE004, FE014) are cited **after** the capability decision — for UX routing and MTN coverage, not as the backlog source.

**Capability ↔ plane (same bounded contexts, business language):**

| Capability | RDS rows (traceability only) |
|------------|------------------------------|
| **Workforce Administration** | FE004, FE009–FE014 |
| **Engagement Administration** | FE008, FE015–FE016 |
| **Access Integration** | FE003 + lifecycle reactions |
| **Workflow Orchestration** | FE005, FE002 approval paths |
| **Supplier Administration** (+ portal projection) | FE001, FE006, FE007 |

The RDS remains valuable as an **external traceability matrix** for MTN conversations — not as the EWP backlog. See [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md).

---

## Classification key

| Code | Meaning |
|------|---------|
| **A** | Already implemented — CMS meets RDS intent at acceptable scope |
| **B** | Implemented as CMS baseline; RDS needs more workflow, integration, or enforcement |
| **C** | Belongs to another plane — do not implement inside workforce state machine |
| **D** | Net-new — no meaningful CMS capability today |
| **E** | Should be challenged — RDS assumption conflicts with CMS architecture or needs MTN clarification |

**Build column:**

| Value | Meaning |
|-------|---------|
| **Now** | Safe extension on proven baseline (validation, enforcement hooks) |
| **Later** | Planned plane work; sequence after baseline freeze |
| **Challenge** | Escalate to MTN before build |

---

## Plane decomposition (architecture protection)

```text
RDS "contractor lifecycle"          CMS decomposition
─────────────────────────          ───────────────────
Portal self-service        →        Supplier plane (ring-fenced UX)
Login / MFA / supplier RBAC  →        Identity + Governance
SNOW access request        →        Access plane (adapter)
Onboarding / rehire        →        Workforce + Identity acquisition
Contract dates / transfer  →        Engagement plane
Suspension / termination     →        Workforce state + Access reaction
Notifications / approvals  →        Workflow plane (or integration bus)
Audit / reporting          →        Audit + Reporting
Blacklisted enforcement    →        Workforce block + Identity validate + Access revoke
```

Workforce plane **emits domain events**. Other planes **react**. Workforce does not call SNOW, HCM push, or IGA directly except through defined adapters (future PRs).

---

## Traceability table — FE001–FE016

| RDS Feature | RDS Intent | CMS Plane | CMS Capability Today | Gap | Decision | Class | Build |
|-------------|------------|-----------|----------------------|-----|----------|-------|-------|
| **FE001** — 3rd party admin portal | Self-service portal for onboarding, rehire, extension, suspension, termination, profile update | **Supplier** + **Workforce** | Supplier portal: nominate contractor, read-only workforce timeline, scoped contractor list; timesheet/invoice surfaces (separate PRs) | No supplier self-service for suspend / terminate / extend / rehire / bulk; no full lifecycle menu RDS describes | **Extend portal incrementally per mapped feature** — do not build one RDS mega-workflow | **B** | Later |
| **FE002** — User authentication & login | Secure login, MFA, RBAC, supplier ring-fencing, HR-approved supplier admin provisioning | **Identity** + **Governance** | JWT auth, permission catalog, supplier scope guard, seed roles (supplier admin, ops, sponsor personas) | No MFA; not MTN IdP standards; no HR approval gate before supplier admin access | **CMS RBAC is baseline**; MTN IdP/MFA is integration; **challenge** HR approval duplicated with Supplier membership | **B** | Later / **Challenge** |
| **FE003** — Access control (request, approve, provision, revoke) | SNOW/E-SSO access request, HR DoA approval, role provisioning, revoke on lifecycle | **Access** (+ **Identity**) | IGA outbox substrate, access context in auth layer; no ServiceNow / Aveksa connector | Full SNOW workflow, provisioning execution, revoke on suspend/terminate/blacklist | **Belongs to Access plane** — adapter PRs, not workforce transitions | **C** | Later |
| **FE004** — Contingent worker onboarding (single & bulk) | Guided onboarding form, mandatory HCM fields, duplicate/blacklist validation, LM + HRBP approval | **Workforce** + **Supplier** + **Identity** | Supplier nominate → `NOMINATED`; ops review → `PENDING_APPROVAL` → `ACTIVE`; HCM promote bootstrap; create contractor API | Bulk onboarding; full MTN field template; LM/HRBP approval chain; BR003–BR008 enforcement at intake; RSA vs non-RSA branching | **Nominate v1 proven**; harden validation/block rules separately from approval engine | **B** | Now (validation) / Later (bulk, workflow) |
| **FE005** — Notifications & alerts | Email/in-app alerts at every lifecycle step; LM as first approver in notification chain | **Workflow** + **Reporting** | Audit log + workforce history (retrospective truth); no notification dispatcher | No email engine; no approver notification routing; no worker-facing provisioning notices | **Net-new notification service** or integration bus — not embedded in transition service | **D** | Later |
| **FE006** — Worker search & record lookup | Search by name/ID; ring-fenced results; masked ID; status; rehire guidance; block dismissed workers | **Workforce** + **Supplier** | Contractor list APIs; supplier portal scoped list; basic filters | National ID–centric search; masked identifier display; duplicate/rehire guidance UX; explicit blocked-worker messaging | **Extend search on registry**; enforcement ties to FE004/FE014 | **B** | Later |
| **FE007** — Worker record update | Update non-lifecycle fields with permissions, validation, audit, optional approval | **Workforce** + **Engagement** | `PATCH /contractors`; supplier create captures intake fields; audit on mutations | Field-level RBAC matrix; approval for sensitive changes; notification on update; RDS field catalog parity | **Registry update ≠ lifecycle event** — keep in contractor service, not transition matrix | **B** | Later |
| **FE008** — Contract extension | Extend contract end date with validation, LM approval, bulk extension, notifications | **Engagement** (+ **Workforce** event) | Engagement `startDate` / `endDate`; ADR event `ContractExtended` (stub) | Extension request UX; approval workflow; bulk; validation (terminated/suspended/blacklisted); billing/access side effects | **Engagement owns dates**; workforce emits `ContractExtended` — do not overload `ACTIVE` | **B** | Later |
| **FE009** — Worker suspension | Temporary inactive state; preserve contract dates; access removal; LM approval; effective dates | **Workforce** + **Access** | `SUSPENDED` state; `ACTIVE → SUSPENDED`; `SUSPENDED → ACTIVE`; domain stub `ContractorSuspended` | No access disablement; no effective-date model; no approval workflow; no “Suspended – No Payroll” semantics | **Split:** Workforce Suspension v1 (state + timeline) **then** Access revocation integration | **B** | Later |
| **FE010** — Worker termination | Formal contract end; access removal; reason capture; do-not-rehire flag; LM approval | **Workforce** + **Access** + **Engagement** | `TERMINATED` state; `ACTIVE → TERMINATED`; legacy deactivate path; domain stub `ContractorTerminated` | Termination reason taxonomy; do-not-rehire linkage; access removal; approval workflow; engagement close automation | **Workforce termination v1** separate from FE014 blacklist and Access revoke | **B** | Later |
| **FE011** — Reverse-termination | Restore terminated worker to active; strict eligibility (time windows, misconduct); access restore | **Workforce** + **Access** | `TERMINATED → ACTIVE` transition (ops path; domain event `ContractorRehired` when from terminated) | RDS eligibility rules (1–3 day window, 30-day cutoff, misconduct blocks); approval; access restoration | **Map to controlled reopen** with governance rules layer — **challenge** hard-coded RDS windows until MTN confirms | **B** / **E** | Later / **Challenge** |
| **FE012** — Rehire | Revive existing record; preserve employee number; new contract period; block do-not-rehire | **Workforce** + **Identity** + **Engagement** | Identity continuity via CTR/HCM promote; `TERMINATED → ACTIVE` partial overlap | Dedicated rehire UX; eligibility vs blacklist; new engagement period; access provisioning; “employee number for life” policy | **Rehire ≠ new nominate** — workforce + identity linking PR; not portal duplicate create | **B** | Later |
| **FE013** — Reinstatement | Resume suspended worker; restore access; LM approval; effective date | **Workforce** + **Access** | `SUSPENDED → ACTIVE`; domain stub `ContractorReinstated` | Reinstatement form; effective date; approval workflow; automatic access restore | **Same split as FE009** — workforce reinstate first, access reaction second | **B** | Later |
| **FE014** — Blacklisting | Do-not-hire; block onboarding, rehire, reverse-termination, reinstatement, movement; approval; access removal | **Workforce** + **Identity** + **Access** | `→ BLACKLISTED`; reason + `authorityNote`; timeline; supplier hidden; ops-only; terminal state | Approval rules (supplier request vs MTN apply); access removal; un-blacklist; **cross-lifecycle enforcement** (onboard, rehire, reinstate, reverse-term, movement) | **CMS workforce policy block shipped** — extend enforcement hooks; defer MTN approval + access | **B** | Now (enforce blocks) / Later (approval, access) |
| **FE015** — Worker transfer | Move worker across org structure (reporting line, department, position); active only | **Engagement** (+ **Governance**) | Engagements with sponsor/placement; contractor org fields partial | Transfer request workflow; LM approval; org-structure mutation; access recalculation | **Engagement plane** — not a workforce state change | **C** | Later |
| **FE016** — Worker movement | Update role, position, OU, cost centre, project while active | **Engagement** | Placement and contract context on engagement | Movement form; approval; cost centre / project codes; manager change rules vs transfer | **Engagement plane** — distinguish movement vs transfer (FE015) | **C** | Later |

---

## Worked examples (classification rationale)

### FE014 — Blacklisting → **B**

**CMS today:**

```text
→ BLACKLISTED
reason
authorityNote
timeline
supplier hidden
ops-only
```

**RDS also requires:** approval rules (supplier request, LM apply), access removal, un-blacklist, enforcement across onboarding, rehire, reinstatement, reverse-termination, and movement.

**Decision:** Keep blacklist as workforce policy block; add cross-plane enforcement incrementally; do not merge into a single RDS approval workflow.

### FE009 — Suspension → **B**

**CMS today:** `SUSPENDED` state + transition possible.

**Gap:** No access disablement, no effective-date model, no approval workflow.

**Decision:** Split into Workforce Suspension v1 and Access Revocation integration later.

---

## Summary by classification

| Class | Count | Features |
|-------|-------|----------|
| **A** | 0 | — (no RDS line is fully satisfied at MTN scope) |
| **B** | 12 | FE001, FE002, FE004, FE006, FE007, FE008, FE009, FE010, FE011, FE012, FE013, FE014 |
| **C** | 3 | FE003, FE015, FE016 |
| **D** | 1 | FE005 |
| **E** | 1 (overlay) | FE011 (challenge eligibility windows) |

---

## Capability roadmap (RDS cited for traceability only — not authorized yet)

Ordered by **capability maturity** per [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md):

```text
1. Workforce Administration   Enforcement hooks (FE004, FE014 back-ref)
2. Workforce Administration   Suspend / terminate / reinstate ops UX (FE009, FE010, FE013)
3. Engagement Administration  Extension, transfer, movement (FE008, FE015, FE016)
4. Access Integration         SNOW/Aveksa + lifecycle reactions (FE003)
5. Workflow Orchestration     Notifications / approval engine when scoped (FE005, FE002)
6. Supplier Administration    Portal wiring to proven paths (FE001, FE006, FE007)
7. MTN challenge pack         Reverse-term windows, supplier HR approval (FE011, FE002)
```

---

## Explicit non-goals (locked)

- One monolithic “RDS contractor workflow” in CMS
- LM / Account Manager approval chains as product core (Workflow plane TBD)
- ServiceNow / Aveksa inside workforce transition service
- HCM outbound push as workforce gate
- `acquisitionModel` / independent contractor schema (separate ADR)
- Un-blacklist, full do-not-rehire policy engine (until challenged and scoped)
- Implementing from this document without a scoped implementation PR

---

## References

| Doc | Role |
|-----|------|
| [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md) | EWP product identity — CMS historical v1 name |
| [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) | Roadmap source — EWP capabilities, maturity, product projections |
| [`DOMAIN_MODEL_RECOVERY_V1.md`](./DOMAIN_MODEL_RECOVERY_V1.md) | Frozen planes — map RDS here, not the other way around |
| [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md) | Workforce states, events, reaction matrix |
| [`PR-WORKFORCE-E2E-UAT-1.md`](./PR-WORKFORCE-E2E-UAT-1.md) | Proven happy path |
| [`PR-WORKFORCE-REVIEW-OUTCOMES-1.md`](./PR-WORKFORCE-REVIEW-OUTCOMES-1.md) | Proven exception path |
| [`PR-WORKFORCE-BLACKLIST-1.md`](./PR-WORKFORCE-BLACKLIST-1.md) | Proven policy block |

**Next:** Roadmap and PRs cite [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) first; RDS rows from this matrix for MTN traceability only.
