# Dashboard Access Matrix QA — Findings

**Date:** 2025-03-01  
**Status:** ✅ All 35 checks passed

## Scope

Verified for each role:

- **Visible vs hidden widgets** (API 200 vs 403)
- **Scoped vs full data** (LEGAL_ENTITY users see only their entities)

## Roles Tested

| Role | Scope | User | Visible Widgets | Hidden Widgets |
|------|-------|------|-----------------|----------------|
| TENANT_ADMIN (GLOBAL) | GLOBAL | admin@demo.workforce | All 7 | — |
| TENANT_ADMIN (LEGAL_ENTITY) | LEGAL_ENTITY | tenantadmin@demo.workforce | Setup, Workforce, Data Imports, HR Export, Pending | Payroll, Compliance |
| PAYROLL_CLERK | LEGAL_ENTITY | payrollclerk@demo.workforce | Setup, Workforce, Payroll | Compliance, Data Imports, HR Export, Pending |
| HR_ADMIN | LEGAL_ENTITY | hr@demo.workforce | Setup, Workforce, HR Export Readiness | Payroll, Compliance, Data Imports, Pending |
| INTEGRATION_IGA | GLOBAL | iga@demo.workforce | Setup, HR Export | Workforce, Payroll, Compliance, Data Imports, Pending |

## Findings

### 1. Scope rule: Empty legalEntityAccess = no data ✅

**Rule implemented:** Empty `legalEntityAccess` returns zeros/empty, **not** platform-wide data.

- **GLOBAL** role users: `legalEntityAccess` is populated with all entities by auth service.
- **LEGAL_ENTITY** role users: `legalEntityAccess` contains assigned entities.
- **No scope / bad data:** Empty array → dashboard returns empty/zero responses.

### 2. Scoped counts ✅

LEGAL_ENTITY users see only their legal entity data. Verified: `employees=10, employments=10` for demo entity.

### 3. Scope regression tests ✅

Unit tests in `dashboard.service.spec.ts` verify:

- **EMPTY** (`legalEntityAccess = []`): endpoints return zeros/empty (not 403, not platform-wide)
- **GLOBAL** (`legalEntityAccess = all entities`): endpoints return platform-wide counts (superadmin path)

Run as part of `npm run qa:dashboard-access`.

### 4. Permission notes

- **HR_ADMIN:** Now includes `hr:read` in seed — HR Export Readiness visible. Re-run `npm run db:seed` to apply.
- **approval:approve:** Generic workflow permission; domain-specific `payrun:approve` used for dashboard. Consider normalizing later.

### 5. Empty dashboard state

Users with no widget permissions see: *"No dashboard widgets available for your role."* (Frontend verified in Dashboard.tsx.)

## How to run

```bash
# Runs empty-scope unit tests + E2E access matrix (backend must be running)
API_BASE=http://localhost:4000/v1 npm run qa:dashboard-access
```

Dashboard endpoints log scope state for debugging: `endpoint userId=... scope=GLOBAL|LEGAL_ENTITY|EMPTY leCount=N`.

## v1 completeness checklist

| Item | Status |
|------|--------|
| Each widget hides correctly | ✅ |
| Each endpoint 403s when called without permission | ✅ |
| Scoped users only see their legal entity data | ✅ |
| Global users see full data | ✅ |
| Empty-dashboard state renders cleanly | ✅ |
