# External Workforce Platform — Capability Map

**Role:** **Source of truth** for EWP — start here for every engineering question  
**Status:** **OPERATIONAL MODE** (May 2026) — discovery complete; apply the architecture  
**Product:** External Workforce Platform (EWP) · **Method applied:** [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md)

> **Where does this belong?** → Find the capability below. Do not search the docs tree first.  
> **No new governance document** unless an existing artifact in this map cannot answer the question.

---

## Governance stack (complete — do not extend)

| Purpose | Artifact | Status |
|---------|----------|--------|
| **EWP architecture (overview)** | [`EWP_ARCHITECTURE.md`](./EWP_ARCHITECTURE.md) | ✅ v1.0 |
| **EWP technical architecture** | [`EWP_TECHNICAL_ARCHITECTURE.md`](./EWP_TECHNICAL_ARCHITECTURE.md) | ✅ v1.0 |
| **Architectural responsibilities** | [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) | ✅ **Frozen v1.0** |
| Product identity | [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md) | ✅ |
| Vocabulary | [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md) | ✅ Frozen |
| **Capability architecture** | **This map** | ✅ Primary |
| Engineering discipline | [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) | ✅ Stable |
| Platform freeze | [`EWP-V1-ARCHITECTURE-FREEZE.md`](./EWP-V1-ARCHITECTURE-FREEZE.md) | ✅ Closed v1 |
| Navigation | [`PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md`](./PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md) | ✅ Frozen |
| Reference CAP | [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) | ✅ v1.0 |
| Customer traceability | [`PR-WORKFORCE-RDS-MAPPING-1.md`](./PR-WORKFORCE-RDS-MAPPING-1.md) (MTN) | ✅ |

**Stop writing architecture documents for EWP.** New work follows the **discovery sequence** in [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) — CAPs, PRs, and CERTs; not parallel governance prose.

**Entry point:** If a design discussion cannot identify the business truth being affected, stop — architecture has not begun.

---

## Operational mode (next six months)

| Discovery mode (done) | Operational mode (now) |
|-----------------------|-------------------------|
| What should this be? | Does this conform to the architecture we agreed? |
| Domain recovery, naming, navigation | CAP → implement → PR → CERT |
| Many ADRs and freezes per capability | **Fewer** ADRs and governance docs per capability |

**Rule:**

> **No new governance document unless an existing artifact in this map cannot answer the question.**

Reuse ADR-012, vocabulary, this map, frozen CAPs, PRs, and [`EWP-V1-ARCHITECTURE-FREEZE.md`](./EWP-V1-ARCHITECTURE-FREEZE.md) — do not fork parallel guidance.

### Document budget (health metric)

Count new ADRs and governance docs **per capability**. The trend **SHALL go down**.

| Capability | Discovery phase (actual) | Operational target |
|------------|--------------------------|-------------------|
| Workforce Administration | ~5 ADRs · ~12 governance docs | Reference — do not repeat |
| Supplier Administration | *(inherit stack)* | **1 CAP · PRs · CERT** ✅ |
| Engagement Administration | *(inherit stack)* | **1 CAP · PRs · CERT** ✅ |
| Identity Acquisition | PR-CTR stack · bootstrap doctrine | **1 CAP · PRs · CERT** ✅ |

If every new capability still generates ~20 governance documents, the method is not being applied. If it mostly produces **CAP + PRs + CERT**, the discipline is working.

---

## Capability tree (source of truth)

Each capability owns its artifact types. **Update this map** when CAPs, PRs, or UI change — do not create a sibling index.

```text
External Workforce Platform
│
├── Overview (platform landing)
│   └── UI: /dashboard — capability health
│
├── Supplier Administration
│   ├── CAP: CAP-SUPPLIER-ADMINISTRATION v1.0 ✅
│   ├── ADRs: ADR-002 …
│   ├── PRs: PR-CMS-OPERATIONS-1*, connector PRs …
│   ├── CERT: CERT-SUPPLIER-ADMINISTRATION (template)
│   └── UI: Suppliers · Approvals · Supplier sync
│
├── Workforce Administration
│   ├── CAP: CAP-WORKFORCE-ADMINISTRATION v1.0 ✅
│   ├── ADRs: ADR-011
│   ├── PRs: PR-WORKFORCE-* …
│   ├── CERT: CERT-WORKFORCE-ADMINISTRATION ✅ v1.0 PASS
│   └── UI: External Workers · Workforce review
│
├── Engagement Administration
│   ├── CAP: CAP-ENGAGEMENT-ADMINISTRATION v1.0 ✅
│   ├── ADRs: ADR-EXTID-001 (draft) …
│   ├── PRs: PR-WORKFORCE-NOMINATE-1, PR-SPONSOR-*, PR-CTR-* …
│   ├── CERT: CERT-ENGAGEMENT-ADMINISTRATION (template)
│   └── UI: Contracts · Engagements · Timesheets · Invoices · Projects · Sponsor Accountability
│
├── Identity Acquisition
│   ├── CAP: CAP-IDENTITY-ACQUISITION v1.0 ✅
│   ├── ADRs: ADR-013, ADR-EXTID-001, PR-CTR-1 …
│   ├── PRs: PR-IDENTITY-ACQUISITION-MODEL-1, PR-IDENTITY-ACQUISITION-MODEL-2, PR-CTR-CONNECTOR-* …
│   ├── CERT: CERT-IDENTITY-ACQUISITION ✅ v1.0 PASS
│   └── UI: Identity Acquisition (connector-gated)
│
├── Access Integration *(gateway)*
│   ├── CAP: CAP-ACCESS-INTEGRATION ✅ v1.0 RATIFIED
│   └── CERT: CERT-ACCESS-INTEGRATION ✅ v1.0 PASS
│
├── Governance (cross-cutting)
│   ├── CAP: (planned) CAP-GOVERNANCE
│   ├── ADRs: ADR-003 …
│   ├── PRs: drift / remediation PRs …
│   └── UI: Audit Logs · Governance Status · Exceptions · Security Insights
│
├── Administration (platform)
│   └── UI: Users · Roles
│
├── Reporting & Projections *(gateway)*
│   ├── CAP: CAP-REPORTING-PROJECTIONS ✅ v1.0 RATIFIED
│   └── CERT: CERT-REPORTING-PROJECTIONS ✅ v1.0 PASS
│
├── Workflow Orchestration (cross-cutting)
│   └── CAP: (planned) CAP-WORKFLOW-ORCHESTRATION
```

**Console navigation** mirrors the first four operational capabilities + Governance + Administration — see [`PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md`](./PR-NAV-CAPABILITY-IA-2_NAV_FREEZE.md).

---

## Core business question

> **How does an enterprise administer and govern its external workforce?**

Capabilities answer parts of that question. They are **what the business owns** — not UI modules, microservices, or customer-specific requirements.

---

## Platform purpose

The **External Workforce Platform** is the authoritative platform for administering, governing, and integrating the external workforce of an enterprise.

It manages the business lifecycle of external workers **independently of employee HCM systems** while integrating with Identity Governance, access provisioning, supplier management, and enterprise workflows.

---

## Capability map — three architectural roles

The architecture protects **business truths**, not modules. See [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) — the frozen primitive beneath this map.

```text
Business Truth → Business Area → Architectural Responsibility → Capability → CAP
```

```text
External Workforce Platform

AUTHORITATIVE — own business truth until a command changes it
│
├── Supplier Administration      (relationship-centric)
├── Workforce Administration     (state-centric)
└── Engagement Administration    (context-centric)

────────────────────────────────────────────────────────────────────

GATEWAY — establish or hand over truth; do not become source of truth
│
├── Identity Acquisition         ✅ pipeline · publish · handover
├── Access Integration           ✅ publish · handover to IGA
└── Reporting & Projections      ✅ project truth for consumers

────────────────────────────────────────────────────────────────────

CROSS-CUTTING — react across authoritative + gateway capabilities
│
├── Governance
└── Workflow Orchestration
```

Nothing here is MTN-specific, Oracle-specific, or limited to contractors.

### Falsifiable architecture (May 2026)

The architecture is **not closed** — it is **falsifiable**. CERT **falsifies architectural responsibilities** — not capability documents. See [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md).

| Architectural responsibility | Protects | Status | Responsibility falsification question |
|------------------------------|----------|--------|--------------------------------------|
| **Authoritative** | Ownership | **Validated** | Can anyone else own this truth? |
| **Gateway** | Transfer | **Validated** | Did it stop at transfer/projection? |
| **Cross-cutting** | Consumption | **Predicted** *(proof sequence pending)* | Did it accidentally create truth? |

**Compositional stack** (see [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md)):

```text
Business Truth → Business Area → Architectural Responsibility → Capability → CAP → Implementation
```

| Architectural responsibility | Protects | Status | Failure mode |
|------------------------------|----------|--------|--------------|
| **Authoritative** | Ownership | **Validated** | Ownership leakage |
| **Gateway** | Transfer | **Validated** | Transfer leakage |
| **Cross-cutting** | Consumption | **Predicted** | State leakage (Workflow) · Judgement leakage (Governance) |

**CERT discipline:**

```text
Responsibility → Attempt to falsify responsibility contract → Survives?
```

Implementation drift discovered during falsification **corrects** the system — that is the intended loop.

**Gateway validation:** Identity, Access, and Reporting share one responsibility; Reporting proved a **negative** (projection did not become authoritative). Future gateways (notifications, event distribution, AI context, …) inherit the same falsification strategy.

**Cross-cutting proof sequence** — falsify **distinct failure modes**, not map order:

1. **Workflow** — state leakage: *Can Workflow become the authoritative source of process state?*
2. **Governance** — judgement leakage: *Can findings replace authoritative truth?*

Cross-cutting is **validated** only when **both** survive. Until then: **predicted**.

**Stop refining abstraction.** Remaining architectural work is empirical falsification; then instantiation depth.

### Authoritative vs gateway vs cross-cutting (design heuristic)

When authoring a new `CAP-*`, ask first:

> **What is the architectural responsibility — Authoritative, Gateway, or Cross-cutting?**

| If gateway… | Expect… |
|-------------|---------|
| Shape | Pipeline, publish handover, or projection — not a business lifecycle state machine |
| Responsibility | Ends at **publish**, **projection availability**, or equivalent terminal operation |
| Objects | Fewer enduring business objects; transport metadata, outbox, projections |
| Queries | **SHALL NOT** be the operational source of truth after terminal operation |

| If cross-cutting… | Expect… |
|-------------------|---------|
| Shape | React across capabilities; coordinate or observe — **SHALL NOT** own worker/supplier/engagement truth |
| Responsibility | Ends at **handover** (Workflow) or **finding delivery** without verdict authority (Governance) |
| Risk | **State creep** (Workflow stores process state); **judgement creep** (Governance findings sound authoritative) |

### Gateway terminal operations

| Gateway | Ends at |
|---------|---------|
| Identity Acquisition | **Publish** to EWP |
| Access Integration | **Publish** to IGA |
| Reporting & Projections | **Projection** for consumption |

### CERT falsification strategies (by responsibility)

Inherited from [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) — **not** invented per CAP.

| Responsibility | Primary falsification question | Failure modes |
|----------------|------------------------------|---------------|
| **Authoritative** | Can anyone else own this truth? | Split ownership; derived truth as state |
| **Gateway** | Did it stop at transfer/projection? | Ownership after handover; projection authority creep |
| **Cross-cutting** | Did it accidentally create truth? | State creep (Workflow); judgement creep (Governance) |

**Cross-cutting nuances** (same responsibility, different temptations):

| Capability | Falsification nuance |
|------------|---------------------|
| Workflow Orchestration | Can Workflow become the authoritative source of **process state**? |
| Governance | Can findings (Compliant, Trusted, Healthy, Risk) **replace** authoritative truth? |

Examples executed under Gateway responsibility: Identity (publish boundary); Access (independent gateway); Reporting (negative proof).

### Cross-cutting terminal operations *(hypothesis — falsify via CAP + CERT)*

| Cross-cutting | Ends at |
|---------------|---------|
| Workflow Orchestration | **Handover** — owning capability executes the command |
| Governance | **Finding** — signal delivered; authoritative CAPs retain truth |

## Authoritative capabilities (platform backbone)

Three operational CAPs **v1.0 RATIFIED** **own persistent business facts**:

| Capability | Business question | Truth owned |
|------------|-------------------|-------------|
| **Supplier Administration** | Which organisations may supply External Workers? | Supplier trust / lifecycle |
| **Workforce Administration** | What is the worker's operational workforce relationship? | Workforce state / history |
| **Engagement Administration** | Where and under what commercial context is the worker operating? | Placement / commercial context |

Answers remain true until another **command** in that capability changes them.

---

## Gateway capabilities (handover, not ownership)

Gateway capabilities **establish or move truth** — they **SHALL NOT** be queried for operational state after handover.

| Capability | Status | Business question (direction) | Handover |
|------------|--------|----------------------------------|----------|
| **Identity Acquisition** | CAP v1.0 ✅ | How does an External Worker become **known** to EWP? | Publish → Workforce / Engagement own the worker |
| **Access Integration** | CAP v1.0 **RATIFIED** | How does EWP communicate workforce and engagement decisions to access governance? *(not: what access does the worker have? — that is IGA)* | Publish intent → IGA executes |
| **Reporting & Projections** | CAP v1.0 ✅ | How is authoritative truth **projected** for consumption? *(not: own reporting truth)* | Operational Projections only |

**Identity Acquisition** is the reference gateway CAP: pipeline, acquisition authority + channel, **publication boundary**. After publish, Workforce owns workforce truth; Engagement owns placement truth. Identity Acquisition **SHALL NOT** answer operational workforce questions.

```text
Supplier (authoritative)
      │
      ▼
Identity Acquisition (gateway)  →  acquire · validate · canonicalize · publish
      │
      ▼ publish
══════════════════════════════════════
Handover — authoritative capabilities own truth from here
══════════════════════════════════════
      │
      ├── Workforce Administration
      ├── Engagement Administration
      ├── Access Integration (gateway — when built)
      └── Governance / Workflow (cross-cutting)
```

Onboarding is **distributed**: acquisition **publishes**; workforce **activates**; engagement **assigns**; access **provisions**; governance **monitors**.

**Acquisition Authority** (business) · `AcquisitionModel` (code) — see ADR-013. **Boundary sentence:** [`CAP-IDENTITY-ACQUISITION.md`](./capabilities/CAP-IDENTITY-ACQUISITION.md) §1.

### Legacy type labels (still useful within roles)

| Capability | Architectural role | Also described as |
|------------|---------------------|-------------------|
| Supplier / Workforce / Engagement | **Authoritative** | Administrative · owns enduring relationship |
| Identity Acquisition | **Gateway** | Transitional · pipeline-centric |
| Access Integration | **Gateway** | Transport / publish handover |
| Reporting & Projections | **Gateway** | Projection / read-model delivery |
| Governance · Workflow | **Cross-cutting** | React; do not originate worker truth |

---

## Cross-cutting capabilities

These capabilities **react** across the platform. They **SHALL NOT** own authoritative business truth for suppliers, workforce, or engagement — and they **SHALL NOT** substitute for gateway handover (acquisition publish, IGA intent, projections).

| Capability | Role |
|------------|------|
| **Governance** | Alignment, drift, remediation, evidence signals |
| **Workflow Orchestration** | Approvals, notifications, task routing |

Gateway capabilities (Identity Acquisition, Access Integration, Reporting & Projections) **move or project truth**; cross-cutting capabilities **observe and orchestrate** reactions to it.

---

## Internal vocabulary

| Prefer (EWP doctrine) | Legacy / code |
|----------------------|---------------|
| **External Workforce Platform (EWP)** | Contractor Management System (CMS) |
| **External Worker** | `Contractor` (schema / API identifier) |

**External Worker** specializations (examples):

```text
External Worker
├── Supplier Contractor
├── Independent Contractor
├── Consultant
├── Temporary Worker
├── Advisor
└── Future types…
```

**External Worker aspects** (identity is one facet, not the whole record):

```text
External Worker
        │
        ├── Workforce
        ├── Engagement
        ├── Identity
        ├── Governance
        ├── Access
        └── Supplier Relationship
```

**Planes** (in code and ADRs) are bounded contexts that implement capabilities.

---

## Engineering sequence

```text
Domain Recovery
        ↓
Capability Recovery
        ↓
Capability Maturation
        ↓
Product Projection
```

---

## Roadmap dependency

```text
Capability (this map)
        ↓
Capability maturity
        ↓
PR (implementation evidence)
        ↓
Product projection
        ↓
Customer traceability (e.g. MTN RDS)
```

Future: **`CAP-*` contract** → Implementation → PR evidence → **`CERT-*`** — see [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](./EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md).

**Example:**

```text
Capability: Workforce Administration
        ↓
Evidence: PR-WORKFORCE-REVIEW-OUTCOMES-1
        ↓
Product projection: Operations Console
        ↓
Customer back-reference: FE004, FE009, FE010, FE014
```

---

## Engineering table of contents

Each capability links its artifact types.

| Artifact | Role |
|----------|------|
| **Specification (`CAP-*`)** | Authoritative contract — what must remain true |
| **ADRs** | Architectural decisions supporting the contract |
| **Implementation evidence (PRs)** | Proof of maturation — not the definition |
| **Certification** | [`CERT-WORKFORCE-ADMINISTRATION`](./capabilities/CERT-WORKFORCE-ADMINISTRATION.md) · [`CERT-IDENTITY-ACQUISITION`](./capabilities/CERT-IDENTITY-ACQUISITION.md) — **v1.0 PASS** (May 2026) |
| **Customer mapping** | External traceability (e.g. MTN RDS) |

First ratified specs: [`CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md), [`CAP-SUPPLIER-ADMINISTRATION.md`](./capabilities/CAP-SUPPLIER-ADMINISTRATION.md), [`CAP-ENGAGEMENT-ADMINISTRATION.md`](./capabilities/CAP-ENGAGEMENT-ADMINISTRATION.md) — see [`capabilities/README.md`](./capabilities/README.md).

### Workforce Administration — **High**

| Artifact | Links |
|----------|-------|
| **Specification** | [`capabilities/CAP-WORKFORCE-ADMINISTRATION.md`](./capabilities/CAP-WORKFORCE-ADMINISTRATION.md) **v1.0 RATIFIED** |
| **CERT** | [`capabilities/CERT-WORKFORCE-ADMINISTRATION.md`](./capabilities/CERT-WORKFORCE-ADMINISTRATION.md) **v1.0 PASS** |
| **UI** | `/contractors` · `/contractors/workforce-review` · Overview health |
| **ADRs** | [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md) |
| **Implementation evidence** | [`PR-WORKFORCE-STATE-MODEL-1`](./PR-WORKFORCE-STATE-MODEL-1.md), [`PR-WORKFORCE-TRANSITIONS-1`](./PR-WORKFORCE-TRANSITIONS-1.md), [`PR-WORKFORCE-NOMINATE-1`](./PR-WORKFORCE-NOMINATE-1.md), [`PR-WORKFORCE-OPS-REVIEW-1`](./PR-WORKFORCE-OPS-REVIEW-1.md), [`PR-WORKFORCE-TIMELINE-FOUNDATION-1`](./PR-WORKFORCE-TIMELINE-FOUNDATION-1.md), [`PR-WORKFORCE-REVIEW-OUTCOMES-1`](./PR-WORKFORCE-REVIEW-OUTCOMES-1.md), [`PR-WORKFORCE-BLACKLIST-1`](./PR-WORKFORCE-BLACKLIST-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1`](./PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1`](./PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md) |
| **UAT / certification** | [`PR-WORKFORCE-E2E-UAT-1`](./PR-WORKFORCE-E2E-UAT-1.md) |
| **Customer mapping (MTN)** | [`PR-WORKFORCE-RDS-MAPPING-1.md`](./PR-WORKFORCE-RDS-MAPPING-1.md) — FE004, FE009–FE014 |
| **Next increment** | Enforcement hooks at intake / promote / reopen |

### Supplier Administration — **High**

| Artifact | Links |
|----------|-------|
| **Specification** | [`capabilities/CAP-SUPPLIER-ADMINISTRATION.md`](./capabilities/CAP-SUPPLIER-ADMINISTRATION.md) **v1.0 RATIFIED** |
| **CERT** | [`capabilities/CERT-SUPPLIER-ADMINISTRATION.md`](./capabilities/CERT-SUPPLIER-ADMINISTRATION.md) *(template)* |
| **UI** | `/suppliers` · `/suppliers/approvals` · `/supplier-sources/oracle/operations` · Overview health |
| **ADRs** | [`ADR-002`](./ADR-002-Supplier-Renewal-Governance.md) |
| **Constitution** | [`EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md`](./EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md) |
| **Implementation evidence** | [`PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md`](./PR-CMS-OPERATIONS-1_SUPPLIER_LIFECYCLE.md), [`PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md`](./PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md), [`PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md`](./PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md), [`PR-CMS-OPERATIONS-1D2_PORTAL_PDP.md`](./PR-CMS-OPERATIONS-1D2_PORTAL_PDP.md), [`PR-CMS-CONNECTOR-1A-C_ORACLE_PROCUREMENT_REST.md`](./PR-CMS-CONNECTOR-1A-C_ORACLE_PROCUREMENT_REST.md), [`PR-SUPPLIER-PORTAL-INVOICES-1.md`](./PR-SUPPLIER-PORTAL-INVOICES-1.md) |
| **Customer mapping (MTN)** | FE001 (portal shell) |
| **Next increment** | Independent supplier path |

### Engagement Administration — **Medium**

| Artifact | Links |
|----------|-------|
| **Specification** | [`capabilities/CAP-ENGAGEMENT-ADMINISTRATION.md`](./capabilities/CAP-ENGAGEMENT-ADMINISTRATION.md) **v1.0 RATIFIED** |
| **CERT** | [`capabilities/CERT-ENGAGEMENT-ADMINISTRATION.md`](./capabilities/CERT-ENGAGEMENT-ADMINISTRATION.md) *(template)* |
| **UI** | `/contracts` · `/engagements` · `/timesheets` · `/invoices` · `/projects` · `/sponsor-tasks` · Overview health |
| **Doctrine** | [`EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md`](./EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md) §7–§9, §25 |
| **ADRs** | [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) *(draft)* |
| **Implementation evidence** | [`PR-WORKFORCE-NOMINATE-1`](./PR-WORKFORCE-NOMINATE-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1`](./PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md), [`PR-CTR-2_STAGING_SCHEMA.md`](./PR-CTR-2_STAGING_SCHEMA.md), [`SPONSOR_ACCOUNTABILITY_MODEL.md`](./SPONSOR_ACCOUNTABILITY_MODEL.md), engagements / timesheets / invoices domains |
| **Customer mapping (MTN)** | FE008, FE015–FE016 |
| **Next increment** | Extension / Transfer / Movement |

### Identity Acquisition — **High**

| Artifact | Links |
|----------|-------|
| **Specification** | [`capabilities/CAP-IDENTITY-ACQUISITION.md`](./capabilities/CAP-IDENTITY-ACQUISITION.md) **v1.0 RATIFIED** |
| **CERT** | [`capabilities/CERT-IDENTITY-ACQUISITION.md`](./capabilities/CERT-IDENTITY-ACQUISITION.md) **v1.0 PASS** |
| **UI** | `/contractor-sources/oracle-hcm/operations` *(Identity Acquisition)* |
| **ADRs / security** | [`ADR-013`](./ADR-013-External-Worker-Acquisition-Model.md), [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) |
| **Constitution** | [`PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md`](./PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md), [`EXTERNAL_WORKFORCE_CANONICAL_DATA_MODEL_V1.md`](./EXTERNAL_WORKFORCE_CANONICAL_DATA_MODEL_V1.md) |
| **Implementation evidence** | [`PR-IDENTITY-ACQUISITION-MODEL-1`](./PR-IDENTITY-ACQUISITION-MODEL-1.md), [`PR-CTR-CONNECTOR-1A-1C_ORACLE_HCM_CONNECTOR.md`](./PR-CTR-CONNECTOR-1A-1C_ORACLE_HCM_CONNECTOR.md), [`PR-CTR-2_STAGING_SCHEMA.md`](./PR-CTR-2_STAGING_SCHEMA.md), [`PR-CTR-3_HCM_EXTRACT_ADAPTER.md`](./PR-CTR-3_HCM_EXTRACT_ADAPTER.md), [`PR-WORKFORCE-HCM-HISTORY-1`](./PR-WORKFORCE-HCM-HISTORY-1.md), [`PR-WORKFORCE-NOMINATE-1`](./PR-WORKFORCE-NOMINATE-1.md) *(portal channel — workforce/engagement handoff §10.3)* |
| **Doctrine** | [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) |
| **Customer mapping (MTN)** | FE004, FE012 |
| **Next increment** | PDP independent-path rules (ADR-013 Step 7); ops UI for acquire-independent |

### Access Integration — **Medium** *(gateway)*

| Artifact | Links |
|----------|-------|
| **Specification** | [`capabilities/CAP-ACCESS-INTEGRATION.md`](./capabilities/CAP-ACCESS-INTEGRATION.md) **v1.0 RATIFIED** |
| **CERT** | [`capabilities/CERT-ACCESS-INTEGRATION.md`](./capabilities/CERT-ACCESS-INTEGRATION.md) **v1.0 PASS** |
| **ADRs / security** | [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) |
| **Implementation evidence** | [`PR-ACCESS-INTEGRATION-PUBLISH-1`](./PR-ACCESS-INTEGRATION-PUBLISH-1.md) · `AccessIntegrationPublishService` |
| **Customer mapping (MTN)** | FE003 |
| **Next increment** | Workforce event reactions; SNOW / Aveksa adapters |

### Governance — **High**

| Artifact | Links |
|----------|-------|
| **Specification** | *Planned:* `capabilities/CAP-GOVERNANCE.md` |
| **ADRs** | [`ADR-003`](./ADR-003-Contractor-Lifecycle-Governance.md) |
| **Implementation evidence** | [`PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md`](./PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md), [`PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md`](./PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md), [`PR-CMS-CONNECTOR-4_DRIFT_RECONCILIATION.md`](./PR-CMS-CONNECTOR-4_DRIFT_RECONCILIATION.md), [`PR-GOV-SIGNAL-LIFECYCLE-1.md`](./PR-GOV-SIGNAL-LIFECYCLE-1.md) |
| **Operations** | [`SUPPLIER_GOVERNANCE_OPERATIONS.md`](../SUPPLIER_GOVERNANCE_OPERATIONS.md), [`GOVERNANCE_SIGNAL_LIFECYCLE.md`](../GOVERNANCE_SIGNAL_LIFECYCLE.md) |
| **Customer mapping (MTN)** | Indirect |
| **Next increment** | Cross-plane policy enforcement |

### Workflow Orchestration — **Low**

| Artifact | Links |
|----------|-------|
| **Specification** | *Planned:* `capabilities/CAP-WORKFLOW-ORCHESTRATION.md` |
| **Implementation evidence** | Ops review advance (not MTN approval engine) |
| **Customer mapping (MTN)** | FE002, FE005 |
| **Next increment** | Notification engine; approval orchestration (when scoped) |

### Reporting & Projections — **Medium**

| Artifact | Links |
|----------|-------|
| **Specification** | [`capabilities/CAP-REPORTING-PROJECTIONS.md`](./capabilities/CAP-REPORTING-PROJECTIONS.md) **v1.0 RATIFIED** |
| **Implementation evidence** | Audit insights, governance tiles, workforce timeline projections |
| **Customer mapping (MTN)** | FE006 (partial) |
| **Next increment** | Implementation improvement: projection module + freshness *(deferred — architecture survived)* |

---

## Capability table (one page)

| Capability | Business question | Owns | Maturity | Proven by | Next increment | RDS refs (MTN) |
|------------|-------------------|------|:--------:|-----------|----------------|----------------|
| **Supplier Administration** | Which organisations may supply workers? | Suppliers, memberships, contracts, portal ring-fence | **High** | [`CAP-SUPPLIER-ADMINISTRATION`](./capabilities/CAP-SUPPLIER-ADMINISTRATION.md) v1.0, Supplier Portal, lifecycle, Oracle sync | Independent supplier path | FE001 |
| **Workforce Administration** | What is this external worker's current workforce status? | Workforce state, transitions, history, policy blocks | **High** | Workforce E2E UAT, review outcomes, blacklist | Enforcement hooks (intake, promote, reopen) | FE004, FE009–FE014 |
| **Engagement Administration** | Where is this worker assigned commercially? | Placements, dates, sponsor, contracts, timesheets, invoices, projects | **Medium** | [`CAP-ENGAGEMENT-ADMINISTRATION`](./capabilities/CAP-ENGAGEMENT-ADMINISTRATION.md) v1.0, engagement model, sponsor inbox | Extension / Transfer / Movement | FE008, FE015–FE016 |
| **Identity Acquisition** | How does an External Worker become known to EWP? | Acquisition authority, channels, pipeline *(not lifecycle)* | **High** | CAP v1.0, ADR-013, PR-IDENTITY-ACQUISITION-MODEL-1/2 | PDP independent-path (Step 7) | FE004, FE012 |
| **Access Integration** | What enterprise access actions should occur? | IGA outbox, access context, lifecycle reaction hooks | **Medium** | Auth access substrate, domain event stubs | SNOW / Aveksa adapters | FE003 |
| **Governance** | Is external worker truth aligned across systems? | Drift, remediation, evidence, signals | **High** | Governance tiles, drift engine, remediation | Cross-plane policy enforcement | Indirect |
| **Workflow Orchestration** | Who needs to decide next? | Approvals, notifications, task routing | **Low** | Ops review advance (not MTN approval engine) | Notification engine; approval orchestration (when scoped) | FE002, FE005 |
| **Reporting & Projections** | How is authoritative truth projected for consumers? | Operational Projections, metrics, exports *(not business truth)* | **Medium** | CAP v1.0 RATIFIED, CERT v1.0 PASS (Gateway falsification survived) | Projection module + freshness *(impl)* | FE006 (partial) |

---

## Product projections

Capabilities compose into **product experiences**. A product is one way of using capabilities — not the capability itself.

```text
External Workforce Platform
        │
        ├──────────────┬───────────────┬───────────────┐
        ▼              ▼               ▼
Supplier Portal   Operations Console   Identity Services
```

| Projection | Capabilities used |
|------------|-------------------|
| **Supplier Portal** | Supplier Administration, Workforce Administration (nominate, timeline), Engagement Administration |
| **Operations Console** | Workforce Administration, Governance, Engagement Administration, Reporting & Projections |
| **Identity Services** | Identity Acquisition, Access Integration |

**Future projections** (same capability map): Mobile Supplier Portal, Executive Dashboard, Vendor API, Analytics Portal.

---

## Plane ↔ capability alignment

| Technical plane (ADR / code) | Business capability |
|------------------------------|---------------------|
| Supplier trust / portal | Supplier Administration |
| Workforce administration | Workforce Administration |
| Engagement / placement | Engagement Administration |
| Identity acquisition | Identity Acquisition |
| Access / IGA | Access Integration |
| Governance / drift | Governance |
| Workflow (TBD) | Workflow Orchestration |
| Audit / reporting | Reporting & Projections |

---

## Proof sequence

Architecture is **falsifiable**, not **finished**. Next work attempts to falsify the remaining hypothesis (**Cross-cutting**).

```text
Next falsification targets (Cross-cutting — predicted)

1. CAP Workflow → state leakage CERT
2. CAP Governance → judgement leakage CERT
```

Both required before Cross-cutting is **validated**. Authoritative and Gateway already **validated**.

**Deferred (implementation improvement — Gateway architecture already survived):** unified Reporting projection module + freshness contract. Distributed projections passed falsification; consolidation does not change architectural proof.

**Operational depth** (parallel, capability-scoped):

```text
Workforce Administration   Enforcement hooks at intake / promote / reopen
Engagement Administration  Extension, transfer, movement
Access Integration         Enterprise adapters (SNOW / Aveksa)
Identity Acquisition       PDP independent-path rules (ADR-013 Step 7)
Supplier Administration    Independent supplier path
```

MTN workshop items cite [`PR-WORKFORCE-RDS-MAPPING-1.md`](./PR-WORKFORCE-RDS-MAPPING-1.md) — they do not reorder the proof sequence above.

---

## Next architectural decision — Acquisition Model ADR ✅

**Ratified:** [`ADR-013-External-Worker-Acquisition-Model.md`](./ADR-013-External-Worker-Acquisition-Model.md) — May 2026

The four operational CAPs are **complete for v1**. This ADR refines Identity Acquisition — it is **not** a missing platform pillar.

**Question (answered):**

> Can every External Worker be acquired through the same **authority model**?

**No.** Acquisition **authority** (who may establish the worker) is persisted as `AcquisitionModel`. Intake **channels** (HCM, portal, Workday, …) are a separate dimension — they **SHALL NOT** become enum values.

| Acquisition authority | Who brings the worker into EWP |
|-----------------------|--------------------------------|
| `SUPPLIER` | Supplier organisation nominates the External Worker |
| `INDEPENDENT` | Enterprise acquires the External Worker directly |

Future **authorities** (`PARTNER`, `INTERNAL_TRANSFER`, …) may extend the enum. Future **channels** (Workday, Fieldglass, …) **SHALL NOT**.

**Evolution:** The business concept is **Acquisition Authority**. The field name `AcquisitionModel` **MAY** be renamed in a future capability version without changing this contract — see ADR-013 *Business concept vs implementation*.

**Next work:** nullable `supplierId` + independent acquire command (ADR-013 Steps 3–6). Cite ADR-013 + CAP-IDENTITY-ACQUISITION §7.

Implemented: [`PR-IDENTITY-ACQUISITION-MODEL-1`](./PR-IDENTITY-ACQUISITION-MODEL-1.md) — `AcquisitionModel` enum, backfill, intake wiring.

---

## After MTN

EWP is the **first validated reference implementation** of HEM — not the definition of HEM. When Hubsec-level `HEM-1.0.md` is ratified, this platform **SHALL** declare conformance to it. The **second product** built with the same sequence validates HEM as a repeatable discipline.

---

## References (frozen — index only)

Do not add new top-level governance docs. Extend **this map** and **`capabilities/`** instead.

| Doc | Role |
|-----|------|
| [`EWP_ARCHITECTURE.md`](./EWP_ARCHITECTURE.md) | **Business** architecture overview |
| [`EWP_TECHNICAL_ARCHITECTURE.md`](./EWP_TECHNICAL_ARCHITECTURE.md) | **Technical** architecture (stack, modules, integrations) |
| [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md) | **Frozen** responsibility model — CERT strategies |
| [`EWP-V1-ARCHITECTURE-FREEZE.md`](./EWP-V1-ARCHITECTURE-FREEZE.md) | v1 closure + freezes |
| [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md) | Frozen labels |
| [`capabilities/README.md`](./capabilities/README.md) | CAP directory — operational rules |
| [`CONNECTOR_GOVERNANCE_INDEX.md`](./CONNECTOR_GOVERNANCE_INDEX.md) | PR index by connector area |
| [`DOMAIN_MODEL_RECOVERY_V1.md`](./DOMAIN_MODEL_RECOVERY_V1.md) | Historical archaeology *(read-only)* |
