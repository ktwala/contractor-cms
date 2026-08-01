# PR-CMS-FORMS-1 — Real supplier forms and display defaults

**Status:** `COMPLETE`  
**Follow-up:** `PR-CMS-FORMS-1A` — docs, contract CSV parity, drift guards (this file + `scripts/cms-forms-drift-check.ts`)

## Goal

Replace scaffold supplier modals and fix user-facing display defaults on contracts and engagements before deeper supplier portal work.

## Scope delivered

### Supplier forms (`/suppliers`)

| Behaviour | Implementation |
|-----------|----------------|
| Add supplier | `SupplierFormModal` → `api.createSupplier` |
| Edit supplier | Preload via `api.getSupplier`, save via `api.updateSupplier` |
| Validation | Name (company or individual), type, email, status, country; phone optional |
| Cancel / close | Resets form state |
| Errors | Toast with API message |

**Key files:** `frontend/components/suppliers/SupplierFormModal.tsx`, `frontend/app/suppliers/page.tsx`

### Display defaults

| Route | Field | Rule |
|-------|-------|------|
| `/contracts` | Type | `Not classified` (never raw `unknown`) |
| `/contracts` | Rate | `—` when missing/invalid (never `RNaN`) |
| `/contracts` | Validity | `Missing End Date` when factual (unchanged) |
| `/engagements` | Title | `Untitled engagement` only when empty |
| `/engagements` | Rate | `—` when missing/invalid |

**Shared helpers:** `frontend/lib/display-format.ts`

### Contract CSV export (1A)

`exportContractsToCSV` uses `formatContractTypeLabel` and `formatAmountForCsvExport` so exported rows match list UI rules.

## Drift guards (1A)

| Guard | Mechanism |
|-------|-----------|
| No supplier form placeholder | `scripts/cms-forms-drift-check.ts` |
| No `RNaN` in UI/CSV paths | Jest `cms-forms-drift.spec.ts` + `currencyDisplayWouldShowNan` |

Run locally:

```bash
npm run drift:cms-forms
cd frontend && npm test -- --testPathPatterns=cms-forms-drift
```

## Acceptance

- [x] Add supplier creates a row or shows API error
- [x] Edit supplier updates the row with preloaded fields
- [x] No placeholder text (`Supplier form would go here`, `Use react-hook-form for full implementation`)
- [x] No `RNaN` on `/contracts` or `/engagements`
- [x] No raw `unknown` contract type in UI or contract CSV

## Out of scope (separate PRs)

| PR | Topic |
|----|--------|
| `PR-PDP-TEST-REPAIR-1` | `pages/settings/PdpActivationConsole.spec.tsx` breaking `next build` |
| `PR-SUPPLIER-PORTAL-DATA-1` | Supplier portal context and empty states |
| `PR-FINANCE-RBAC-1` | Financial field redaction (locked) |

## Related

- `docs/security/PR-CMS-RUNTIME-HARDENING-1_NULL_SAFE_PAGES_AND_SUPPLIER_CONTEXT.md` — null-safe list pages (predecessor)
- `frontend/lib/safe-string.ts` — low-level null-safe string/date helpers
