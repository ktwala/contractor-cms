# CERT-IDENTITY-ACQUISITION

**Capability:** Identity Acquisition
**Certifies conformance to:** [`CAP-IDENTITY-ACQUISITION.md`](./CAP-IDENTITY-ACQUISITION.md) **v1.0**
**Status:** **EXECUTED** — v1.0 certification gate (May 2026)
**Purpose:** Prove implementation **upholds the CAP** — not that a specific stack was used.

> CERT answers: *Does the implementation satisfy the capability contract?*
> PR answers: *What changed in this increment?*

Known **Planned** gaps are **PARTIAL**, not FAIL.

---

## Certification scope

| Field | Value |
|-------|-------|
| CAP version | 1.0 |
| Platform | External Workforce Platform (EWP) |
| Implementation | `contractor-cms` backend + frontend (current) |
| Certification date | **2026-05-19** |
| Certified by | Architecture review — implementation audit |

**Overall result:** **PASS (v1.0)** — gateway publication boundary validated; **PARTIAL** rows match Planned scope in CAP §11.

---

## Section conformance

| CAP section | Result | Notes / evidence |
|-------------|--------|------------------|
| §1 Purpose | **PASS** | HCM promote + portal nominate + independent acquire establish canonical worker; responsibility ends at publish |
| §2 Business question | **PASS** | Staging/promote answers *known to EWP* — not workforce active / IGA entitlements |
| §3 Boundaries | **PASS** | Gateway; no enduring relationship; pipeline ≠ lifecycle |
| §4 Authoritative objects | **PASS** | Staging, batch, identity map, correlation, canonical `Contractor` |
| §5 Acquisition pipeline | **PASS** | `HcmMigrationPipelineStatus`; `IGA_PUBLISHED` after outbox *(remediated May 2026)* |
| §6 Commands | **PASS** | Extract/validate/promote via admin + connector — not Activate/Approve commands |
| §7 Policies P-01–P-07 | **PASS** | `AcquisitionModel`, duplicate-before-canonical, channel vs authority separation |
| §8 Events | **PARTIAL** | `contractor.migrated` outbox; formal acquisition domain event bus **Planned** |
| §9 Read models | **PASS** | HCM operations console, overview health, staging queues |
| §10 Integrations | **PASS** | §10.3 handoff preserved; IGA publish via `AccessIntegrationPublishService` |
| §11 Maturity | **PASS** | PR-CTR stack + PR-IDENTITY-ACQUISITION-MODEL-1/2 evidence |
| §12 Invariants (1–12) | **PASS** | See invariant evidence; bootstrap vs operational authority in drift engine |

---

## Remediation during certification

| Finding | CAP violation | Fix |
|---------|---------------|-----|
| Promote stopped pipeline at `PROMOTED` after IGA outbox enqueue | §5 publish stage incomplete | Advance to `IGA_PUBLISHED` + audit on successful `publishToIga` |

No other **FAIL** items identified.

---

## Gateway pattern validation

Identity Acquisition exhibits gateway semantics **without forcing the model**:

| Gateway trait | Evidence |
|---------------|----------|
| Pipeline not lifecycle | `HcmMigrationPipelineStatus` ≠ `ContractorWorkforceState` |
| Publish boundary | `IGA_PUBLISHED` after outbox; workforce bootstrap delegated via history |
| No operational truth after handover | Staging row terminal at publish; workforce/engagement services own worker |
| Acquisition authority ≠ channel | `AcquisitionModel` + intake metadata (ADR-013) |

This validates the Authoritative / Gateway taxonomy for the **first** gateway CAP.

---

## Invariant evidence (§12)

| Inv. | Law | Evidence |
|------|-----|----------|
| 1 | No enduring relationship | Staging/promote completes; no ongoing acquisition lifecycle on worker |
| 2 | One channel authority per episode | `acquisitionModel` on promote/acquire/nominate paths |
| 3–4 | Canonical once; duplicate first | `hcm-staging-validation`, `findDuplicateConflict` on promote |
| 5 | Pipeline ≠ lifecycle | Separate enums + tests |
| 6 | Workforce via delegation | `HCM_BOOTSTRAP` history on promote; nominate → `NOMINATED` |
| 7 | No access execution | Outbox intent only — IGA executes |
| 8–9 | No supplier/sponsor ownership | Boundaries in CAP §3.4 |
| 10 | Bootstrap lineage distinct | `legacySourceSystem`, drift engine, bootstrap metadata |
| 11 | Failure ≠ terminate/revoke | Quarantine does not mutate workforce |
| 12 | Boundary at publish | `IGA_PUBLISHED` pipeline terminal for HCM path |

**Test suites:** `contractor-migration/**/*.spec.ts` (55 tests), `hcm-migration-pipeline.e2e-spec.ts`

---

## Open gaps (certified PARTIAL — not failures)

| Item | CAP reference | Status |
|------|---------------|--------|
| PDP independent-path rules | §11 / ADR-013 Step 7 | Planned |
| Cross-channel duplicate at nominate | §11 / Workforce P-11 | Planned |
| Access Integration owns IGA transport | §10.2 | **Implemented** — [`PR-ACCESS-INTEGRATION-PUBLISH-1`](../PR-ACCESS-INTEGRATION-PUBLISH-1.md) |
| Formal acquisition domain events | §8 | Planned |

---

## Re-certification

When **CAP v2.0** is ratified, this CERT **SHALL** be superseded. Do not certify v2.0 behaviour against v1.0 text.

---

## Template notice

Copy for future gateway CAP CERTs. CERT **SHALL** always reference an explicit **CAP version**.
