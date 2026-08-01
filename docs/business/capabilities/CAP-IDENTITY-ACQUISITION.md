# CAP-IDENTITY-ACQUISITION

**Capability:** Identity Acquisition  
**Platform:** External Workforce Platform (EWP)  
**Version:** 1.0  
**Status:** RATIFIED — authoritative contract (May 2026)  
**Normative:** This document uses **SHALL** / **SHALL NOT** as defined in RFC 2119.

> **Fourth operational CAP — entry gate, not owner.** Unlike Supplier, Workforce, and Engagement Administration, Identity Acquisition **SHALL NOT** own an enduring business relationship. It owns **acquisition** only. See [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) for template discipline; §5 uses a **pipeline**, not a lifecycle state machine.

**Implementation identifiers (non-normative):** `ContractorMigration*`, `HcmContractorStaging`, `contractor-migration` domain; UI route `/contractor-sources/oracle-hcm/operations` *(Identity Acquisition)*.

---

## Dependencies

| ADR / constitution | Role |
|--------------------|------|
| [`ADR-012`](../ADR-012-External-Workforce-Platform-Naming.md) | External Workforce Platform identity; multi-source intake vocabulary |
| [`ADR-013`](../ADR-013-External-Worker-Acquisition-Model.md) | Acquisition **authority** (`AcquisitionModel` in code) — distinct from channel and pipeline |
| [`ADR-EXTID-001`](../../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) *(draft)* | Canonical identity vs IGA vs sponsorship boundary |
| [`PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md`](../PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md) | HCM bootstrap authority; CMS operational cutover |
| [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) | Bootstrap lineage vs operational governance authority |

**Reading chain:**

| Question | Document |
|----------|----------|
| Why does it exist? | ADR-012, ADR-013, ADR-EXTID-001, PR-CTR-1 |
| What must it do? | **This CAP (v1.0)** |
| How was it built? | §11 Maturity — PR evidence |
| Does it conform? | [`CERT-IDENTITY-ACQUISITION.md`](./CERT-IDENTITY-ACQUISITION.md) *(when certified)* |

---

## 1. Purpose

> **Identity Acquisition is responsible for establishing the canonical External Worker within the External Workforce Platform. Its responsibility ends when the External Worker has been successfully acquired and published to downstream capabilities.**

Identity Acquisition **SHALL** make an External Worker **known** to EWP through declared acquisition channels — validating intake, correlating upstream identity, detecting duplicates, creating the canonical record once, and publishing acquisition facts to downstream capabilities.

It **SHALL NOT** own workforce lifecycle, supplier trust, engagement placement, access provisioning, governance remediation, or ongoing operational authority over the worker relationship.

---

## 2. Business question

> **How does an External Worker become known to the External Workforce Platform?**

Every element of this capability **SHALL** exist only to answer that question.

Identity Acquisition **SHALL NOT** be confused with:

| Question | Owned by |
|----------|----------|
| Who is this person? (identity exploration / directory) | Enterprise identity services *(outside EWP)* |
| Can they log in? | Access Integration / IGA |
| Are they active in the workforce relationship? | Workforce Administration |
| Where are they assigned commercially? | Engagement Administration |
| Is platform truth aligned across systems? | Governance |

---

## 3. Capability boundaries

### 3.1 Platform chronology and publication boundary (non-normative)

```text
Supplier exists (Supplier Administration)
        │
        ▼
Identity Acquisition  ← authority + channel + pipeline
        │
        ▼ publish
══════════════════════════════════════════════════════════════
Publication boundary — acquisition complete; worker is canonical
══════════════════════════════════════════════════════════════
        │
        ▼
Workforce Administration
        │
        ▼
Engagement Administration
        │
        ▼
Access Integration
```

Identity Acquisition is the **front door**, not the house. Architecturally it is **stateless in relationship terms**: it performs work, publishes, and stops. It owns a **transition**, not an enduring business relationship.

### 3.2 Three dimensions (do not collapse)

| Dimension | Question | v1 persistence |
|-----------|----------|----------------|
| **Acquisition Authority** | Who may establish this worker? | `Contractor.acquisitionModel` — business concept per ADR-013 |
| **Acquisition Channel** | How did they enter? | Intake metadata (portal, HCM, enterprise acquire, …) — **not** `AcquisitionModel` |
| **Processing Pipeline** | What stages completed? | §5 — **not** workforce lifecycle |

Future channels (Workday, Fieldglass, CSV, API) **SHALL** map to existing authorities — not new enum values.

### 3.3 Owns

Identity Acquisition **SHALL** own:

| Concern | Description |
|---------|-------------|
| **Acquisition channels** | Declared paths by which upstream workers enter EWP (HCM, CSV, Supplier Portal nominate, future API / Workday / SAP) |
| **Intake validation** | Schema, authority, and channel-specific quality gates before correlation |
| **Correlation** | Matching upstream identity to existing or new canonical records |
| **Duplicate detection** | Pre-canonical conflict detection and quarantine |
| **Canonical identity creation** | Exactly-once materialization of the External Worker record |
| **Bootstrap / migration waves** | Controlled batch intake (not continuous upstream lifecycle sync) |
| **Promotion** | Transition from staged intake to canonical published worker |
| **Acquisition authority** | Which party is authoritative for establishing the worker (`SUPPLIER` \| `INDEPENDENT` — see ADR-013) |
| **Channel-to-authority mapping** | Which intake channels are valid for which acquisition authority |
| **Acquisition pipeline state** | Processing stages for intake rows and batches *(not workforce lifecycle)* |
| **Acquisition audit facts** | Extract, validate, correlate, promote, publish events |

### 3.4 Does not own

Identity Acquisition **SHALL NOT** own:

| Concern | Owned by |
|---------|----------|
| Workforce state, transitions, history *(incl. sponsor-before-ACTIVE gates)* | Workforce Administration |
| Supplier lifecycle, evidence, portal trust | Supplier Administration |
| Engagement dates, sponsor accountability, commercial placement | Engagement Administration |
| Access provisioning, revocation, IGA publication execution | Access Integration |
| Drift detection, remediation workflow | Governance |
| Approval chains, notifications, task routing | Workflow Orchestration |
| Ongoing upstream employment authority post-cutover | External enterprise HR *(EWP consumes at acquisition only)* |

Identity Acquisition **SHALL NOT** assign workforce state, approve nominations, activate workers, or provision access — even when a single HTTP request spans acquisition and downstream handoff *(see §10.3)*.

### 3.5 Capability type (not sibling parity)

Identity Acquisition is a **transitional (gateway)** capability — not an administrative capability of the same kind as Supplier, Workforce, or Engagement Administration.

| Capability | Type | Owns enduring business relationship? |
|------------|------|--------------------------------------|
| Supplier Administration | Administrative | Yes |
| Workforce Administration | Administrative | Yes |
| Engagement Administration | Administrative | Yes |
| **Identity Acquisition** | **Transitional** | **No** |

Classification in the Capability Map: **Foundational** (establishes the worker for downstream capabilities) but **not** an enduring relationship owner. See [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](../EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — Foundational vs Cross-cutting.

---

## 4. Authoritative objects

| Object | Definition |
|--------|------------|
| **Acquisition Channel** | A declared source path with explicit authority (e.g. Oracle HCM, CSV, Supplier Portal, API) |
| **Acquisition Batch** | A bounded unit of intake processing (migration wave, file batch, connector run) |
| **Staged Identity** | An upstream worker representation before canonical promotion |
| **Correlation Result** | Outcome of matching staged identity to existing or proposed canonical record |
| **Canonical External Worker** | The authoritative EWP worker record after successful acquisition |
| **Acquisition Pipeline Stage** | Current processing stage for a staged row or batch *(not Workforce State)* |
| **Acquisition Authority** | Rules declaring which channel may seed or override which attributes |
| **Promotion Record** | Audit of staged → canonical transition |

Implementation **MAY** map these to `HcmContractorStaging`, `ContractorMigrationBatch`, `Contractor`, identity map tables, and related persistence.

---

## 5. Authoritative acquisition pipeline

Identity Acquisition **SHALL** model intake as a **processing pipeline**, not a business lifecycle state machine.

Pipeline stages describe **how far acquisition has progressed** — not whether the worker is active, nominated, or assigned.

### 5.1 Conceptual pipeline (Capability Version 1)

| Stage | Meaning |
|-------|---------|
| **Discovered** | Upstream worker observed at a channel |
| **Validated** | Intake passed channel validation rules |
| **Correlated** | Identity matched or conflict resolved |
| **Canonical** | Canonical External Worker record created |
| **Published** | Downstream capabilities notified; acquisition complete |

### 5.2 Implementation mapping (non-normative)

Current HCM bootstrap path **MAY** express stages including:

```text
EXTRACTED → NORMALIZED → VALIDATED → (QUARANTINED) → APPROVED → CTR_ISSUED → PROMOTED → IGA_PUBLISHED
```

Staging row validation **MAY** use `PENDING | PASSED | FAILED | QUARANTINED | PROMOTED`.

These enums **SHALL NOT** be interpreted as Workforce State or Engagement State.

### 5.3 Pipeline vs lifecycle (mandatory distinction)

| Model | Identity Acquisition | Workforce / Supplier / Engagement |
|-------|---------------------|-----------------------------------|
| Nature | Processing pipeline | Business lifecycle state machine |
| Question answered | Has intake completed? | What is the operational relationship? |
| Terminal success | Published to downstream | Active / terminated / offboarded etc. |
| Re-entry | Retry acquisition, new batch | Rehire, reopen nomination, etc. |

---

## 6. Commands

Acquisition operations. **SHALL NOT** reference UI controls, HTTP methods, or product names.

| Command | Effect (normative) |
|---------|-------------------|
| **Acquire Worker** | Accept upstream worker into a channel batch at Discovered / Extracted |
| **Validate Identity** | Run intake validation; advance to Validated or quarantine |
| **Correlate Identity** | Match staged identity; advance to Correlated or flag conflict |
| **Promote Identity** | Materialize Canonical External Worker from approved staged row |
| **Retry Acquisition** | Re-process failed or quarantined intake within channel rules |
| **Materialize Worker** | Complete canonical creation and initial publish handoff *(delegates workforce bootstrap per §10.3)* |

These are **acquisition operations**, not workforce or engagement business commands.

Identity Acquisition **SHALL NOT** expose commands named **Activate Worker**, **Approve Supplier**, or **Assign Sponsor** — those belong to other capabilities even when invoked in the same user journey.

---

## 7. Policies

Capability policies — the heart of Identity Acquisition. Distinct from §12 invariants.

| ID | Policy |
|----|--------|
| **P-01** | Every External Worker **SHALL** enter the platform through exactly one acquisition channel per acquisition episode. |
| **P-02** | An acquisition channel **SHALL** declare compatible **acquisition authority** (`SUPPLIER`, `INDEPENDENT`, …) — channels (HCM, portal, CSV) **SHALL NOT** be encoded as authority values. |
| **P-03** | Acquisition **SHALL** precede Workforce Administration — no authoritative workforce relationship **SHALL** exist before acquisition succeeds for that intake path. |
| **P-04** | Acquisition **SHALL NOT** assign workforce state — that is Workforce Administration. |
| **P-05** | Acquisition **SHALL NOT** provision access — that is Access Integration. |
| **P-06** | Duplicate detection **SHALL** occur before canonical creation. |
| **P-07** | Canonical identity **SHALL** be created exactly once per successful acquisition outcome. |

---

## 8. Events

Business facts Identity Acquisition **SHALL** emit after successful acquisition operations. Event names **SHALL** reflect acquisition — not workforce activation.

| Event | Typical pipeline outcome |
|-------|--------------------------|
| **Worker Acquired** | Upstream worker accepted into channel intake |
| **Identity Validated** | Intake passed validation |
| **Identity Correlated** | Staged identity matched or conflict recorded |
| **Canonical Identity Created** | External Worker record materialized |
| **Bootstrap Completed** | Batch or wave promotion finished |
| **Acquisition Published** | Downstream handoff signalled *(incl. IGA publish intent)* |
| **Acquisition Failed** | Intake quarantined or batch failed |

Events **SHALL** be facts, not commands. Workforce Administration **SHALL** emit **Worker Activated** — not Identity Acquisition.

---

## 9. Read models

Projections of acquisition data. Products **MAY** surface these; the capability **SHALL NOT** define UI.

| Read model | Audience | Content |
|------------|----------|---------|
| **Migration Operations Console** | Connector / bootstrap operators | Batch status, staging queues, promote actions |
| **Staging Review Queue** | Enterprise operators | Rows in `QUARANTINED` or correlation conflict |
| **Acquisition Batch Summary** | Enterprise operators | Wave progress, extract counts, failure reasons |
| **Bootstrap Lineage View** | Enterprise operators | Upstream source reference tied to canonical worker |
| **Capability Health — Identity Acquisition** | Overview dashboard | Open batches, quarantine counts, promote backlog |

Read models **SHALL** respect connector and bootstrap permissions — acquisition operators **SHALL NOT** imply supplier or workforce approval authority.

---

## 10. Integrations

Responsibilities only — no adapter implementation.

### 10.1 Consumes

| Source | Consumption |
|--------|-------------|
| **Supplier Administration** | Supplier scope for supplier-backed channels; supplier master for correlation |
| **Supplier Portal** | Nominate intake as acquisition channel *(workforce/engagement commands delegated)* |
| **Oracle HCM** | Bootstrap extract and controlled migration waves |
| **CSV / file intake** | Batch file acquisition |
| **Future API / Workday / SAP** | Additional channels under same pipeline discipline |

### 10.2 Produces

| Capability | Production |
|--------------|------------|
| **Workforce Administration** | Canonical worker exists; **Bootstrap Workforce Relationship** authority for initial history |
| **Engagement Administration** | Placement substrate when channel bundles engagement intent *(owned by Engagement Administration)* |
| **Access Integration** | IGA publish intent after acquisition completes |
| **Governance** | Bootstrap lineage signals; correlation conflict facts |

### 10.3 Handoff boundary (Supplier Portal nominate)

Supplier-backed nomination **SHALL** be modeled as an **acquisition channel**, not as workforce administration inside Identity Acquisition.

When a single request creates worker + engagement rows:

| Step | Owning capability |
|------|-------------------|
| Channel authority + supplier scope validation | Identity Acquisition *(channel gate)* |
| Canonical External Worker creation | Identity Acquisition |
| Initial Workforce State (`NOMINATED`, etc.) | Workforce Administration *(via delegated bootstrap / nominate command)* |
| Engagement placement record | Engagement Administration |

Setting `acquisitionModel` **SHALL** end at publish. Initial workforce state (`NOMINATED`, etc.) **MAY** be recorded via delegation to Workforce Administration — that is workforce intake, not extended acquisition ownership. Sponsor-before-`ACTIVE` rules **SHALL** be enforced under Workforce CAP §7 P-12.

HCM promote path **SHALL** delegate initial workforce history to **Bootstrap Workforce Relationship** under Workforce Administration CAP §6 — not re-label promote as activation.

---

## 11. Maturity and evidence

Implementation conformance **SHALL** be demonstrated by evidence — not by this specification changing when code ships.

| Capability element | Status | Evidence |
|--------------------|--------|----------|
| HCM migration constitution | Implemented | [`PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md`](../PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md) |
| Staging schema | Implemented | [`PR-CTR-2_STAGING_SCHEMA.md`](../PR-CTR-2_STAGING_SCHEMA.md), [`PR-CTR-2_PROMOTION_RULES.md`](../PR-CTR-2_PROMOTION_RULES.md) |
| HCM extract adapter | Implemented | [`PR-CTR-3_HCM_EXTRACT_ADAPTER.md`](../PR-CTR-3_HCM_EXTRACT_ADAPTER.md) |
| Oracle REST provider | Implemented | [`PR-CTR-4_ORACLE_REST_PROVIDER.md`](../PR-CTR-4_ORACLE_REST_PROVIDER.md) |
| HCM connector | Implemented | [`PR-CTR-CONNECTOR-1A-1C_ORACLE_HCM_CONNECTOR.md`](../PR-CTR-CONNECTOR-1A-1C_ORACLE_HCM_CONNECTOR.md) |
| Connector health / operations | Implemented | [`PR-CTR-CONNECTOR-1D_ORACLE_HCM_CONNECTOR_HEALTH.md`](../PR-CTR-CONNECTOR-1D_ORACLE_HCM_CONNECTOR_HEALTH.md), [`PR-CTR-CONNECTOR-1E_ORACLE_HCM_OPERATIONS.md`](../PR-CTR-CONNECTOR-1E_ORACLE_HCM_OPERATIONS.md) |
| Drift engine (bootstrap lineage) | Implemented | [`PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md`](../PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md) |
| Bootstrap authority doctrine | Implemented | [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) |
| Bootstrap workforce history | Implemented | [`PR-WORKFORCE-HCM-HISTORY-1`](../PR-WORKFORCE-HCM-HISTORY-1.md) |
| Supplier nominate channel | Implemented | [`PR-WORKFORCE-NOMINATE-1`](../PR-WORKFORCE-NOMINATE-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1`](../PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md) *(workforce/engagement ownership — channel handoff §10.3)* |
| Backend domain | Implemented | `backend/src/domain/contractor-migration/` |
| Acquisition model schema + intake | Implemented | [`PR-IDENTITY-ACQUISITION-MODEL-1`](../PR-IDENTITY-ACQUISITION-MODEL-1.md), [`PR-IDENTITY-ACQUISITION-MODEL-2`](../PR-IDENTITY-ACQUISITION-MODEL-2.md), [`ADR-013`](../ADR-013-External-Worker-Acquisition-Model.md) |
| Independent acquire command | Implemented | `POST /contractors/acquire-independent` |
| PDP independent-path rules | Planned | ADR-013 Step 7 |
| Cross-channel duplicate enforcement at nominate | Planned | Workforce CAP §7 P-11 coordination |
| Formal CERT | **PASS v1.0** | [`CERT-IDENTITY-ACQUISITION.md`](./CERT-IDENTITY-ACQUISITION.md) (May 2026) |

**Certification:** [`CERT-IDENTITY-ACQUISITION.md`](./CERT-IDENTITY-ACQUISITION.md) **v1.0 PASS** (May 2026) — PARTIAL rows match Planned scope above.

**Customer mapping (non-normative):** MTN RDS FE004, FE012 — [`PR-WORKFORCE-RDS-MAPPING-1`](../PR-WORKFORCE-RDS-MAPPING-1.md)

**Naming note (non-normative):** Business users may say *Worker Intake* or *External Worker Intake*; the capability name **Identity Acquisition** **SHALL** remain normative because responsibility ends at canonical identity — not onboarding, activation, or engagement.

---

## 12. Capability invariants

Laws that **SHALL** hold for any conforming implementation of Capability Version 1.

1. Identity Acquisition **SHALL NOT** own an enduring business relationship with the External Worker.
2. Every successful acquisition **SHALL** declare exactly one acquisition channel authority for that episode.
3. Canonical External Worker creation **SHALL** occur at most once per successful acquisition outcome.
4. Duplicate detection **SHALL** precede canonical creation.
5. Acquisition pipeline stages **SHALL NOT** be conflated with Workforce State, Supplier Status, or Engagement State.
6. Identity Acquisition **SHALL NOT** assign workforce state except via explicit delegation to Workforce Administration commands documented in §10.3.
7. Identity Acquisition **SHALL NOT** provision or revoke enterprise access.
8. Identity Acquisition **SHALL NOT** own supplier approval, nomination review, or sponsor accountability.
9. After acquisition publishes, operational authority over workforce and engagement **SHALL** belong to their respective capabilities — upstream HCM **SHALL NOT** remain operational truth post-cutover.
10. Bootstrap lineage **SHALL** remain distinguishable from operational governance authority.
11. Acquisition failure **SHALL NOT** imply workforce termination or access revocation — those require their owning capabilities.
12. The capability boundary **SHALL** be drawn at publish: downstream capabilities **SHALL** own everything after canonical External Worker exists and acquisition facts are emitted.

---

## Document control

| Version | Change |
|---------|--------|
| **1.0** | Initial authoritative contract — May 2026 |

Changes to this document **SHALL** represent **capability contract revisions** and **SHALL** increment the capability version (e.g. v1.0 → v2.0). Implementation changes **SHALL NOT** require a version bump unless normative text in §1–§10 or §12 changes.

PRs **SHALL** cite `CAP-IDENTITY-ACQUISITION v1.0` and list affected § until a new version is ratified.
