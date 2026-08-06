# PR-WORKFORCE-TRANSITIONS-1 — Controlled workforce transitions

**Status:** COMPLETE
**Builds on:** [`PR-WORKFORCE-STATE-MODEL-1.md`](./PR-WORKFORCE-STATE-MODEL-1.md), [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md)

## Scope

- Supplier-backed only (`supplierId` still required)
- Internal controlled transition API
- Narrow allowed transition matrix
- Audit + domain-event stub emission (unchanged from state-model PR)
- **No** MTN approval chains, SNOW/Aveksa, `acquisitionModel`, independent contractor migration, portal UX

## API

```http
PATCH /contractors/:id/workforce-transition
Permission: contractors:update
```

Body:

```json
{
  "targetState": "SUSPENDED",
  "reason": "optional operator note"
}
```

Legacy `PATCH /contractors/:id/deactivate` still maps to `ACTIVE → TERMINATED` via the same transition service.

## Allowed transitions (v1)

```text
NOMINATED           → PENDING_APPROVAL
PENDING_APPROVAL    → ACTIVE
ACTIVE              → SUSPENDED | TERMINATED | BLACKLISTED
SUSPENDED           → ACTIVE
TERMINATED          → ACTIVE | BLACKLISTED
BLACKLISTED         → (terminal)
```

Existing creates and HCM materialization remain **`ACTIVE`** until a nominate workflow is added — this PR adds **controlled movement**, not intake redesign.

## Domain events (stubs via audit)

| Transition | Event |
|------------|-------|
| → `PENDING_APPROVAL` | `ContractorNominated` |
| → `ACTIVE` (from pending) | `ContractorActivated` |
| → `ACTIVE` (from suspended) | `ContractorReinstated` |
| → `ACTIVE` (from terminated) | `ContractorRehired` |
| → `SUSPENDED` | `ContractorSuspended` |
| → `TERMINATED` | `ContractorTerminated` |
| → `BLACKLISTED` | `ContractorBlacklisted` |

## Guardrail

`workforceState` is workforce truth; `isActive` remains derived on every transition. Supplier, engagement, governance, and access planes are unchanged.

## Next

Supplier portal nominate UX; optional auto-submit to `PENDING_APPROVAL`; then acquisitionModel ADR.
