# Payroll register ↔ payment export financial control (PR-PAYRUN-GOV-3A)

This is the **first vertical** under **PR-PAYRUN-GOV-3 — Financial control & reconciliation**. It answers:

**Does the approved payroll register exactly reconcile to the payment export (within policy) before we mark paid or posted?**

## Baseline chain

**Calculate → Approve → Export → Reconcile → Pay**

- **Register:** `EmployeeResult` rows for the payrun (canonical net totals from calculation).
- **Export:** `PaymentBatch` + `Payment` rows after **payment batch export** (`exportStatus === GENERATED`).
- **Reconcile:** `PayrunFinancialControl` snapshot compares register vs export (counts, net totals, hard blocks, soft warnings).
- **Mark paid:** `POST /payruns/:id/mark-paid` requires **MATCH**, or **VARIANCE** with **acknowledged review**, or an **audited financial override** (this gate only).  
- **Mark posted:** `POST /payruns/:id/mark-posted` also requires **GOV-3B** bank confirmation — see [`PAYRUN_BANK_RECONCILIATION.md`](./PAYRUN_BANK_RECONCILIATION.md).

## Canonical object: `PayrunFinancialControl`

Stored in table `payrun_financial_controls` (see Prisma). API shape (snake_case JSON) includes:

- `payrun_id`, `payment_batch_id`
- `employee_count_register`, `employee_count_export`
- `total_net_register`, `total_net_export`
- `variance_amount`, `variance_employee_count`
- `status`: `MATCH` | `VARIANCE` | `BLOCKED`
- `threshold_policy` (baseline: `DEFAULT_ZAR_0_05` — absolute net variance cap **0.05** same currency)
- `review_required`, `reviewed_by`, `reviewed_at`
- `soft_warnings`, `blocked_reasons`
- `reconciled_at`

## API

| Method | Path | Permission |
|--------|------|--------------|
| GET | `/v1/payruns/:payrun_id/financial-control` | `payrun:read` |
| POST | `/v1/payruns/:payrun_id/financial-control/reconcile` | `payrun:edit` |
| POST | `/v1/payruns/:payrun_id/financial-control/review` | `payrun:approve` |

Reconciliation also runs automatically after **`POST /v1/payments/batches/:id/export`** succeeds.

## Hard blocks (→ `BLOCKED`)

Includes: no batch, export not generated, employee count mismatch, net total beyond threshold, duplicate payment employee, duplicate bank account key on export lines, negative payment amounts.

## Soft warnings (→ `VARIANCE`, `review_required`)

Includes: zero-net employees on register, missing bank reference on export payment rows.

## Financial override (separate from readiness)

- Permission: **`payrun:financial_override`** (seeded on **PAYROLL_MANAGER** and **GLOBAL_PAYROLL_ADMIN**; distinct from **`payrun:readiness_override`** and from **TENANT_ADMIN** — see `docs/RBAC_SPEC.md` PR-RBAC-GOV-2).
- Headers on **mark paid / mark posted**:
  - `x-financial-gate-override: approved`
  - `x-financial-override-justification` (min **20** characters trimmed)

Successful override → audit **`PAYRUN_FINANCIAL_CONTROL_OVERRIDE`**.

Reconcile outcomes → **`PAYRUN_FINANCIAL_CONTROL_MATCH`** or **`PAYRUN_FINANCIAL_CONTROL_VARIANCE`** (includes blocked outcomes in payload).

## Financial control baseline locked (PR-PAYRUN-GOV-3A-LOCK)

The **payroll register ↔ payment export financial control program is baseline locked**: reconciliation rules, export coupling, lifecycle gates, and admin behaviour are enforced in CI. Treat changes here as a **cross-cutting contract**, not a single-file tweak.

### Required checks (CI)

- **`npm run check:payrun-financial-control-drift`** — static contract vs controller gate, payment export hook, seed permission, CORS, admin Payrun detail, shared client, and spec presence (`scripts/check_payrun_financial_control_drift.ts`).
- **Backend:** `src/modules/payruns/__tests__/payrun-financial-control.spec.ts` — gate allow / block / override with audit expectations.
- **Frontend:** `admin-portal/src/utils/payrunFinancialControlClient.test.ts` — override header shape, `PAYRUN_FINANCIAL_GATE_BLOCKED` detection, guard helper behaviour.

### Forbidden regressions

- **`mark-paid` / `mark-posted` without the financial gate** on the controller path for those mutations.
- **Financial override without permission** — accepting override headers when the actor lacks **`payrun:financial_override`** (backend must deny; UI must not imply success).
- **Override without justification** — override approved without a justification meeting the **minimum length** (trimmed).
- **Override without audit** — a successful override path that does not emit **`PAYRUN_FINANCIAL_CONTROL_OVERRIDE`** on the audit log.
- **Payment export not triggering reconcile** — `POST …/payments/batches/:id/export` must continue to invoke reconciliation for the linked payrun (or an equivalent documented replacement).
- **Frontend action enabled while the backend would block** — primary or secondary CTAs for **mark paid / mark posted** must stay consistent with financial control status and override rules (same inputs the API enforces).

### Ownership rule (financial control changes)

Any change that affects **register totals**, **payment export** shape or timing, **reconciliation** logic or persistence, the **mark paid / mark posted gate**, **admin UI**, **audit** events, **permissions**, or **error contract** must land **together**:

1. **Register / export / reconcile** — `PayrunFinancialControlService`, `PaymentBatchService` export hook, Prisma model if persisted fields change.  
2. **Gate** — `PayrunsController` wiring for **mark paid** and **mark posted**.  
3. **UI** — **Payrun detail** (`FINANCIAL_GATED_PAY_ACTIONS`, financial control panel, override inputs, headers on gated requests).  
4. **Audit** — match / variance / override actions and payloads remain truthful and searchable.  
5. **Tests** — `payrun-financial-control.spec.ts` and `payrunFinancialControlClient.test.ts` updated for the new behaviour.  
6. **Drift gate** — `scripts/check_payrun_financial_control_drift.ts` so CI continues to encode the contract.  
7. **Documentation** — this file (`docs/PAYRUN_FINANCIAL_CONTROL.md`).

## Existing environments

Re-run **`prisma/seed.ts`** (or equivalent migration) so **`payrun:financial_override`** exists and is assigned where intended.

## Later slices (GOV-3B–D)

- **3B:** **Payment export ↔ bank confirmation** — see [`docs/PAYRUN_BANK_RECONCILIATION.md`](./PAYRUN_BANK_RECONCILIATION.md) (`PR-PAYRUN-GOV-3B`). Mark **posted** requires this gate in addition to GOV-3A.  
- **3C:** **Register ↔ GL posting** — see [`docs/PAYRUN_GL_RECONCILIATION.md`](./PAYRUN_GL_RECONCILIATION.md) (`PR-PAYRUN-GOV-3C`). **Period close** runs readiness + 3A + 3B + 3C for in-scope payruns.  
- **3D:** Period close + reversal governance  
