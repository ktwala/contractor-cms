-- Remove ADMIN role and enum value (no longer seeded; use canonical roles or PLATFORM_SUPERADMIN).
-- Order: clear references, then delete role, then drop enum value.

-- 1. Clear approval_levels that reference the ADMIN role (optional FK)
UPDATE "approval_levels"
SET "approver_role_id" = NULL
WHERE "approver_role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN');

-- 2. Delete dependent rows (role_assignments, role_permissions, user_roles)
DELETE FROM "role_assignments"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN');

DELETE FROM "role_permissions"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN');

DELETE FROM "user_roles"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN');

-- 3. Delete the ADMIN role row
DELETE FROM "roles"
WHERE "name" = 'ADMIN';

-- 4. Recreate RoleName enum without ADMIN (PostgreSQL has no DROP VALUE for enums)
ALTER TYPE "RoleName" RENAME TO "RoleName_old";
CREATE TYPE "RoleName" AS ENUM ('PAYROLL_MANAGER','APPROVER','HR_ADMIN','TENANT_ADMIN','PAYROLL_CLERK','PAYROLL_APPROVER','FINANCE_APPROVER','SARS_OFFICER','SARS_APPROVER','AUDITOR','AUDITOR_READONLY','EMPLOYEE_SELF_SERVICE','INTEGRATION_IGA','PLATFORM_SUPERADMIN');
ALTER TABLE "roles" ALTER COLUMN "name" TYPE "RoleName" USING "name"::text::"RoleName";
DROP TYPE "RoleName_old";
