# RBAC Drift Prevention

> This document defines the engineering invariants that prevent RBAC drift.
> Every PR that touches RBAC must satisfy ALL invariants.

## The 10 Invariants

| # | Invariant | Enforcement Mechanism | Status |
|---|---|---|---|
| 1 | Every `@Permissions('...')` decorator value exists in `PERMISSION_CATALOG` | CI: `permissions-catalog.spec.ts` → Decorator → Catalog alignment | ✅ Enforced |
| 2 | Every seeded role permission exists in `PERMISSION_CATALOG` | CI: `permissions-catalog.spec.ts` → Seed → Catalog alignment + runtime seed validation | ✅ Enforced |
| 3 | Every frontend permission constant exists in backend `PERMISSION_CATALOG` | CI: `permissions-drift.test.ts` → Backend ↔ Frontend sync | ✅ Enforced |
| 4 | Every domain controller endpoint has `@Permissions(...)` or `@Public()` | CI: `permissions-catalog.spec.ts` → Handler-level enforcement | ✅ Enforced |
| 5 | Every frontend route has a declared permission or explicit public exception | CI: (to be added in PR2) | ⏳ PR2 |
| 6 | Every sidebar item maps to the same permission as its route | CI: (to be added in PR2) | ⏳ PR2 |
| 7 | Every action button maps to the same permission as its backend endpoint | Manual review (to be codified in PR2) | ⏳ PR2 |
| 8 | System roles cannot be edited/deleted through admin APIs | Runtime: (to be enforced in PR3) | ⏳ PR3 |
| 9 | No role assignment can remove the last `CMS_ADMIN` | Runtime: (to be enforced in PR3) | ⏳ PR3 |
| 10 | Org-scoped roles must be enforced per-organization | Runtime: `PermissionsGuard` + `@RequiresOrgContext()` + E2E `rbac-matrix` suite | ✅ Enforced |

---

## CI Pipeline Requirements

### Backend CI

```bash
# 1. Permission catalog integrity (invariants 1, 2, 4)
npm run test:unit

# 2. Regenerate and verify (invariant 3)
npm run rbac:verify
```

### Frontend CI

```bash
# 3. Frontend ↔ Backend sync (invariant 3)
# Runs as part of frontend test suite
npm test -- --testPathPattern=permissions-drift
```

### Pre-merge Checklist

Before merging any RBAC-touching PR:

- [ ] `npm run rbac:check` passes (backend unit tests)
- [ ] `npm run rbac:verify` passes (generated files in sync)
- [ ] Frontend drift test passes
- [ ] No new raw permission strings in frontend code
- [ ] New permissions added to `permissions.constants.ts` first
- [ ] Seed updated if new roles need the permission
- [ ] Generator re-run if catalog changed

---

## Architecture

```
backend/src/core/auth/permissions.constants.ts    ← CANONICAL SOURCE OF TRUTH
       │
       ├──→ backend/prisma/seed.ts                ← validates at seed time
       ├──→ backend/src/domain/**/*.controller.ts  ← decorators reference catalog
       ├──→ backend/scripts/generate-permissions.ts ← generates ↓
       │
       ├──→ backend/src/core/auth/permissions.catalog.json  ← JSON export
       └──→ frontend/lib/permissions.generated.ts           ← frontend constants
                │
                └──→ frontend/lib/__tests__/permissions-drift.test.ts ← validates sync
```

**Key principle:** The backend `permissions.constants.ts` is the **single source of truth**. Everything else is derived.

---

## Adding a New Permission

1. Add it to `PERMISSIONS` in `backend/src/core/auth/permissions.constants.ts`
2. Add `@Permissions('resource:action')` to the controller handler
3. Update the seed if a role should include it
4. Run `npm run rbac:generate` to regenerate frontend constants + JSON
5. Run `npm run rbac:check` to verify all invariants
6. Commit the generated files alongside the source changes

---

## Deprecating a Permission

1. Remove the `@Permissions(...)` decorator from the controller
2. Remove from any seed role `permissions` arrays
3. Remove from `PERMISSIONS` in `permissions.constants.ts`
4. Run `npm run rbac:generate`
5. Run `npm run rbac:check`
6. Update the permission ledger: `docs/security/RBAC_PERMISSION_LEDGER.md`

---

## Org-Scope Enforcement

Org-scoped RBAC is **fully enforced** as of PR5:

- `PermissionsGuard` resolves `targetOrganizationId` via `@RequiresOrgContext()` decorator
- Scoped roles (`UserRole.organizationId != null`) only apply when the target matches
- Global roles (`UserRole.organizationId = null`) apply universally
- Mutation endpoints resolve org ownership from the database before authorization
- `AccessContext` propagates scope to service layer for row-level filtering

E2E validation: `test/rbac-matrix.e2e-spec.ts` (8 tests, all passing)
