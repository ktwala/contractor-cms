# PR-IDENTITY-ACQUISITION-MODEL-2 — Independent acquisition path

**Status:** COMPLETE  
**ADR:** [`ADR-013-External-Worker-Acquisition-Model.md`](./ADR-013-External-Worker-Acquisition-Model.md) Steps 3–6  
**CAP:** [`capabilities/CAP-IDENTITY-ACQUISITION.md`](./capabilities/CAP-IDENTITY-ACQUISITION.md) **v1.0**

## CAP traceability

**Capability:** Identity Acquisition  
**CAP version:** v1.0  
**Implements:** CAP §7 P-01–P-02 · ADR-013 §7 Step 3, §5 channel mapping, Step 6

## Scope

- `Contractor.organizationId` for tenant scope (independent workers without supplier)
- Nullable `supplierId` + DB check constraint vs `acquisitionModel`
- Nullable `ContractorEngagement.contractId` for independent placements
- `POST /contractors/acquire-independent` — enterprise direct intake at `NOMINATED`
- HCM promote: absent vendor → `INDEPENDENT`; unresolved vendor → fail
- Workforce guard: `INDEPENDENT` → `ACTIVE` requires sponsored engagement
- Org context resolver + contractor queries use `organizationId`

## Out of scope

- PDP rules keyed off `INDEPENDENT` (ADR-013 Step 7)
- Supplier portal independent path (blocked by design)
- Frontend ops UX for acquire-independent

## Cross-capability policy ownership

| Policy | Owner | Notes |
|--------|-------|-------|
| Sponsor required before `ACTIVE` (independent authority) | **Workforce Administration** CAP §7 P-12 | Implemented in workforce transition path; acquisition ends at publish |

## Builds on

[`PR-IDENTITY-ACQUISITION-MODEL-1`](./PR-IDENTITY-ACQUISITION-MODEL-1.md)

## Evidence

| Area | Artifact |
|------|----------|
| Schema | `20260530200000_contractor_independent_acquisition` |
| Acquire command | `contractors.service.ts`, `contractors.controller.ts` |
| HCM promote | `promote-hcm-contractor-to-cms.service.ts` |
| Workforce guard | `contractor-workforce-state.service.ts` |
| Tests | `contractor-workforce-independent-acquire.spec.ts`, promote spec |
