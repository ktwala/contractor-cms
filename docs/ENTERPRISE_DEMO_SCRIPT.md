# Enterprise Demo Script — Talk Track

**Duration:** ~8–12 minutes (core) | **Optional deep dive:** +5–10 min

Use this as the narrative for an Enterprise operating-model demo. **Before every presentation**, run the **[10-minute Demo Pre-Flight](./DEMO_PREFLIGHT.md)** (seed sanity, Tenant Admin run, Payroll Clerk 403, Pending Approvals, Roles page). For a summary of Enterprise page behavior, RBAC/error handling, and technical debt, see **[Enterprise Pages — Technical Debt](./ENTERPRISE_PAGES_TECHNICAL_DEBT.md)**.

---

## Prerequisites (before you start)

- Backend and admin portal running.
- Database seeded (`npm run db:seed` with valid `DATABASE_URL`).
- Log in as **tenantadmin@demo.payroll** or **hr@demo.payroll** for the main flow (or **admin@demo.payroll** for full access).

---

## Core walkthrough (~8–12 min)

### 1. Company Groups (1–2 min)

*“We start with how the organisation is structured.”*

- Open **Company Groups**.
- Show the group hierarchy and which legal entities belong to which group.
- *“This is the consolidation view we use for reporting and governance.”*

---

### 2. Cost Centers (1 min)

*“Cost centers tie payroll and finance to the same structure.”*

- Open **Cost Centers**.
- Show the list and how they map to the org.
- *“So we can report and allocate by cost center and entity.”*

---

### 3. Employees — HCM core (3–4 min)

*“The heart of the demo is the employee lifecycle.”*

- Open **Employees**.
- *“You see the directory: totals, active, terminated. Stats match what’s in the system.”*
- Click an employee name. *“We open the detail view: hire date, termination date, department, job title.”*
- *“Here’s current employment: legal entity, pay group, job title, cost center, effective from. And below that, full employment history — every assignment, from and to dates.”*
- Click **Add employment change**. *“For a mover we pick legal entity, pay group, effective from. We validate — e.g. country must match the legal entity, pay group must belong to that entity. On save, history and current employment refresh.”*
- *“So we’ve shown: directory → open employee → current employment and history → add a mover. That’s the core HCM story.”*
- **Leaver / Rehire / Manager:** Show **Terminate Employee** (ACTIVE only), **Rehire Employee** (TERMINATED only), **Change Manager**. *“We manage the full lifecycle: joiner, mover, leaver, rehire, reporting-line change. This is the authoritative source for IGA.”*

---

### 4. HR Export (IGA Preview) — optional (1 min)

*“For integrations and IGA, we expose a stable HR export.”*

- Open **Integrations → HR Export (IGA)** (requires hr:read; tenantadmin has it).
- *“This previews the `/v1/hr/employees` delta feed: employee_no, updated_at, manager_employee_no, current employment dates. IGA connectors poll with changed_since; we show exactly what they see.”*
- Toggle **Show raw JSON** to show the payload.

---

### 5. Approval Workflows (1–2 min)

*“Governance is handled through approval workflows.”*

- Open **Approval Workflows** (or **Pending Approvals**).
- *“If the approvals backend is enabled, you see pending items. If it’s not set up for this tenant, you get a calm empty state — no red errors, just ‘No pending approvals’ or ‘Approvals may not be enabled for this tenant.’ That keeps the demo safe.”*

---

### 6. Roles (1 min)

*“We expose role-based access clearly.”*

- Open **Roles** (sidebar: “Roles Management”).
- *“The in-page title is ‘Role Templates (Preview)’ and the banner explains that custom roles and assignment are coming. We don’t show Create or Edit yet — so the story is: we have a clear RBAC model, and the UI is aligned with what’s wired today.”*

---

## Optional deep dive (+5–10 min)

- **RBAC proof:** Log in as **payrollclerk@demo.payroll**, go to Employees (or call `GET /v1/employees`). Show **403** and that only the right personas (e.g. tenant admin, HR) can manage employees.
- **Audit:** Where available, show PERMISSION_DENIED or access events in audit logs for the 403 case.
- **API:** Use Postman or curl with **tenantadmin@demo.payroll** or **hr@demo.payroll** and run `GET /v1/employees`, `POST /v1/employees`, `GET /v1/employees/:id/employments`, `POST /v1/employees/:id/employments` to show the same permissions as the UI.

---

## Demo users (from seed)

| Persona | Email | Password | Use in demo |
|--------|--------|----------|-------------|
| Tenant Admin | tenantadmin@demo.payroll | admin123 | Main walkthrough; employees + governance |
| HR | hr@demo.payroll | admin123 | Same as above; HCM-only role |
| Payroll Clerk | payrollclerk@demo.payroll | admin123 | Deep dive: 403 on Employees |
| Full access | admin@demo.payroll | admin123 | Break-glass / full demo |

---

## Sign-off

Before a formal demo, run through **[ENTERPRISE_DEMO_SIGNOFF_CHECKLIST.md](./ENTERPRISE_DEMO_SIGNOFF_CHECKLIST.md)** so RBAC, Employees UX, Pending Approvals behavior, Roles messaging, and this script are all confirmed.
