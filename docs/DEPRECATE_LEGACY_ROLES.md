# Deprecating Legacy Roles (UserRole + UserLegalEntityAccess)

This doc describes how to retire the legacy **UserRole** and **UserLegalEntityAccess** models in favour of **RBAC v1.1 (RoleAssignment)** only, and what the impact is.

---

## Current state

- **UserRole** (`user_roles`): links User ↔ Role with no scope. Which legal entities a user can see is separate.
- **UserLegalEntityAccess** (`user_legal_entity_access`): links User ↔ LegalEntity for “can access this entity.”
- **RoleAssignment** (`role_assignments`): links User ↔ Role with **scope** (GLOBAL or LEGAL_ENTITY) and optional `legalEntityId`. One table for “who has what role where.”

Auth today: `AuthService.getUserContext()` uses **RoleAssignment first**; if the user has no RoleAssignment rows, it **falls back** to UserRole + UserLegalEntityAccess. So legacy is only used when a user has zero RoleAssignments.

---

## Clean deprecation steps

### Phase 1: Migrate data (no behaviour change yet)

1. **Run the existing backfill** so every user who has UserRole gets equivalent RoleAssignments:
   ```bash
   DATABASE_URL="postgresql://..." npx ts-node prisma/backfill-role-assignments.ts
   ```
   - Backfill creates RoleAssignment rows from (UserRole × UserLegalEntityAccess), and GLOBAL for TENANT_ADMIN/PLATFORM_SUPERADMIN.
   - Users who only have UserRole and no legal entity access are skipped (no scope); decide if they should get a GLOBAL assignment or be assigned to a default entity.

2. **Verify** no user relies on legacy-only:
   - Query users who have `user_roles` but no `role_assignments`; either run backfill with adjusted rules or create RoleAssignments manually.
   - Ensure demo/admin users have the intended RoleAssignments (e.g. demo user has TENANT_ADMIN + PAYROLL_CLERK + SARS_OFFICER; add PLATFORM_SUPERADMIN or equivalent if you want “full access” without legacy ADMIN).

3. **Optional:** Add a small script or one-off query to **report** users still only in `user_roles` / `user_legal_entity_access` so you can fix or backfill them.

---

### Phase 2: Code – use only RoleAssignment

1. **Auth (critical)**  
   - **File:** `src/modules/auth/auth.service.ts`  
   - **Change:** In `getUserContext()`, remove the `else` branch that reads `userRole.findMany` and `userLegalEntityAccess.findMany`.  
   - **Effect:** If a user has no RoleAssignment rows, they get empty `roles`, `permissions`, and `legalEntityAccess` (and will fail permission checks). So Phase 1 must guarantee every active user has ≥1 RoleAssignment.

2. **Compliance report**  
   - **File:** `src/modules/compliance/compliance.service.ts`  
   - **Change:** In `generateUserAccessReport()`, load users with `roleAssignments` (include `role` and role’s `permissions`) instead of `userRoles`.  
   - **Effect:** “User access” report shows roles/permissions from RoleAssignment only; you can optionally add scope (GLOBAL vs LEGAL_ENTITY + legalEntityId) to the report.

3. **Approvals – role-based approver**  
   - **File:** `src/modules/approvals/approvals.service.ts`  
   - **Change:** In `findApproverForLevel()` (or equivalent), when resolving by `level.approverRoleId`, replace `prisma.userRole.findFirst({ where: { roleId } })` with `prisma.roleAssignment.findFirst({ where: { roleId }, include: { user: true } })`.  
   - **Optional:** Restrict by legal entity (e.g. same `legalEntityId` as the approval context) so you pick an approver scoped to that entity.  
   - **Effect:** Role-based approval steps resolve using RoleAssignment; no dependency on UserRole.

4. **Seed**  
   - **File:** `prisma/seed.ts`  
   - **Change:**  
     - Remove `prisma.userRole.create({ userId: demoUser.id, roleId: ADMIN })`.  
     - Remove `prisma.userLegalEntityAccess.create({ userId: demoUser.id, legalEntityId })`.  
   - **Reason:** Demo user already has RoleAssignments (TENANT_ADMIN GLOBAL, PAYROLL_CLERK + SARS_OFFICER LEGAL_ENTITY). If you need “full access” for demo, give that user a RoleAssignment to **PLATFORM_SUPERADMIN** (GLOBAL) instead of relying on legacy ADMIN.

---

### Phase 3: Stop writing to legacy (optional)

- Search for any other `prisma.userRole.create` / `userRole.update` / `userLegalEntityAccess.create` (e.g. in admin/iam flows).  
- Replace with RoleAssignment (and, if needed, scope + legalEntityId).  
- Ensure no new UserRole or UserLegalEntityAccess rows are created after this.

---

### Phase 4: Remove legacy models (later)

1. **Schema:** Remove `UserRole` and `UserLegalEntityAccess` from `prisma/schema.prisma`, and remove their relations from `User`, `Role`, and `LegalEntity`.  
2. **Migration:** Add a migration that drops `user_roles` and `user_legal_entity_access` (after Phase 1–3 and a period of no writes).  
3. **Code:** Remove backfill script or keep it only for historical reference.  
4. **Prisma:** Run `prisma generate`; fix any remaining references (there should be none if Phase 2–3 are done).

---

## Impact summary

| Area | Impact |
|------|--------|
| **Auth / JWT** | Users with **no** RoleAssignment get empty roles/permissions/legalEntityAccess and will be denied. Must complete Phase 1 so every active user has RoleAssignments. |
| **Guards / audit** | No change: they use the resolved `user.roles` / `user.permissions` from context; once auth only uses RoleAssignment, behaviour is unchanged. |
| **Compliance report** | Report must read from `roleAssignments` instead of `userRoles`; can expose scope (GLOBAL vs LEGAL_ENTITY) for clarity. |
| **Approvals** | Role-based approver lookup must use RoleAssignment; consider legal-entity scope when picking an approver. |
| **Seed / demo** | Demo user must get all needed access via RoleAssignment only (e.g. PLATFORM_SUPERADMIN or TENANT_ADMIN + PAYROLL_CLERK + SARS_OFFICER). |
| **Enterprise module** | Uses `(prisma as any).userRoleAssignment` (different concept/table). Out of scope for this deprecation; leave as-is unless that module is refactored to use the same Prisma `RoleAssignment` model. |

---

## Risk and rollback

- **Risk:** If Phase 1 is incomplete, some users lose access when the legacy fallback is removed (Phase 2).  
- **Mitigation:** Run backfill, then verify in staging that every active user has ≥1 RoleAssignment and that login + permission checks work.  
- **Rollback:** Revert the auth change (restore the legacy fallback in `getUserContext`) until all users are migrated.

---

## Checklist

- [ ] Run `backfill-role-assignments.ts` and verify no users are “legacy only”.
- [ ] Optionally add PLATFORM_SUPERADMIN (or ADMIN-as-RoleAssignment) for demo user if full access is required.
- [ ] Remove legacy fallback in `auth.service.ts` `getUserContext()`.
- [ ] Switch compliance `generateUserAccessReport()` to `roleAssignments`.
- [ ] Switch approvals role-based approver lookup to `roleAssignment.findFirst`.
- [ ] Update seed: stop creating UserRole and UserLegalEntityAccess.
- [ ] (Later) Remove UserRole and UserLegalEntityAccess from schema and drop tables (Phase 4).
