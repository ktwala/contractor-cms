# HCM Lifecycle Sign-Off Checklist

Termination → Rehire → Manager change. Use with **hr@demo.payroll** (or any role with `employee:write`).

---

## 1) Termination (Leaver Flow)

- [ ] **Terminate ACTIVE employee** with today's date
- [ ] **Verify:**
  - Employee status becomes **TERMINATED**
  - `termination_date` is set
  - Current employment row now has `effective_to = termination_date`
  - Current employment card updates accordingly
  - Employment history shows closure

---

## 2) Rehire Flow

- [ ] **Rehire the same employee** with a future/next-day date
- [ ] **Verify:**
  - Status flips to **ACTIVE**
  - `termination_date` cleared
  - A new employment is created with `effective_from = rehire_date`
  - Current employment switches to the new row (`effective_to` null)
  - History now shows 2 segments

---

## 3) Manager Change (Mover-lite)

- [ ] **Search and assign a manager**
- [ ] **Verify:**
  - Manager display shows name + employee_no
  - Refreshing the page still shows the manager (GET includes manager)

- [ ] **Clear manager**
- [ ] **Verify:**
  - Manager display becomes "—"
  - Refresh keeps it cleared

---

## 4) RBAC

- [ ] **Login as payrollclerk@demo.payroll**
- [ ] **Verify:**
  - Buttons for Terminate / Rehire / Change Manager are **not visible**
  - Direct PATCH attempts return **403** + **PERMISSION_DENIED** audit

---

## 5) Overlap Guard

- [ ] **Rehire with overlapping date** (e.g. rehire_date ≤ last employment effective_to)
- [ ] **Verify:** Backend returns **400** with `OVERLAPPING_EMPLOYMENT` and prevents creation

---

## Demo users

| Email                 | Password | Purpose                          |
|-----------------------|----------|----------------------------------|
| hr@demo.payroll       | admin123 | HCM flows (employee:write)       |
| payrollclerk@demo.payroll | admin123 | RBAC verification (no employee access) |

---

## 6) HR Export (IGA Preview)

- [ ] **Login as tenantadmin@demo.payroll** (has hr:read)
- [ ] **Navigate to Integrations → HR Export (IGA)**
- [ ] **Verify:**
  - Table shows employee_no, updated_at, manager_employee_no, effective_from, effective_to
  - Raw JSON preview toggle works
  - changed_since filter works (e.g. last 7 days)
