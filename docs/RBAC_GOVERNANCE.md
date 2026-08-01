# RBAC Governance & Operational Controls

## Purpose
This document defines governance rules and operational requirements for RBAC and Separation of Duties (SoD) controls in the platform. It complements the RBAC specification (roles, permissions, scoping, and SoD enforcement).

---

## Role Governance

### ADMIN
**Status:** Removed. Not in seed; not in `RoleName` enum (see migration `20260301130000_remove_admin_role`).

Use **canonical roles** (TENANT_ADMIN, PAYROLL_*, HR_ADMIN, etc.) or **PLATFORM_SUPERADMIN** for break-glass. The migration deletes any existing ADMIN role rows and drops the enum value for clean deployments and upgrades.

---

### PLATFORM_SUPERADMIN (Break-glass)
**Status:** Break-glass role providing full platform access for emergency scenarios.

**Governance Rules**
- PLATFORM_SUPERADMIN must be assigned **only to a very small number of trusted operators**.
- Use should be **time-bound** (JIT elevation recommended) and limited to incident support / platform recovery.
- PLATFORM_SUPERADMIN is the only role permitted to bypass permission checks in the PermissionsGuard.
- PLATFORM_SUPERADMIN must not be used for routine tenant operations.

**Audit Expectation**
- Access elevation and usage must be logged and reviewed:
  - Who elevated access
  - When
  - Why (incident ticket / change reference)
  - Which tenant/legal entities were accessed (where applicable)
  - Actions performed (at least at endpoint/action level)

---

## Separation of Duties (SoD) Governance

### PR-SOD-03 Operational Requirement (Finance)
**Rule:** Payer cannot post/finalize a payrun.

**Operational Requirement**
When PR-SOD-03 is enabled (enforced in code), operations must ensure **at least two distinct finance personas/users** exist:
- One user authorized to mark payruns as paid (`payrun:pay`)
- A different user authorized to post/finalize (`payrun:post`, `payrun:finalize`)

**Rationale**
This is a standard payroll-grade control to reduce fraud risk and to ensure dual control for high-impact financial actions.

---

## Legal Entity Scoping
Operational roles must only operate within their allowed legal entities.
- User scope is derived from `UserLegalEntityAccess`.
- Services must enforce scoping using standardized helpers (e.g., `assertHasLegalEntities`, `assertLegalEntityAllowed`).
- Role permissions do not override legal entity scoping (scope is always enforced).

---

## Access Reviews
The following access reviews are recommended:
- Quarterly review of:
  - ADMIN assignments (must trend down)
  - PLATFORM_SUPERADMIN assignments (minimal, justified)
  - High-impact roles:
    - FINANCE_APPROVER
    - SARS_APPROVER
    - PAYROLL_APPROVER
- Review must confirm:
  - Correct legal entity access
  - No conflicting SoD assignments where controls require separation

---

## Exceptions
Exceptions to these governance rules must:
- Be explicitly approved (record approver identity)
- Have a documented start and end date
- Include the reason and risk acceptance
- Be tracked in a change/ticketing system

---

## Audit Logging (Step 2.5)
The following high-impact events are logged to `audit_logs` using canonical event codes:

**SoD violations (DENIED):**
- `SOD_PAYRUN_CREATOR_APPROVE_DENIED` (PR-SOD-01)
- `SOD_PAYRUN_APPROVER_PAY_DENIED` (PR-SOD-02)
- `SOD_PAYRUN_PAYER_FINALIZE_DENIED` (PR-SOD-03)
- `SOD_EMP201_GENERATOR_SUBMIT_DENIED` (SARS-SOD-01)
- `SOD_EMP501_SUBMITTER_APPROVE_DENIED` (SARS-SOD-02)

**Privilege-use (SUCCESS):**
- `PAYRUN_SUBMITTED`, `PAYRUN_APPROVED`, `PAYRUN_PAID`, `PAYRUN_POSTED`, `PAYRUN_FINALIZED`
- `EMP201_SUBMITTED`, `EMP501_APPROVED`

**PLATFORM_SUPERADMIN_ACCESS:** Every request when break-glass bypass is used (endpoint, method, user id, timestamp)

---

## References
- RBAC Spec: `docs/RBAC_SPEC.md`
- Permission enforcement: `src/common/guards/permissions.guard.ts`
- SoD enforcement:
  - `src/modules/payruns/payrun-lifecycle.service.ts`
  - `src/modules/sars/services/sars-tax.service.ts`
  - `src/modules/sars/services/emp501-reconciliation.service.ts`
