# CERT-ACCESS-INTEGRATION

**Capability:** Access Integration  
**Certifies conformance to:** [`CAP-ACCESS-INTEGRATION.md`](./CAP-ACCESS-INTEGRATION.md) **v1.0**  
**Status:** **EXECUTED** — v1.0 certification gate (May 2026)  
**Purpose:** Prove implementation **upholds the CAP** — gateway publish boundary, no authoritative truth ownership.

> CERT answers: *Does the implementation satisfy the capability contract?*  
> PR answers: *What changed in this increment?*

---

## Certification scope

| Field | Value |
|-------|-------|
| CAP version | 1.0 |
| Platform | External Workforce Platform (EWP) |
| Implementation | `backend/src/domain/access-integration/` + IGA outbox substrate |
| Certification date | **2026-05-19** |
| Certified by | Architecture review — implementation audit |

**Overall result:** **PASS (v1.0)** — with **PARTIAL** rows explicitly Planned in CAP §11.

---

## Certification history

| Pass | Date | Scope |
|------|------|-------|
| Baseline | 2026-05-19 | `AccessIntegrationPublishService` publish boundary ([`PR-ACCESS-INTEGRATION-PUBLISH-1`](../PR-ACCESS-INTEGRATION-PUBLISH-1.md)) |
| Re-cert | 2026-05-19 | Workforce event reactions ([`PR-ACCESS-INTEGRATION-WORKFORCE-REACTIONS-1`](../PR-ACCESS-INTEGRATION-WORKFORCE-REACTIONS-1.md)) |

---

## Section conformance

| CAP section | Result | Notes / evidence |
|-------------|--------|------------------|
| §1 Purpose | **PASS** | Publishes access intent; does not own entitlement truth |
| §2 Business question | **PASS** | Communicates workforce/engagement decisions to IGA — not "what access?" |
| §3 Gateway boundary | **PASS** | Ends at outbox handover; no workforce/engagement mutation |
| §4 Authoritative objects | **PARTIAL** | Outbox + intent mapping; formal publish pipeline enum **Planned** |
| §5 Publish pipeline | **PARTIAL** | Outbox queue only; stage read models **Planned** |
| §6 Commands | **PASS** | Publish methods map to Queue/Publish operations |
| §7 Policies P-01–P-07 | **PASS** | No workforce mutation; publish traces to workforce facts |
| §8 Events | **PARTIAL** | IGA outbox events; formal Access Integration domain events **Planned** |
| §9 Read models | **PARTIAL** | **Planned** |
| §10 Integrations | **PASS** | Consumes workforce domain events; produces IGA outbox |
| §11 Maturity | **PASS** | PR-ACCESS-INTEGRATION-PUBLISH-1 + WORKFORCE-REACTIONS-1 |
| §12 Invariants (1–8) | **PASS** | See invariant evidence |

---

## Gateway validation

| Trait | Evidence |
|-------|----------|
| Does not own workforce truth | Reactions read-only; no `workforceState` writes |
| Does not provision access | Outbox enqueue only — IGA executes |
| Consumes authoritative facts | `AccessIntegrationWorkforceReactionService` reacts to workforce domain events |
| Ends at publish | `IgaOutboxService.save` within same transaction as workforce transition |
| Second gateway CAP | Same contract as Identity Acquisition — different business area |

---

## Invariant evidence (§12)

| Inv. | Law | Evidence |
|------|-----|----------|
| 1–2 | No workforce/engagement ownership | No mutations in access-integration domain |
| 3 | IGA owns execution truth after publish | Outbox only |
| 4 | Publish derives from workforce facts | Reaction maps domain events → IGA event types |
| 5 | Failed publish ≠ workforce change | Shared transaction rolls back together |
| 6 | No suspend/terminate commands | Reaction service has no workforce commands |
| 7 | Pipeline ≠ lifecycle | IGA event types ≠ `ContractorWorkforceState` |
| 8 | Ends at publish | No ack ingestion or entitlement storage |

**Test suites:** `access-integration/**/*.spec.ts`, workforce transition specs with reaction mock

---

## Open gaps (certified PARTIAL — not failures)

| Item | CAP reference | Status |
|------|---------------|--------|
| IGA ack ingestion | §11 | Planned |
| Publish pipeline read models | §9 | Planned |
| Formal Access Integration domain events | §8 | Planned |
| ServiceNow / Aveksa adapters | §11 | Planned |

---

## Re-certification

When **CAP v2.0** is ratified, supersede this CERT. Do not certify v2.0 against v1.0 text.
