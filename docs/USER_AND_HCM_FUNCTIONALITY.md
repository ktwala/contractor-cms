# User Information & HCM Functionality — Current State

This document summarizes what exists today for **user information** and **HCM (Human Capital Management)** from both **UI** and **REST API** perspectives.

---

## Two Distinct Concepts

| Concept | Purpose | Data Model |
|--------|---------|------------|
| **User** | Platform identity: login, IAM, roles, permissions, audit. Who can access the system. | `User` (auth, `UserRole`, `RoleAssignment`, `UserLegalEntityAccess`) |
| **Employee** | HCM/payroll person: headcount, employment, compensation, payslips. Who gets paid. | `Employee`, `Employment`, `Compensation`, `BankAccount`, `TaxProfile`, etc. |

A **User** can be linked to at most one **Employee** via `Employee.userId`. That link is required for self-service (payslips, profile, tax certificates).

---

## 1. User (Platform Identity / IAM)

### REST API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `v1/auth/login` | Login with email/password; returns JWT + user summary (id, email, name, roles, permissions, legal_entity_access) | None |
| `GET`  | `v1/auth/me`    | Current user identity, roles, permissions, legal entity access | JWT, `auth:read` |

**Login response** includes: `user_id`, `email`, `first_name`, `last_name`, `roles[]`, `permissions[]`, `legal_entity_access[]`. No dedicated “list users” or “create user” endpoint exists in the main app; user management is only via **Enterprise** RBAC endpoints below.

**Enterprise (RBAC) — under `v1` prefix:**  
Base path is `api/enterprise` in code but mounted under the same app; confirm actual base (e.g. `v1/api/enterprise` or `/api/enterprise` depending on global prefix).

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `api/enterprise/users/:userId/roles` | Assign role to user (role_id, legal_entity_id, effective_from, effective_to) | `admin:users:manage` |
| `GET`  | `api/enterprise/users/:userId/roles` | Get roles for a user | `admin:users:view` |
| `GET`  | `api/enterprise/users/:userId/permissions` | Get effective permissions for a user (optional legal_entity_id) | `admin:users:view` |
| `GET`  | `api/enterprise/permissions` | List all permissions (optional category) | `admin:roles:view` |
| `GET`  | `api/enterprise/roles/:roleId` | Get role details | `admin:roles:view` |
| `POST` | `api/enterprise/roles` | Create role | `admin:roles:create` |
| `POST` | `api/enterprise/roles/:roleId/permissions` | Assign permissions to role | `admin:roles:manage` |
| `POST` | `api/enterprise/permissions` | Create permission | `admin:permissions:create` |

There is **no REST API** for:

- Listing platform users (e.g. `GET /users`)
- Creating/updating/deactivating users (e.g. `POST /users`, `PATCH /users/:id`)

So “user information” from an IAM perspective is: **login**, **me**, and **role/permission assignment** for an existing user by ID.

### UI

- **Admin portal**
  - **Login** (`/login`): calls `POST /auth/login`, stores token and role; no user list or user CRUD.
  - **Roles Management** (`/enterprise/roles`): **mock data only** — hardcoded roles (Super Admin, HR Manager, etc.); does **not** call `api/enterprise/roles` or user/role APIs.
- **Employee portal**
  - **Login** and **AuthContext**: use `POST /auth/login` and `GET /auth/me` for identity; no user management UI.

---

## 2. Employee (HCM / Payroll Person)

### REST API

All under global prefix `v1` unless noted.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `v1/employees` | Create employee (min payload: employee_no, first_name, last_name, hire_date, etc.) | `employee:write` |
| `GET`  | `v1/employees` | List employees (query: q, limit, etc.); paginated | `employee:read` |
| `GET`  | `v1/employees/:employee_id` | Get one employee | `employee:read` |
| `PATCH`| `v1/employees/:employee_id` | Update employee (limited fields) | `employee:write` |
| `POST` | `v1/employees/:employee_id/employments` | Add employment (legal entity, pay group, country, job_title, effective_from) | `employment:write` |
| `GET`  | `v1/employees/:employee_id/employments` | List employment history | `employment:read` |
| `GET`  | `v1/employees/:employee_id/compensation` | List compensation history (effective-dated) | `compensation:read` |
| `POST` | `v1/employees/:employee_id/compensation` | Add compensation record | `compensation:write` |
| `GET`  | `v1/employees/:employee_id/bank-accounts` | List bank accounts (masked) | `bank_account:read` |
| `POST` | `v1/employees/:employee_id/bank-accounts` | Add bank account | `bank_account:write` |
| `GET`  | `v1/employees/:employee_id/tax-profile` | List tax profile history | `tax_profile:read` |
| `POST` | `v1/employees/:employee_id/tax-profile` | Add tax profile | `tax_profile:write` |
| `GET`  | `v1/employees/:employee_id/recurring-inputs` | List recurring inputs | `recurring_input:read` |
| `POST` | `v1/employees/:employee_id/recurring-inputs` | Add recurring input | `recurring_input:write` |
| `DELETE`| `v1/employees/:employee_id/recurring-inputs/:id` | Deactivate recurring input | `recurring_input:write` |

**Note:** The seeded permissions in `prisma/seed.ts` (RBAC spec) do **not** include `employee:read`, `employee:write`, `compensation:*`, `bank_account:*`, `tax_profile:*`, `employment:*`, or `recurring_input:*`. Only roles that get “all” permissions (e.g. ADMIN) can call these today unless you add these permission codes to the seed and assign them to roles.

### UI

- **Admin portal — Employees** (`/enterprise/employees`):
  - **List:** `GET /v1/employees?q=...&limit=100` (real API).
  - **Create:** `POST /v1/employees` then optionally `POST /v1/employees/:id/employments` (real API).
  - **Create modal:** legal entity and pay group loaded from `GET /v1/legal-entities` and `GET /v1/pay-groups`.
  - No detail page or edit form in code; list + create only.

---

## 3. Self-Service (Employee-Facing “My” Data)

Self-service is **employee-centric**: the authenticated **User** must have an **Employee** linked (`Employee.userId = User.id`). If not, all self-service endpoints return `403` with `NO_EMPLOYEE_LINKED`.

### REST API

Base path: `v1/self-service`.

| Method | Path | Description | Permission (in code) |
|--------|------|-------------|------------------------|
| `GET`  | `profile` | Get profile (employee + employment + bank accounts masked + leave balances) | `self_service:read` |
| `POST` | `profile/contact` | Request contact info update | `self_service:update` |
| `POST` | `profile/bank-account` | Request bank account update | `self_service:update` |
| `GET`  | `payslips` | List payslips (query: year, from_date, to_date) | `self_service:read` |
| `GET`  | `payslips/:id` | Get one payslip | `self_service:read` |
| `GET`  | `payslips/:id/download` | Download payslip (PDF/HTML) | `self_service:read` |
| `GET`  | `tax-certificates` | List tax certificates | `self_service:read` |
| `GET`  | `tax-certificates/:id` | Get one certificate | `self_service:read` |
| `POST` | `tax-certificates/generate` | Generate for tax_year | `self_service:read` |
| `GET`  | `tax-certificates/:id/download` | Download certificate (HTML) | `self_service:read` |

**Permission mismatch:** Controllers use `self_service:read` and `self_service:update`. The RBAC seed defines `self:payslips:read`, `self:tax:read`, `self:profile:read`, `self:profile:update` only. So the guard checks for codes that are not in the seeded permission list; either add `self_service:read` / `self_service:update` to the seed and roles, or change the controller to use `AnyPermissions('self:payslips:read', 'self:profile:read', ...)` etc.

### UI

- **Employee portal — Profile** (`/profile`):
  - Calls `GET /v1/self-service/profile`.
  - On failure, falls back to **demo/mock** profile data (no API). So “user information” here is the employee profile (name, job, department, hire date, bank accounts masked, leave balances) when the API succeeds.

Other employee portal routes (payslips, tax certificates, etc.) are present; they would call the same `v1/self-service/*` endpoints when wired.

---

## 4. Enterprise / HCM-Adjacent APIs

These are under `api/enterprise` (and possibly under `v1` depending on routing):

- **Company groups** (multi-company consolidation): create group, add entity, consolidated payroll/compliance/headcount.
- **Approval workflows**: create workflow, submit/approve/reject approval requests, pending list, history.
- **Audit**: query audit logs, entity history, compliance report.
- **RBAC**: as in the User section above (roles, permissions, assign role to user, get user roles/permissions).
- **Delegations**: create/list/revoke delegations (user-to-user).
- **Cost centers**: CRUD.
- **Bulk**: bulk employee import/terminate (e.g. `POST bulk/employees/import`, `POST bulk/employees/terminate`).

These support “user” in the sense of **who did what** (audit, approvals, delegations) and **who has access** (RBAC), not a full user CRUD or directory.

---

## 5. Summary Table

| Area | REST API | Admin UI | Employee UI |
|------|----------|----------|-------------|
| **Login / identity** | ✅ `POST /auth/login`, `GET /auth/me` | ✅ Login page, token + role stored | ✅ Login, AuthContext, `auth/me` |
| **Platform user list** | ❌ No `GET /users` | ❌ | — |
| **Platform user CRUD** | ❌ No create/update user | ❌ | — |
| **User role/permission assignment** | ✅ Enterprise RBAC (`users/:id/roles`, etc.) | ❌ Roles page is mock only | — |
| **Employee list/create** | ✅ `GET/POST /employees`, employments, compensation, etc. | ✅ List + create (modal + employments) | — |
| **Employee detail/edit** | ✅ Get/patch, compensation, bank, tax, recurring | ⚠️ List only (no detail/edit page) | — |
| **Self-service profile** | ✅ `GET /self-service/profile`, contact/bank request | — | ✅ Profile page (API + mock fallback) |
| **Self-service payslips/tax** | ✅ List/get/download payslips and tax certificates | — | ✅ Routes; need to call `v1/self-service/*` |

---

## 6. Gaps and Notes

1. **No platform user directory API** — Cannot list or create Users via REST. Needed for true IAM admin (invite users, assign to employee, etc.).
2. **Roles Management UI is mock** — Does not call Enterprise roles/permissions or user-role APIs; needs to be wired to `api/enterprise` (and permission codes aligned with backend).
3. **Permission code alignment** — Employees module uses `employee:read`/`employee:write` (and compensation, bank_account, etc.); self-service uses `self_service:read`/`update`. Seed only has RBAC-spec codes (`iam:*`, `payrun:*`, `self:*`, etc.). Either add the missing codes to the seed and role mappings, or change controllers to use the existing codes (e.g. `AnyPermissions` with `self:*` for self-service).
4. **User–Employee link for self-service** — Self-service requires `Employee.userId = current user id`. The seed creates a demo User (admin) and demo Employees; if the admin user is not linked to an employee, self-service profile/payslips will 403 with `NO_EMPLOYEE_LINKED`. For employee portal testing, either link a seeded employee to a user or create a user and link them to an employee.
5. **Admin Employees page** — No detail view or edit form; only list and create (with optional employment). Consider adding `GET /employees/:id` detail page and `PATCH` for basic edits.

This document reflects the codebase as of the last review; API base paths (e.g. `v1` vs `api/enterprise`) should be confirmed against the running app and frontend env (e.g. `VITE_API_BASE_URL`).
