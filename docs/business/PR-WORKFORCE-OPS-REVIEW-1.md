# PR-WORKFORCE-OPS-REVIEW-1 — Internal workforce ops review

**Status:** COMPLETE  
**Builds on:** [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md`](./PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md), [`PR-WORKFORCE-TRANSITIONS-1.md`](./PR-WORKFORCE-TRANSITIONS-1.md)

## Guardrail

> Ops review advances workforce state; it is not yet an approval workflow engine.

## Scope

- Internal nominated-contractor queue
- Filter: `workforceState = NOMINATED | PENDING_APPROVAL`
- Read placement intent + supplier + engagement summary
- Operator actions via existing `PATCH /contractors/:id/workforce-transition`:
  - `NOMINATED → PENDING_APPROVAL` (submit for review)
  - `PENDING_APPROVAL → ACTIVE` (activate)
- Operator note required (audit `reason`)
- Workforce audit trail in expanded row when actor has `audit:read`

## End-to-end path (supplier-backed)

```text
Supplier nominates (portal)
        ↓
Ops reviews (/contractors/workforce-review)
        ↓
Ops activates (workforce-transition)
        ↓
Contractor becomes ACTIVE
```

## API

```http
GET /contractors/workforce-review
Permission: contractors:read
Optional query: workforceState=NOMINATED|PENDING_APPROVAL
```

Actions reuse:

```http
PATCH /contractors/:id/workforce-transition
Permission: contractors:update
Body: { "targetState": "PENDING_APPROVAL"|"ACTIVE", "reason": "operator note" }
```

## UI

- Route: `/contractors/workforce-review` (nav: **Workforce review**)
- Queue table with expandable placement + audit history
- Primary role: `CONTRACTOR_MANAGER` (`contractors:update`)

## Out of scope

- Supplier activation from portal
- LM/Account Manager workflow
- SNOW/Aveksa, RDS mapping
- `acquisitionModel`, independent contractors
- Reject/back transitions from `PENDING_APPROVAL`

## Next

Workforce business timeline — **PR-WORKFORCE-TIMELINE-FOUNDATION-1 COMPLETE**; optional reject path later.
