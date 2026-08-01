# PR-CMS-RUNTIME-HARDENING-1 — Null-safe pages and supplier context

## Null-safety (frontend)

- `frontend/lib/safe-string.ts` — `safeLower`, `safeReplace`, `safeFormatDate`, `safeIsoDatePart`
- `/contracts` and `/engagements` — no `.replace()` / `.toLowerCase()` / date formatting on nullable API fields without defaults

## Supplier portal context

- **Fix:** `frontend/lib/api-supplier-portal.ts` used invalid default import; API client is a named export (`{ api }`).
- **Backend:** `PermissionsGuard` sets `supplierScopeId` when membership exists and route is `/supplier-portal/*` or user is non-global.
- **Frontend:** `useSupplierPortalGate` refreshes profile, checks `user.supplierId`, shows “No supplier linked” instead of a red API error when membership is missing.

## Acceptance

| Route | Expected |
|-------|----------|
| `/contracts` | Loads when `contract.type` is missing |
| `/engagements` | Loads when `title` or `contractNumber` is missing |
| `/supplier-portal/profile` | Profile or truthful empty state |
| `/supplier-portal/contractors` | Scoped list or empty state |
| `/supplier-portal/timesheets` | Scoped list or empty state |
| Error banners | Real server/API failures only |
