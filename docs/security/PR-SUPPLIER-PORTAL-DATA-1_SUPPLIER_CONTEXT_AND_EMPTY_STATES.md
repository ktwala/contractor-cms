# PR-SUPPLIER-PORTAL-DATA-1 — Supplier context and empty states

**Status:** `COMPLETE`
**Type:** Governance / data truthfulness (not cosmetic UI)

## Objective

Supplier portal pages show **real scoped data** when membership exists, **neutral empty states** when data is absent, **access warnings** when membership is missing, and **red banners only** for genuine API/server failures.

## Authority chain

```text
authenticated user → active SupplierMembership → supplierScopeId → scoped queries
```

## Backend contract

| Route | Behaviour |
|-------|-----------|
| `GET /supplier-portal/profile` | Envelope; `data: null` + `empty_state: NO_PROFILE` when row missing |
| `GET /supplier-portal/contractors` | Envelope; `empty_state: NO_CONTRACTORS` when total = 0 |
| `GET /supplier-portal/timesheets` | Envelope; `empty_state: NO_TIMESHEETS` when total = 0 |
| `GET /supplier-portal/dashboard` | Aggregated counts (profile / contractors / timesheets) |
| No membership | `403` + `code: SUPPLIER_MEMBERSHIP_REQUIRED` |

Envelope shape:

```json
{
  "status": "ok",
  "supplier_context": {
    "supplier_id": "…",
    "organization_id": "…"
  },
  "data": [],
  "empty_state": "NO_CONTRACTORS",
  "pagination": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

## Frontend banner law

| State | UI |
|-------|-----|
| No membership | Neutral `PortalEmptyState` — **No supplier linked** |
| Empty data (200 envelope) | Neutral copy from `SUPPLIER_PORTAL_EMPTY_COPY` |
| 5xx / network / 401 | Red banner |
| 403 membership | Access warning (not red server error) |

## Key files

| Layer | Path |
|-------|------|
| Errors / code | `backend/src/domain/supplier-portal/supplier-portal.errors.ts` |
| Envelope | `backend/src/domain/supplier-portal/supplier-portal-response.util.ts` |
| Service | `backend/src/domain/supplier-portal/supplier-portal.service.ts` |
| Parser | `frontend/lib/supplier-portal-response.ts` |
| Dashboard widgets | `frontend/components/dashboard/SupplierPortalDashboardSummary.tsx` |
| Drift | `scripts/supplier-portal-drift-check.ts` |

## Verification

```bash
npm run drift:supplier-portal
cd backend && npm run test:e2e -- --testPathPattern=supplier-portal-data
cd frontend && npm test -- --testPathPatterns=supplier-portal
```

## Acceptance matrix

| Persona | Expected |
|---------|----------|
| `supplier.admin@` + membership + no contractors | Page loads; **No contractors assigned to your supplier yet.** |
| Portal user without `supplierId` | **No supplier linked** |
| `supplier.admin@` + data | Real profile / contractors / timesheets |
| `admin@` (no membership) | Internal CMS shell; portal API `403` + code |
| Backend outage | Red error banner |

## Locked stack (predecessors)

```text
PR-UI-TOKENS-1 · PR-UI-TOKENS-2 · PR-FINANCE-RBAC-1 · PR-SHELL-NAV-CONTEXT-1
PR-CMS-RUNTIME-HARDENING-1 · PR-CMS-FORMS-1 · PR-CMS-FORMS-1A
```

## Related follow-up

- `PR-PDP-TEST-REPAIR-1` — Next build spec isolation (separate; see `PR-PDP-TEST-REPAIR-1_NEXT_BUILD_SPEC_ISOLATION.md`)
