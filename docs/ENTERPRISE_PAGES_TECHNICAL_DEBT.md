# Enterprise Pages — Technical Debt & Consistency

This document summarizes the **Hubsec Workforce Admin → Enterprise** section: pages, API usage, RBAC/error handling, and what technical debt has been addressed.

## Pages Overview

| Route | Page | Data source | 403 handling | 404/501 handling | Notes |
| `/enterprise/company-groups` | CompanyGroups | `GET/POST/DELETE /api/enterprise/groups` | Friendly "no access" empty state | Calm "not available" empty state | Create/Delete can still 403; message from API shown in banner |
| `/enterprise/users` | Users | `GET /api/enterprise/users` | ForbiddenEmptyState if no iam:users:manage | UnavailableEmptyState (404/501) | List, search, filter; links to UserDetail |
| `/enterprise/users/:userId` | UserDetail | `GET /api/enterprise/users/:id`, role-assignments; `POST/DELETE` assignments | ForbiddenEmptyState | UnavailableEmptyState | Assign/remove roles (GLOBAL + LEGAL_ENTITY) |
| `/enterprise/cost-centers` | CostCenters | `GET/POST/PUT/DELETE /api/enterprise/cost-centers` | Friendly “no access” empty state | Calm “not available” empty state | Edit/Delete wired; shared empty states; 500 retry |
| `/enterprise/workflows` | ApprovalWorkflows | Mock (useState) | N/A | N/A | Preview banner; Create disabled; Edit/View are UI-only |
| `/enterprise/approvals/pending` | PendingApprovals | `GET /api/enterprise/approval-requests/pending` | Calm empty state | Calm empty state | No red banner for 403/404/501 |
| `/enterprise/roles` | RolesManagement | Backend roles (read) | — | — | “Role Templates (Preview)” + banner; no Create/Edit |
| `/enterprise/employees` | Employees | `GET/POST /v1/employees` | Friendly “no access” empty state | — | 500 still shows red error |
| `/enterprise/employees/:id` | EmployeeDetail | `GET /v1/employees/:id`, `GET /v1/employees/:id/employments`, legal-entities, pay-groups | Friendly “no access” message + Back link | “Employee not found” + error | 403 on any load shows access-denied copy |

### EmployeeDetail tab gating (least-privilege)

Tabs are **hidden entirely** if the user lacks permission — no placeholders or hints for unauthorized roles.

| Tab | Show if |
|-----|---------|
| Overview | `employee:read` OR `employment:read` |
| Employment | `employment:read` |
| Lifecycle | `employee:write` |
| Compensation | `compensation:read` |
| Bank & Tax | `bank_account:read` OR `tax_profile:read` |
| Activity | `audit:events:read` |

Placeholder tabs (Compensation, Bank & Tax, Activity) show “Preview: wiring coming next” only to users who have the corresponding permission. "Add employment change" requires `employment:write` (not `employee:write`).

## Patterns Applied

### 1. 403 (Forbidden) — RBAC

- **List pages (Company Groups, Cost Centers, Employees):** Full-page friendly empty state with lock icon, title “You don’t have access to [Feature]”, and “Contact your Tenant Admin…”.
- **Detail (Employee Detail):** When load fails with 403, show “You don’t have access to this employee” and “← Back to Employees”; no red error banner.

### 2. 404 / 501 (Not implemented or not found)

- **Company Groups / Cost Centers:** Calm empty state: “not available” / “may not be enabled for your tenant” (no red banner).
- **Pending Approvals:** 404/501 → empty list + no error banner (demo-safe).
- **Employee Detail:** 404 → “Employee not found” + error message + Back link.

### 3. 500 / network errors

- Red error banner or inline error message; user can retry or go back.

### 4. Preview / mock pages

- **Approval Workflows:** Banner: “Workflow list is preview data; backend wiring in progress. Create and edit workflows coming soon.” Create button disabled.
- **Roles Management:** “Role Templates (Preview)” title + banner; no Create/Edit actions.

## API Base Paths

- **V1 REST (employees, legal-entities, pay-groups):** `/v1/...` (e.g. `/v1/employees`). Used by Employees and Employee Detail.
- **Legacy enterprise:** `/api/enterprise/...` (e.g. `/api/enterprise/groups`). Used by Company Groups, Cost Centers, Pending Approvals. Base URL is the same axios instance (e.g. `VITE_API_BASE_URL` + path).

## Remaining / Follow-up

- **Company Groups / Cost Centers:** Backend may not expose `/api/enterprise/*` under `/v1`; confirm base path and RBAC permissions for these endpoints.
- **Company Groups:** ✅ Migrated to `ForbiddenEmptyState`, `UnavailableEmptyState`, `EmptyListState` from `ui/empty-states`; added 500 retry; uses `normalizeError`; Edit/Delete wired.
- **Cost Centers:** ✅ Same migration as Company Groups; Edit/Delete wired; backend `PUT`/`DELETE` endpoints added.
- **Approval Workflows:** When backend is ready, replace mock data with API and add 403/404/501 handling same as other list pages.
- **Users:** New page under Enterprise → Governance. Gated by `iam:users:manage`. Will list users, show role assignments (GLOBAL + per legal entity), support assign/remove. Backend wiring in progress.

## Related

- **RBAC:** `docs/RBAC_SPEC.md`, `docs/ENTERPRISE_DEMO_SCRIPT.md`
- **Demo readiness:** `docs/DEMO_PREFLIGHT.md`, `docs/ENTERPRISE_DEMO_SIGNOFF_CHECKLIST.md`
