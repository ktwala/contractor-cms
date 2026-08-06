# PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1 — Supplier portal nomination wiring

**Status:** COMPLETE
**Builds on:** [`PR-WORKFORCE-NOMINATE-1.md`](./PR-WORKFORCE-NOMINATE-1.md)

## Guardrail

> Supplier portal can nominate a worker; it cannot activate a worker.

## Scope

- Wire supplier portal create form to workforce nomination (`NOMINATED`)
- `supplierId` from membership scope (unchanged)
- Require contract + engagement basics in portal POST
- Show `workforceState` in portal list + detail
- Block supplier users from direct `ACTIVE` create (portal delegates to `ContractorsService.nominate`)
- **No** auto-submit to `PENDING_APPROVAL`
- **No** approval workflow, SNOW/Aveksa, `acquisitionModel`

## Flow

```text
Supplier user nominates contractor (portal)
        ↓
POST /supplier-portal/contractors → ContractorsService.nominate
        ↓
Contractor enters NOMINATED
        ↓
Internal operator: PATCH /contractors/:id/workforce-transition
        → PENDING_APPROVAL → ACTIVE
```

## API

| Method | Path | Permission |
|--------|------|------------|
| `GET` | `/supplier-portal/contracts` | `supplier-contractors:read` |
| `GET` | `/supplier-portal/contractors` | `supplier-contractors:read` |
| `GET` | `/supplier-portal/contractors/:id` | `supplier-contractors:read` |
| `POST` | `/supplier-portal/contractors` | `supplier-contractors:create` |

Portal list includes non-active workforce rows (excludes `BLACKLISTED` only). Dashboard contractor count uses the same scope.

## UI

- **Nominate contractor** modal: identity + placement intent (contract, role, rate, optional sponsor)
- List: workforce state badge + link to detail
- Detail: read-only workforce state + placement intent

## Out of scope

- Auto-submit to `PENDING_APPROVAL`
- Supplier-side workforce transitions
- Client `POST /contractors` (still `ACTIVE` for admin compatibility)

## Next

Internal ops UX — **PR-WORKFORCE-OPS-REVIEW-1 COMPLETE**; supplier portal timeline — **PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1 COMPLETE**; then acquisitionModel ADR.
