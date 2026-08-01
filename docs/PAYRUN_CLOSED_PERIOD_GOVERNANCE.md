# Payrun closed-period governance (GOV-3D-1)

**PR:** `PR-PAYRUN-GOV-3D-1 — Closed Period Mutation Guard`

## Source of truth

When payroll period close succeeds (`POST …/payroll-cycle/periods/:periodId/close` after the GOV-3C gate), the `pay_periods.closed_at` timestamp is set together with `closed_by_user_id`. This is the durable signal for **closed period** (independent of UI period badges).

## What is blocked

For a **REGULAR** payrun linked to a period with `closed_at` set, the API blocks register / lifecycle mutations including:

- Snapshot, employee include/exclude/remove, line-item inputs, calculate  
- Submit, approve, revert-to-draft, mark paid, mark posted, finalize  
- Creating another **REGULAR** payrun for the same `period_id`

## Allowed paths

1. **Adjustment payrun** — `payrun_type === ADJUSTMENT` may be edited through the normal payrun workflow (created via `POST …/payruns/:id/create-adjustment` against a finalized base run).  
2. **Audited bypass** — callers with permission `payrun:closed_period_override` may send:

   - `x-closed-period-mutation-bypass: approved` **and**  
   - `x-closed-period-mutation-justification` (minimum 20 characters)  

   **or** structured routing identifiers (same permission + justification required):

   - `x-reversal-workflow-id` (at least 8 characters), or  
   - `x-payrun-correction-approval-id` (at least 8 characters)

   Successful bypasses emit audit action `PAYRUN_CLOSED_PERIOD_MUTATION_BYPASS`.

3. **Governed reversal / correction (GOV-3D-2)** — first-class `PayrunReversalWorkflow` and `PayrunCorrectionApproval` records (see below). While a workflow/approval is **APPROVED** and the compensating **adjustment payrun is not yet linked** (`reversal_payrun_id` / `resulting_adjustment_payrun_id` still null), callers may pass `x-reversal-workflow-id` or `x-payrun-correction-approval-id` together with `x-closed-period-mutation-justification` (≥ 20 chars) **without** `payrun:closed_period_override`. After the adjustment is linked, the closed **REGULAR** source stays immutable; ongoing work uses the **ADJUSTMENT** payrun (exempt from the closed-period guard by type).

   Successful governed mutations emit **`PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION`**.

## Client / CORS

Browser clients must allow the bypass headers through CORS (`src/main.ts`).

## PR-PAYRUN-GOV-3D-2 — Reversal / correction governance (minimal v1)

**Core question:** *If payroll truth must change after close, what is the approved path?*

### Data model (Prisma)

- **`PayrunReversalWorkflow`** — `source_payrun_id`, `reason`, `initiated_by_user_id`, `approved_by_user_id`, `status`, optional `reversal_payrun_id`, `audit_chain` JSON.  
- **`PayrunCorrectionApproval`** — `payrun_id`, `requested_change_scope`, `requested_by_user_id`, `approver_user_id`, `approval_reference` (unique), optional `resulting_adjustment_payrun_id`, `status`.

### HTTP (under `GET/POST /v1/payruns/…`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `:payrun_id/reversal-workflows` | List workflows for a source payrun |
| POST | `:payrun_id/reversal-workflows` | Request workflow (`reason`) — requires closed period + **FINALIZED** REGULAR |
| POST | `:payrun_id/reversal-workflows/:workflow_id/approve` | Approve (initiator ≠ approver) |
| POST | `:payrun_id/reversal-workflows/:workflow_id/link-reversal-payrun` | Link `reversal_payrun_id` (must be **ADJUSTMENT** with `base_payrun_id` = source) |
| GET | `:payrun_id/correction-approvals` | List correction approvals |
| POST | `:payrun_id/correction-approvals` | Create request (`requested_change_scope`) — closed period REGULAR |
| POST | `:payrun_id/correction-approvals/:approval_id/approve` | Approve (requester ≠ approver) |
| POST | `:payrun_id/correction-approvals/:approval_id/link-adjustment` | Link `resulting_adjustment_payrun_id` |

Permissions: **`payrun:edit`** (request), **`payrun:approve`** (approve), **`payrun:adjust`** (link adjustment / reversal payrun).

### Hard rules (v1)

- **No direct mutation** of the closed REGULAR register after the compensating adjustment is linked (workflow **COMPLETED** / correction **APPLIED** ends governed header access on the source).  
- **Reversal** records an audit chain on the workflow; linking enforces **ADJUSTMENT** + correct `base_payrun_id`.  
- **Correction** routes to an adjustment payrun via **link-adjustment** with the same **ADJUSTMENT** validation.  
- **Bank / GL downstream** impacts are not auto-reversed in this slice — operators should re-run reconciliation and treat variances explicitly (future GOV-3D-3+).

## Related

- Period close orchestration: `docs/PAYRUN_GL_RECONCILIATION.md` (GOV-3C)  
- Lock rules: `GET …/payruns/:id/lock-rules` includes `period_closed` when the linked period is closed.

---

## PR-PAYRUN-GOV-3D-LOCK — Closed period mutation baseline locked

This slice is **merge-frozen** as a unit: durable close state, API guard, lock-rules contract, permissions, CORS, audit semantics, tests, drift CI, admin UI parity, and this document must evolve **together**. Do not land a regression that changes behaviour without updating the matching surfaces (especially drift + spec).

### Required checks

- **Unit / service spec:** `src/modules/payruns/__tests__/payrun-closed-period-mutation-guard.service.spec.ts` — must continue to assert closed-period deny/allow and bypass audit paths.
- **Drift gate:** `npm run check:payrun-closed-period-drift` (`scripts/check_payrun_closed_period_drift.ts`) — CI must keep the wiring (controller → guard, `PayrunsService` create + lock-rules, schema, calendar close, seed, permissions, CORS, docs, UI `period_closed` usage).

### Forbidden regressions

- **Mutating closed-period regular payruns** without an allowed route (adjustment payrun type, governed GOV-3D-2 pre-link approval, or audited break-glass override).
- **Break-glass bypass without permission** `payrun:closed_period_override` (governed GOV-3D-2 path does **not** use this permission; it requires an approved DB workflow/approval + justification).
- **Break-glass bypass without** one of: `x-closed-period-mutation-bypass: approved`, or opaque `x-reversal-workflow-id` / `x-payrun-correction-approval-id` (≥ 8 chars), **together with** `x-closed-period-mutation-justification` (≥ 20 chars).
- **Bypass without audit** — successful break-glass must log `PAYRUN_CLOSED_PERIOD_MUTATION_BYPASS`; successful governed header path must log `PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION`.
- **Regular payrun creation** for a closed `period_id` without the same audited bypass contract.
- **UI showing mutating actions** when `GET …/payruns/:id/lock-rules` returns `period_closed: true` for a **REGULAR** payrun (admin `PayrunDetail` must respect `period_closed`; adjustment runs stay editable).

### Ownership rule

Changes to **period close state** (`pay_periods.closed_at`), **mutation guard** (`PayrunClosedPeriodMutationGuardService` + controller wiring), **reversal/correction tables and services** (`PayrunReversalWorkflow`, `PayrunCorrectionApproval`), **lock rules** (`period_closed` + rule flags), **permissions / seed**, **CORS**, **audit** action names and payloads, **tests**, **drift script**, and **this doc** are one governance change-set: reviewers should reject partial PRs that split them.

---

## PR-PAYRUN-GOV-3D-2-LOCK — Governed reversal / correction baseline locked

This slice freezes **GOV-3D-2** as a unit: first-class workflow/approval models, guard helpers (`isApprovedWorkflowForSourceMutation`, `isApprovedCorrectionForSourceMutation`), `PayrunsController` routes, audit actions on create/approve/link, **service specs**, the closed-period **guard spec**, **drift script**, and this document must evolve **together**.

### Required checks

- **Drift:** `npm run check:payrun-closed-period-drift` — must keep schema, controller routes, guard `PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION`, services, and doc references aligned.
- **Closed-period guard spec:** `src/modules/payruns/__tests__/payrun-closed-period-mutation-guard.service.spec.ts` — governed vs break-glass paths and audit expectations.
- **Reversal / correction service specs:**  
  - `src/modules/payruns/__tests__/payrun-reversal-workflow.service.spec.ts`  
  - `src/modules/payruns/__tests__/payrun-correction-approval.service.spec.ts`  

### Forbidden regressions

- **Approved workflow reused after linked reversal** — governed header path on the **source** must fail once `reversal_payrun_id` is set (workflow moves to **COMPLETED**; `isApprovedWorkflowForSourceMutation` must require `reversal_payrun_id: null`).
- **Approved correction reused after linked adjustment** — same for `resulting_adjustment_payrun_id` and **APPLIED** / `isApprovedCorrectionForSourceMutation`.
- **Initiator approving own reversal** or **requester approving own correction** — SoD checks in `PayrunReversalWorkflowService.approve` / `PayrunCorrectionApprovalService.approve` must remain.
- **Governed mutation without DB-backed approved workflow/approval** — guard must resolve headers against persisted rows, not trust opaque strings alone (break-glass remains a separate, permissioned path).
- **Governed mutation without audit** — `PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION` (and service-level `PAYRUN_REVERSAL_*` / `PAYRUN_CORRECTION_*` audits) must not be dropped or bypassed.
- **Direct mutation of the original closed REGULAR payrun** after reversal/correction link — pre-link window only; post-link governed access on the **source** must be denied; work continues on the **ADJUSTMENT** payrun (type-exempt in the closed-period guard).

### Ownership rule

**Workflow models**, **guard helpers**, **`PayrunsController` routes**, **audit** payloads, **service + guard tests**, **`check_payrun_closed_period_drift.ts`**, and **this doc** (including both **3D-LOCK** and **3D-2-LOCK** sections) are one change-set for GOV-3D-2 regressions.

### Next slice (roadmap)

**Post-reversal reconciliation impact (GOV-4)** — implemented: see [`docs/PAYRUN_POST_REVERSAL_IMPACT.md`](./PAYRUN_POST_REVERSAL_IMPACT.md) (`PR-PAYRUN-GOV-4` + **GOV-4-LOCK** baseline), impact flags on the source payrun, period-close blocking until acknowledgement, and `npm run check:payrun-post-reversal-impact-drift`.
