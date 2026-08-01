# PR-WORKFORCE-TIMELINE-FOUNDATION-1 — Workforce business timeline

**Status:** COMPLETE  
**Builds on:** [`PR-WORKFORCE-OPS-REVIEW-1.md`](./PR-WORKFORCE-OPS-REVIEW-1.md), [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md)

## Guardrail

Three different truths — do not collapse them:

| Artifact | Question |
|----------|----------|
| **Workforce history** (`ContractorWorkforceHistory`) | How did this contractor's workforce relationship evolve? |
| **Audit** | Who changed the database? |
| **Domain events** | What should downstream systems react to? |

Workforce history stores **transitions** (`fromState → toState`), not `eventType`. Labels like "Submitted for review" are **derived** at read time.

## Write path (transaction order)

```text
Update workforceState
        ↓
Persist ContractorWorkforceHistory   ← business truth (same tx)
        ↓
Audit                               ← operational evidence
        ↓
Domain event stub                   ← integration publication
```

## Schema

```text
ContractorWorkforceHistory
  fromState?          — null on intake (Nominated)
  toState
  occurredAt
  effectiveAt?
  actorUserId
  reason
  source              — authority channel
  metadata
```

### Source authority

`SUPPLIER_PORTAL` | `OPS` | `HCM_BOOTSTRAP` | `HCM_SYNC` | `SYSTEM` | `LEGACY_BRIDGE`

## API

```http
GET /contractors/:id/workforce-history
Permission: contractors:read
```

Returns ordered timeline with derived `transitionLabel`.

## Wired write paths (v1)

- Supplier/internal **nominate** → `null → NOMINATED` (`SUPPLIER_PORTAL` or `OPS`)
- **Workforce transitions** → `fromState → toState` (`OPS` default)
- **Legacy isActive bridge** → `LEGACY_BRIDGE`
- **HCM promote/materialize** → `null → ACTIVE` (`HCM_BOOTSTRAP`) — see [`PR-WORKFORCE-HCM-HISTORY-1.md`](./PR-WORKFORCE-HCM-HISTORY-1.md)

## UI

Ops review expandable row shows **Workforce timeline** (not audit).

## CQRS note

- **Write model:** transition + history row
- **Read model (future):** unified Identity/Timeline aggregating workforce + access + governance contributors

## Out of scope

- Backfill pre-existing contractors
- Reject/send-back workflow
- RDS / ServiceNow

## Next

Supplier portal timeline read — [`PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md`](./PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md) **COMPLETE**; `HCM_SYNC` history when ongoing sync transitions are modeled.
