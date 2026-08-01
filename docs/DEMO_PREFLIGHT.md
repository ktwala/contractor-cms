# 10-Minute Demo Pre-Flight

**Do this every time before presenting.** Keeps the Enterprise demo bulletproof.

---

## A) Seed sanity (~2 min)

1. Run the seed:
   ```bash
   DATABASE_URL="postgresql://payroll:payroll_secret@localhost:5432/payroll_platform?schema=public" npm run db:seed
   ```
   (Or use your `.env` and run `npm run db:seed`.)
2. Confirm it completes with no errors (no unique-constraint or connection failures).
3. Log in to the admin portal as each persona (password **admin123** for all):
   - **tenantadmin@demo.payroll**
   - **hr@demo.payroll**
   - **payrollclerk@demo.payroll**

---

## B) Tenant Admin quick run (~2 min)

1. Log in as **tenantadmin@demo.payroll** (or **hr@demo.payroll**).
2. Open **/enterprise/employees**.
   - The list should load with no “employee:read” or permission-error banner.
3. Click **Add Employee** and create one employee (required fields + optional employment).
4. Click the new employee’s name → detail page opens.
5. Click **Add employment change** → fill required fields → Save.
6. Confirm **employment history** and **current employment** both update.

---

## C) Payroll Clerk negative test (~1 min)

1. Log in as **payrollclerk@demo.payroll**.
2. Open **/enterprise/employees**.
   - You should see a **friendly “not allowed”** message:  
     *“You don’t have access to Employee Records. Contact your Tenant Admin.”*  
     No red error banner; the screen should feel like “RBAC working,” not “broken.”
3. Optionally call `GET /v1/employees` as this user → **403**.
4. Confirm the backend has logged a **PERMISSION_DENIED** audit event (DB or logs).

---

## D) Pending Approvals behavior (~1 min)

1. Open **/enterprise/approvals/pending** (as any allowed user).
2. If the backend doesn’t support it (404/501/403): you see a **calm empty state** (e.g. “No pending approvals” / “Approvals may not be enabled for this tenant”) and **no red banner**.
3. If the backend returns **500**: a **red banner** is acceptable (real server issue).

---

## E) Roles page expectation (~30 sec)

1. Open **/enterprise/roles**.
2. In-page title must say **“Role Templates (Preview)”** and a **banner** must state it’s not wired yet (e.g. “backend wiring in progress” / “Custom roles coming soon”).
3. There must be **no “Create role” or “Edit”** actions.

---

## Summary

| Step | What to check |
|------|----------------|
| A | Seed runs; tenantadmin, hr, payrollclerk all log in |
| B | Employees list loads; add employee; detail; add employment change; history + current employment update |
| C | Payroll clerk sees friendly “no access” on Employees (no red banner); 403 + PERMISSION_DENIED in audit |
| D | Pending Approvals: calm empty state for 404/501/403; red OK for 500 |
| E | Roles: “Role Templates (Preview)” + banner; no Create/Edit |

When all boxes pass, you’re ready to present. For the full talk track, use **[ENTERPRISE_DEMO_SCRIPT.md](./ENTERPRISE_DEMO_SCRIPT.md)**.
