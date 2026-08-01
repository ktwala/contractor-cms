# Data-Backed Page — PR Checklist

Use this checklist when reviewing any pull request that adds or modifies a page
that loads data from a backend API.

## Required checks

- [ ] Uses `classifyPageState()` or `classifyError()` from `src/utils/pageState.ts`
- [ ] Handles all five states: **loading**, **error**, **blocked**, **empty**, **ready**
- [ ] Separates **load errors** (drive page state) from **action errors** (inline `Banner`)
- [ ] Uses `PageStateView` or the individual `PageErrorView` / `PageBlockedView` / `PageEmptyView` shared components
- [ ] Does **not** string-match backend error messages for state decisions
- [ ] Maps backend structured error codes via the `BLOCKED_CODES` registry
- [ ] Passes `page` and `module` props to `PageStateView` for telemetry

## Telemetry

- [ ] If using `PageStateView`, telemetry is automatic (hook runs inside the component)
- [ ] If using early-return patterns with `PageBlockedView` / `PageErrorView`, calls `usePageStateTelemetry()` directly

## New blocked codes

If the PR introduces a new business-rule or readiness error:

- [ ] Backend throws `ForbiddenException({ code: 'MY_CODE', message: '...' })`
- [ ] Frontend adds an entry to `BLOCKED_CODES` in `src/utils/pageState.ts`
- [ ] Updates `docs/STRUCTURED_ERROR_CODES.md` with the new code

## Reference

- [Page State Contract](./PAGE_STATE_CONTRACT.md)
- [Structured Error Codes](../../docs/STRUCTURED_ERROR_CODES.md)
- [Canonical Example](./examples/DATA_PAGE_TEMPLATE.tsx)
- [Visual Fixtures](http://localhost:5173/dev/page-states) (local dev only)
