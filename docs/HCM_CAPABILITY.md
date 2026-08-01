# HCM Capability — Current State

This document summarizes **Human Capital Management (HCM)** capabilities in the platform: what exists in the **backend (REST API + data model)** and what is **wired in the UI** (admin and employee portals).  
API base prefix is **`/v1`** (e.g. `POST /v1/auth/login`). Controllers under `api/*` are exposed as `/v1/api/*`.

---

## 1. Employee Master & Employment

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Employee CRUD** | ✅ `POST/GET/PATCH /v1/employees`, `GET /v1/employees/:id` | `Employee` | ✅ List + Create (with optional employment); no detail/edit page | — |
| **Employment (legal entity, pay group, job)** | ✅ `POST/GET /v1/employees/:id/employments` | `Employment` | ✅ Create employment in “Add Employee” flow | — |
| **Compensation (effective-dated)** | ✅ `GET/POST /v1/employees/:id/compensation` | `Compensation` | ❌ No UI | — |
| **Bank accounts (effective-dated)** | ✅ `GET/POST /v1/employees/:id/bank-accounts` | `BankAccount` | ❌ No UI | — |
| **Tax profile (effective-dated)** | ✅ `GET/POST /v1/employees/:id/tax-profile` | `TaxProfile` | ❌ No UI | — |
| **Recurring inputs** | ✅ `GET/POST/DELETE /v1/employees/:id/recurring-inputs` | `RecurringInput` | ❌ No UI | — |

**Notes:** Employee list/create and first employment are wired. Compensation, bank, tax profile, and recurring inputs have full APIs but no admin UI. Permissions use `employee:read`/`employee:write` and related codes that may need to be added to the RBAC seed.

---

## 2. Leave

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Leave types** | ✅ `GET/POST .../leave/types`, `POST .../leave/types/initialize` | `LeaveType` | ❌ No dedicated page | — |
| **Leave balances** | ✅ `GET /v1/leave/balances/:employeeId`, `POST .../balances/adjust` | `LeaveBalance` | ❌ No UI | Self-service: `GET /v1/leave/self-service/leave/balances` (API exists) |
| **Leave requests** | ✅ `POST /v1/leave/requests/:employeeId`, `GET /v1/leave/requests` | `LeaveRequest` | ❌ No UI | Self-service: `POST/GET .../self-service/leave/requests` |
| **Accruals / working days / termination payout** | ✅ `POST .../accruals/run`, `.../calculate-working-days`, `.../termination-payout` | `LeaveAccrual`, etc. | ❌ No UI | — |
| **Public holidays** | ✅ `GET/POST .../leave/public-holidays` | (in leave pack / config) | ❌ No UI | — |

**Notes:** Leave service is implemented (Prisma + country leave pack). No admin leave UI; self-service leave endpoints exist for balances and requests.

---

## 3. Time & Attendance

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Clock in/out** | ✅ `POST /v1/api/time-attendance/clock-in`, `clock-out` | (attendance records) | — | Mobile: clock-in/out |
| **Attendance status** | ✅ `GET .../time-attendance/status` | — | — | — |
| **Attendance by employee** | ✅ `GET .../time-attendance/attendance/:employee_id` | — | ✅ Attendance dashboard calls this | — |
| **Summary by month** | ✅ `GET .../time-attendance/summary/:employee_id/:month` | — | ✅ Attendance dashboard | — |
| **Shifts** | ✅ `GET/POST .../time-attendance/shifts`, `POST .../shifts/assign` | — | ✅ Shift Management page | — |
| **Overtime request/approve** | ✅ `POST .../overtime/request`, `.../overtime/:id/approve` | — | ❌ No UI | Mobile: overtime request |

**Notes:** Time-attendance APIs exist and are used by Admin (attendance dashboard, shift management). Paths used by UI: `/time-attendance/...` with base `v1` → effectively `v1/api/time-attendance/...`.

---

## 4. Benefits

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Benefit plans** | ✅ `POST/GET/GET:id /v1/api/benefits/plans`, activate/deactivate | `BenefitPlan`, `BenefitPlanOption`, `BenefitRate` | ✅ BenefitPlans page (GET plans) | — |
| **Plan options & rates** | ✅ `POST .../plan-options`, `POST/GET .../rates` | — | ❌ No UI | — |
| **Enrollments** | ✅ `POST/GET .../enrollments`, `GET .../employees/:id/enrollments`, approve/verify/activate/cancel | `EmployeeBenefit`, `BenefitEnrollmentHistory` | ✅ BenefitEnrollments (list, approve, reject, verify, activate) | — |
| **Contribution calc / deduction summary / payroll process** | ✅ `POST .../calculate-contribution`, `GET .../reports/deduction-summary`, `POST .../payroll/process-benefits` | `BenefitDeduction` | ✅ BenefitReports (deduction-summary); stats endpoints may differ | — |

**Notes:** Benefits module has real services (Prisma). Admin UI calls `api/benefits` (with v1 prefix). Some admin pages reference paths like `api.get('/benefits/stats/enrollments')` — confirm these exist on the benefits controller.

---

## 5. Expenses

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Categories** | ✅ `POST/GET/GET:id /v1/api/expenses/categories`, activate/deactivate | — | ✅ ExpensePolicies (CRUD categories) | — |
| **Policies** | ✅ `POST/GET/GET:id /v1/api/expenses/policies`, deactivate, mileage rate | — | ✅ ExpensePolicies (CRUD policies) | — |
| **Claims** | ✅ `POST/GET .../claims`, submit/approve/reject/cancel, `GET .../employees/:id/claims`, `GET .../claims/pending/approvals` | — | ✅ ExpenseClaims (list, approve, reject); ExpenseReports (stats, by-category, monthly-trends, top-spenders) | — |
| **Claim items** | ✅ `POST/GET .../items`, `DELETE .../items/:id` | — | ❌ No item-level UI | — |

**Notes:** Expenses controller is under `api/expenses`. Admin UI is wired for policies, categories, claims, and reports (paths may need `api/` prefix if base is v1 only).

---

## 6. Loans

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Loan types** | ✅ `GET/GET:id /v1/api/loans/types`, create/activate/deactivate, `.../types/calculate-repayment`, `.../types/available/:employeeId`, `.../types/:id/max-amount/:employeeId` | — | ✅ LoanProducts (types CRUD); ActiveLoans (list, schedule) | — |
| **Applications** | ✅ `GET/POST .../applications`, approve/reject | — | ✅ LoanApplications (list, approve, reject) | Mobile: apply, list |
| **Active loans & repayments** | ✅ `GET .../active`, `.../active/:id`, `.../active/:id/schedule`, `.../active/:id/repayments`, disburse, record repayment, `.../payroll/deductions` | — | ✅ ActiveLoans | Mobile: list loans |
| **Stats** | ✅ `GET .../stats/loans`, `.../stats/applications` | — | ✅ Used in admin | — |

**Notes:** Loans controller is under `api/loans`. Admin pages (LoanProducts, LoanApplications, ActiveLoans) call these endpoints (with v1 prefix). Mobile has apply/list.

---

## 7. Recruitment

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Job requisitions** | ✅ `POST/GET/GET:id/PUT .../api/recruitment/requisitions`, approve/post/close | `JobRequisition` | ❌ Mock only (JobRequisitions page uses static data) | — |
| **Candidates** | ✅ `POST .../candidates`, `GET .../candidates/:id` | — | ❌ Mock (Candidates page) | — |
| **Applications** | ✅ `POST .../applications`, stage/reject/rate, `GET .../requisitions/:id/applications` | `JobApplication` | ❌ Mock | — |
| **Interviews** | ✅ `POST .../interviews`, feedback/complete/cancel, `GET .../interviews/my-interviews`, `GET .../applications/:id/interviews` | — | ❌ Mock (Interviews page) | — |
| **Offers** | ✅ `POST/GET .../offers`, approve/send/accept/decline | `JobOffer` | ❌ Mock | — |
| **Onboarding** | ✅ `POST .../onboarding`, tasks complete, documents upload/verify, equipment assign, access provision, `GET .../onboarding/:id`, `.../tasks/my-tasks` | — | ❌ Mock (Onboarding page) | — |

**Notes:** Recruitment APIs and services (requisitions, candidates, interviews, offers, onboarding) are implemented. Admin recruitment pages (Job Requisitions, Candidates, Interviews, Onboarding) use **mock/static data** and do not call the API.

---

## 8. Performance

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Cycles** | ✅ `GET/POST .../api/performance/cycles`, activate, `GET .../cycles/:id/stats` | `PerformanceCycle` | ❌ No dedicated page | — |
| **Goals** | ✅ `GET/POST .../performance/goals` | `PerformanceGoal` | ❌ No UI | — |
| **Reviews** | ✅ `GET/POST .../performance/reviews`, self-assessment, manager-review | `PerformanceReview` | ❌ No UI | — |
| **Feedback** | ✅ `POST .../feedback/request`, `.../feedback/:id/submit` | `PerformanceFeedback` | ❌ No UI | — |

**Notes:** Performance controller and schema exist. No admin or employee UI for performance.

---

## 9. Documents

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Document types** | ✅ `GET/POST/PUT .../v1/documents/types`, initialize-defaults | `DocumentType` | ❌ No UI | — |
| **Upload / list / get / update** | ✅ `POST/GET/GET:id/PUT .../documents`, upload with file | `Document`, `DocumentAccessLog`, `DocumentExpiryAlert`, `DocumentRequest` | ❌ No UI | — |
| **Self-service documents** | ✅ Under `self-service/documents` (separate controller section) | — | — | — |
| **Bulk request/verify/archive** | ✅ Bulk endpoints in documents controller | — | ❌ No UI | — |

**Notes:** Document management and self-service document endpoints exist. No admin document UI; employee document UI may call self-service if implemented.

---

## 10. Change Requests (Employee Data)

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Create change request** | ✅ `POST /v1/change-requests` | — | — | — |
| **List / pending / get by id** | ✅ `GET .../change-requests`, `.../pending`, `.../:id` | — | ❌ No UI | — |
| **Approve / reject / cancel** | ✅ `POST .../approve`, `.../reject`, `.../cancel` | — | ❌ No UI | — |

**Notes:** Change-requests controller is for sensitive employee data changes (workflow). No UI wired. Self-service profile contact/bank “request” endpoints exist under `/v1/self-service` (separate from this change-request workflow).

---

## 11. Approvals (Generic Workflow)

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Workflows** | ✅ `POST/GET/GET:id/PATCH /v1/approvals/workflows` | Approval workflow config | ❌ No UI (enterprise has workflows too) | — |
| **Submit / approve / reject / delegate** | ✅ `POST .../submit`, `.../steps/:id/approve`, `.../reject`, `.../delegate` | `ApprovalInstance`, `ApprovalStep` | — | — |
| **Pending / instance / by entity** | ✅ `GET .../pending`, `.../instances/:id`, `.../entity/:type/:id` | — | ✅ PendingApprovals calls `api/enterprise/approval-requests/pending` | — |
| **Delegations** | ✅ `POST/DELETE .../delegations` | — | ❌ No UI | — |

**Notes:** Two approval surfaces: `v1/approvals` (approvals module) and `v1/api/enterprise` (approval-requests). Admin Pending Approvals uses enterprise pending endpoint.

---

## 12. Enterprise / Org & Bulk

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Company groups** | ✅ `POST/GET .../api/enterprise/groups`, add member, consolidated payroll/compliance/headcount | — | ✅ CompanyGroups (GET, POST, DELETE) | — |
| **Cost centers** | ✅ `POST/GET .../cost-centers`, allocations, budgets, utilization, report, alerts | `CostCenter` (or similar) | ✅ CostCenters (GET, POST) | — |
| **Bulk employee import/terminate** | ✅ `POST .../bulk/employees/import`, `.../bulk/employees/terminate` | — | ❌ No UI | — |
| **Bulk salaries update** | ✅ `POST .../bulk/salaries/update` | — | ❌ No UI | — |
| **RBAC (roles, permissions, user-role)** | ✅ `POST/GET .../roles`, `.../users/:id/roles`, `.../permissions`, etc. | `Role`, `Permission`, `RoleAssignment` | ❌ Roles Management page is mock | — |
| **Audit / retention / archive / delegations** | ✅ Various enterprise endpoints | — | ❌ No UI | — |

**Notes:** Company groups and cost centers are wired in admin. Bulk and RBAC have APIs but no (or mock) UI.

---

## 13. Payroll Cycle & Calendars

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Calendars** | ✅ `POST/GET .../api/payroll-cycle/calendars`, `POST .../calendars/:id/generate-periods` | — | ❌ PayrollCalendars page uses **mock data** | — |
| **Periods** | ✅ `GET .../periods/current`, `.../upcoming`, `.../:id`, lock/unlock/close | — | ❌ No UI | — |
| **Checklist** | ✅ `POST/GET .../periods/:id/checklist`, complete/assign task, `GET .../checklist-tasks/my-tasks` | — | ❌ Payroll Checklist page likely mock | — |
| **Exceptions / reconciliation / forecasts** | ✅ Detect, list, resolve, dismiss, reconciliation, forecasts | — | ❌ No UI | — |

**Notes:** Payroll-cycle controller is implemented. Admin Payroll Calendars and Checklist pages do not call it (mock/static).

---

## 14. Self-Service (Hubsec Workforce Employee Portal)

| Capability | Backend API | Data model | Admin UI | Employee UI |
|------------|-------------|------------|----------|-------------|
| **Profile** | ✅ `GET /v1/self-service/profile` | Employee + employment + bank masked | — | ✅ Profile page (API + mock fallback) |
| **Profile contact/bank request** | ✅ `POST .../profile/contact`, `.../profile/bank-account` | — | — | — |
| **Payslips** | ✅ `GET .../payslips`, `.../payslips/:id`, `.../payslips/:id/download` | PayRunEmployee, etc. | — | ✅ Payslips route (needs API wiring) |
| **Tax certificates** | ✅ `GET .../tax-certificates`, generate, download | — | — | ✅ Tax Certificates route (needs API wiring) |

**Notes:** Self-service requires `Employee.userId` set for the current user; otherwise endpoints return 403 `NO_EMPLOYEE_LINKED`. Permission codes in controller (`self_service:read`/`update`) may not match RBAC seed (`self:*`).

---

## 15. Other (Payruns, Legal Entities, Pay Groups, Jobs, Imports, Dashboard, Analytics)

- **Payruns:** Full API (create, snapshot, calculate, submit, approve, pay, post, finalize, results, etc.); payrun UI may be partial or separate.
- **Legal entities / Pay groups:** `v1/legal-entities`, `v1/pay-groups` — used by Employees create flow and elsewhere.
- **Jobs:** `v1/jobs` is for **async/background jobs** (create, list, cancel), not job positions.
- **Imports:** `v1/imports` — templates, preview, execute (e.g. employees, pay data).
- **Dashboard:** `v1/dashboard` — dashboard, analytics, summary (permission `dashboard:read`).
- **Analytics:** `v1/api/analytics` — dashboard, payroll/trends, departments, tax/turnover/expenses/loans/performance, KPIs, saved reports.

---

## Summary: What’s Strong vs Gaps

**Backend (API + model) present and used:**

- Employee master + employment (list/create + first employment in UI).
- Leave (full API; no admin UI).
- Time & attendance (API + admin attendance & shifts).
- Benefits (API + admin plans, enrollments, reports).
- Expenses (API + admin policies, claims, reports).
- Loans (API + admin types, applications, active loans).
- Self-service profile, payslips, tax certs (API; employee profile wired, others need wiring).
- Enterprise: company groups, cost centers, approval-requests pending.
- Payruns, legal entities, pay groups, imports, dashboard, analytics.

**Backend present but UI mock or missing:**

- Recruitment (full API; admin Job Requisitions, Candidates, Interviews, Onboarding are mock).
- Payroll cycle (calendars, periods, checklist, exceptions) — API exists; Calendars/Checklist UI mock.
- Roles Management (enterprise RBAC API exists; admin page mock).
- Compensation, bank, tax profile, recurring inputs (API only; no admin UI).
- Performance, documents, change-requests (API only; no UI).
- Bulk import/terminate, bulk salaries (API only).

**Permission / path notes:**

- Some controllers use permission codes not in the RBAC seed (e.g. `employee:read`, `self_service:read`). Either add these to the seed or align controllers with existing codes.
- Admin base URL is `v1`; endpoints under `api/*` are called as `/api/...` (e.g. `v1/api/benefits/plans`). Payment batch endpoints (`/payments/batches`) may be in a different module — confirm actual route.

Use this as the single reference for “what HCM capability we currently have” and for planning UI wiring and permission alignment.
