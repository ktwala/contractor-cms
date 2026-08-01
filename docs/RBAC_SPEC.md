# RBAC Spec (Step 2) — Roles, Permissions, Scoping, and SoD

## Scope
This document defines the canonical RBAC model for the platform:
- Roles and permission bundles
- Legal-entity scoping rules
- Separation of Duties (SoD) enforcement
- QA persona checklist for release validation

---

## Authorization Model

### Permissions
- Permissions are string codes (e.g., `payrun:create`, `sars:emp201:submit`).
- `@Permissions(...)` enforces AND semantics (all required).
- `@AnyPermissions(...)` enforces OR semantics (any one required).

### Guard Behavior
- `PLATFORM_SUPERADMIN` is the only bypass role (break-glass).
- No `ADMIN` bypass. Access is always via permissions in DB.
- **Admin portal UI:** `useAccess` (`admin-portal/src/hooks/useAccess.ts`) treats **`PLATFORM_SUPERADMIN`** as having **all** permission codes for **client-side** `can()` / `canAny()` checks (so break-glass operators see override controls and nav without a full permission array in localStorage). **API authorization remains authoritative:** Nest guards use JWT-resolved permissions; do not rely on the UI alone to enforce payroll governance.

---

## PR-RBAC-GOV-2 — Payroll override authority (GOV-3A–3D)

**Decision:** Payrun **override** permissions are intentionally split so tenant administration, payroll execution leadership, treasury (bank), and accounting (GL) can be governed separately. This is a product governance choice reflected in `prisma/seed.ts` `ROLE_PERM_MAP` and enforced in CI via `npm run check:rbac-role-policy-drift`.

| Override permission | Meaning (high level) | Role(s) |
|---------------------|----------------------|---------|
| `payrun:readiness_override` | GOV-3A — bypass readiness / checklist gates | `PAYROLL_MANAGER`, `GLOBAL_PAYROLL_ADMIN` |
| `payrun:financial_override` | GOV-3D — financial / amount governance bypass | `PAYROLL_MANAGER`, `GLOBAL_PAYROLL_ADMIN` |
| `payrun:closed_period_override` | Closed-period / temporal execution bypass | `PAYROLL_MANAGER`, `GLOBAL_PAYROLL_ADMIN` |
| `payrun:bank_override` | GOV-3B — treasury / bank-file governance bypass | `PAYMENT_OPERATOR` |
| `payrun:gl_override` | GOV-3C — GL / posting governance bypass | `FINANCE_REVIEWER` |

**Role intent**

- **`TENANT_ADMIN`** — Platform and tenant **administration** (IAM, entities, audit read, etc.). The seed may still include broad **non-override** payrun and compliance permissions for operational flexibility; **`TENANT_ADMIN` must not** hold any of the five override codes above (not routine payroll override authority).
- **`PAYROLL_MANAGER`** — Payroll operations lead: readiness + financial + closed-period overrides; **not** bank or GL overrides.
- **`GLOBAL_PAYROLL_ADMIN`** — Cross-entity payroll authority: **same override bundle as `PAYROLL_MANAGER`** (readiness, financial, closed period only); **not** bank or GL overrides.
- **`PAYMENT_OPERATOR`** — Treasury / payment operations: **bank override** only among the five; must not hold the other four.
- **`FINANCE_REVIEWER`** — Accounting / GL review: **GL override** only among the five; must not hold the other four.
- **`RECONCILIATION_ANALYST`** — Reconciliation review and workflow; **no** payrun override permissions.

Authoritative permission lists remain in **`prisma/seed.ts`**; this section is the governance narrative for the override slice only.

---

## PR-RBAC-GOV-3 — Override assumption sweep (tests / UI)

- **Drift:** `npm run check:rbac-override-test-fixture-drift` — Playwright and `*.spec.ts` files must not pair **TENANT_ADMIN-only** sessions with **`payrun:*_override`** permission literals. Override behaviour is tested with **`PAYROLL_MANAGER`**, **`PAYMENT_OPERATOR`**, **`FINANCE_REVIEWER`**, or **`GLOBAL_PAYROLL_ADMIN`** (or explicit multi-role fixtures).
- **UI:** Override surfaces are gated by **permission** via **`can('payrun:…_override')`**, not by role name. The only **UI-level** exception is **`PLATFORM_SUPERADMIN`** (see Guard Behavior above).
- **E2E:** `test/playwright/pr-rbac-gov-3-override-authority.spec.ts` — **`TENANT_ADMIN`** without override perms does **not** see the audited readiness panel; **`PAYROLL_MANAGER`** and **`GLOBAL_PAYROLL_ADMIN`** with **`payrun:readiness_override`** do; **`PLATFORM_SUPERADMIN`** sees it via admin break-glass **`useAccess`** behaviour (without requiring that code in the mocked permission list).

## PR-RBAC-GOV-3A — Global payroll admin (Playwright)

- **`GLOBAL_PAYROLL_ADMIN`** is covered alongside **`PAYROLL_MANAGER`** for **readiness override UI** when the session includes **`payrun:readiness_override`**, matching the seed override bundle (PR-RBAC-GOV-2).
- **`PLATFORM_SUPERADMIN`** behaviour in the admin app is **intentionally** broader on the client: break-glass full **`can()`** for layout and controls; document and regression-test so it is not mistaken for the tenant-admin model.

---

## Payroll override authority baseline locked

This baseline matches the governance closure pattern used for payroll imports and payrun controls: seed + drift + targeted tests.

**Required checks (CI / release discipline)**

| Check | Purpose |
|-------|---------|
| `npm run check:rbac-role-policy-drift` | Seed `ROLE_PERM_MAP` keys ↔ `ROLE_POLICY` (backend + admin-portal); PR-RBAC-GOV-2 override split on seeded roles |
| `npm run check:rbac-override-test-fixture-drift` | No `*.spec.ts` / Playwright test body pairs **TENANT_ADMIN-only** fixtures with **`payrun:*_override`** literals |
| `npm run test:playwright:pr-rbac-gov-3` | Create Payrun readiness override UI: tenant admin denied, manager + global payroll admin allowed, superadmin break-glass UI path |
| `PayrunReadinessGateService` Jest (`src/modules/payruns/__tests__/payrun-readiness-gate.spec.ts`) | Backend gate: no bypass without **`payrun:readiness_override`** (includes PR-RBAC-GOV-3 tenant-style bundle case) |

**Forbidden regressions**

- **`TENANT_ADMIN`** receives any of the five payroll **`payrun:*_override`** permissions in **`prisma/seed.ts`** (caught by `check:rbac-role-policy-drift`).
- **Override UI** (or similar) gated by **role name** (e.g. `if (role === 'TENANT_ADMIN')`) instead of **permission** — use **`can('payrun:…_override')`**; **`PLATFORM_SUPERADMIN`** is the only documented **`useAccess`** exception for client-side checks.
- A seeded role **missing** from **`ROLE_POLICY`** in both **`src/common/constants/rbac-role-policy.ts`** and **`admin-portal/src/shared/rbacRolePolicy.ts`** (caught by role-policy drift).
- **Test fixtures** that rely on **`TENANT_ADMIN` alone** for override authority (caught by override test-fixture drift).

---

## Scoping Model (Legal Entity)
- **RBAC v1.1:** Role assignment: `RoleAssignment` (per legal entity or GLOBAL)
- **Legacy fallback:** `UserRole` + `UserLegalEntityAccess` (when no RoleAssignment exists)
- All entity-scoped endpoints use `@CurrentUser()` and pass `user` into services.
- Services enforce scope using:
  - `assertHasLegalEntities(user)`
  - `assertLegalEntityAllowed(user, legalEntityId)`

---

## Canonical Roles and Permission Bundles

Roles are grouped by domain: **IAM** (TENANT_ADMIN), **Payroll** (CLERK, APPROVER, FINANCE_APPROVER), **SARS**, **Audit**, **HCM** (HR_ADMIN), **Integration** (INTEGRATION_IGA), and **break-glass** (PLATFORM_SUPERADMIN). ADMIN is not seeded; use canonical roles or PLATFORM_SUPERADMIN for full access.

### TENANT_ADMIN (Governance / IAM)
- **Purpose:** Tenant-level administration (IAM, legal entities, audit, imports, calendars, and related bundles per seed).
- **PR-RBAC-GOV-2:** Must **not** include any `payrun:*_override` permission (`readiness_override`, `financial_override`, `bank_override`, `gl_override`, `closed_period_override`). Override authority is assigned to the roles in the table above.
- **Source of truth:** Full permission list — `prisma/seed.ts` → `ROLE_PERM_MAP.TENANT_ADMIN`.

### PAYROLL_CLERK (Prepare payruns)
- `payrun:read`
- `payrun:create`
- `payrun:edit`
- `payrun:snapshot`
- `payrun:cancel`
- `payrun:calculate`
- `payrun:submit`
- `payrun:trace:read`
- `payrun:adjust` *(clerks manage adjustments pre-approval)*

### PAYROLL_APPROVER (Approve payruns)
- `payrun:read`
- `payrun:approve`
- `payrun:trace:read`

### FINANCE_APPROVER (Payment + close-out)
- `payrun:read`
- `payrun:pay`
- `payrun:post`
- `payrun:finalize`
- `payrun:trace:read`

### SARS_OFFICER (Generate / export / validate)
- `sars:tax_periods:read`
- `sars:irp5:read`
- `sars:irp5:generate`
- `sars:irp5:export`
- `sars:emp201:read`
- `sars:emp201:generate`
- `sars:emp201:export`
- `sars:emp501:read`
- `sars:emp501:generate`
- `sars:emp501:export`
- `sars:validation:run`

### SARS_APPROVER (Submit / approve)
- `sars:emp201:read`
- `sars:emp201:submit`
- `sars:submission:manage`
- `sars:submission:read`
- `sars:emp501:read`
- `sars:emp501:approve`

### AUDITOR_READONLY
- `payrun:read`
- `payrun:trace:read`
- `sars:irp5:read`
- `sars:emp201:read`
- `sars:emp501:read`
- `audit:events:read`

> No exports by default.

### HR_ADMIN (HCM — employee master data)
- `employee:read`
- `employee:write`
- `employment:read`
- `employment:write`
- `legal_entity:read`
- `legal_entity:write`

> Employee and employment lifecycle per legal entity. Can create/update legal entities for setup. No payroll run, SARS, or IAM. Typically LEGAL_ENTITY scoped.

### INTEGRATION_IGA (Connector / HR export only)
- `hr:read`

> Read-only HR export API (delta feed, by employee_no). For IGA/identity connectors. Typically GLOBAL or service account.

### EMPLOYEE_SELF_SERVICE
- `self:payslips:read`
- `self:tax:read`
- `self:profile:read`
- `self:profile:update`

### PLATFORM_SUPERADMIN (Break-glass)
- All permissions (not assigned by default; time-bound recommended)

### PAYROLL_MANAGER, GLOBAL_PAYROLL_ADMIN, PAYMENT_OPERATOR, FINANCE_REVIEWER, RECONCILIATION_ANALYST
- **PAYROLL_MANAGER** / **GLOBAL_PAYROLL_ADMIN:** Full payrun lifecycle plus **readiness, financial, and closed-period** overrides only (see PR-RBAC-GOV-2). `GLOBAL_PAYROLL_ADMIN` is scoped for cross-entity payroll; override split matches `PAYROLL_MANAGER`.
- **PAYMENT_OPERATOR:** Payrun read/trace, payment batches, bank reporting; **`payrun:bank_override`** only.
- **FINANCE_REVIEWER:** Read/trace, GL reporting, reconciliation view; **`payrun:gl_override`** only.
- **RECONCILIATION_ANALYST:** Reconciliation and reports; **no** overrides.
- **Source of truth:** `prisma/seed.ts` → `ROLE_PERM_MAP`.

---

## Separation of Duties (SoD)

### Payruns
- PR-SOD-01: Creator cannot approve (enforced in `payrun-lifecycle.service.ts` approve)
- PR-SOD-02: Approver cannot mark paid (enforced in `payrun-lifecycle.service.ts` markPaid)
- PR-SOD-03: Payer cannot post/finalize (enforced in `payrun-lifecycle.service.ts` markPosted/finalize)

**PayRun fields**
- `createdByUserId`, `submittedByUserId`, `approvedByUserId`, `paidByUserId`, `postedByUserId`, `finalizedByUserId` + timestamps

### SARS
- SARS-SOD-01: Generator cannot submit EMP201 (enforced in `sars-tax.service.ts` submitEMP201)
- SARS-SOD-02: Submitter cannot approve EMP501 (enforced in `emp501-reconciliation.service.ts` approveReconciliation)

**EMP201 fields**
- `generatedByUserId`, `submittedByUserId` (+ legacy submittedBy kept)

**EMP501 fields**
- `generatedByUserId`, `submittedByUserId`, `approvedByUserId`, `approvedAt` (+ legacy reconciledBy kept)

---

## QA Persona Checklist (Per Legal Entity)
Run with two legal entities: LE-A and LE-B.
- Payroll Clerk (LE-A): can create/calc/submit in LE-A only; cannot approve/pay.
- Payroll Approver (LE-A): can approve in LE-A only; cannot approve own created payrun.
- Finance Approver (LE-A): can pay/post/finalize in LE-A only; cannot post/finalize if payer (SoD).
- SARS Officer (LE-A): can generate/export/validate for LE-A only; cannot submit.
- SARS Approver (LE-A): can submit/approve for LE-A only; cannot submit if generator (SoD).
- Auditor (LE-A): read-only; no exports; no LE-B.
- Tenant Admin: IAM and tenant bundles per seed; **no** payrun GOV override permissions (PR-RBAC-GOV-2).
- Payroll Manager: readiness + financial + closed-period overrides; **not** bank/GL overrides.
- Global Payroll Admin: same override bundle as Payroll Manager (cross-entity).
- Payment Operator: bank override; **not** other payrun overrides.
- Finance Reviewer: GL override; **not** other payrun overrides.
- Reconciliation Analyst: recon workflows; **no** overrides.
- HR Admin (LE-A): can list/view/create/update employees and employments in LE-A only; cannot manage Company Groups, Cost Centers, or Payroll.
