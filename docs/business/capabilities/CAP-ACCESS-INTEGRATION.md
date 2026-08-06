# CAP-ACCESS-INTEGRATION

**Capability:** Access Integration
**Platform:** External Workforce Platform (EWP)
**Version:** 1.0
**Status:** **RATIFIED** — gateway CAP (May 2026); implementation partial per §11
**Normative:** This document uses **SHALL** / **SHALL NOT** as defined in RFC 2119.

> **Gateway capability — not an enduring truth owner.** Access Integration **SHALL NOT** answer *what access does this worker have?* — that is enterprise IGA. It **SHALL** answer *how does EWP communicate workforce and engagement decisions to access governance systems?* Responsibility **ends at publish to IGA** (or equivalent handover). See [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](../EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — Authoritative / Gateway / Cross-cutting.

**Implementation identifiers (non-normative):** `IgaOutboxEvent`, `IgaWorkforceEventWriter`, `igaIntegrationStatus`, `accessIntent` — current partial implementation; this CAP defines the target contract.

---

## Dependencies

| ADR / doctrine | Role |
|----------------|------|
| [`ADR-012`](../ADR-012-External-Workforce-Platform-Naming.md) | External Workforce Platform identity |
| [`ADR-EXTID-001`](../../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) | CMS ≠ IGA; access intent vs execution |
| [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) | Authoritative workforce truth consumed — not owned |
| [`CAP-ENGAGEMENT-ADMINISTRATION.md`](./CAP-ENGAGEMENT-ADMINISTRATION.md) | Placement / sponsor substrate consumed |
| [`CAP-IDENTITY-ACQUISITION.md`](./CAP-IDENTITY-ACQUISITION.md) | Reference gateway CAP — publish/handover discipline |

**Reading chain:**

| Question | Document |
|----------|----------|
| Why does it exist? | ADR-EXTID-001, operating model §24 |
| What must it do? | **This CAP (v1.0 draft)** |
| How was it built? | §11 Maturity — PR evidence *(when implemented)* |
| Does it conform? | `CERT-ACCESS-INTEGRATION` *(when certified)* |

**Architectural role:** **Gateway** — establishes or **publishes** access intent; **SHALL NOT** own workforce, engagement, or entitlement truth.

---

## 1. Purpose

> **Access Integration is responsible for translating authoritative workforce and engagement facts into access governance intent and publishing that intent to enterprise IGA. Its responsibility ends when intent has been successfully published (or explicitly failed) to the downstream access governance system.**

Access Integration **SHALL** consume authoritative EWP facts, derive **access intent**, publish outbound integration events, and record publish outcomes — without executing provisioning, SoD, certification campaigns, or badge/PACS operations.

It **SHALL NOT** own workforce state, engagement placement, supplier trust, identity acquisition, or operational answers to *what access the worker currently has*.

---

## 2. Business question

> **How does the External Workforce Platform communicate workforce and engagement decisions to access governance systems?**

Every element of this capability **SHALL** exist only to answer that question.

Access Integration **SHALL NOT** be confused with:

| Question | Owned by |
|----------|----------|
| What is the worker's workforce state? | Workforce Administration |
| Where is the worker engaged? | Engagement Administration |
| What entitlements / roles does the worker hold? | Enterprise IGA |
| Is platform truth aligned? | Governance |
| How did the worker enter EWP? | Identity Acquisition |

---

## 3. Capability boundaries

### 3.1 Architectural role (gateway)

Access Integration is a **gateway capability**. It **transfers responsibility** to IGA. It **SHALL NOT** remain the operational source of truth for access outcomes after publish.

```text
Workforce Administration ──┐
                           ├──► Access Integration ──► publish ──► Enterprise IGA
Engagement Administration ─┘              │
                                          ▼ handover
                               IGA owns access execution truth
```

**Boundary sentence:** Access Integration **ends at publish to IGA.**

### 3.2 Owns

Access Integration **SHALL** own:

| Concern | Description |
|---------|-------------|
| **Access intent derivation** | Mapping authoritative workforce/engagement facts to outbound access intent |
| **Publish pipeline state** | Processing stages for outbound messages *(not workforce lifecycle)* |
| **Integration outbox / transport** | Durable publish attempts to IGA adapters |
| **Publish outcomes** | Sent, failed, retry, dead-letter — **transport truth only** |
| **Correlation identifiers** | Stable keys linking EWP worker to IGA subject |
| **Access integration events** | Past-tense facts about publish attempts and outcomes |

### 3.3 Does not own

Access Integration **SHALL NOT** own:

| Concern | Owned by |
|---------|----------|
| Workforce state, transitions, history | Workforce Administration |
| Engagement placement, sponsor accountability | Engagement Administration |
| Supplier trust | Supplier Administration |
| Canonical worker acquisition | Identity Acquisition |
| Entitlement catalog, role assignments, SoD results | Enterprise IGA |
| Drift detection / remediation workflow | Governance |
| Approval chains, notifications | Workflow Orchestration |

Access Integration **SHALL NOT** suspend workers, terminate engagements, or change workforce state — even when reacting to access failures.

**Gateway ≠ integration volume:** Heavy adapter code **SHALL NOT** imply authoritative ownership. This capability is a gateway because it **transfers responsibility**, not because it calls external APIs.

---

## 4. Authoritative objects

Business objects — not database tables.

| Object | Definition |
|--------|------------|
| **Access Intent** | Derived statement of what IGA should consider given current workforce/engagement facts |
| **Publish Request** | A unit of work to deliver one intent message to IGA |
| **Publish Pipeline Stage** | How far an outbound message has progressed *(not workforce state)* |
| **Publish Outcome** | Transport result — sent, failed, retry scheduled — **not entitlement truth** |
| **IGA Correlation** | Stable link between EWP External Worker and IGA subject |

Implementation **MAY** map these to `IgaOutboxEvent`, `Contractor.igaIntegrationStatus`, and related persistence.

---

## 5. Authoritative publish pipeline

Access Integration **SHALL** model outbound work as a **processing pipeline**, not a business lifecycle state machine.

### 5.1 Conceptual pipeline (Capability Version 1)

| Stage | Meaning |
|-------|---------|
| **Intent Formed** | Authoritative facts consumed; access intent derived |
| **Queued** | Publish request persisted durably |
| **Published** | IGA accepted message or adapter confirmed handoff |
| **Failed** | Publish failed; retry or dead-letter per policy |
| **Acknowledged** *(optional)* | IGA downstream ack recorded — **still not entitlement truth** |

### 5.2 Pipeline vs lifecycle (mandatory distinction)

| Model | Access Integration | Workforce Administration |
|-------|-------------------|--------------------------|
| Nature | Publish pipeline | Business lifecycle state machine |
| Question answered | Was intent handed to IGA? | What is workforce standing? |
| Terminal success | Published to IGA | ACTIVE / TERMINATED / etc. |
| Operational queries after handover | Publish status only — **not** "what access?" | Workforce state |

Workforce `SUSPENDED` **SHALL NOT** be encoded as an Access Integration pipeline stage.

---

## 6. Commands

Integration operations. **SHALL NOT** reference UI controls, HTTP methods, or product names.

| Command | Effect (normative) |
|---------|-------------------|
| **Form Access Intent** | Derive intent from consumed authoritative facts |
| **Queue Publish** | Persist outbound publish request |
| **Publish to IGA** | Attempt delivery to enterprise IGA adapter |
| **Retry Publish** | Re-attempt failed publish within policy |
| **Record Publish Outcome** | Persist transport result |
| **Correlate IGA Subject** | Bind External Worker to IGA correlation id |

Access Integration **SHALL NOT** expose commands named **Suspend Worker**, **Revoke Entitlement**, or **Assign Role** — those belong to Workforce Administration or IGA respectively.

---

## 7. Policies

| ID | Policy |
|----|--------|
| **P-01** | Access Integration **SHALL NOT** mutate workforce or engagement authoritative state. |
| **P-02** | Every publish **SHALL** trace to a workforce or engagement fact — not invent access truth. |
| **P-03** | After successful publish, operational entitlement questions **SHALL** be answered by IGA — not Access Integration. |
| **P-04** | Publish **SHALL** be idempotent per intent correlation key. |
| **P-05** | Failed publish **SHALL NOT** imply workforce state change. |
| **P-06** | Access Integration **SHALL NOT** execute SoD, certification, badge, or account provisioning. |
| **P-07** | Inbound IGA status **MAY** be recorded as publish/ack outcomes — **SHALL NOT** overwrite workforce state without Workforce command. |

---

## 8. Events

Business facts Access Integration **SHALL** emit after successful operations. Past tense; transport/integration semantics.

| Event | Typical outcome |
|-------|-----------------|
| **Access Intent Formed** | Intent derived from authoritative facts |
| **Access Publish Queued** | Outbox record created |
| **Access Intent Published** | Handoff to IGA succeeded |
| **Access Publish Failed** | Delivery failed; retry or dead-letter |
| **IGA Subject Correlated** | Correlation identifier bound |

Workforce Administration **SHALL** emit **Worker Suspended** — Access Integration **SHALL** react by forming publish intent, not by owning suspension.

---

## 9. Read models

| Read model | Audience | Content |
|------------|----------|---------|
| **Publish Operations Console** | Integration operators | Outbox backlog, failures, retries |
| **Worker Access Integration Status** | Enterprise operators | Publish pipeline stage + last outcome — **not** entitlement catalog |
| **Capability Health — Access Integration** | Overview dashboard | Queue depth, failure rate |

Read models **SHALL NOT** present IGA entitlement truth as if owned by EWP.

---

## 10. Integrations

### 10.1 Consumes

| Capability | Consumption |
|------------|-------------|
| **Workforce Administration** | Workforce state change events / facts |
| **Engagement Administration** | Placement, sponsor, access-required signals |
| **Identity Acquisition** | Initial publish after acquisition complete *(optional path)* |
| **Governance** | Policy blocks that suppress publish |

### 10.2 Produces

| Target | Production |
|--------|------------|
| **Enterprise IGA** | Access intent messages — **handover** |
| **Governance** | Publish failure signals |
| **Reporting & Projections** | Publish metrics *(when built)* |

On every successful **Publish to IGA**, Access Integration **SHALL** persist:

1. **Publish outcome** — transport truth
2. **Audit record** — who triggered publish
3. **Integration event** — downstream notification stub or live bus

---

## 11. Maturity and evidence

| Capability element | Status | Evidence |
|--------------------|--------|----------|
| Outbox writer (person created/updated/sponsor) | **Implemented** | [`PR-ACCESS-INTEGRATION-PUBLISH-1`](../PR-ACCESS-INTEGRATION-PUBLISH-1.md) · `AccessIntegrationPublishService` |
| Acquisition migrated intent (`contractor.migrated`) | **Implemented** | Same PR — promote path |
| Workforce event reactions | **Implemented** | [`PR-ACCESS-INTEGRATION-WORKFORCE-REACTIONS-1`](../PR-ACCESS-INTEGRATION-WORKFORCE-REACTIONS-1.md) |
| Publish pipeline enum / stages | Planned | — |
| IGA ack ingestion | Planned | — |
| Formal CERT | **PASS v1.0** | [`CERT-ACCESS-INTEGRATION.md`](./CERT-ACCESS-INTEGRATION.md) (May 2026) |

**Certification:** [`CERT-ACCESS-INTEGRATION.md`](./CERT-ACCESS-INTEGRATION.md) **v1.0 PASS** (May 2026) — PARTIAL rows match Planned scope above.

---

## 12. Capability invariants

1. Access Integration **SHALL NOT** own workforce truth.
2. Access Integration **SHALL NOT** own engagement truth.
3. Access Integration **SHALL NOT** answer operational entitlement state after publish — IGA owns execution truth.
4. Every publish **SHALL** derive from authoritative workforce or engagement facts.
5. Failed publish **SHALL NOT** change workforce state.
6. Access Integration **SHALL NOT** suspend, terminate, or activate workers.
7. Pipeline stages **SHALL NOT** be confused with Workforce States.
8. Responsibility **SHALL** end at publish to IGA (handover complete).

---

## Document control

| Version | Change |
|---------|--------|
| **1.0 draft** | First gateway CAP authoring pass — May 2026 |

Changes **SHALL** increment capability version when normative §1–§10 or §12 change.

PRs **SHALL** cite `CAP-ACCESS-INTEGRATION vX.Y` and list affected § once ratified.

---

## Template notice

Gateway CAP — emphasize §3 publish boundary, §5 pipeline, §10 handover. Do **not** copy Workforce state machine into this document.
