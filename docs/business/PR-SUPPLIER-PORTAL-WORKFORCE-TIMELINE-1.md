# PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1 — Supplier portal workforce timeline (read)

**Status:** COMPLETE  
**Builds on:** [`PR-WORKFORCE-TIMELINE-FOUNDATION-1.md`](./PR-WORKFORCE-TIMELINE-FOUNDATION-1.md), [`PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md`](./PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md)

## Guardrail

> Supplier users may see the workforce narrative for their own workers; they may **not** advance workforce state.

## Scope

- Read-only workforce timeline on supplier portal contractor detail
- Membership-scoped: only contractors belonging to the active supplier
- Reuses `ContractorWorkforceHistoryService` (same business narrative as ops)
- Portal response omits ops-only fields (`actorUserId`, `reason`, `metadata`, `organizationId`)
- No supplier actions, activation, RDS workflow, or HCM sync transitions

## API

| Method | Path | Permission |
|--------|------|------------|
| `GET` | `/supplier-portal/contractors/:id/workforce-history` | `supplier-contractors:read` |

Returns standard supplier portal envelope with `data: WorkforceHistoryEntry[]` (portal subset).

## UI

- Contractor detail page: **Workforce timeline** panel (read-only)
- Shared `ContractorWorkforceTimeline` component with ops review queue

## Entry paths visible to suppliers

```text
Supplier nomination:  null → NOMINATED  (source: SUPPLIER_PORTAL)
HCM bootstrap:        null → ACTIVE     (source: HCM_BOOTSTRAP)
Ops transitions:      e.g. NOMINATED → PENDING_APPROVAL → ACTIVE (source: OPS)
```

## Out of scope

- Supplier-side workforce transitions
- Client `GET /contractors/:id/workforce-history` for supplier users (403 — portal route only)
- HCM sync history (`HCM_SYNC` reserved)

## Next

Workforce plane baseline proof — [`PR-WORKFORCE-E2E-UAT-1.md`](./PR-WORKFORCE-E2E-UAT-1.md) **COMPLETE**; then reject/send-back, blacklist, or RDS mapping.
