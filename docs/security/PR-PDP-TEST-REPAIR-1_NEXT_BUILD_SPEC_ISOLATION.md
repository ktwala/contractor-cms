# PR-PDP-TEST-REPAIR-1 — Next build spec isolation

**Status:** `COMPLETE`

## Problem

PDP settings UI lived under `frontend/pages/settings/`. Next.js treated those modules as Pages Router entries and `next build` failed because they export named components only (no `default` export). A colocated `.spec.tsx` made the failure worse.

## Fix

- Moved `PdpActivationConsole.tsx` and `PdpExceptionQueue.tsx` to `frontend/components/pdp/`
- Moved tests to `frontend/__tests__/pdp-activation-console.spec.tsx` (removed `pages/**/*.spec.tsx`)
- Updated App Router imports in `app/settings/pdp-activation` and `app/settings/pdp-exceptions`
- No CMS, finance, shell, or supplier portal logic touched

## Gate fixes surfaced during `next build` (types only)

Strict type-check also required one-line fixes outside PDP (no behaviour change):

- `app/sponsor-tasks/page.tsx` — `showToast(type, message)` argument order
- `lib/hooks.ts` — `useRef` initial values (React 19)
- `components/ui/skeleton.tsx` — optional `style` prop
- `components/ui/audit-detail-drawer.tsx` — `unknown` metadata render guard
- `lib/supplier-portal-response.ts` / `app/suppliers/page.tsx` — envelope generic casts

## Verification

```bash
npm run drift:cms-forms
npm run drift:supplier-portal
cd backend && npm run test:e2e -- --testPathPatterns=supplier-portal
cd frontend && npm test -- --testPathPatterns="cms-forms-drift|supplier-portal|pdp-activation-console"
cd frontend && npm run build
```
