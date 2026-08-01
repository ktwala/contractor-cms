# Recruitment RBAC Execution Checklist

## Phase 1 — Canonicalization
- [x] Canonical backend permission registry created (`P.RECRUITMENT_*` in `src/common/constants/permissions.ts`)
- [x] Frontend permission constants created (mirror in `admin-portal/src/constants/permissions.ts`)
- [x] Recruitment surface capability registry created (`admin-portal/src/lib/permissions/recruitmentSurfaceRegistry.ts`)
- [x] Controller migrated from inline strings to `P.*` constants

## Phase 2 — Guard Alignment
- [x] Sidebar Talent group uses `recruitment:requisitions:view` (not `iam:users:manage`)
- [x] Page-level routes use only `:view` permissions for page entry
- [x] Mutation actions use exact action permissions
- [ ] Frontend page components hard-check permissions (not just nav visibility)

## Phase 3 — Role Alignment
- [x] TALENT_ADMIN seeded with full recruitment access
- [x] RECRUITER seeded with operational pipeline permissions
- [x] HIRING_MANAGER seeded with approval/decision permissions
- [x] INTERVIEWER seeded with narrow view/feedback permissions
- [x] HR_OPERATIONS seeded with post-offer onboarding permissions
- [x] TENANT_ADMIN given full recruitment access
- [x] PLATFORM_SUPERADMIN inherits all (automatic via `PERMISSIONS.map()`)

## Phase 4 — Drift Enforcement
- [x] Permission drift test blocks banned variants (`recruitment-permission-drift.spec.ts`)
- [x] Permission registry consistency test validates all four layers (`recruitment-permission-registry.spec.ts`)
- [x] CI required-check enforcement (`.github/workflows/ci.yml`)
- [ ] PR template updated with recruitment anti-drift checklist

## Phase 5 — Testing
- [x] Backend permission decorator tests implemented (registry spec)
- [x] Backend authz behavior tests — role allow/deny decisions (`recruitment-authz-behavior.spec.ts`)
- [x] Frontend/backend parity tests implemented (registry spec)
- [x] Surface registry coverage test implemented (registry spec)
- [x] Seed file coverage test implemented (registry spec)
- [x] Frontend surface visibility tests — role vs surface allow/deny (`recruitment-surface-visibility.spec.ts`)
- [x] Playwright role-route enforcement tests (`test/playwright/recruitment-rbac.spec.ts`)

---

## PR Checklist

When a PR touches any recruitment capability, role, route, page guard, action guard, seed, or test:

- [ ] Backend `P.*` registry updated (`src/common/constants/permissions.ts`)
- [ ] Frontend `P.*` constants updated (`admin-portal/src/constants/permissions.ts`)
- [ ] Surface capability registry updated (`admin-portal/src/lib/permissions/recruitmentSurfaceRegistry.ts`)
- [ ] Role seed mappings updated (`prisma/seed.ts`)
- [ ] RBAC reconciliation doc updated (`docs/RBAC_RECRUITMENT_ROLE_RECONCILIATION_STATUS.md`)
- [ ] This execution checklist updated
- [ ] Backend authz tests updated
- [ ] Frontend permission/render tests updated
- [ ] `recruitment-permission-registry.spec.ts` passes
- [ ] `recruitment-permission-drift.spec.ts` passes

---

## Banned Drift Patterns

The following patterns are explicitly blocked by CI tests:

| Pattern | Reason |
|---|---|
| `recruitment.requisitions.*` (dots) | Wrong separator, must use colons |
| `talent:requisitions:*` | Wrong module prefix |
| `hr:recruitment:*` | Wrong module prefix |
| `hiring:*` | Non-canonical prefix |
| Inline `'recruitment:...'` strings outside constants files | Must use `P.*` constants |
