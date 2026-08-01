# RBAC v1.1 — Scoped Role Assignments (RoleAssignment per Legal Entity)

## Purpose
RBAC v1.1 upgrades role assignment from:
- Global roles (`UserRole`) + separate scope (`UserLegalEntityAccess`)
to:
- Scoped role assignments (`RoleAssignment`) where scope is intrinsic to the assignment.

This enables: "User is PAYROLL_CLERK for LE-A, PAYROLL_APPROVER for LE-B".

---

## Model
### RoleAssignment
Each assignment links:
- user → role → scopeType → optional legalEntityId

#### Scope types
- **GLOBAL**: applies to all legal entities (use sparingly)
- **LEGAL_ENTITY**: applies only to one legal entity (default for operational roles)

**Policy:** Operational roles should default to LEGAL_ENTITY; only governance/break-glass roles may be GLOBAL.

---

## Authorization runtime behavior
### Permissions
Permissions remain code-based (`payrun:approve`, `sars:emp201:submit`).

### Effective user context in JWT / request user
From RoleAssignment we derive:
- roles (list)
- permissions (union)
- legalEntityAccess (union of scoped entities; GLOBAL expands to all)

Existing guards and service scoping helpers continue using:
- `user.permissions`
- `user.legalEntityAccess`

---

## Migration plan (no downtime)
### Phase 1 — Dual-read
Auth builds context from RoleAssignment if present; otherwise uses legacy UserRole + UserLegalEntityAccess.

### Phase 2 — Backfill
Run `npx tsx prisma/backfill-role-assignments.ts`:
- For each (UserRole × UserLegalEntityAccess) create LEGAL_ENTITY RoleAssignment
- Optionally convert selected roles to GLOBAL (TENANT_ADMIN, PLATFORM_SUPERADMIN)

### Phase 3 — Cutover
Stop writing legacy tables; write only RoleAssignment.

### Phase 4 — Cleanup (optional)
Deprecate or remove legacy tables after validation period.

---

## Audit logging updates (Step 2.5 compatibility)
Audit events SHOULD include:
- `legalEntityId` (when determinable from request params, body, query, or `x-legal-entity-id` header)
- `roleAssignments` (optional compact list, when available on user context)

This applies to:
- PERMISSION_DENIED
- SOD_DENIED
- PLATFORM_SUPERADMIN_ACCESS

---

## QA additions for v1.1
Test same user with different roles per entity:
- LE-A: PAYROLL_CLERK can create/submit, cannot approve
- LE-B: PAYROLL_APPROVER can approve, cannot create

Ensure permission + entity scoping enforcement remains consistent.

---

## References
- RBAC v1.0 spec: `docs/RBAC_SPEC.md`
- Governance notes: `docs/RBAC_GOVERNANCE.md`
