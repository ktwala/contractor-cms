# CERT-REPORTING-PROJECTIONS

**Capability:** Reporting & Projections  
**Certifies conformance to:** [`CAP-REPORTING-PROJECTIONS.md`](./CAP-REPORTING-PROJECTIONS.md) **v1.0**  
**Status:** **EXECUTED** — v1.0 certification gate (May 2026)  
**Purpose:** Prove implementation **survives falsification** of the CAP — projection gateway boundary, no authoritative truth ownership, **no authority creep**.

> CERT answers: *Can we break the architectural responsibility?* (Not: *Does documentation match code?*)  
> PR answers: *What changed in this increment?*

---

## Primary certification gate

> **Can any projection become the source of business truth?**

This gate **instantiates** the **Gateway** responsibility falsification strategy ([`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](../ARCHITECTURAL_RESPONSIBILITIES_V1.md)) for Reporting & Projections — it is not a one-off CAP question.

| Answer | Result |
|--------|--------|
| **No** | CERT may pass (subject to section conformance) |
| **Yes** | **CERT FAILS** — regardless of dashboard quality or query performance |

**Gate result (v1.0):** **No** — partial implementations are read-only aggregations over authoritative stores; no projection persists parallel business truth or exposes authoritative commands.

### Authority creep review checklist

| Question | Expected | v1.0 audit |
|----------|----------|------------|
| Does any projection emit a verdict (compliant, trusted, should suspend)? | **No** | **PASS** — counts, buckets, timelines only; no compliance/trust verdicts in projection APIs |
| Does any projection reconcile conflicting authoritative facts into one "effective" status? | **No** | **PASS** — governance buckets count by `SupplierStatus` / `sourceSyncStatus`; no blended status |
| Is freshness (Fresh / Delayed / Stale) visible where operators act on projections? | **Yes** *(when contract implemented)* | **PARTIAL** — date filters on audit insights only; no Fresh/Delayed/Stale contract |
| Can operational dispute resolution cite a projection instead of an authoritative CAP? | **No** | **PASS** — approve/suspend/workforce transitions remain on authoritative endpoints |
| Do counts/trends/charts remain distinguishable from business decisions? | **Yes** | **PASS** — see P-09 evidence below |

---

## Certification scope

| Field | Value |
|-------|-------|
| CAP version | 1.0 **RATIFIED** |
| Platform | External Workforce Platform (EWP) |
| Implementation | `AuditInsightsService`, `SupplierGovernanceDashboardService`, `AnalyticsService`, workforce timeline read APIs, `CapabilityOverview` |
| Certification date | **2026-05-19** |
| Certified by | Architecture review — implementation audit |

**Overall result:** **PASS (v1.0)** — with **PARTIAL** rows explicitly Planned in CAP §11 (unified projection module, freshness contract, projection events).

---

## Section conformance

| CAP section | Result | Notes / evidence |
|-------------|--------|------------------|
| §1 Purpose | **PASS** | Projections served read-only; disputes not resolved in projection layer |
| §2 Business question | **PASS** | Dashboards aggregate — do not own supplier/workforce/engagement truth |
| §3 Gateway boundary | **PASS** | No mutation; disagreement not reconciled in dashboards |
| §4 Projection objects | **PARTIAL** | Behaviour matches Supplier/Workforce projections; formal projection-plane naming **Planned** |
| §5 Projection pipeline + freshness | **PARTIAL** | On-demand materialization only; Fresh/Delayed/Stale **Planned** |
| §6 Commands | **PASS** | GET-only insight/dashboard endpoints; no authoritative commands |
| §7 Policies P-01–P-09 | **PASS** | Read-only queries; P-09 — no verdict APIs (see below) |
| §8 Events | **PARTIAL** | No Projection Materialized / Freshness Changed events **Planned** |
| §9 Operational Projections | **PARTIAL** | Audit Insights, Governance Status buckets, Workforce Timeline, Analytics summaries — not unified module |
| §10 Integrations | **PASS** | Read-only `findMany` / `count` against authoritative tables |
| §11 Maturity | **PASS** | Partial evidence audited; gaps match CAP Planned rows |
| §12 Invariants (1–11) | **PASS** | Invariant 11 — primary gate **No** |

---

## Gateway validation

| Trait | Evidence |
|-------|----------|
| Third gateway CAP | Terminal operation **Projection** — GET responses, no handover to external system |
| Does not own authoritative truth | No writes in `AuditInsightsService`, `SupplierGovernanceDashboardService`, `AnalyticsService` dashboard paths |
| Consumes authoritative facts read-only | Prisma read queries only on `AuditLog`, `Supplier`, `Contractor`, `ContractorWorkforceHistory`, invoices, etc. |
| No authority creep (P-09) | See P-09 evidence |
| Freshness as business semantics | **PARTIAL** — `startDate`/`endDate` on audit insights; Fresh/Delayed/Stale contract **Planned** |

---

## P-09 authority creep evidence

| Surface | What it projects | Verdict risk | Assessment |
|---------|------------------|--------------|------------|
| `AuditInsightsService` | Audit log counts, high-risk lists, role-change timeline | Low — activity aggregation | **PASS** |
| `SupplierGovernanceDashboardService` | `synced`, `pendingEvidence`, `active`, `suspended` **counts** | Low — buckets map to authoritative `SupplierStatus` / sync fields | **PASS** |
| `AnalyticsService` | Financial totals, `activeContractors` count via `isActive`, engagement counts | Low — numeric rollups | **PASS** |
| `ContractorsService.listWorkforceTimeline` | `ContractorWorkforceHistory` rows + transition labels | Low — presents workforce-authored history | **PASS** |
| `CapabilityOverview` | Capability health **Healthy** / **Attention** from backlog metrics | Medium — monitor wording; signals backlog not business verdict | **PASS** *(watch)* |
| ADR-010 `GovernanceAnalyticsService` *(proposed)* | Risk scores, compliance metrics | **Not implemented** — CAP/CERT before build | **N/A** |

**Not found in v1.0 code:** `isCompliant`, `supplierIsTrusted`, `shouldSuspend`, `officialWorkforceHealth`, or reconciled "effective status" fields in projection APIs.

---

## Invariant evidence (§12)

| Inv. | Law | Evidence |
|------|-----|----------|
| 1–6 | No ownership of authoritative domains | No create/update/delete on supplier, workforce, engagement, acquisition, access, governance remediation in projection services |
| 7 | Projections derive from facts | Counts and timelines query authoritative tables |
| 8 | Disputes resolve against authoritative CAPs | Supplier approve/suspend, workforce transitions on domain services — not dashboard services |
| 9 | Pipeline ≠ lifecycle | Dashboard buckets ≠ `SupplierStatus` enum replacement |
| 10 | Ends at consumption availability | HTTP GET returns projection; no downstream ownership claim |
| **11** | **No projection becomes authoritative source** | **PASS** — primary gate |

**Test suites:** `audit-insights.service.spec.ts`, `supplier-governance-dashboard.service.spec.ts`, `contractor-workforce-history.spec.ts`, `supplier-portal-workforce-timeline.spec.ts`

---

## Implementation map (non-normative)

| Operational Projection (CAP §9) | Implementation | Module boundary |
|---------------------------------|----------------|-----------------|
| Audit Insights Projection | `backend/src/core/audit/audit-insights.service.ts` | Audit (cross-cutting observability) — read-only |
| Governance Status Projection | `backend/src/domain/suppliers/supplier-governance-dashboard.service.ts` | Supplier domain — **should move** under reporting module when built |
| Workforce Timeline Projection | `ContractorsService.listWorkforceTimeline` + `ContractorWorkforceHistoryService.listForContractor` | Workforce domain — read path only |
| Operations / Analytics summaries | `backend/src/domain/analytics/analytics.service.ts` | Analytics domain — read-only |
| Operations Overview | `frontend/components/dashboard/CapabilityOverview.tsx` | FE aggregation of authoritative API counts |

**Architectural note:** v1.0 projections are **distributed** across domains, not a unified `reporting-projections` module. CERT **PASS** does not require module consolidation — CAP §11 marks unified module **Planned**.

---

## Open gaps (certified PARTIAL — not failures)

| Item | CAP reference | Status |
|------|---------------|--------|
| Unified `reporting-projections` module | §11 | Planned |
| Projection freshness contract (Fresh / Delayed / Stale) | §5.3, §7 P-05 | Planned |
| Projection Materialized / Freshness Changed events | §8 | Planned |
| Formal Operational Projection DTO naming | §4, §9 | Planned |
| Cross-capability disagreement display (explicit multi-source) | §3.2 | Planned |
| ADR-010 risk scores / executive scorecard | §9, §11 | Proposed — **must** pass P-09 review before implementation |

---

## Re-certification

When **CAP v2.0** is ratified, supersede this CERT. Re-cert **SHALL** re-run the primary gate and P-09 checklist — especially before ADR-010 analytics or AI summarization layers.

When unified projection module lands, re-cert §9–§10 and freshness contract.

---

## Document control

| Version | Change |
|---------|--------|
| **0.1** | CERT scaffold — primary gate defined at CAP ratification (May 2026) |
| **1.0** | Executed — PASS with PARTIAL per CAP §11 Planned scope |
