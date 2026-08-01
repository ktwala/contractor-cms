# PR-PAYRUN-GOV-4 — Post-reversal / correction reconciliation impact (GOV-4)

When a **closed-period** source payrun is changed only through the governed paths (GOV-3D-2 reversal workflow or correction approval), linking the compensating **adjustment** payrun records that downstream **financial (3A), bank (3B), and GL (3C)** truths tied to the **immutable source** may no longer describe the full economic story until operators re-truth and acknowledge.

## Data model (minimal v1)

On `payruns` (source REGULAR payrun):

| Column | Meaning |
|--------|---------|
| `financial_control_impacted` | 3A register↔export may be stale vs current understanding |
| `bank_reconciliation_impacted` | 3B export↔bank may be stale |
| `gl_reconciliation_impacted` | 3C register↔GL may be stale |

On `payrun_reversal_workflows` and `payrun_correction_approvals`:

| Column | Meaning |
|--------|---------|
| `downstream_reconciliation_required` | Set when adjustment is linked; cleared with payrun impact acknowledge |

## Trigger

`PayrunReversalWorkflowService.linkReversalPayrun` and `PayrunCorrectionApprovalService.linkAdjustmentPayrun` run in a transaction that:

1. Completes the workflow / approval row (including `downstream_reconciliation_required = true`).
2. Sets all three impact flags on the **source** payrun to `true` (v1 marks every pillar stale; future versions may scope per event).

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/payruns/:id/post-close-reconciliation-impact` | `payrun:read` |
| POST | `/payruns/:id/post-close-reconciliation-impact/acknowledge` | `payrun:approve` |

Acknowledgement clears source impact flags and `downstream_reconciliation_required` on related workflows/approvals. It does **not** re-run 3A/3B/3C — operators must re-reconcile on the source (and run 3A/3B/3C on the **adjustment** payrun as needed) before acknowledging.

## 3A / 3B / 3C responses

`PayrunFinancialControlService`, `PayrunBankReconciliationService`, and `PayrunGLReconciliationService` expose:

`post_close_reconciliation_impact_pending` — sourced from the corresponding payrun impact flag so UIs can show pillar-level warnings without a second round-trip.

## Period close (archival governance)

`PayrollPeriodCloseGateService` calls `PayrunPostCloseReconciliationImpactService.assertAllowsPeriodClose` **before** GOV-3A/3B/3C checks. If any source impact flag is still `true`, period close returns `403` with code `PAYRUN_POST_CLOSE_RECON_IMPACT_PENDING`.

## Governance chain

Close period → (optional) reverse/correct → link adjustment → **impact flags** → re-truth 3A/3B/3C as needed → **acknowledge** → period close allowed again.

---

## PR-PAYRUN-GOV-4-LOCK — Post-reversal reconciliation impact baseline locked

**Post-reversal reconciliation impact** is **merge-frozen** as a unit: reversal/correction **link** transactions that set source impact flags and `downstream_reconciliation_required`, **`PayrunPostCloseReconciliationImpactService`** (summary, period-close assert, acknowledge + audit), **`PayrollPeriodCloseGateService`** wiring, **3A / 3B / 3C** responses exposing `post_close_reconciliation_impact_pending`, **admin `PayrunDetail`** (banner + Post-close Impact card + acknowledge flow), **tests**, **drift scripts + CI**, and **this document** must evolve **together**. Reviewers should reject partial PRs that change behaviour without updating the matching surfaces.

### Required checks

- **Drift (GOV-4):** `npm run check:payrun-post-reversal-impact-drift` (`scripts/check_payrun_post_reversal_impact_drift.ts`) — CI must keep schema, link services, impact service, period-close gate, controller routes, 3A/3B/3C wiring, UI, package script, and **this doc including the GOV-4-LOCK section** aligned.
- **Unit / service spec:** `src/modules/payruns/__tests__/payrun-post-close-reconciliation-impact.service.spec.ts` — must continue to cover summary aggregation, acknowledge + transaction semantics, `assertAllowsPeriodClose` allow/deny, and `GOV-4` / `GOV-4-LOCK` intent in naming or comments.
- **Related 3A / 3B / 3C drift** — each must keep asserting `post_close_reconciliation_impact_pending` on pillar responses so controls cannot silently drop impact surfacing:
  - `npm run check:payrun-financial-control-drift` (`scripts/check_payrun_financial_control_drift.ts`)
  - `npm run check:payrun-bank-reconciliation-drift` (`scripts/check_payrun_bank_reconciliation_drift.ts`)
  - `npm run check:payrun-gl-reconciliation-drift` (`scripts/check_payrun_gl_reconciliation_drift.ts`)

### Forbidden regressions

- **Reversal or correction link** without setting the three **source** impact flags (`financial_control_impacted`, `bank_reconciliation_impacted`, `gl_reconciliation_impacted`) in the same transaction as completing the link.
- **Downstream workflow / approval** not marked **`downstream_reconciliation_required`** when the compensating adjustment payrun is linked.
- **Payroll period close** allowed while any source impact flag remains `true` (must keep `PayrunPostCloseReconciliationImpactService.assertAllowsPeriodClose` in the period-close gate before 3A/3B/3C orchestration).
- **3A / 3B / 3C API responses** omitting or failing to surface **`post_close_reconciliation_impact_pending`** when the corresponding payrun impact flag is set.
- **`acknowledgeImpact`** without **`PAYRUN_POST_CLOSE_RECON_IMPACT_ACK`** audit (or clearing flags / downstream flags outside the governed acknowledge path).
- **UI hiding active post-close impact** — when the API reports impact, the payrun detail view must not drop the reconciliation-impact banner, pillar warnings, or the Post-close Impact card without an intentional governance redesign reflected in docs + drift.

### Ownership rule

**Reversal/correction link**, **impact flags** (Prisma + writes on link), **period-close gate** (`assertAllowsPeriodClose`), **3A/3B/3C response fields**, **UI** (`PayrunDetail` impact surfaces), **`PAYRUN_POST_CLOSE_RECON_IMPACT_ACK` audit**, **tests** (`payrun-post-close-reconciliation-impact.service.spec.ts` and any linked specs), **drift** (`check_payrun_post_reversal_impact_drift.ts` plus the three pillar drift scripts above), and **this doc** (including **GOV-4-LOCK**) are **one governance change-set** for GOV-4 regressions.

## Drift guard

```bash
npm run check:payrun-post-reversal-impact-drift
```

## Related

- `docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md` — GOV-3D baseline
- `docs/PAYRUN_FINANCIAL_CONTROL.md` — GOV-3A
- Bank / GL docs for GOV-3B / GOV-3C
