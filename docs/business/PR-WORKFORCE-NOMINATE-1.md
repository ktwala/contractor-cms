# PR-WORKFORCE-NOMINATE-1 — Supplier-backed workforce nomination intake

**Status:** COMPLETE
**Builds on:** [`PR-WORKFORCE-STATE-MODEL-1.md`](./PR-WORKFORCE-STATE-MODEL-1.md), [`PR-WORKFORCE-TRANSITIONS-1.md`](./PR-WORKFORCE-TRANSITIONS-1.md), [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md)

## Guardrail

> Nomination is not onboarding. It is the first workforce-state entry point for a supplier-backed contractor.

## Scope

- Supplier-backed nominate intake enters at **`NOMINATED`**
- Existing `POST /contractors` (admin/direct create) remains **`ACTIVE`** for compatibility
- Require `supplierId`
- Capture sponsor + engagement placement basics in the same request
- Emit **`ContractorNominated`** domain-event stub on intake
- Progress via existing `PATCH /contractors/:id/workforce-transition` (`NOMINATED → PENDING_APPROVAL → ACTIVE`)
- **No** LM/Account Manager approval engine, SNOW/Aveksa, `acquisitionModel`, portal UX

## API

```http
POST /contractors/nominate
Permission: contractors:create
```

Body (contractor fields + nested `engagement`):

```json
{
  "supplierId": "...",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@supplier.example",
  "workerClassification": "SUPPLIER_CONTRACTOR",
  "engagementModel": "AGENCY",
  "taxResidency": "ZA",
  "nominationReason": "optional",
  "engagement": {
    "contractId": "...",
    "role": "Senior Developer",
    "startDate": "2026-06-01",
    "rateType": "HOURLY",
    "rateAmount": 850,
    "sponsorEmployeeId": "hcm:sponsor-1"
  }
}
```

Response: contractor at `workforceState: NOMINATED`, `isActive: false`.

## What happens

1. Validates supplier + contract (same supplier) + optional project
2. Creates contractor at **`NOMINATED`** with derived `isActive: false`
3. Creates engagement row (placement intent + sponsor substrate) — bypasses active-contractor gate used by `POST /engagements`
4. Audit: `CONTRACTOR_CREATED`, `CONTRACTOR_CREATED_IN_CMS` (`workforceIntake: NOMINATED`)
5. Stub: `CONTRACTOR_WORKFORCE_DOMAIN_EVENT` / `ContractorNominated` (`intake: true`)

## Progression (unchanged from transitions PR)

```text
POST /contractors/nominate           → NOMINATED
PATCH workforce-transition           → PENDING_APPROVAL  (ContractorNominated transition stub)
PATCH workforce-transition           → ACTIVE            (ContractorActivated stub)
```

## Out of scope

- MTN approval workflow
- Supplier portal UX wiring
- Independent contractor path (`acquisitionModel`)

## Next

Supplier portal nominate UX; optional auto-submit to `PENDING_APPROVAL`; then acquisitionModel ADR.
