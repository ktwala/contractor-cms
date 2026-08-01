# PR-PAYRUN-GOV-3C — Payroll register ↔ GL posting

## Trust question

**Did what payroll calculated and settled get posted correctly into the ledger?**

This is where **payroll governance becomes finance governance**: GOV-3A proves internal register ↔ export intent; GOV-3B proves external settlement truth; **GOV-3C** proves the **general ledger** reflects that same payroll truth before the period is closed.

## Canonical object: `PayrunGLReconciliation`

One row per **`payrun_id`** (table `payrun_gl_reconciliations`). Key fields (API uses snake_case):

- `payrun_id`, `legal_entity_id`, `gl_batch_reference`, optional `gl_posting_hash` (duplicate detection vs other payruns in the same legal entity)
- Register side (from `EmployeeResult` aggregates): `register_gross`, `register_net`, `register_paye`, `register_deductions`
- GL side (import): `gl_gross`, `gl_net`, `gl_paye`, `gl_deductions`
- `variance_amount` (max absolute line variance at import), `variance_dimensions` (JSON: gross / net / paye / deductions deltas)
- `status`: `MATCH` | `VARIANCE` | `BLOCKED`
- `review_required`, `reviewed_by`, `reviewed_at`
- `source_type`: `ERP_IMPORT` | `GL_FILE` | `MANUAL`
- `soft_warnings`, `blocked_reasons`

## Governance chain (full)

**Calculate → Export → Bank confirm → GL post → Period close**

Baseline narrative: **Register → export → confirm → GL → close** (with GOV-3A/3B/3C gates at the appropriate steps).

## API (payruns)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/v1/payruns/:payrun_id/gl-reconciliation` | `payrun:read` |
| POST | `/v1/payruns/:payrun_id/gl-confirmation/import` | `payrun:edit` |
| POST | `/v1/payruns/:payrun_id/gl-confirmation/review` | `payrun:approve` |

## Period close gate

`POST /v1/api/payroll-cycle/periods/:periodId/close` (permission `payroll:periods:close`) runs **`PayrollPeriodCloseGateService.assertAllowsPeriodClose`**, which for **every payrun on that period** in **`PAID`**, **`POSTED`**, or **`FINALIZED`** enforces, in order:

1. **Readiness** — `PayrunReadinessGateService` with operation `payroll.period_close`
2. **GOV-3A** — `PayrunFinancialControlService.assertAllowsMarkPaidOrPosted` with operation `payroll.period_close`
3. **GOV-3B** — `PayrunBankReconciliationService.assertAllowsMarkPostedBankGate` with operation `payroll.period_close`
4. **GOV-3C** — `PayrunGLReconciliationService.assertAllowsPeriodCloseGl` with operation `payroll.period_close`

Override headers reuse the same family as mark paid/posted: readiness, financial, bank, and **GL**:

- `x-readiness-gate-override` / `x-readiness-override-justification`
- `x-financial-gate-override` / `x-financial-override-justification`
- `x-bank-gate-override` / `x-bank-override-justification`
- `x-gl-gate-override: approved`
- `x-gl-override-justification` (min length aligned with backend `PAYRUN_GL_OVERRIDE_JUSTIFICATION_MIN`)

Permission: **`payrun:gl_override`** (accounting authority; seeded on **FINANCE_REVIEWER** — see `docs/RBAC_SPEC.md` PR-RBAC-GOV-2).

Successful GL override → audit **`PAYRUN_GL_RECON_OVERRIDE`**.

## Period close UI (PR-PAYRUN-GOV-3C-UI)

**`admin-portal/src/pages/PayrollCalendars.tsx`** — when closing a period, the SPA sends **only** the override header pairs for gates the user checked **and** is permitted to use (`buildPeriodCloseOverrideHeaders` in `admin-portal/src/utils/periodCloseGovernanceClient.ts`). Shared justification must be at least **20** characters when any override is selected. A **403** response stores the API `code` per period so the UI can label the **blocking gate** (readiness, GOV-3A, GOV-3B, or GOV-3C) and keep **Close** disabled until the matching override path is valid, or the underlying data is fixed.

## Audit events

- **`PAYRUN_GL_RECON_MATCH`** — import outcome `MATCH`
- **`PAYRUN_GL_RECON_VARIANCE`** — import or variance acknowledgement
- **`PAYRUN_GL_RECON_OVERRIDE`** — period-close GL gate override

## Hard blocks (import → `BLOCKED`)

Includes: line mismatch beyond tolerance (gross / net / PAYE / deductions), **duplicate GL posting** (`DUPLICATE_GL_POSTING` when hash collides on another payrun in the same legal entity).

## Soft warnings

Flags on import (e.g. account mapping drift, cost center variance, timing lag, rounding-only differences) contribute to `VARIANCE` with optional review, depending on residual line variance.

## GL reconciliation baseline locked (PR-PAYRUN-GOV-3C-LOCK)

**GL reconciliation baseline locked.** The **register ↔ GL posting** program and the **period-close governance chain** (readiness + GOV-3A + GOV-3B + GOV-3C) are **baseline locked**: persistence, service rules, controller wiring, **Payroll Calendars** override headers (**PR-PAYRUN-GOV-3C-UI**), CORS, permissions, audit, and CI drift checks form one contract. Treat changes here as **cross-cutting**, not a single-file tweak.

### Required checks (CI)

- **`npm run check:payrun-gl-reconciliation-drift`** — `scripts/check_payrun_gl_reconciliation_drift.ts` (controller + period-close gate + **PayrollCalendars** / **periodCloseGovernanceClient** parity, seed, CORS, docs)
- **Backend:** `src/modules/payruns/__tests__/payrun-gl-reconciliation.spec.ts`
- **Frontend:** `admin-portal/src/utils/payrunGlReconciliationClient.test.ts`
- **Frontend (period close):** `admin-portal/src/utils/periodCloseGovernanceClient.test.ts`

### Forbidden regressions

- **Period close without readiness / 3A / 3B / 3C gates** — `POST …/periods/:periodId/close` must always run `PayrollPeriodCloseGateService.assertAllowsPeriodClose` before mutating period state; no bypass for in-scope payruns.
- **GL override without permission** — accepting GL override headers when the actor lacks **`payrun:gl_override`** (backend must deny).
- **Override without 20+ char justification** — trimmed justification below the shared minimum (aligned with readiness / financial / bank override rules) must not succeed as an audited override path.
- **Override without audit** — a successful GL gate override that does not emit **`PAYRUN_GL_RECON_OVERRIDE`** on the audit log (and the same standard for sibling gates where overrides apply on period close).
- **Duplicate GL postings silently accepted** — same settlement identity must not attach to another payrun in the same legal entity without **`DUPLICATE_GL_POSTING`** (or an equivalent documented replacement).
- **Payroll Calendars UI unable to pass required override headers** — **`PayrollCalendars.tsx`** must remain able to send the same **`x-*-gate-override`** / **`x-*-override-justification`** families the backend expects for period close (via **`periodCloseGovernanceClient`**); drift must keep enforcing that parity.

### Ownership rule

Any change that affects **GL import**, **reconciliation logic or persistence**, **period-close gate** orchestration, **UI** (Payrun detail GL card **and** Payroll Calendars period-close overrides), **override headers** / CORS, **audit** events, **permissions**, **error contract**, **tests**, or **drift** must land **together**:

1. **Import / reconcile / persist** — `PayrunGLReconciliationService`, Prisma model if fields change.  
2. **Period close gate** — `PayrollPeriodCloseGateService`, `PayrollCycleController.closePeriod`, and related GOV-3A/3B operation labels (`payroll.period_close`).  
3. **UI** — Payrun detail GL panel; **PayrollCalendars** + **`periodCloseGovernanceClient`**.  
4. **Audit** — match / variance / override payloads remain truthful and searchable.  
5. **Tests** — `payrun-gl-reconciliation.spec.ts`, `payrunGlReconciliationClient.test.ts`, **`periodCloseGovernanceClient.test.ts`** updated for new behaviour.  
6. **Drift gate** — `scripts/check_payrun_gl_reconciliation_drift.ts`.  
7. **Documentation** — this file (`docs/PAYRUN_GL_RECONCILIATION.md`).

## Related

- [PAYRUN_FINANCIAL_CONTROL.md](./PAYRUN_FINANCIAL_CONTROL.md) — GOV-3A  
- [PAYRUN_BANK_RECONCILIATION.md](./PAYRUN_BANK_RECONCILIATION.md) — GOV-3B  
- [PAYRUN_EXECUTION.md](./PAYRUN_EXECUTION.md) — readiness-gated execution  

## Next slice (GOV-3D)

**Period close + reversal governance** — temporal truth after close: reversals, audit trail, and close integrity so the ledger and payroll history stay aligned (see roadmap in `PAYRUN_FINANCIAL_CONTROL.md`). With **PR-PAYRUN-GOV-3C-LOCK** in place, GOV-3D can focus on **post-close** behaviour without re-litigating register ↔ GL trust.

Implemented first slice: **[PAYRUN_CLOSED_PERIOD_GOVERNANCE.md](./PAYRUN_CLOSED_PERIOD_GOVERNANCE.md)** (`PR-PAYRUN-GOV-3D-1`).
