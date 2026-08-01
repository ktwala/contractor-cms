# Enterprise Demo Sign-Off Checklist

RBAC v1.1 + UI hardening. Use this to verify the Enterprise demo path before customer or internal walkthroughs.

---

## 1) RBAC + seed correctness

- [ ] **Run seed** — `npm run db:seed` (with `DATABASE_URL` set) completes successfully with no unique-constraint or other errors.
- [ ] **Login as TENANT_ADMIN (or HR) persona**  
  Use **tenantadmin@demo.workforce** or **hr@demo.workforce** (password: **admin123**). Then:
  - `GET /v1/employees` → **200**
  - `POST /v1/employees` (valid body) → **201**
  - `GET /v1/employees/:id/employments` → **200**
  - `POST /v1/employees/:id/employments` (valid body) → **201**
- [ ] **Login as role without employee permissions**  
  Use **payrollclerk@demo.workforce** (password: **admin123**). Then:
  - `GET /v1/employees` → **403** and a **PERMISSION_DENIED** audit event is recorded.
- [ ] **UI** — For **tenantadmin@demo.workforce** or **hr@demo.workforce**, the Employees list and Add Employee flow work; no spurious RBAC error on the Employees page.

---

## 2) Employees UX demo path

- [ ] **Employees list** loads; stats (total, active, terminated, etc.) match the data returned by the API.
- [ ] **Clicking an employee name** opens the Employee Detail page (no 404 or blank screen).
- [ ] **Current employment** shows the expected open record (e.g. row with `effective_to` null).
- [ ] **“Add employment change”:**
  - Required fields are validated (e.g. legal entity, pay group, effective from).
  - On success, employment history and current employment refresh.
  - On error (e.g. country mismatch, pay group not in legal entity), a clear message is shown (no generic “Something went wrong” only).

---

## 3) Pending Approvals demo-safe behavior

- [ ] If the backend returns **404 / 501 / 403**, the UI shows a **calm empty state** (e.g. “No pending approvals” / “Approvals may not be enabled for this tenant”) and **no red error banner**.
- [ ] If the backend returns **500** (real server error), the **red failure banner** is still shown.
- [ ] Console logs include status and error detail for developers; the UI remains clean for 404/501/403.

---

## 4) Roles page messaging alignment

- [ ] Sidebar label can remain **“Roles Management”.**
- [ ] **In-page title** clearly says **“Role Templates (Preview)”.**
- [ ] A **banner** makes it obvious the page is not wired to real RBAC yet (e.g. “backend wiring in progress” / “Custom roles coming soon”).
- [ ] **No “Create role” or “Edit”** actions are present.

---

## 5) Demo script readiness

- [ ] **docs/ENTERPRISE_DEMO_SCRIPT.md** exists and reads like a **talk track** (not only engineering notes).
- [ ] **Prerequisites** are minimal and realistic (seed run, tenant/legal entity, demo users).
- [ ] **Timeboxed walkthrough** is ~8–12 minutes, with an optional “deep dive” branch called out.

---

## Demo users (from seed)

| Email | Password | Role(s) | Purpose |
|-------|----------|--------|--------|
| admin@demo.workforce | admin123 | ADMIN (GLOBAL) + TENANT_ADMIN, PAYROLL_CLERK, SARS_OFFICER | Full access / break-glass |
| tenantadmin@demo.workforce | admin123 | TENANT_ADMIN (LE) | Governance; employees + employments allowed |
| hr@demo.workforce | admin123 | HR_ADMIN (LE) | HCM lifecycle; employees + employments only |
| payrollclerk@demo.workforce | admin123 | PAYROLL_CLERK (LE) | Payrun prep; no employee/employment permissions → 403 on /employees |
| iga@demo.workforce | admin123 | INTEGRATION_IGA (GLOBAL) | HR export API only (hr:read) |

All LE-scoped users are scoped to the seeded demo legal entity.
