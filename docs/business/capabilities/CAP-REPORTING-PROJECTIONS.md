# CAP-REPORTING-PROJECTIONS

**Capability:** Reporting & Projections
**Platform:** External Workforce Platform (EWP)
**Version:** 1.0
**Status:** **RATIFIED** — gateway CAP (May 2026); authority-creep protections in §7 P-09, §12
**Normative:** This document uses **SHALL** / **SHALL NOT** as defined in RFC 2119.

> **Gateway capability — not an enduring truth owner.** Reporting & Projections **SHALL NOT** answer *what is the worker's workforce state?* or *is this supplier trusted?* — those are authoritative capabilities. It **SHALL** answer *how does EWP project authoritative business truth into operational views without becoming the owner of that truth?* **Its responsibility ends when a projection has been made available for consumption. It SHALL NOT interpret or resolve disagreements between authoritative capabilities.** See [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](../EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — Authoritative / Gateway / Cross-cutting.

**Implementation identifiers (non-normative):** `AuditInsightsService`, governance status tiles, `ContractorWorkforceTimeline`, dashboard widgets, export endpoints — current partial implementation; this CAP defines the target contract. **Operational Projection** (business) **MAY** be implemented as a read model, query service, or cached aggregate (implementation).

---

## Dependencies

| ADR / doctrine | Role |
|----------------|------|
| [`ADR-012`](../ADR-012-External-Workforce-Platform-Naming.md) | External Workforce Platform identity |
| [`CAP-SUPPLIER-ADMINISTRATION.md`](./CAP-SUPPLIER-ADMINISTRATION.md) | Supplier truth consumed — not owned |
| [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) | Workforce truth consumed — not owned |
| [`CAP-ENGAGEMENT-ADMINISTRATION.md`](./CAP-ENGAGEMENT-ADMINISTRATION.md) | Engagement truth consumed — not owned |
| [`CAP-IDENTITY-ACQUISITION.md`](./CAP-IDENTITY-ACQUISITION.md) | Acquisition pipeline facts consumed |
| [`CAP-ACCESS-INTEGRATION.md`](./CAP-ACCESS-INTEGRATION.md) | Publish outcomes consumed — not entitlement truth |
| [`ADR-010`](../../security/ADR-010-Governance-Analytics-And-Risk-Intelligence.md) *(proposed)* | Governance analytics as read-only aggregation |

**Reading chain:**

| Question | Document |
|----------|----------|
| Why does it exist? | Capability Map § gateway role, Operations Console projection |
| What must it do? | **This CAP (v1.0)** |
| How was it built? | §11 Maturity — PR evidence *(when implemented)* |
| Does it conform? | [`CERT-REPORTING-PROJECTIONS.md`](./CERT-REPORTING-PROJECTIONS.md) |

**Architectural role:** **Gateway** — derives and delivers **Operational Projections**; **SHALL NOT** own supplier, workforce, engagement, identity, access, or governance truth.

### Gateway terminal operations (platform algebra)

Same architectural responsibility — different terminal operation:

| Gateway | Ends at |
|---------|---------|
| Identity Acquisition | **Publish** |
| Access Integration | **Publish** |
| Reporting & Projections | **Projection** |

---

## 1. Purpose

> **Reporting & Projections is responsible for projecting authoritative EWP business truth into Operational Projections for consumers. Its responsibility ends when a projection has been made available for consumption. It SHALL NOT interpret or resolve disagreements between authoritative capabilities — consumers and authoritative CAPs own resolution.**

Reporting & Projections **SHALL** consume authoritative facts and cross-cutting signals, derive non-authoritative Operational Projections, apply scope and redaction policy, declare projection freshness, and deliver results to operators, executives, auditors, and integrations.

It **SHALL NOT** mutate supplier trust, workforce state, engagement placement, acquisition pipeline, access intent, governance remediation, or any other authoritative business object.

It **SHALL NOT** derive business decisions that replace or supersede authoritative capability decisions *(§7 P-09)*.

---

## 2. Business question

> **How does the External Workforce Platform project authoritative business truth into operational views without becoming the owner of that truth?**

Every element of this capability **SHALL** exist only to answer that question.

Reporting & Projections **SHALL NOT** be confused with:

| Question | Owned by |
|----------|----------|
| What is the worker's workforce state? | Workforce Administration |
| Which organisations may supply workers? | Supplier Administration |
| Where is the worker engaged? | Engagement Administration |
| How did the worker enter EWP? | Identity Acquisition |
| What access intent was published? | Access Integration |
| Is platform truth aligned? | Governance |
| What entitlements does the worker hold? | Enterprise IGA |

---

## 3. Capability boundaries

### 3.1 Architectural role (gateway)

Reporting & Projections is a **gateway capability**. It **projects** truth for consumption. It **SHALL NOT** remain the operational source of truth for any business object after a consumer acts on a projection.

```text
Supplier Administration ─────┐
Workforce Administration ────┤
Engagement Administration ───┼──► Reporting & Projections ──► Operational Projections
Governance (signals) ────────┤              │
Access Integration (publish) ┘              ▼ consumption
                                 Consumers resolve disputes
                                 against authoritative CAPs
```

**Boundary sentence:** Reporting & Projections **ends when a projection has been made available for consumption. It SHALL NOT interpret or resolve disagreements between authoritative capabilities.**

**Guardrail:** Reporting **MAY** derive views; it **SHALL NOT** become authoritative for supplier, workforce, engagement, identity, access, or governance truth.

**Authority creep:** Reporting is the most dangerous gateway because it **lives**, **evolves**, and **accumulates derived logic**. This CAP **SHALL** be read as explicit protection against gradual ownership leakage — see §7 P-09 and §12 invariant 11.

### 3.2 Cross-capability disagreement (display, do not reconcile)

When authoritative sources disagree, Reporting **SHALL** surface the disagreement — **SHALL NOT** reconcile it.

| Example | Reporting **SHALL** | Reporting **SHALL NOT** |
|---------|---------------------|-------------------------|
| Supplier `ACTIVE`, Workforce `TERMINATED` | Display both facts with source attribution | Compute a single "effective" status |
| Engagement active, contract expired | Show both signals and freshness | Declare contract "automatically expired" |
| Governance drift open, workforce `ACTIVE` | Show drift signal alongside workforce projection | Override workforce display with drift verdict |

Same discipline as Identity Explorer: **show; do not decide.**

### 3.3 Owns

Reporting & Projections **SHALL** own:

| Concern | Description |
|---------|-------------|
| **Projection definitions** | How authoritative facts map to an Operational Projection |
| **Operational Projection materialization** | Cached or on-demand assembly — implementation **MAY** use read models |
| **Metric definitions** | Counts, rates, rollups — **derived**, not business state |
| **Export jobs** | Scheduled or on-demand extracts for consumers |
| **Projection freshness** | **Fresh** / **Delayed** / **Stale** — business semantics, not optional UI chrome |
| **Scope and redaction application** | Sponsor, supplier portal, finance visibility on derived output |
| **Projection events** | Past-tense facts about materialization and export completion |

### 3.4 Does not own

Reporting & Projections **SHALL NOT** own:

| Concern | Owned by |
|---------|----------|
| Supplier status, trust, lifecycle | Supplier Administration |
| Workforce state, transitions, history | Workforce Administration |
| Engagements, contracts, timesheets, invoices | Engagement Administration |
| Acquisition pipeline stages | Identity Acquisition |
| Access intent, publish outcomes, IGA correlation | Access Integration |
| Drift detection, remediation workflow, evidence verdicts | Governance |
| Approval chains, task routing | Workflow Orchestration |
| Entitlement catalog, role assignments | Enterprise IGA |

Reporting & Projections **SHALL NOT** approve suppliers, suspend workers, promote staging rows, publish to IGA, or resolve drift — even when a dashboard surfaces an item requiring action.

**Gateway ≠ UI volume:** Dashboards and charts **SHALL NOT** imply authoritative ownership. This capability is a gateway because it **projects truth for consumption**, not because it renders pixels.

---

## 4. Projection objects

**Projection-plane objects only** — not authoritative business objects. The noun **Projection** reminds consumers: *this is not the thing; it is a view.*

| Object | Definition |
|--------|------------|
| **Supplier Projection** | Derived view of supplier facts — status counts, trends, contract validity windows |
| **Workforce Projection** | Derived view of workforce facts — state distribution, timeline, review queue depth |
| **Engagement Projection** | Derived view of placement, utilisation, billing summaries |
| **Governance Projection** | Derived view of drift, remediation, signal summaries — **not** remediation authority |
| **Operational Projection** | Composite projection for a defined consumer context (Operations Console, executive scorecard) |
| **Metric** | Scalar or time-series rollup over authoritative facts |
| **Export Job** | Bounded extract request with format, scope, and completion status |
| **Projection Freshness** | **Fresh**, **Delayed**, or **Stale** — see §5.3 |
| **Consumer Scope** | Applied filter context (org, sponsor, supplier portal, finance redaction) |

Implementation **MAY** map Operational Projections to read models, query services, or cached aggregates — **SHALL NOT** persist parallel authoritative business records.

**Naming discipline (business → implementation):**

```text
Operational Projection  →  read model / query / aggregate (code)
External Worker         →  Contractor (schema)
```

---

## 5. Projection pipeline

Reporting & Projections **SHALL** model outbound work as a **projection pipeline**, not a business lifecycle state machine.

### 5.1 Conceptual pipeline (Capability Version 1)

| Stage | Meaning |
|-------|---------|
| **Sources Selected** | Authoritative capabilities and signals identified for derivation |
| **Projection Defined** | Mapping rules and scope policy bound to the Operational Projection |
| **Materialized** | Projection computed from current authoritative facts |
| **Available** | Projection made available for consumption (UI, API, export) |

Terminal success is **Available** — not ongoing ownership of business truth.

### 5.2 Pipeline vs lifecycle (mandatory distinction)

| Model | Reporting & Projections | Workforce Administration |
|-------|------------------------|--------------------------|
| Nature | Projection pipeline | Business lifecycle state machine |
| Question answered | What does the operator see right now? | What is workforce standing? |
| Terminal success | Projection available for consumption | ACTIVE / TERMINATED / etc. |
| Operational disputes | **SHALL** resolve against authoritative CAP | Workforce state |

Workforce `SUSPENDED` **SHALL NOT** be encoded as a Reporting pipeline stage.

### 5.3 Projection freshness (first-class business semantics)

Unlike Identity Acquisition and Access Integration — which publish once per intent — Reporting **continually reflects** authoritative truth. Freshness is **business semantics**, not optional operational metadata. Without freshness, Reporting can accidentally claim truth.

| Freshness | Meaning |
|-----------|---------|
| **Fresh** | Projection reflects authoritative sources within defined SLA |
| **Delayed** | Projection is within acceptable lag; consumers **SHALL** be informed |
| **Stale** | Source facts changed materially since materialization; refresh required before high-stakes use |

Every Operational Projection **SHALL** declare freshness at consumption time. **Stale** projections **SHALL NOT** be presented without explicit staleness indication.

---

## 6. Commands

Projection operations. **SHALL NOT** reference UI controls, HTTP methods, or product names.

| Command | Effect (normative) |
|---------|-------------------|
| **Define Projection** | Register or update derivation rules for an Operational Projection |
| **Materialize Projection** | Compute projection from current authoritative facts |
| **Refresh Metric** | Recompute rollup for a time window |
| **Run Export** | Produce bounded extract for a consumer |
| **Apply Consumer Scope** | Enforce sponsor, supplier, finance redaction on output |
| **Record Projection Freshness** | Persist Fresh / Delayed / Stale — not business mutation |

Reporting & Projections **SHALL NOT** expose commands named **Suspend Worker**, **Approve Supplier**, **Promote Staging Row**, **Publish to IGA**, **Resolve Drift**, or **Determine Compliance** — those belong to authoritative or cross-cutting capabilities.

---

## 7. Policies

| ID | Policy |
|----|--------|
| **P-01** | Reporting **SHALL NOT** mutate authoritative business state. |
| **P-02** | Every projection **SHALL** trace to authoritative facts — not invent business truth. |
| **P-03** | After consumption, operational disputes **SHALL** be resolved against authoritative capabilities — not against projections. |
| **P-04** | Projections **SHALL** respect sponsor scope, supplier portal ring-fence, and finance visibility. |
| **P-05** | Every Operational Projection **SHALL** declare freshness (Fresh / Delayed / Stale) — **SHALL NOT** silently present derived data as current truth. |
| **P-06** | Reporting **SHALL NOT** execute provisioning, remediation, approval, or publish side effects. |
| **P-07** | Governance analytics **MAY** aggregate audit and signal data — **SHALL NOT** become the remediation authority. |
| **P-08** | IGA entitlement catalogs **SHALL NOT** be presented as EWP-owned truth. |
| **P-09** | Reporting **SHALL NOT** derive **business decisions** that replace or supersede authoritative capability decisions. |

### P-09 — Authority creep (normative examples)

| Allowed (projection) | Not allowed (business decision) |
|----------------------|--------------------------------|
| 92 workers active | Worker is compliant |
| 14 expiring this month | Supplier is trusted |
| Supplier trend chart | Worker should be suspended |
| Utilisation chart | Contract automatically expired |
| Drift count by severity | Official workforce health score |
| Workers at risk *(signal)* | Workforce health determination |

Counts, trends, charts, and **labeled signals** are projections. Verdicts, trust determinations, compliance outcomes, and **official** scores are authoritative decisions — **SHALL NOT** originate in Reporting.

---

## 8. Events

Business facts Reporting & Projections **SHALL** emit after successful operations. Past tense; projection semantics only.

| Event | Typical outcome |
|-------|-----------------|
| **Projection Defined** | Derivation rules registered or updated |
| **Projection Materialized** | Operational Projection computed from authoritative sources |
| **Metric Refreshed** | Rollup recomputed for window |
| **Export Completed** | Extract delivered to consumer |
| **Projection Freshness Changed** | Fresh → Delayed → Stale transition recorded |

Authoritative capabilities **SHALL** emit business facts (e.g. **Worker Suspended**) — Reporting **SHALL** react by refreshing projections, not by owning suspension.

---

## 9. Operational Projections

**Operational Projections** are the **primary deliverable** of this capability — what the business consumes. Implementation **MAY** realize them as read models. Each **SHALL** declare authoritative sources, audience, and freshness semantics.

| Operational Projection | Audience | Authoritative sources | Content |
|------------------------|----------|----------------------|---------|
| **Operations Overview** | Enterprise operators | Supplier, Workforce, Engagement, Governance | Counts, health tiles, queue depth summaries |
| **Workforce Timeline Projection** | Operators, sponsors | Workforce Administration | State history per External Worker |
| **Governance Status Projection** | Governance operators | Governance, Supplier, Workforce | Drift/remediation summaries by severity |
| **Audit Insights Projection** | Security, audit | Audit log (cross-cutting observability) | Activity rollups, severity trends |
| **Engagement Utilisation Projection** | Operations, finance | Engagement Administration | Placement and billing summaries |
| **Access Publish Projection** | Integration operators | Access Integration | Publish backlog — **not** entitlement catalog |
| **Executive Scorecard Projection** | Leadership | Multiple authoritative + governance signals | KPI rollups with freshness |

Operational Projections **SHALL NOT** present derived metrics as commands, verdicts, or authoritative state transitions.

---

## 10. Integrations

### 10.1 Consumes

| Capability | Consumption |
|------------|-------------|
| **Supplier Administration** | Supplier status, lifecycle, contract validity facts |
| **Workforce Administration** | Workforce state, history, review outcomes |
| **Engagement Administration** | Placements, contracts, timesheets, invoices |
| **Identity Acquisition** | Pipeline status, staging queue depth *(not acquisition authority)* |
| **Access Integration** | Publish pipeline outcomes *(not IGA entitlements)* |
| **Governance** | Drift, remediation, signal lifecycle, evidence status |
| **Workflow Orchestration** | Task and approval queue depth *(when built)* |

Consumption **SHALL** be read-only against authoritative stores.

### 10.2 Produces

| Target | Production |
|--------|------------|
| **Operations Console** | Dashboards, tiles, timelines |
| **Executive / audit consumers** | Scorecards, exports |
| **External analytics** *(optional)* | Bounded API or file feeds — still non-authoritative |
| **Governance** | Friction metrics as signals — **not** remediation decisions |

On every **Projection Materialized**, Reporting & Projections **SHALL** record:

1. **Projection freshness** — Fresh / Delayed / Stale with source coverage and timestamp
2. **Scope applied** — sponsor / supplier / finance context
3. **Projection event** — downstream notification stub or live bus *(when built)*

---

## 11. Maturity and evidence

| Capability element | Status | Evidence |
|--------------------|--------|----------|
| Audit insights aggregation | **Partial** | `AuditInsightsService`, `/settings/audit-insights` |
| Governance status tiles | **Partial** | Supplier governance operations, drift summaries |
| Workforce timeline projection | **Partial** | [`PR-WORKFORCE-TIMELINE-FOUNDATION-1`](../PR-WORKFORCE-TIMELINE-FOUNDATION-1.md) |
| Unified projection service / module | Planned | — |
| Projection freshness contract (Fresh/Delayed/Stale) | Planned | — |
| Formal CERT | **PASS v1.0** | [`CERT-REPORTING-PROJECTIONS.md`](./CERT-REPORTING-PROJECTIONS.md) (May 2026) — PARTIAL rows match Planned scope above |

---

## 12. Capability invariants

1. Reporting & Projections **SHALL NOT** own supplier truth.
2. Reporting & Projections **SHALL NOT** own workforce truth.
3. Reporting & Projections **SHALL NOT** own engagement truth.
4. Reporting & Projections **SHALL NOT** own identity acquisition truth.
5. Reporting & Projections **SHALL NOT** own access or entitlement truth.
6. Reporting & Projections **SHALL NOT** own governance remediation truth.
7. Every projection **SHALL** derive from authoritative facts — not invent business state.
8. Operational disputes **SHALL** resolve against authoritative capabilities, not projections.
9. Pipeline stages **SHALL NOT** be confused with Workforce States or supplier lifecycle.
10. Responsibility **SHALL** end when a projection has been made available for consumption.
11. **No Operational Projection may become the authoritative source of any business truth** — regardless of dashboard count, export volume, KPI maturity, or AI summarization layered on top.

Invariant 11 is platform-critical: if preserved, Reporting remains a gateway forever. A proposal to calculate "official workforce status" inside Reporting **SHALL** be rejected for the same reason workforce suspension inside Access Integration is rejected — **not because Reporting cannot calculate it, but because it does not own that truth.**

---

## Document control

| Version | Change |
|---------|--------|
| **1.0 draft** | First gateway CAP authoring pass — May 2026 |
| **1.0** | Ratified — authority-creep protections (P-09), Operational Projections, freshness semantics, invariant 11 |

Changes **SHALL** increment capability version when normative §1–§10 or §12 change.

PRs **SHALL** cite `CAP-REPORTING-PROJECTIONS vX.Y` and list affected §.

---

## Template notice

Gateway CAP — emphasize §3 projection boundary and disagreement display, §5.3 freshness, §7 P-09 authority creep, §9 Operational Projections, §12 invariant 11. Do **not** copy Workforce state machine or Governance remediation workflow into this document.
