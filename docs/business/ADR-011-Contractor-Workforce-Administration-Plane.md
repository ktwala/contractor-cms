# ADR-011: Contractor Workforce Administration Plane

## Status

**APPROVED** — May 2026 (Workforce State Model PR authorized)

**Depends on:** [`DOMAIN_MODEL_RECOVERY_V1.md`](./DOMAIN_MODEL_RECOVERY_V1.md) (frozen baseline)
**Platform:** External Workforce Platform (EWP) — [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md)
**Capability contract:** [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) (normative; this ADR is rationale)
**Supersedes scope confusion with:** [`ADR-003`](./ADR-003-Contractor-Lifecycle-Governance.md) (PDP maturation remains valid; this ADR names the **workforce state machine** ADR-003 assumed but did not define)

---

## Context

The External Workforce Platform already runs **multiple lifecycles** around the `Contractor` aggregate:

- Supplier trust lifecycle
- Identity acquisition (HCM sync → staging → promote)
- Engagement / placement lifecycle
- Governance / drift lifecycle
- Access / IGA lifecycle (substrate)

What is **missing** is an explicit **Contractor Workforce Administration** plane: the platform's answer to *“What is this person’s workforce status with the client?”*

Today that is **proxied** by `Contractor.isActive` and engagement dates. That was sufficient for bootstrap and governance demos; it is **insufficient** for:

- Suspension vs termination vs blacklist semantics
- Rehire and reverse-termination distinctions
- Event-driven reactions across identity, access, and sponsor planes
- Mapping external HR requirements without collapsing planes

External specs (e.g. contingent-worker RDS) often label all of this “contractor lifecycle.” This ADR **decomposes** that label into a workforce plane that **emits domain events**; other planes **react**.

**Constitutional alignment:** [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) §7.1 workforce states; [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) — EWP `ACTIVE` ≠ IGA `ENABLED`.

---

## Decision

### 1. Introduce Contractor Workforce Administration as a first-class plane

**Owns:**

- Workforce state transitions
- Approval gates for workforce transitions (workflow TBD in implementation PRs)
- Audit + domain events for each transition
- Rules tying workforce state to PDP inputs (not replacing PDP)

**Does not own:**

- Supplier operational trust (`SupplierStatus`)
- HCM staging pipeline status
- Drift/remediation workflow status
- IGA provisioning execution
- Engagement commercial rate/contract selection (engagement plane updates **in reaction** to workforce events)

### 2. Workforce states (v1)

```text
NOMINATED           → intake captured; not yet approved for workforce
PENDING_APPROVAL    → submitted; awaiting approver chain
ACTIVE              → workforce-approved; may exist without ACCESS_ENABLED
SUSPENDED           → temporarily ineligible; contract dates may remain
TERMINATED          → workforce relationship ended
BLACKLISTED         → do-not-rehire / dismissal flag; blocks (re)onboard
```

**Mapping note:** Doctrine §7.1 also lists `SUPPLIER_VALIDATED`, `CLIENT_VALIDATED`, `SPONSOR_ASSIGNED`, `EXPIRED`. Implementation may **fold** early gates into `NOMINATED` / `PENDING_APPROVAL` sub-status or explicit pre-ACTIVE checklist — detail in state-model PR, not this ADR.

**`BLACKLISTED`** may apply to a person identity (national ID / passport anchor) across contractor records — identity rules in implementation PR.

### 3. Domain events (workforce plane publishes)

| Event | Typical transition |
|-------|-------------------|
| `ContractorNominated` | Create / intake |
| `ContractorActivated` | → `ACTIVE` |
| `ContractExtended` | Active + new end date |
| `ContractorSuspended` | → `SUSPENDED` |
| `ContractorReinstated` | `SUSPENDED` → `ACTIVE` |
| `ContractorTerminated` | → `TERMINATED` |
| `ContractorBlacklisted` | → `BLACKLISTED` (or flag set) |
| `ContractorRehired` | Prior record revived → `ACTIVE` (not new identity) |

Events are **past tense facts**. Handlers in other modules subscribe; workforce service does not call IGA/HCM directly except via defined adapters.

### 4. Plane reaction matrix (non-exhaustive)

| Event | Identity acquisition | Engagement | Governance | Access / IGA | Sponsor |
|-------|---------------------|------------|------------|--------------|---------|
| `ContractorActivated` | Confirm CTR / identity map | Ensure skeleton engagement | Clear bootstrap-only signals if cutover | Outbox: person approved | Require sponsor assigned |
| `ContractExtended` | — | Update `endDate` | — | Optional refresh if policy | Renewal review task |
| `ContractorSuspended` | — | — | May open signal | Suspend / revoke intent | — |
| `ContractorTerminated` | Retire maps per policy | Close engagement | Drift scan | Revoke intent | Offboarding prompt |
| `ContractorBlacklisted` | Block promote/onboard | — | Audit | — | — |
| `ContractorRehired` | Link prior identity | New/reopen engagement | — | Re-provision intent | Re-assign sponsor |

### 5. Relationship to `isActive`

**Interim:** `isActive = true` when workforce state ∈ `{ ACTIVE }` (and not `BLACKLISTED` on same record).

**Target:** `isActive` becomes **derived or deprecated** once `workforceState` column + PDP rules ship. Migration PR required; do not dual-write indefinitely.

### 6. Supplier-backed first; independent deferred

**Phase 1 implementation:** supplier-backed contractors only (`supplierId` required).

**Phase 2 (separate ADR + migration):** [`ADR-013`](./ADR-013-External-Worker-Acquisition-Model.md) — acquisition authority model:

```text
Contractor.acquisitionModel = SUPPLIER | INDEPENDENT

SUPPLIER     → supplierId required
INDEPENDENT  → supplierId nullable; primary sponsor required before ACTIVE
```

Do not nullable `supplierId` in Phase 1.

### 8. Three truths — history, audit, domain events (PR-WORKFORCE-TIMELINE-FOUNDATION-1)

| Artifact | Purpose |
|----------|---------|
| **`ContractorWorkforceHistory`** | Business truth — workforce transitions (`fromState → toState`), source authority, reason, effective date |
| **Audit log** | Operational truth — who changed the database |
| **Domain events** | Integration truth — downstream publication stubs |

Workforce history is persisted **in the same transaction** as state change, **before** audit and domain-event emission. Transition labels are **derived** at read time, not stored as `eventType`.

### 9. Explicit non-goals (this ADR)

- Full MTN RDS feature parity (FE001–FE016)
- ServiceNow / Aveksa connectors (access plane adapters — later)
- HCM outbound push (identity/post-cutover adapter — later)
- Replacing supplier lifecycle or drift engine

---

## Consequences

### Positive

- Clear place for employment/workforce semantics without contaminating identity or IGA planes
- External requirements map to **events + states**, not schema rewrites
- Preserves [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) — bootstrap remains acquisition, not workforce orchestration

### Negative / cost

- New state machine + migration from `isActive`
- Approval workflow engine (or disciplined controller pattern) required for `PENDING_APPROVAL`
- ADR-003 enforcement phases must align with workforce states to avoid duplicate/conflicting rules

---

## Implementation sequence

| Step | Deliverable |
|------|-------------|
| 1 | **This ADR** + Recovery v1 — **done** |
| 2 | Workforce state enum + `Contractor.workforceState` — **PR-WORKFORCE-STATE-MODEL-1 COMPLETE** |
| 3 | Transition service + audit events + outbox hooks (supplier-backed only) |
| 4 | Portal/internal UX for nominate → pending → active (minimal); supplier-backed |
| 5 | Suspension + termination + blacklist (supplier-backed) |
| 6 | Rehire + extension events wired to engagement |
| 7 | **ADR-013: acquisitionModel** + nullable `supplierId` for independent path — [`ADR-013`](./ADR-013-External-Worker-Acquisition-Model.md) **APPROVED**; schema PR pending |
| 8 | External RDS mapping document (features → planes) |

---

## Approval

| Role | Name | Date |
|------|------|------|
| Product | | |
| Architecture | | |

When **APPROVED**, open workforce state schema PR with [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md) update.
