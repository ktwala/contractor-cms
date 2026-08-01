# Payroll Governance Master Index

Single operating map for **GOV-1 … GOV-7** and the **CONTAINER** vertical (**tax-year payroll shell**): where the contract is written, how CI freezes it, which tests prove it, which permissions and routes expose it, and what “one change-set” ownership means. Audience: developers, internal audit, PMO.

**How this map may change:** [`docs/PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md) (**GOV-META-1** / PR-PAYRUN-GOV-META-1) — hierarchy, amendment and supersession rules, naming, ownership, audit, and meta-governance.

**Policy-change lifecycle (GOV-7, end-to-end):** Preview → Hash → Acknowledge → Draft → Approve / Reject / Cancel → Activate → Audit. Canonical narrative: [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md) (GOV-7A / GOV-7B / PR-PAYRUN-GOV-7B-2).

**Strategic ladder (GOV-2 … GOV-4 in the cockpit):** same file, “Strategic map” and GOV-5A DTO field descriptions.

---

## CI anchor

All **drift gates** below run in **`.github/workflows/ci.yml`** on the **`lint-and-test`** job (after `npm run lint`), in the order listed there. **`check:payroll-container-drift`** (**CONTAINER** / **PR-PAYROLL-CONTAINER-META-1**) runs before **`check:payroll-governance-constitution-drift`** (**GOV-META-2**, **PR-PAYRUN-GOV-META-2-LOCK**); META-2 asserts every **GOV-1 … GOV-7** slice **and** the **CONTAINER** registry row still have doc / drift / tests / CI / LOCK / index wiring — see [`docs/PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md). **GOV-1** additionally has a dedicated **`payroll-import-e2e`** job (migrated DB, contract Jest, Playwright import consoles).

---

## GOV-1 — Import integrity

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYROLL_IMPORTS.md`](./PAYROLL_IMPORTS.md) (payroll supplemental + opening balances, **baseline locked**). Supporting: [`docs/DATA_IMPORT_WIZARD.md`](./DATA_IMPORT_WIZARD.md), [`docs/BOOTSTRAP_PACK_IMPORT.md`](./BOOTSTRAP_PACK_IMPORT.md). |
| **Drift** | `npm run check:payroll-import-drift` → [`scripts/check_payroll_import_drift.ts`](../scripts/check_payroll_import_drift.ts) |
| **Tests** | `src/modules/data-imports/__tests__/payroll-import-contract.spec.ts`; Playwright `npm run test:playwright:payroll-imports` → `test/playwright/payroll-import-consoles.spec.ts` |
| **CI** | `lint-and-test` → Payroll import drift gate; `payroll-import-e2e` → seed + contract spec + Playwright |
| **Permissions** | `data_import:read`, `data_import:write`, `data_import:approve`, `data_import:publish` (and `iam:legal_entities:manage` where enterprise listing applies) — see `src/modules/data-imports/**/*.controller.ts` |
| **Key routes (admin UI)** | `/enterprise/data-imports`, `/enterprise/data-imports/wizard`, `/enterprise/data-imports/bootstrap-pack`, `/enterprise/data-imports/payroll-supplemental`, `/enterprise/data-imports/payroll-opening-balances`, `/enterprise/data-imports/:jobId` — [`admin-portal/src/App.tsx`](../admin-portal/src/App.tsx) |
| **Owner rule** | Any **schema or contract** change lands **together**: parser + tenant template + precheck/upload/publish + grouped error export + **this doc** + drift script — per [`PAYROLL_IMPORTS.md`](./PAYROLL_IMPORTS.md) “Ownership rule”. |

**Note:** GOV-1 is **not** rolled into per-payrun governance health DTO (see GOV-5 strategic map); it is still first-class for payroll truth because downstream readiness and payruns depend on clean imports.

---

## GOV-2 — Execution governance (readiness-gated payrun execution)

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_EXECUTION.md`](./PAYRUN_EXECUTION.md) (**PR-PAYRUN-GOV-2** / execution baseline locked) |
| **Drift** | `npm run check:payrun-execution-drift` → [`scripts/check_payrun_execution_drift.ts`](../scripts/check_payrun_execution_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-readiness-gate.spec.ts`; `admin-portal/src/utils/payrunExecutionClient.test.ts` |
| **CI** | `lint-and-test` → Payrun execution drift gate; covered by broader `npm run test:cov` |
| **Permissions** | `payrun:read`, `payrun:edit`, `pay_group:read`, gated actions; override: **`payrun:readiness_override`** |
| **Key routes** | `GET /v1/payroll/readiness/pay-groups/:payGroupId`; payrun lifecycle mutations on `PayrunsController` — see execution doc |
| **Owner rule** | Controller gate + frontend guard (`payrunExecutionClient.ts`, Create Payrun / Payrun detail) + doc + tests + drift — per [`PAYRUN_EXECUTION.md`](./PAYRUN_EXECUTION.md) |

### GOV-2B — Payrun cancellation (terminal, pre-execution)

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_CANCEL.md`](./PAYRUN_CANCEL.md) (**PR-PAYRUN-CANCEL-1**) |
| **Drift** | `npm run check:payrun-cancel-drift` → [`scripts/check_payrun_cancel_drift.ts`](../scripts/check_payrun_cancel_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-cancel.service.spec.ts`; `admin-portal/src/utils/payrunCancelClient.test.ts` |
| **Permissions** | **`payrun:cancel`** (distinct from `payrun:admin` revert-to-draft) |
| **Key routes** | `POST /v1/payruns/:payrun_id/cancel` |

---

## GOV-3 — Financial / bank / GL truth and closed-period temporal governance

### GOV-3A — Register ↔ payment export financial control

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_FINANCIAL_CONTROL.md`](./PAYRUN_FINANCIAL_CONTROL.md) |
| **Drift** | `npm run check:payrun-financial-control-drift` → [`scripts/check_payrun_financial_control_drift.ts`](../scripts/check_payrun_financial_control_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-financial-control.spec.ts`; `admin-portal/src/utils/payrunFinancialControlClient.test.ts` |
| **CI** | `lint-and-test` → financial control drift + `test:cov` |
| **Permissions** | `payrun:read`, `payrun:edit`, `payrun:approve`; financial override audited separately — see pillar doc |
| **Key routes** | `GET/POST /v1/payruns/:payrun_id/financial-control` (+ reconcile, review) — see pillar doc |
| **Owner rule** | Service + controller + batch export hook + admin client + CORS if new headers + seed permissions + doc + drift + specs — summarized in pillar doc and drift script |

### GOV-3B — Payment export ↔ bank confirmation

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_BANK_RECONCILIATION.md`](./PAYRUN_BANK_RECONCILIATION.md) |
| **Drift** | `npm run check:payrun-bank-reconciliation-drift` → [`scripts/check_payrun_bank_reconciliation_drift.ts`](../scripts/check_payrun_bank_reconciliation_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-bank-reconciliation.spec.ts`; `admin-portal/src/utils/payrunBankReconciliationClient.test.ts` |
| **CI** | `lint-and-test` → bank reconciliation drift + `test:cov` |
| **Permissions** | See pillar doc (align with `payrun:*` gates on mark posted / bank import paths) |
| **Key routes** | Bank reconciliation endpoints on `PayrunsController` — see pillar doc |
| **Owner rule** | Same pattern as 3A: service, UI client, policy key literals for GOV-6B, doc, drift |

### GOV-3C — Register ↔ GL posting reconciliation

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_GL_RECONCILIATION.md`](./PAYRUN_GL_RECONCILIATION.md) |
| **Drift** | `npm run check:payrun-gl-reconciliation-drift` → [`scripts/check_payrun_gl_reconciliation_drift.ts`](../scripts/check_payrun_gl_reconciliation_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-gl-reconciliation.spec.ts`; `admin-portal/src/utils/payrunGlReconciliationClient.test.ts`; period close UI: `admin-portal/src/utils/periodCloseGovernanceClient.test.ts` |
| **CI** | `lint-and-test` → GL reconciliation drift + `test:cov` |
| **Permissions** | See pillar doc and period close flow |
| **Key routes** | GL reconciliation on payruns; period close on payroll cycle — see pillar doc |
| **Owner rule** | GL service + period close gate coupling + Payrun detail / calendars surfaces + doc + drift |

### GOV-3D — Closed period and governed reversal / correction

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md`](./PAYRUN_CLOSED_PERIOD_GOVERNANCE.md) (**GOV-3D-1**, **GOV-3D-2**) |
| **Drift** | `npm run check:payrun-closed-period-drift` → [`scripts/check_payrun_closed_period_drift.ts`](../scripts/check_payrun_closed_period_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-closed-period-mutation-guard.service.spec.ts`; `payrun-reversal-workflow.service.spec.ts`; `payrun-correction-approval.service.spec.ts` |
| **CI** | `lint-and-test` → closed-period drift + `test:cov` |
| **Permissions** | `payrun:closed_period_override`; governed paths per doc |
| **Key routes** | Closed-period guard on payrun mutations; reversal / correction identifiers via headers — see doc |
| **Owner rule** | Guard service + controller + CORS + reversal/correction services + Payrun detail + permissions registry + doc + drift |

---

## GOV-4 — Post-change reconciliation impact

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYRUN_POST_REVERSAL_IMPACT.md`](./PAYRUN_POST_REVERSAL_IMPACT.md) |
| **Drift** | `npm run check:payrun-post-reversal-impact-drift` → [`scripts/check_payrun_post_reversal_impact_drift.ts`](../scripts/check_payrun_post_reversal_impact_drift.ts) |
| **Tests** | `src/modules/payruns/__tests__/payrun-post-close-reconciliation-impact.service.spec.ts` |
| **CI** | `lint-and-test` → post-reversal impact drift + `test:cov` |
| **Permissions** | `payrun:read` (GET impact), `payrun:approve` (acknowledge) — see pillar doc |
| **Key routes** | `GET/POST /v1/payruns/:id/post-close-reconciliation-impact` (+ acknowledge) — see pillar doc |
| **Owner rule** | Impact service + linkage from reversal/correction + period close gate assert + 3A/3B/3C DTO flags + Payrun detail + doc + drift (cross-checks pillar drift files) |

---

## GOV-5 — Control plane / portfolio / evidence export

Canonical doc: [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md).

| Slice | Baseline / LOCK | Drift | Tests | Permissions | Key routes (full HTTP prefix) | Owner rule (summary) |
|-------|-----------------|-------|-------|-------------|-------------------------------|------------------------|
| **GOV-5A** Dashboard | **PR-PAYRUN-GOV-5A-LOCK** in control plane doc | `npm run check:payrun-governance-dashboard-drift` → [`scripts/check_payrun_governance_dashboard_drift.ts`](../scripts/check_payrun_governance_dashboard_drift.ts) | `src/modules/payruns/__tests__/payrun-governance-health.service.spec.ts` | `payrun:read` | `GET /v1/payruns/:payrun_id/governance-health`; UI `/payroll/payruns/:id/governance` | DTO + service + controller + dashboard + App route + Payrun detail link + spec + drift + doc |
| **GOV-5B** Portfolio | **PR-PAYRUN-GOV-5B-LOCK** | `npm run check:payrun-governance-portfolio-drift` → [`scripts/check_payrun_governance_portfolio_drift.ts`](../scripts/check_payrun_governance_portfolio_drift.ts) | `src/modules/payroll-cycle/__tests__/payroll-governance-portfolio.service.spec.ts` | `payrun:read` | `GET /v1/api/payroll-cycle/governance-portfolio/periods/:periodId` (and pay-group / legal-entity variants) — see control plane doc | Portfolio DTO + service + controller + `GovernancePortfolio.tsx` + nav + spec + drift + doc |
| **GOV-5C** Export | **PR-PAYRUN-GOV-5C-LOCK** | Same drift script as **GOV-5B** | `src/modules/payroll-cycle/__tests__/payroll-governance-portfolio-evidence-export.service.spec.ts` | `payrun:read` | `GET /v1/api/payroll-cycle/governance-portfolio/.../export?format=csv|xlsx` | Portfolio + export service + controller + UI downloads + spec + drift + doc |

**CI:** `lint-and-test` runs dashboard drift, then portfolio drift (covers **GOV-5B** and **GOV-5C**).

---

## GOV-6 — Policy registry, enforcement, and administration

Canonical tables and LOCK sections: [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md) (GOV-6A / 6B / 6C, **GOV-6B-LOCK**, **GOV-6C-LOCK**).

| Slice | Role | Drift / tests | Permissions | Key surfaces |
|-------|------|---------------|-------------|--------------|
| **GOV-6A** Registry | Versioned `PayrollGovernancePolicy` rows, history, validation | `npm run check:payrun-governance-policy-drift` → [`scripts/check_payrun_governance_policy_drift.ts`](../scripts/check_payrun_governance_policy_drift.ts); `payroll-governance-policy.service.spec.ts`, `governance-policy-value.validator.spec.ts`, `governance-policy-payload-hash.spec.ts` | **`payrun:admin`** for list/history/drafts/preview | `GET /v1/api/payroll-cycle/governance-policies`, `GET .../history`, draft + activate routes — see control plane doc |
| **GOV-6B** Enforcement | `PayrunGovernancePolicyResolutionService` + keys in 3A/3B/3C, readiness, closed period | Policy drift **plus** pillar drifts (`check:payrun-financial-control-drift`, `check:payrun-bank-reconciliation-drift`, `check:payrun-gl-reconciliation-drift`); `payrun-governance-policy-resolution.service.spec.ts` | Enforced at existing gate permissions | Resolution wired into payrun services — see **GOV-6B** table in control plane doc |
| **GOV-6C** Admin UI | `GovernancePolicies.tsx` | Same policy drift + Playwright `test/playwright/governance-policies-admin.spec.ts` | **`payrun:admin`** | UI `/payroll/governance-policies` |

**Owner rule (rolled up):** Policy keys, validator, hash helper, impact DTOs, policy service, payroll-cycle controller routes, admin UI, audit actions, unit + Playwright tests, **`check_payrun_governance_policy_drift.ts`**, and control plane doc (**GOV-6C-LOCK** text) are **one governance change-set** for registry/admin regressions; **GOV-6B-LOCK** adds pillar services and pillar drift scripts.

---

## GOV-7 — Policy change governance (preview → activation)

All detailed route tables, audit action names, and LOCK text: [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md).

| Slice | Intent | Drift / tests | Notes |
|-------|--------|---------------|--------|
| **GOV-7A** Impact preview | Diff + heuristic simulation + **`payload_hash`** before commit | Anchored in `check_payrun_governance_policy_drift.ts`; `payroll-governance-policy.service.spec.ts`; `governance-policy-payload-hash.spec.ts`; Playwright | **PR-PAYRUN-GOV-7A-LOCK** |
| **GOV-7B** Draft workflow | Submit → **approver ≠ requester** → activate; direct **`POST …/governance-policies`** → **410 Gone** | Same drift + specs + `governance-policies-admin.spec.ts` | **PR-PAYRUN-GOV-7B-LOCK** |
| **GOV-7B-2** Reject / Cancel | Terminal draft states with audit | Same drift + specs + Playwright | **PR-PAYRUN-GOV-7B-2-LOCK** |

**Lifecycle string (locked):** Preview → Hash → Acknowledge → Draft → Approve / Reject / Cancel → Activate → Audit.

**CI:** `lint-and-test` → “Payrun governance policy registry drift (GOV-6A)” step (script also encodes **GOV-7**).

---

## CONTAINER — Tax-year payroll shell governance

**Program id:** **PR-PAYROLL-CONTAINER-1 … PR-PAYROLL-CONTAINER-4-LOCK** (schema, hub, lifecycle API, UI, **PR-PAYROLL-CONTAINER-4-LOCK**). **Constitutional wiring:** **PR-PAYROLL-CONTAINER-META-1** — this vertical is **not** a parallel undocumented system; it is indexed here and cross-referenced from [`docs/PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md).

| Area | Pointer |
|------|---------|
| **Baseline docs** | [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md) (doctrine, backfill, lifecycle API, **PR-PAYROLL-CONTAINER-4-LOCK**) |
| **Drift** | `npm run check:payroll-container-drift` → [`scripts/check_payroll_container_drift.ts`](../scripts/check_payroll_container_drift.ts) |
| **Tests** | `src/modules/payroll-containers/__tests__/payroll-container-lifecycle.policy.spec.ts` (policy helpers); broader service behaviour covered under `npm run test:cov` |
| **CI** | `lint-and-test` → Payroll container governance drift (**PR-PAYROLL-CONTAINER-META-1**); then `npm run db:migrate:prod` + `npm run verify:payroll-container-period-linkage` (**PR-PAYROLL-CONTAINER-2**) |
| **Permissions** | `pay_group:read` (read + lifecycle preview); **`payroll:containers:close`**, **`payroll:containers:archive`** (audited POST only) — see container doc |
| **Key routes (admin UI)** | `/payroll/payrolls`, `/payroll/payrolls/:id` — close/archive gated on **`GET /v1/payrolls/:id/lifecycle-eligibility`** |
| **Owner rule** | **Schema, service, policy, UI, permissions, audit, docs, tests, and drift** evolve **together** — **PR-PAYROLL-CONTAINER-4-LOCK** |

---

## Drift scripts (alphabetical)

| Script | npm run |
|--------|---------|
| [`scripts/check_payroll_container_drift.ts`](../scripts/check_payroll_container_drift.ts) | `check:payroll-container-drift` (**CONTAINER** — **PR-PAYROLL-CONTAINER-META-1**) |
| [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts) | `check:payroll-governance-constitution-drift` (**GOV-META-2** — constitution compliance) |
| [`scripts/check_payroll_import_drift.ts`](../scripts/check_payroll_import_drift.ts) | `check:payroll-import-drift` |
| [`scripts/check_payrun_bank_reconciliation_drift.ts`](../scripts/check_payrun_bank_reconciliation_drift.ts) | `check:payrun-bank-reconciliation-drift` |
| [`scripts/check_payrun_closed_period_drift.ts`](../scripts/check_payrun_closed_period_drift.ts) | `check:payrun-closed-period-drift` |
| [`scripts/check_payrun_execution_drift.ts`](../scripts/check_payrun_execution_drift.ts) | `check:payrun-execution-drift` |
| [`scripts/check_payrun_financial_control_drift.ts`](../scripts/check_payrun_financial_control_drift.ts) | `check:payrun-financial-control-drift` |
| [`scripts/check_payrun_gl_reconciliation_drift.ts`](../scripts/check_payrun_gl_reconciliation_drift.ts) | `check:payrun-gl-reconciliation-drift` |
| [`scripts/check_payrun_governance_dashboard_drift.ts`](../scripts/check_payrun_governance_dashboard_drift.ts) | `check:payrun-governance-dashboard-drift` |
| [`scripts/check_payrun_governance_policy_drift.ts`](../scripts/check_payrun_governance_policy_drift.ts) | `check:payrun-governance-policy-drift` |
| [`scripts/check_payrun_governance_portfolio_drift.ts`](../scripts/check_payrun_governance_portfolio_drift.ts) | `check:payrun-governance-portfolio-drift` |
| [`scripts/check_payrun_post_reversal_impact_drift.ts`](../scripts/check_payrun_post_reversal_impact_drift.ts) | `check:payrun-post-reversal-impact-drift` |

---

## Related entry point

Deep narrative and API tables for **GOV-5 … GOV-7** remain in [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md). **Tax-year shell** doctrine and lifecycle locks: [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md). This master index is the **cross-GOV + CONTAINER routing table**.
