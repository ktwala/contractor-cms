# Continuous Workforce Assurance — product boundary (v1)

**Status:** RATIFIED — subordinate to **complete & frozen** lifecycle [`EXTERNAL_WORKFORCE_LIFECYCLE.md`](./EXTERNAL_WORKFORCE_LIFECYCLE.md). **Do not refine architecture** — execute assurance domains.  
**Audience:** Product, demo authors, engineers  
**Parent:** [`business/EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md`](./business/EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md)  
**Related:** [`WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md`](./WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md) · [`INTERNAL_ACCOUNTABILITY_MODEL.md`](./INTERNAL_ACCOUNTABILITY_MODEL.md) · [`DEMO-MTN-ASSURANCE-STORIES.md`](./DEMO-MTN-ASSURANCE-STORIES.md)

---

## Doctrine

> **Continuous Workforce Assurance does not discover workers, reconcile identities, or provision access. It continuously evaluates whether operational workers remain compliant with workforce governance policy.**

> **Assessment determines whether a worker is ready to become operational. Continuous Workforce Assurance determines whether an operational worker remains fit to stay operational.**

| Belongs elsewhere | Capability |
|-------------------|------------|
| Discover workers | Workforce Discovery |
| Readiness at import | Workforce Assessment |
| Provision / revoke access | IGA |
| **Ongoing compliance of operational workers** | **Continuous Workforce Assurance** |

> **Every capability exists to answer exactly one business question. When a capability begins answering multiple independent questions, it is a signal that a new capability may be emerging — not that the existing one should expand.**

**Product discipline:** Before adding scope, ask — *Is this about becoming operational, or remaining operational?*

---

## Capability vs workspace

| Layer | Name | Role |
|-------|------|------|
| **Capability** | **Continuous Workforce Assurance** | Platform continuously evaluates operational workers |
| **Workspace (future)** | **Governance Review** | Where operators review findings and execute actions |

Planned navigation — see [`EXTERNAL_WORKFORCE_LIFECYCLE.md`](./EXTERNAL_WORKFORCE_LIFECYCLE.md).

---

## Boundary: Operational Workforce only

**Everything before Operational Workforce is onboarding. Everything after is continuous governance.**

Continuous Workforce Assurance applies **only** to workers in the operational registry. It never runs readiness checks on discovery staging.

Readiness findings from Assessment stay on Workforce Discovery until the worker is operational and a gap persists in live state.

---

## Five assurance domains (frozen)

Assurance **disciplines** — not generic nouns:

```text
Accountability Assurance
Supplier Assurance
Engagement Assurance
Workforce Assurance
Access Assurance          ← Phase 2 (requires IGA signals)
```

| # | Domain | Governance question |
|---|--------|---------------------|
| 1 | Accountability Assurance | Who no longer has clear accountability? |
| 2 | Supplier Assurance | Who no longer belongs to a valid supplier? |
| 3 | Engagement Assurance | Who no longer has a valid engagement? |
| 4 | Workforce Assurance | Whose workforce record no longer reflects reality? |
| 5 | Access Assurance | Whose operational access no longer matches workforce status? |

### Rule: one finding, one domain

Every finding belongs to **exactly one** domain. Separate findings for separate violations (e.g. contract expired → Engagement Assurance; stale access → Access Assurance).

---

## Observation → Finding → Decision → Action

```text
Observation  →  Finding  →  Decision  →  Action
 (evidence)      (policy)     (triage)      (execution)
```

| Stage | Meaning |
|-------|---------|
| **Observation** | Evidence from Portal, HCM, IGA, or EWP registry |
| **Finding** | Policy interpretation — one domain, one code |
| **Decision** | Triage — not every finding requires action (`MONITOR`, `REVIEW_REQUIRED`, `CRITICAL`, `COMPLIANT`) |
| **Action** | Operator or integrated remediation |

**Example — nearing expiry (monitor, no action):**

```text
Observation   Contract expires in 28 days
Finding       ENGAGEMENT_CONTRACT_EXPIRING
Decision      Monitor
Action        None
```

**Example — expired (review required):**

```text
Observation   Contract expired yesterday; engagement still active
Finding       ENGAGEMENT_CONTRACT_EXPIRED
Decision      Review required
Action        Open governance task
```

**Example — access drift (critical):**

```text
Observation   Oracle account active after contract expiry
Finding       ACCESS_AFTER_ENGAGEMENT_END
Decision      Critical
Action        Create IGA remediation
```

Full pipeline spec: [`EXTERNAL_WORKFORCE_LIFECYCLE.md`](./EXTERNAL_WORKFORCE_LIFECYCLE.md).

---

## Domain catalogs (permitted findings)

### Accountability Assurance

| Finding | Meaning |
|---------|---------|
| `ACCOUNTABILITY_MISSING` | No Responsible Manager on active engagement |
| `ACCOUNTABILITY_INACTIVE` | Assigned Responsible Manager no longer active |
| `ACCOUNTABILITY_INVALID` | Assignee cannot hold accountability |

### Supplier Assurance

| Finding | Meaning |
|---------|---------|
| `SUPPLIER_SUSPENDED` | Linked supplier suspended or offboarded |
| `SUPPLIER_NOT_SYNCHRONIZED` | EWP diverges from Portal / Procurement |
| `SUPPLIER_REMOVED` | Supplier removed upstream; worker still linked |

### Engagement Assurance

| Finding | Meaning |
|---------|---------|
| `ENGAGEMENT_CONTRACT_EXPIRED` | No active contract covers engagement |
| `ENGAGEMENT_CONTRACT_EXPIRING` | Contract ends within policy window |
| `ENGAGEMENT_CONFLICT` | Overlapping active engagements |
| `ENGAGEMENT_MISSING` | No active engagement on operational worker |

### Workforce Assurance

| Finding | Meaning |
|---------|---------|
| `WORKFORCE_DUPLICATE` | Same person, multiple operational records |
| `WORKFORCE_HCM_MISMATCH` | HCM state conflicts with EWP operational state |
| `WORKFORCE_ORPHANED` | Removed from portal; still operational in EWP |

### Access Assurance — Phase 2

| Finding | Meaning |
|---------|---------|
| `ACCESS_AFTER_ENGAGEMENT_END` | Access remains after engagement ended |
| `ACCESS_WITHOUT_ACCOUNTABILITY` | Privileged access with accountability gap |
| `ACCESS_DORMANT` | Privileged access unused beyond threshold |

---

## Supplier Portal drift (detection pattern)

Drift is a **mechanism**, not a domain. It produces observations that become findings in Supplier, Engagement, or Workforce Assurance.

---

## Governance Review counts (future UI)

Counts only — no health score:

```text
132 Operational workers — 121 Healthy — 11 Require review — 3 Critical
```

Healthy workers show **positive compliance evidence**, not empty rows.

---

## Implementation gate

| Step | Status |
|------|--------|
| Lifecycle + assurance architecture frozen | ✅ |
| Seven demo personas | ✅ |
| Personas seeded on operational workers | ☐ |
| Full pipeline rules (observation → decision → action) | ☐ |
| Governance Review workspace | ☐ |

---

## Amendment process

Add a finding only if it: (1) maps to one domain, (2) applies to operational workers, (3) documents observation → finding → decision → action, (4) has a remediation owner, (5) updates this document.

Otherwise: Assessment, Supplier Synchronization, IGA, or out of scope.
