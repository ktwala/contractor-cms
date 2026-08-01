# Payrun execution (readiness-gated)

Payrun **creation**, **calculation**, and **downstream publish-style lifecycle** actions are governed by **PR-PAYRUN-GOV-1 — Readiness-Gated Payrun Execution**.

**Register ↔ payment export** before mark paid/posted is governed separately under **PR-PAYRUN-GOV-3A** — see [`docs/PAYRUN_FINANCIAL_CONTROL.md`](./PAYRUN_FINANCIAL_CONTROL.md). **Mark posted** additionally requires **PR-PAYRUN-GOV-3B** ([`docs/PAYRUN_BANK_RECONCILIATION.md`](./PAYRUN_BANK_RECONCILIATION.md)).

**Terminal cancellation** (pre-approval abandon) is **not** readiness-gated — see [`docs/PAYRUN_CANCEL.md`](./PAYRUN_CANCEL.md) (**PR-PAYRUN-CANCEL-1**).

## Baseline rule

Do not **create** a payrun, **snapshot**, **calculate** (engine or legacy), **submit for approval**, **approve**, **mark paid**, **mark posted**, **finalize**, or **create an adjustment payrun** for a pay group unless **payroll readiness is green** (`canCreatePayrun === true` from `GET /v1/payroll/readiness/pay-groups/:payGroupId`) **or** the action is an **explicit, audited override** (see below).

The backend enforces this in `PayrunReadinessGateService` and `PayrunsController`. The admin UI mirrors the rule so operators see the constraint before calling the API.

## Readiness API

- **Route:** `GET /v1/payroll/readiness/pay-groups/:payGroupId`
- **Auth:** JWT; **permissions:** `payrun:read` **or** `pay_group:read`
- **Semantics:** `canCreatePayrun` is `true` only when periods exist, there is at least one eligible employee, and there are no blocking reasons (see `PayrollReadinessService`).

## Override (break-glass)

Reserved for operators who hold **`payrun:readiness_override`** (seeded on **PAYROLL_MANAGER** and **GLOBAL_PAYROLL_ADMIN**; not **TENANT_ADMIN** — see `docs/RBAC_SPEC.md` PR-RBAC-GOV-2).

Required HTTP headers on the gated request:

| Header | Value |
|--------|--------|
| `x-readiness-gate-override` | `approved` (case-insensitive) |
| `x-readiness-override-justification` | Non-empty string, **minimum 20 characters** after trim |

A successful override emits audit action **`PAYRUN_READINESS_GATE_OVERRIDE`** with the operation, readiness snapshot fields, and the justification.

If readiness is not green and override conditions are not met, the API responds with **403** and payload code **`PAYROLL_READINESS_GATE_BLOCKED`** (includes `blockingReasons`, `canCreatePayrun`, `readinessPercent`).

**CORS:** `src/main.ts` allows the override headers on cross-origin browser calls.

## Payrun execution baseline locked (PR-PAYRUN-GOV-2)

The **payrun execution program is baseline locked**: readiness gating, override policy, and admin alignment are enforced in CI. Treat changes here as a **cross-cutting contract**, not a single-file tweak.

### Required checks (CI)

- **`npm run check:payrun-execution-drift`** — static contract vs controller wiring, module imports, CORS, seed permission, admin pages, and shared client (`scripts/check_payrun_execution_drift.ts`).
- **Backend:** `src/modules/payruns/__tests__/payrun-readiness-gate.spec.ts` — gate allow / block / override with audit, minimum justification.
- **Frontend:** `admin-portal/src/utils/payrunExecutionClient.test.ts` — override header shape, `PAYROLL_READINESS_GATE_BLOCKED` detection, guard helper behaviour.

### Forbidden regressions

- **Create / calculate / publish** (and any other gated lifecycle action) **without** the readiness gate on the **controller** path for that mutation.
- **Override without permission** — accepting override headers when the actor lacks **`payrun:readiness_override`** (backend must deny; UI must not imply success).
- **Override without justification** — override approved without a justification meeting the **minimum length** (trimmed).
- **Override without audit** — a successful override path that does not emit **`PAYRUN_READINESS_GATE_OVERRIDE`** on the audit log.
- **Frontend action enabled while the backend would block** — primary or secondary CTAs that call gated endpoints must stay consistent with `canCreatePayrun` and override rules (same inputs the API enforces).

### Ownership rule (payrun lifecycle changes)

Any change to a **payrun lifecycle action** (new or moved endpoint, permission, gate condition, override contract, or admin entrypoint) must land **together**:

1. **Controller gate** — `PayrunsController` / `PayrunReadinessGateService` wiring for that action.  
2. **Frontend guard** — **Create Payrun**, **Payrun detail**, and shared helpers (`payrunExecutionClient.ts`, `READINESS_GATED_ACTIONS` where applicable).  
3. **Documentation** — this file (`docs/PAYRUN_EXECUTION.md`).  
4. **Tests** — `payrun-readiness-gate.spec.ts` and `payrunExecutionClient.test.ts` updated or extended for the new behaviour.  
5. **Drift gate** — `scripts/check_payrun_execution_drift.ts` so CI continues to encode the contract.

### Seed and existing environments

> **Existing environments** must **re-run seed** or apply an **equivalent permission migration** so the **`payrun:readiness_override`** permission exists and is assigned to the intended roles. New deploys that rely on `prisma/seed.ts` pick this up automatically when seed is part of the rollout.
