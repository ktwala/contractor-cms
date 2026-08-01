# CERT-WORKFORCE-ADMINISTRATION

**Capability:** Workforce Administration  
**Certifies conformance to:** [`CAP-WORKFORCE-ADMINISTRATION.md`](./CAP-WORKFORCE-ADMINISTRATION.md) **v1.0**  
**Status:** **EXECUTED** — v1.0 certification gate (May 2026)  
**Purpose:** Prove implementation **upholds the CAP** — not that a specific stack (NestJS, Prisma, etc.) was used.

> CERT answers: *Does the implementation satisfy the capability contract?*  
> PR answers: *What changed in this increment?*

Failed sections **SHALL** block "certified" status for that CAP version. Known **Planned** gaps are **PARTIAL**, not FAIL.

---

## Certification scope

| Field | Value |
|-------|-------|
| CAP version | 1.0 |
| Platform | External Workforce Platform (EWP) |
| Implementation | `contractor-cms` backend + frontend (current) |
| Certification date | **2026-05-19** |
| Certified by | Architecture review — implementation audit |

**Overall result:** **PASS (v1.0)** — with documented **PARTIAL** items that are explicitly **Planned** in CAP §11 (not deviations).

---

## Section conformance

Stack-agnostic. Each row maps to a **CAP section**, not a code module.

| CAP section | Result | Notes / evidence |
|-------------|--------|------------------|
| §1 Purpose | **PASS** | `ContractorWorkforceStateService`, `contractors.service` workforce paths own workforce relationship only |
| §2 Business question | **PASS** | `workforceState` + history answer operational workforce standing |
| §3 Boundaries | **PASS** | No inline IGA/HCM/supplier lifecycle ownership; events stubbed for downstream |
| §4 Authoritative objects | **PASS** | Mapped to `Contractor`, `ContractorWorkforceHistory` |
| §5 State machine | **PASS** | `CONTRACTOR_WORKFORCE_TRANSITIONS` matches §5.2; `BLACKLISTED` terminal |
| §6 Commands | **PASS** | Nominate, review outcomes, transition, blacklist, legacy bridge map to §6 |
| §7 Policies P-01–P-10 | **PASS** | `contractor-workforce-state.constants.ts`, supplier portal redaction, reason/authority gates |
| §7 Policy P-11 | **PARTIAL** | Cross-intake blacklist enforcement — **Planned** per CAP §11 (not a silent gap) |
| §7 Policy P-12 | **PASS** | `assertIndependentPrimarySponsorBeforeActivate` — ADR-013 / independent acquire |
| §8 Events | **PASS** | `ContractorWorkforceEventPublisherService` stub on transitions; nomination intake stub |
| §9 Read models | **PASS** | Ops review queue, rejected list, policy block candidates, supplier timeline, registry |
| §10 Integrations | **PASS** | Three truths atomic; Access Integration consumes workforce domain events |
| §11 Maturity | **PASS** | PR evidence chain complete; Planned rows unchanged |
| §12 Invariants (1–13) | **PASS** | See invariant evidence below; legacy `create()` bootstrap history remediated |

**Result legend:** `PASS` | `PARTIAL` | `FAIL` | `Pending`

---

## Remediation during certification

| Finding | CAP violation | Fix |
|---------|---------------|-----|
| Legacy `POST /contractors` created `ACTIVE` without bootstrap history | §12 inv. 3, 10 | Bootstrap history (`null → ACTIVE`) + `isActive` derivation in `contractors.service.create()` |

No other **FAIL** items identified. **Planned** scope (P-11, Access reactions, Workflow) remains **PARTIAL** by contract.

---

## Invariant evidence (§12)

| Inv. | Law | Evidence |
|------|-----|----------|
| 1 | One current workforce state | `Contractor.workforceState` single column |
| 2 | `isActive` derived | `deriveIsActiveFromWorkforceState` |
| 3 | Transition appends one history row | `applyTransition` + nominate/acquire/create bootstrap |
| 4 | History append-only | No update/delete paths on history service |
| 5 | No direct access provision | No IGA execute calls in workforce service |
| 6–7 | No supplier/engagement lifecycle ownership | Boundaries enforced by domain split |
| 8–11 | Blacklist terminal / supplier scope | `CONTRACTOR_WORKFORCE_TRANSITIONS`, portal filters |
| 12 | Ops review = permitted transitions only | `resolveOpsReviewNextTargetState` |
| 13 | Independent → ACTIVE requires sponsor | P-12 guard in `applyTransition` |

**Test suites:** `contractor-workforce-*.spec.ts` (41 tests), `workforce-administration-uat.e2e-spec.ts`

---

## Recommended evidence sources

| Evidence type | Artifacts |
|---------------|-----------|
| End-to-end behaviour | [`PR-WORKFORCE-E2E-UAT-1`](../PR-WORKFORCE-E2E-UAT-1.md), `workforce-administration-uat.e2e-spec.ts` |
| Unit / transition specs | `contractor-workforce-*.spec.ts` |
| CAP §11 PR list | As enumerated in CAP-WORKFORCE-ADMINISTRATION §11 |
| Bootstrap history fix | `contractors.service.create()` — CERT remediation May 2026 |

---

## Open gaps (certified PARTIAL — not failures)

| Item | CAP reference | Status |
|------|---------------|--------|
| Cross-intake blacklist enforcement | §7 P-11 | Planned |
| Access Integration reactions | §10 | Planned |
| Workflow orchestration integration | §11 | Planned |

---

## Re-certification

When **CAP v2.0** is ratified, this CERT **SHALL** be superseded by `CERT-WORKFORCE-ADMINISTRATION` for v2.0. Do not certify v2.0 behaviour against v1.0 text.

---

## Template notice

Copy this structure for `CERT-SUPPLIER-ADMINISTRATION`, etc. Replace CAP reference, section table, and evidence sources. CERT **SHALL** always reference an explicit **CAP version**.
