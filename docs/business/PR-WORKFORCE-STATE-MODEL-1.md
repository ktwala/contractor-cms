# PR-WORKFORCE-STATE-MODEL-1 — Contractor workforce state column

**Status:** COMPLETE
**Authority:** [`ADR-011-Contractor-Workforce-Administration-Plane.md`](./ADR-011-Contractor-Workforce-Administration-Plane.md) (**APPROVED**)

## Scope (deliberately small)

1. Add `Contractor.workforceState` enum column
2. Backfill from `isActive` (`true` → `ACTIVE`, `false` → `TERMINATED`)
3. Keep `supplierId` required
4. Add `ContractorWorkforceStateService` transition helper
5. Emit audit + domain-event **stubs** (audit envelope only)
6. **No** MTN workflows, approval chains, or new public lifecycle APIs

## Guardrail

> `workforceState` replaces `isActive` as workforce truth **over time**; it does **not** collapse supplier, engagement, governance, or access state.

Interim: `isActive` is **derived** on every workforce transition (`ACTIVE` only).

## Schema

```text
ContractorWorkforceState:
  NOMINATED | PENDING_APPROVAL | ACTIVE | SUSPENDED | TERMINATED | BLACKLISTED
```

Migration: `20260528120000_contractor_workforce_state`

## Code

| Area | Path |
|------|------|
| Constants / transitions | `contractor-workforce-state.constants.ts` |
| Transition service | `contractor-workforce-state.service.ts` |
| Domain event stubs | `contractor-workforce-event-publisher.service.ts` |
| Audit catalog | `CONTRACTOR_WORKFORCE_STATE_CHANGED`, `CONTRACTOR_WORKFORCE_DOMAIN_EVENT` |
| Wired paths | `contractors.service` create (ACTIVE), deactivate → TERMINATED, legacy `isActive` patch |

## Out of scope

- `acquisitionModel` / nullable `supplierId`
- MTN LM/AM approval workflow
- HCM push, SNOW/Aveksa handlers
- Dedicated REST lifecycle endpoints (use transition service internally first)

## Next

Supplier-backed workforce transitions exposed via controlled API + portal UX; then independent acquisition ADR.
