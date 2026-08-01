# PR-IDENTITY-ACQUISITION-MODEL-1 — Acquisition model schema and intake wiring

**Status:** COMPLETE  
**ADR:** [`ADR-013-External-Worker-Acquisition-Model.md`](./ADR-013-External-Worker-Acquisition-Model.md)  
**CAP:** [`capabilities/CAP-IDENTITY-ACQUISITION.md`](./capabilities/CAP-IDENTITY-ACQUISITION.md) **v1.0** — §7 P-01, P-02; §12 invariants 2, 4

## CAP traceability

**Capability:** Identity Acquisition  
**CAP version:** v1.0  
**Implements:** CAP §7 P-01, P-02 · ADR-013 §7 Step 2

## Scope

- `AcquisitionModel` enum (`SUPPLIER` | `INDEPENDENT`) on `Contractor`
- Backfill existing rows → `SUPPLIER`
- Explicit `acquisitionModel` on supplier-backed intake (`POST /contractors`, `POST /contractors/nominate`, supplier portal nominate)
- HCM promote derives model from resolved supplier link (`SUPPLIER` when `supplierId` present)
- API response exposes `acquisitionModel`
- `supplierId` remains **required** — nullable + check constraint deferred to follow-on PR (ADR-013 Step 3)

## Out of scope

- Independent enterprise acquire command (ADR-013 Step 6)
- Nullable `supplierId` migration
- HCM promote without supplier link (`INDEPENDENT` path)
- PDP / governance rules keyed off `INDEPENDENT`

## Evidence

| Area | Artifact |
|------|----------|
| Schema | `20260530180000_contractor_acquisition_model` |
| Authority helper | `acquisition-model.constants.ts` |
| Nominate | `contractors.service.ts`, `contractor-workforce-nominate.spec.ts` |
| HCM promote | `promote-hcm-contractor-to-cms.service.ts` |
| Response | `contractor-response.dto.ts` |

## Next

ADR-013 Step 3 — nullable `supplierId` + mutual constraint for `INDEPENDENT`.
