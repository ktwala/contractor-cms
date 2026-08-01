# PR-PAYRUN-GOV-5 — Governance analytics / supervisory control plane

**Core question:** can leadership, audit, and PMO see **governance health** across payroll truth layers without spelunking individual modules?

GOV-5 introduces a **control plane** on top of the governed engine: read-only aggregation, RAG-style rollups, and drill-down into the underlying GOV-1 … GOV-4 implementations.

## GOV-5A — Governance dashboard (minimal v1)

### API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/payruns/:payrun_id/governance-health` | `payrun:read` |

Response type: **`PayrunGovernanceHealthDto`** (`src/modules/payruns/dto/payrun-governance-health.dto.ts`) — per payrun:

- `readiness_status` — GOV-2 (pay group readiness)
- `financial_control_status` — GOV-3A
- `bank_reconciliation_status` — GOV-3B
- `gl_reconciliation_status` — GOV-3C
- `closed_period_status` — GOV-3D-1 (`OPEN` / `CLOSED`)
- `reversal_status` — GOV-3D-2 rollup (`NONE` / `ACTIVE` / `ADJUSTMENT_LINKED`)
- `post_close_impact_status` — GOV-4 (`CLEAR` / `PENDING`)
- `override_count`, `override_types` — recent `audit_logs` for `entity_type = PayRun` and this `payrun_id`, actions matching override/bypass patterns (heuristic v1)
- `unresolved_governance_blocks` — operator-facing strings (non-exhaustive)
- `overall_governance_rag` — worst-of key pillars
- `ladder` — rows for UI truth ladder (GOV-2 → GOV-4)

Implementation: `PayrunGovernanceHealthService` composes existing services (readiness, 3A/3B/3C, reversal/correction lists, post-close summary, Prisma for period + audit).

### UI

- **Route:** `/payroll/payruns/:id/governance` — **Governance cockpit** (`PayrunGovernanceDashboard.tsx`).
- **Entry:** link from **Payrun detail** (“Governance cockpit”) for users with `payrun:read`.

Future slices (not in v1): dedicated audit workspace, PMO maturity scoring, saved filters. **Portfolio rollups** ship as **GOV-5B** below.

## GOV-5B — Period / entity governance portfolio (minimal v1)

**Core question:** which pay groups, entities, and periods are governance-green, blocked, overridden, or stale at **portfolio** scale?

### API (global prefix `v1`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/payroll-cycle/governance-portfolio/periods/:periodId` | `payrun:read` |
| GET | `/api/payroll-cycle/governance-portfolio/pay-groups/:payGroupId` | `payrun:read` |
| GET | `/api/payroll-cycle/governance-portfolio/legal-entities/:legalEntityId` | `payrun:read` |

Response: **`GovernancePortfolioSummaryDto`** (`src/modules/payroll-cycle/dto/governance-portfolio-summary.dto.ts`):

- `total_payruns` — payruns in scope (capped for safety)
- `blocked_payruns_count` — distinct payruns with any of **3A / 3B / 3C** in `BLOCKED`
- `stale_post_close_impact_count` — payruns with any **GOV-4** impact flag set
- `override_event_count` — `audit_logs` rows for `PayRun` entities in scope matching override/bypass heuristics
- `financial_exception_payruns` / `bank_exception_payruns` / `gl_exception_payruns` — distinct payruns with pillar **BLOCKED** or **variance / reject / partial** paths still requiring review (v1 definitions mirror gate stress)
- `open_payrun_exceptions_count` — `PayrunException` rows `OPEN` or `ASSIGNED` in scope

**Access:** legal entity of the period’s pay group / pay group / entity must be in the caller’s `legalEntityAccess` (or `hasGlobalScope`).

Implementation: `PayrollGovernancePortfolioService` (`src/modules/payroll-cycle/services/payroll-governance-portfolio.service.ts`), routes on `PayrollCycleController`.

### UI

- **Route:** `/payroll/governance-portfolio` — **`GovernancePortfolio.tsx`** (period, pay group, and legal entity selectors + summary grid).
- **Nav:** Payroll → **Governance portfolio**.

Drill-down remains **GOV-5A** per-payrun cockpit.

## GOV-5C — Audit / PMO governance evidence export (minimal v1)

**Core question:** can audit, PMO, and leadership **export** the same governance rollups as the portfolio for evidence and steering?

**Chain:** Cockpit (**GOV-5A**) → Portfolio (**GOV-5B**) → **Export** → Evidence.

### API (global prefix `v1`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/payroll-cycle/governance-portfolio/periods/:periodId/export?format=csv` or `format=xlsx` | `payrun:read` |
| GET | `/api/payroll-cycle/governance-portfolio/pay-groups/:payGroupId/export?format=csv` or `format=xlsx` | `payrun:read` |
| GET | `/api/payroll-cycle/governance-portfolio/legal-entities/:legalEntityId/export?format=csv` or `format=xlsx` | `payrun:read` |

**Response:** file download (`text/csv` or spreadsheet MIME). One **data row** (plus header) including:

- **`generated_at`** — ISO-8601 timestamp when the file was produced
- **`generated_by`** — subject from JWT (`email (sub)` when email is present, else `sub` / user id)
- **`scope`**, **`scope_id`**, **`label`** — same semantics as **`GovernancePortfolioSummaryDto`**
- **`total_payruns`**, **`blocked_payruns_count`**, **`stale_post_close_impact_count`** (GOV-4 flags), **`override_event_count`**, **`financial_exception_payruns`**, **`bank_exception_payruns`**, **`gl_exception_payruns`**, **`open_payrun_exceptions_count`**

**Access:** identical to portfolio JSON — **`PermissionsGuard`** + **`payrun:read`**, and **`PayrollGovernancePortfolioService`** legal-entity checks on the underlying scope.

Implementation: **`PayrollGovernancePortfolioEvidenceExportService`** (`payroll-governance-portfolio-evidence-export.service.ts`), routes on **`PayrollCycleController`**.

### UI

On **`GovernancePortfolio`** (`/payroll/governance-portfolio`), after a rollup is loaded, **Download .csv** and **Download .xlsx** call the export endpoints with the authenticated client (blob download).

Future: scheduled PMO packs, multi-period workbooks, audit log annex.

## Strategic map

| Layer | Code | Control plane v1 |
|-------|------|-------------------|
| Import integrity | GOV-1 | Not aggregated per payrun (see data-import consoles) |
| Execution governance | GOV-2 | `readiness_status` |
| Financial intent | GOV-3A | `financial_control_status` |
| Settlement truth | GOV-3B | `bank_reconciliation_status` |
| Accounting truth | GOV-3C | `gl_reconciliation_status` |
| Temporal protection + governed reversal | GOV-3D | `closed_period_status`, `reversal_status` |
| Post-change consequence | GOV-4 | `post_close_impact_status` |
| Portfolio supervision | GOV-5B | Period / pay group / legal entity summary DTO + portfolio UI |
| Evidence export | GOV-5C | Portfolio rollup `.csv` / `.xlsx` with scope + `generated_at` / `generated_by` |
| Policy / threshold registry | GOV-6A | `PayrollGovernancePolicy` + list/create API (version chain + audit) |
| Policy-backed enforcement | GOV-6B | Runtime resolution + audit of policy keys for 3A/3B/3C, overrides, closed period |

## Drift guard

```bash
npm run check:payrun-governance-dashboard-drift
npm run check:payrun-governance-portfolio-drift
npm run check:payrun-governance-policy-drift
```

---

## PR-PAYRUN-GOV-5A-LOCK — Governance control plane baseline locked

**Governance control plane (GOV-5A)** is **merge-frozen** as a unit: the **`PayrunGovernanceHealthDto`** contract, **`PayrunGovernanceHealthService`** aggregation (including audit-derived overrides and `unresolved_governance_blocks`), **`GET …/governance-health`**, **`PayrunGovernanceDashboard`** backed by that API, **`App.tsx`** route wiring, **Payrun detail → Governance cockpit** entry, **tests**, **drift + CI**, and **this document** must evolve **together**. Reviewers should reject partial PRs that change supervisory behaviour without updating the matching surfaces.

### Required checks

- **Drift:** `npm run check:payrun-governance-dashboard-drift` (`scripts/check_payrun_governance_dashboard_drift.ts`) — CI must keep DTO fields, service signals, controller route, UI ↔ API wiring, `PayrunDetail` link, package script, and **this doc including GOV-5A-LOCK** aligned.
- **Unit / service spec:** `src/modules/payruns/__tests__/payrun-governance-health.service.spec.ts` — must continue to exercise `getHealthForPayrun` and **GOV-5A / GOV-5A-LOCK** intent.

### Forbidden regressions

- **Dashboard not backed by API contract** — `PayrunGovernanceDashboard` must call `GET /payruns/:id/governance-health` and render from `PayrunGovernanceHealthDto` fields (no parallel hard-coded governance state as source of truth).
- **Health API omits GOV-2 / 3A / 3B / 3C / 3D / GOV-4 signals** — `PayrunGovernanceHealthDto` must retain readiness, financial, bank, GL, closed period, reversal/correction rollup, post-close impact, ladder, and overall RAG; service must populate them from existing GOV modules.
- **`unresolved_governance_blocks` hidden** when non-empty — the dashboard must surface the list (and the DTO field must remain populated by the service when blockers exist).
- **Override / bypass audit signals omitted** — `override_count`, `override_types` (from `audit_logs` heuristics on this payrun) must not be dropped without an intentional redesign documented here and in drift.
- **Dashboard route removed without replacement** — `/payroll/payruns/:id/governance` must remain registered with a governance cockpit implementation unless superseded in the same change-set with an equivalent per-payrun supervisory entry (GOV-5B **portfolio** is a separate route; it does not replace the cockpit).
- **Cockpit link removed from Payrun detail** — “Governance cockpit” entry on payrun detail for `payrun:read` must remain unless moved with the same governance UX contract.

### Ownership rule

**DTO**, **service aggregation**, **controller route**, **dashboard page**, **route wiring (`App.tsx`)**, **Payrun detail link**, **tests** (`payrun-governance-health.service.spec.ts`), **`check_payrun_governance_dashboard_drift.ts`**, and **this doc** (including **GOV-5A-LOCK**) are **one governance change-set** for GOV-5A regressions.

### Next slice (roadmap)

**GOV-5B** — **implemented (minimal v1)** and **baseline locked** as **PR-PAYRUN-GOV-5B-LOCK** (see below): period / pay group / legal entity portfolio API + `/payroll/governance-portfolio` UI. Further work: saved views, PMO maturity scoring, cross-entity dashboards.

---

## PR-PAYRUN-GOV-5B-LOCK — Governance portfolio baseline locked

**Governance portfolio (GOV-5B)** is **merge-frozen** as a unit: **`GovernancePortfolioSummaryDto`**, **`PayrollGovernancePortfolioService`** rollups (blocked payruns, GOV-4 stale impact, 3A/3B/3C exception payruns, open payrun exceptions, audit override/bypass counts), **legal-entity access enforcement** on every scope path, **`PayrollCycleController`** portfolio routes (`PermissionsGuard` + `payrun:read`), **`GovernancePortfolio`** UI + **`App.tsx`** route + **Payroll nav** entry, **tests**, **`check_payrun_governance_portfolio_drift.ts` + CI**, and **this document** must evolve **together**.

### Required checks

- **Drift:** `npm run check:payrun-governance-portfolio-drift` (`scripts/check_payrun_governance_portfolio_drift.ts`) — CI must keep DTO fields, rollup queries, access checks, controller paths, UI wiring, nav link, package script, and **this doc including GOV-5B-LOCK** aligned.
- **Unit / service spec:** `src/modules/payroll-cycle/__tests__/payroll-governance-portfolio.service.spec.ts` — must continue to exercise access denial and rollup entrypoints with **GOV-5B / GOV-5B-LOCK** intent.

### Forbidden regressions

- **Portfolio API bypassing legal entity access** — every `summarizePeriod` / `summarizePayGroup` / `summarizeLegalEntity` path must call **`assertLegalEntity`** (or equivalent) against the resolved `legalEntityId` before returning rollups.
- **`blocked_payruns_count` omitted or hollowed** — distinct payruns with any **3A / 3B / 3C** `BLOCKED` status must remain in the DTO and populated by the service.
- **Overrides / bypasses omitted** — `override_event_count` must remain sourced from **`audit_logs`** heuristics for `PayRun` entities in scope (not silently dropped).
- **Stale GOV-4 impacts omitted** — `stale_post_close_impact_count` must remain tied to payrun **impact flags** in scope.
- **3A / 3B / 3C exceptions hidden** — `financial_exception_payruns`, `bank_exception_payruns`, and `gl_exception_payruns` must remain first-class DTO fields and surfaced in the portfolio UI summary.
- **Portfolio UI route removed without replacement** — `/payroll/governance-portfolio` must stay registered with a portfolio implementation unless superseded in the same change-set with an equivalent portfolio entry point (GOV-5A cockpit remains separate).

### Ownership rule

**DTO**, **service rollups**, **controller routes**, **access checks**, **UI route + nav**, **tests** (`payroll-governance-portfolio.service.spec.ts`), **`check_payrun_governance_portfolio_drift.ts`**, and **this doc** (including **GOV-5B-LOCK**) are **one governance change-set** for GOV-5B regressions.

### Next slice (roadmap)

**GOV-5C** — **implemented (minimal v1)** and **baseline locked** as **PR-PAYRUN-GOV-5C-LOCK** (see below): period / pay group / legal entity **`.csv` / `.xlsx`** exports. Further work: scheduled PMO packs, multi-sheet workbooks, audit annex.

---

## PR-PAYRUN-GOV-5C-LOCK — Audit / PMO export baseline locked

**Governance evidence export (GOV-5C)** is **merge-frozen** as a unit: **`PayrollGovernancePortfolioService`** (source of truth for rollups + legal-entity access), **`PayrollGovernancePortfolioEvidenceExportService`** (row shape + CSV/XLSX encoding), **`PayrollCycleController`** export routes (`PermissionsGuard` + `payrun:read`, calling summarize paths only through the portfolio service), **`GovernancePortfolio`** download actions, **tests**, **`check_payrun_governance_portfolio_drift.ts` + CI**, and **this document** must evolve **together**.

**Chain (locked):** Cockpit (**GOV-5A**) → Portfolio (**GOV-5B**) → **Export** → Evidence.

The full path for evidence is also stated plainly as **Cockpit → Portfolio → Export → Evidence** (no alternate download path may skip portfolio access or rollups).

### Required checks

- **Drift:** `npm run check:payrun-governance-portfolio-drift` (`scripts/check_payrun_governance_portfolio_drift.ts`) — CI must keep portfolio DTO + rollups, export encoding, export controller paths, UI downloads, package script, and **this doc including GOV-5C-LOCK** aligned.
- **Unit / service spec:** `src/modules/payroll-cycle/__tests__/payroll-governance-portfolio-evidence-export.service.spec.ts` — must continue to exercise evidence row shape and CSV/XLSX output with **GOV-5C / GOV-5C-LOCK** intent.

### Forbidden regressions

- **Export bypasses portfolio access checks** — export handlers must not re-query pay periods / pay groups / legal entities without **`PayrollGovernancePortfolioService`** `summarizePeriod` / `summarizePayGroup` / `summarizeLegalEntity` (which enforce **`assertLegalEntity`**); ad-hoc rollups for download only are forbidden.
- **CSV / XLSX omit generated metadata** — every export row must include **`generated_at`** and **`generated_by`** alongside **`scope`**, **`scope_id`**, and **`label`**.
- **Export metrics diverge from portfolio JSON** — counts in the file must be derived from the same **`GovernancePortfolioSummaryDto`** instance returned for JSON for that scope (no second aggregation path with different definitions).
- **Blocked / override / stale GOV-4 / 3A / 3B / 3C exception counts omitted** — `blocked_payruns_count`, `override_event_count`, `stale_post_close_impact_count`, `financial_exception_payruns`, `bank_exception_payruns`, `gl_exception_payruns`, `open_payrun_exceptions_count`, and **`total_payruns`** must remain in the evidence row unless an intentional contract change is documented here and in drift.
- **UI download removed without replacement** — after a rollup is loaded, **Download .csv** and **Download .xlsx** (or an equivalent authenticated export entry on the same page) must remain unless superseded in the same change-set.

### Ownership rule

**Portfolio service**, **export service**, **controller export routes**, **UI downloads**, **tests** (`payroll-governance-portfolio-evidence-export.service.spec.ts`; portfolio spec for access/rollup regressions), **`check_payrun_governance_portfolio_drift.ts`**, and **this doc** (including **GOV-5C-LOCK**) are **one governance change-set** for GOV-5C regressions.

---

## GOV-6 — Policy / threshold governance layer (roadmap)

**Core question:** who defines the **rules of governance** (thresholds, tolerances, override minimums, closed-period mutation posture), and how are **changes** to those rules themselves governed?

Today many knobs still live in code or constants. **GOV-6** introduces a **governed policy plane**: explicit policy keys, scoped values, effective dating, maker identity, optional approval references, supersession chain, and audit.

**Positioning:** GOV-1 … GOV-4 govern **payroll truth and execution**. GOV-5 is the **supervisory control plane** over that engine. **GOV-6 governs the governors** — the parameters and policies that the control plane and gates consult.

### GOV-6A — Governance policy registry (minimal v1, PR-PAYRUN-GOV-6A)

**Prisma:** `PayrollGovernancePolicy` with `GovernancePolicyScope` (`GLOBAL` | `LEGAL_ENTITY` | `PAY_GROUP`), `policy_key`, optional `legal_entity_id` / `pay_group_id`, `current_value` (JSON), `effective_from`, `changed_by_user_id`, optional `approval_reference`, optional `superseded_by_policy_id` (prior row points at the replacing row), timestamps.

**API** (`PayrollCycleController`, **`payrun:admin` only** for registry administration — GOV-6C):

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/payroll-cycle/governance-policies?legal_entity_id=` or `?pay_group_id=` | `payrun:admin` (global operators may omit filters and list all current heads) |
| GET | `/api/payroll-cycle/governance-policies/history?policy_key=&scope=&legal_entity_id=&pay_group_id=` | `payrun:admin` (full supersession chain for one key + scope dimensions) |
| POST | `/api/payroll-cycle/governance-policies/impact-preview` | `payrun:admin` (GOV-7A — diff + heuristic simulation + **`payload_hash`**) |
| GET | `/api/payroll-cycle/governance-policies/drafts?legal_entity_id=&pay_group_id=&status=` | `payrun:admin` (**GOV-7B** — pending / approved drafts in portfolio scope) |
| POST | `/api/payroll-cycle/governance-policies/drafts` | `payrun:admin` (**GOV-7B** — requires **`impact_preview_hash`** + **`approval_reference`**; creates **`PENDING_APPROVAL`** draft; audits **`GOV_POLICY_DRAFT_CREATE`** + **`GOV_POLICY_DRAFT_SUBMIT`**) |
| POST | `/api/payroll-cycle/governance-policies/drafts/:id/approve` | `payrun:admin` (**GOV-7B** — approver **≠** requester; **`GOV_POLICY_DRAFT_APPROVE`**) |
| POST | `/api/payroll-cycle/governance-policies/drafts/:id/reject` | `payrun:admin` (**GOV-7B-2** — **Reject / Cancel** slice; non-requester; **`PENDING_APPROVAL` → `REJECTED`**; **`GOV_POLICY_DRAFT_REJECT`**) |
| POST | `/api/payroll-cycle/governance-policies/drafts/:id/cancel` | `payrun:admin` (**GOV-7B-2** — requester only; **`PENDING_APPROVAL` → `CANCELLED`**; **`GOV_POLICY_DRAFT_CANCEL`**) |
| POST | `/api/payroll-cycle/governance-policies/drafts/:id/activate` | `payrun:admin` (**GOV-7B** — requires **`APPROVED`**; creates active **`PayrollGovernancePolicy`** row + **`GOV_POLICY_VERSION_CREATE`** + **`GOV_POLICY_DRAFT_ACTIVATE`**) |
| POST | `/api/payroll-cycle/governance-policies` | **`410 Gone`** — direct activation removed (**GOV-7B**); use draft → approve → activate |

**Prisma (GOV-7B):** `PayrollGovernancePolicyDraft` + **`GovernancePolicyDraftStatus`** (`DRAFT` \| `PENDING_APPROVAL` \| `APPROVED` \| `REJECTED` \| `ACTIVATED` \| `CANCELLED`).

**Service:** `PayrollGovernancePolicyService` — legal-entity access aligned with portfolio patterns; **activation** runs in a transaction (supersede prior head); writes **`GOV_POLICY_VERSION_CREATE`** on activate; **`AuditService`** covers preview, draft lifecycle, and version create.

**Value validation:** `validateGovernancePolicyValue` in **`governance-policy-value.validator.ts`** enforces JSON shape for known **`policy_key`** values before insert.

**Tests:** `payroll-governance-policy.service.spec.ts`, `governance-policy-value.validator.spec.ts`.

**Drift:** `npm run check:payrun-governance-policy-drift`.

### GOV-6C — Policy administration UI (PR-PAYRUN-GOV-6C)

**Core question:** can authorized governance owners **view and change** policy values **without developer involvement**, with guardrails?

**Admin UI:** `admin-portal/src/pages/GovernancePolicies.tsx` — route **`/payroll/governance-policies`**, **`payrun:admin`** gate, scope selector (**global / legal entity / pay group**), list current heads, **draft queue** (**GOV-7B** / **GOV-7B-2** — **Reject** / **Cancel**, status badges), **supersession history** per key, **required approval reference**, **impact acknowledgement** before **submit draft**, **Approve** / **Activate** (SoD: approver ≠ requester), displays **effective date** and **changed_by_user_id**.

**Backend gates (v1):** list + history + drafts + draft lifecycle all **`payrun:admin`**; **`approval_reference`** non-empty on draft create; server-side value shape validation; version create audit includes **`superseded_prior_policy_id`**, **`current_value`**, **`impact_preview_hash`**, and **`governance_policy_draft_id`** when activated from a draft.

**Drift / doc coupling:** **PR-PAYRUN-GOV-6C** — UI file, `App.tsx` route, controller history + `payrun:admin` list, **`governance-policy-value.validator.ts`**, service **`listPolicyVersionHistory`**, and this section evolve **together** with **`check_payrun_governance_policy_drift.ts`**.

### GOV-6B — Policy-backed threshold enforcement (PR-PAYRUN-GOV-6B)

**Runtime:** `PayrunGovernancePolicyResolutionService` resolves effective values by **`policy_key`** with scope precedence (**`PAY_GROUP` > `LEGAL_ENTITY` > `GLOBAL`**), falling back to code defaults when no registry row exists.

**Canonical keys (v1):**

| Key | Used by |
|-----|---------|
| `financial_control.net_variance_threshold` | GOV-3A net register ↔ export absolute tolerance (`PayrunFinancialControlService.reconcilePayrun`); `thresholdPolicy` column records `REGISTRY:…` or `DEFAULT:…` |
| `bank_reconciliation.fee_tolerance` | GOV-3B bank total vs export tolerance (`PayrunBankReconciliationService.importBankConfirmation`) |
| `gl_reconciliation.rounding_tolerance` | GOV-3C register↔GL **variance epsilon** (`maxAbs` vs MATCH path in `PayrunGLReconciliationService.importGlConfirmation`); line-level `DEFAULT_GL_LINE_TOLERANCE` unchanged in v1 |
| `override.justification_min_length` | Minimum characters for audited **readiness**, **financial**, **bank**, **GL** gate overrides and **closed-period** bypass / governed paths |
| `closed_period.mutation_policy` | JSON `{ "mode": "STANDARD" \| "GOVERNED_PATHS_ONLY" }` — **`GOVERNED_PATHS_ONLY`** disables break-glass **`PAYRUN_CLOSED_PERIOD_MUTATION_BYPASS`**; governed reversal/correction routes unchanged |

**Audit:** reconciliations, gate overrides, and closed-period audits include **`governance_policy_key`**, **`governance_policy_id`**, **`governance_policy_source`** (and applied numeric / mode fields) when a registry value is used or when justification length is policy-resolved.

**Tests:** `payrun-governance-policy-resolution.service.spec.ts` (resolution precedence); existing payrun gate specs extended with policy resolver mocks; closed-period spec covers **`GOVERNED_PATHS_ONLY`**.

**Cross-drift:** `check:payrun-financial-control-drift`, `check:payrun-bank-reconciliation-drift`, `check:payrun-gl-reconciliation-drift` anchor policy key strings in services.

---

## PR-PAYRUN-GOV-6C-LOCK — Policy administration baseline locked

**Policy administration baseline locked.** **GOV-6C / GOV-7A / GOV-7B / GOV-7B-2** merges the **policy keys** file, **`governance-policy-value.validator.ts`**, **`governance-policy-payload-hash.ts`**, **`governance-policy-impact.dto.ts`**, **`governance-policy-draft.dto.ts`**, **`PayrollGovernancePolicyService`**, **policy list / history / drafts / approve / reject / cancel / activate / impact-preview routes** (`payrun:admin`), **`GovernancePolicies.tsx`** (`/payroll/governance-policies`), **audit** on **`GOV_POLICY_IMPACT_PREVIEW`**, **`GOV_POLICY_DRAFT_*`**, and **`GOV_POLICY_VERSION_CREATE`** (including **`impact_preview_hash`**, **`governance_policy_draft_id`**, supersession + value payload), **`payroll-governance-policy.service.spec.ts`**, **`governance-policy-value.validator.spec.ts`**, **`governance-policy-payload-hash.spec.ts`**, **`test/playwright/governance-policies-admin.spec.ts`**, **`check_payrun_governance_policy_drift.ts`**, and **this document** (including **PR-PAYRUN-GOV-7B-2-LOCK**) as **one governance change-set**.

### Required checks

- **Policy drift:** `npm run check:payrun-governance-policy-drift` — registry, enforcement wiring, GOV-6C admin surface, **GOV-6B-LOCK**, **GOV-6C-LOCK**, **GOV-7A-LOCK**, **GOV-7B-LOCK**, and **PR-PAYRUN-GOV-7B-2-LOCK** doc anchors.
- **Unit specs:** `payroll-governance-policy.service.spec.ts`, `governance-policy-value.validator.spec.ts`, `governance-policy-payload-hash.spec.ts`.
- **E2E (Playwright):** `test/playwright/governance-policies-admin.spec.ts` — `payrun:admin` gate, **GOV-7A** impact preview then acknowledgement, **GOV-7B** draft / approve / activate, **GOV-7B-2** reject / cancel (API-mocked shell).

### Forbidden regressions

- **Policy list visible without `payrun:admin`** — list and history endpoints, and the admin UI gate, must not regress to `payrun:read` or anonymous access.
- **Policy creation without approval reference** — POST must reject blank or missing **`approval_reference`**.
- **Draft / activation without impact preview hash** — **`POST …/drafts`** must reject missing or mismatched **`impact_preview_hash`**; activation re-checks hash integrity from stored draft fields.
- **Impact preview not auditable** — **`GOV_POLICY_IMPACT_PREVIEW`** must remain on successful preview calls (metadata includes **`payload_hash`**).
- **Unvalidated policy value shapes** — known **`policy_key`** values must not bypass **`validateGovernancePolicyValue`** on the server.
- **Policy history hidden** — **`GET …/governance-policies/history`** must remain available to **`payrun:admin`** for the supersession chain.
- **Supersession not auditable** — version create audit must retain linkage (**`superseded_prior_policy_id`**) and material payload (**`current_value`**, **`approval_reference`**, **`impact_preview_hash`**) suitable for governance investigation.
- **UI save without impact preview + acknowledgement** — the policy admin page must call **`POST …/governance-policies/impact-preview`** before version create and must not POST until the operator acknowledges the preview (checkbox + confirm).

### Ownership rule

**Policy keys**, **validator**, **policy service**, **controller routes**, **admin UI**, **audit payload**, **unit + Playwright tests**, **drift script**, and **this doc** (including **GOV-6C-LOCK**) are **one governance change-set** for GOV-6C regressions.

---

## PR-PAYRUN-GOV-6B-LOCK — Policy-backed enforcement baseline locked

**Policy-backed enforcement (GOV-6B)** is **merge-frozen** as a unit: **`governance-policy-keys.ts`**, **`PayrunGovernancePolicyResolutionService`**, **3A / 3B / 3C services**, **readiness + closed-period guards**, **audit metadata on policy use**, **resolution + gate specs**, **`check_payrun_governance_policy_drift.ts`** (plus pillar drift scripts), and **this document** must evolve **together**.

### Required checks

- **Policy drift:** `npm run check:payrun-governance-policy-drift` — registry, resolution service, wired keys, specs, and **GOV-6B-LOCK** doc anchors.
- **Pillar drift:** `npm run check:payrun-financial-control-drift`, `npm run check:payrun-bank-reconciliation-drift`, `npm run check:payrun-gl-reconciliation-drift` — must keep GOV-6B key literals in the governed services.
- **Specs:** `payrun-governance-policy-resolution.service.spec.ts`, `payroll-governance-policy.service.spec.ts`, and payrun gate specs that mock **`PayrunGovernancePolicyResolutionService`**.

### Forbidden regressions

- **Silent divergence** — thresholds or justification mins must not be recomputed in UI or alternate services without the same registry resolution path used by the backend gate.
- **Audit omits policy provenance** — when a registry value applies, **`governance_policy_id`** and **`governance_policy_key`** must not be dropped from the relevant **`audit_logs`** payload without an intentional redesign documented here and in drift.
- **Fallback removal** — code defaults (`DEFAULT_NET_VARIANCE_THRESHOLD`, `DEFAULT_BANK_TOTAL_TOLERANCE`, `DEFAULT_GL_ROUNDING_EPSILON`, override mins, `STANDARD` closed-period mode) must remain when no policy row matches.
- **GOVERNED_PATHS_ONLY bypass** — break-glass closed-period bypass must stay disabled when `closed_period.mutation_policy.mode` resolves to **`GOVERNED_PATHS_ONLY`**.

### Ownership rule

**Policy keys file**, **resolution service**, **payrun financial / bank / GL services**, **readiness + closed-period guards**, **tests**, **policy + pillar drift scripts**, and **this doc** (including **GOV-6B-LOCK**) are **one governance change-set** for GOV-6B regressions.

### Next slice (roadmap)

Maker-checker on policy writes, optional second key for GL line tolerance, wire **`gl_reconciliation.rounding_tolerance`** semantics beyond epsilon if product requires split thresholds. **GOV-6C** policy admin UI and **GOV-6C-LOCK** baseline are closed; live-API E2E or richer UX can follow as small change-sets. **GOV-7A** (policy diff & impact simulation) is **baseline locked** (**PR-PAYRUN-GOV-7A-LOCK**). **GOV-7B** (draft → approve → activate) is **implemented** as the only activation path and **baseline locked** (**PR-PAYRUN-GOV-7B-LOCK**); see **GOV-7B** below. **GOV-7B-2** (**Reject / Cancel**, **PR-PAYRUN-GOV-7B-2**) extends the same flow and is **baseline locked** (**PR-PAYRUN-GOV-7B-2-LOCK**). **Primary forward:** richer approver roles, SLA / escalation, multi-party approval.

## GOV-7 — Governance change intelligence / diff governance

**Maturity chain:** **operations governed** (GOV-1–5) → **financial truth governed** (GOV-3A–3C, etc.) → **policy governed** (GOV-6) → **policy-change impact governed** (**GOV-7A**, baseline locked) → **policy-change authorization** (**GOV-7B**, draft / approve / activate; **GOV-7B-2**, reject / cancel terminal states, **PR-PAYRUN-GOV-7B-2-LOCK**).

**Positioning:** **GOV-1–5** cover payroll operational truth and supervisory governance. **GOV-6** covers governance **rule definition**, **threshold enforcement**, and **governed policy administration**. **GOV-7** covers **governance change itself**: stakeholders see **operational impact** before commit (**GOV-7A**), and a **separate approver** must authorize before activation (**GOV-7B**).

**Core question (7A):** When governance changes, can stakeholders see **what will happen in operations** (gates, tolerances, scope blast radius) **before** the new version is effective?

**Core question (7B):** **Who approves governance policy changes before they become effective?**

### PR-PAYRUN-GOV-7A — Policy diff & impact simulation (minimal v1)

**Goal:** Govern the **consequences** of policy changes **before** they land — extending GOV-6C’s acknowledgement step with **substantive** diff and simulation, not copy-only warnings.

**Minimal v1 capabilities:**

- **Compare** prior head vs proposed new value for the same **`policy_key`** and **scope dimensions** (legal entity / pay group / global as applicable).
- **Show:** numeric or structured **threshold delta**; **affected scope** (entities / pay groups implied by the policy row and inheritance from resolution precedence); **likely gate behaviour** shifts (GOV-3A / 3B / 3C tolerances, readiness justification floor, closed-period mutation posture — bounded heuristics in v1).
- **Heuristic prompts (v1 quality bar):** framed questions such as whether the change **tightens** or **loosens** enforcement vs the current head, and whether that direction **tends to** block runs that previously cleared or clear runs that previously blocked — with explicit disclaimer that v1 is **not** full historical counterfactual replay unless/until a later slice adds it.
- **Gate:** **Impact preview** (read-only diff + simulation summary) is **required** before **publish** / version create (same transaction as today’s POST, with server-side enforcement that preview was generated for the payload).

**Implemented (GOV-7A v1 — server + admin UI):**

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/payroll-cycle/governance-policies/impact-preview` | `payrun:admin` |

- **Response** includes **`payload_hash`** (SHA-256 of canonical payload: `policy_key`, `scope`, resolved `legal_entity_id` / `pay_group_id`, `current_value`, `effective_from` ISO).
- **POST** `/api/payroll-cycle/governance-policies/drafts` requires **`impact_preview_hash`** matching that hash for the same body fields; **`GovernancePolicies`** runs preview first, then acknowledgement, then **submit draft**; a distinct operator **approves**, then **activate** creates the policy row (**GOV-7B**). **`POST …/governance-policies`** (direct) returns **410 Gone**.
- **Audit:** **`GOV_POLICY_IMPACT_PREVIEW`** on preview; version create audit includes **`impact_preview_hash`**.

**Further work:** richer “would block / unblock prior payruns” modelling, payload TTL, and PMO-facing diff UX — evolve with **GOV-6C-LOCK**, **GOV-7A-LOCK**, **GOV-7B-LOCK**, **PR-PAYRUN-GOV-7B-2-LOCK**, **GOV-7** doc, and drift.

---

## PR-PAYRUN-GOV-7A-LOCK — Policy diff / impact simulation baseline locked

**Policy diff / impact simulation baseline locked.** The governance-change chain is operational: **policy edit → impact preview → payload hash → acknowledgement → draft submit → reject|cancel|approval → activation → audit** (`GOV_POLICY_IMPACT_PREVIEW` → **`GOV_POLICY_DRAFT_*`** (**GOV-7B** / **GOV-7B-2**) → `GOV_POLICY_VERSION_CREATE` with **`impact_preview_hash`**).

### Required checks

- **Policy drift:** `npm run check:payrun-governance-policy-drift` — impact-preview route, hash helper, draft hash gate, **GOV-7A-LOCK** / **GOV-7B-LOCK** / **PR-PAYRUN-GOV-7B-2-LOCK** doc anchors, and **GOV-6C-LOCK** coupling.
- **Unit specs:** `payroll-governance-policy.service.spec.ts` (preview + hash mismatch + **GOV-7B** draft / activate + **GOV-7B-2** reject / cancel), `governance-policy-payload-hash.spec.ts` (canonical hash contract).
- **E2E (Playwright):** `test/playwright/governance-policies-admin.spec.ts` — preview before POST, acknowledgement gating, **GOV-7B-2** reject / cancel (API-mocked shell).

### Forbidden regressions

- **Draft create without `impact_preview_hash`** — POST `/api/payroll-cycle/governance-policies/drafts` must reject missing or wrong hash. Direct **`POST …/governance-policies`** must stay **disabled (410)**.
- **Hash computed from non-canonical payload** — **`computeGovernancePolicyImpactPayloadHash`** / **`canonicalizeJson`** must remain the single source of truth; preview and create must use the **same** canonical fields (`policy_key`, `scope`, resolved `legal_entity_id` / `pay_group_id`, `current_value`, `effective_from` ISO).
- **Preview bypassing scope/access validation** — impact preview must reuse **`resolvePolicyScopeDimensions`** and **`validateGovernancePolicyValue`** (same gates as create).
- **UI draft submit enabled before preview + acknowledgement** — admin UI must not **`POST …/drafts`** until **`POST …/impact-preview`** has succeeded for the current payload and the operator has acknowledged the preview. UI must not call direct **`POST …/governance-policies`** (drift-enforced).
- **Audit missing `GOV_POLICY_IMPACT_PREVIEW`** — successful preview must continue to write **`GOV_POLICY_IMPACT_PREVIEW`** to **`audit_logs`**.
- **Version audit missing `impact_preview_hash`** — **`GOV_POLICY_VERSION_CREATE`** **`newValue`** must retain **`impact_preview_hash`** for investigation.

### Ownership rule

**Preview DTOs**, **`governance-policy-payload-hash.ts`**, **`PayrollGovernancePolicyService`** (preview + draft path + deprecated direct create), **controller routes**, **`GovernancePolicies.tsx`** flow, **audit payloads**, **unit + Playwright tests**, **`check_payrun_governance_policy_drift.ts`**, and **this doc** (including **GOV-7A-LOCK** / **GOV-7B-LOCK** / **PR-PAYRUN-GOV-7B-2-LOCK**) are **one governance change-set** for GOV-7A / preview regressions.

## GOV-7B — Policy change approval workflow (minimal v1)

**Positioning:** **GOV-7A** binds **impact preview → payload hash → acknowledgement**. **GOV-7B** **replaces immediate activation**: **`POST …/governance-policies`** is **410 Gone**; operators **submit a draft** (`PENDING_APPROVAL`), a **different** **`payrun:admin`** user **approves**, then **activate** creates the **`PayrollGovernancePolicy`** head and supersession chain.

**Core question:** **Who approves governance policy changes before they become effective?**

### Implemented (v1)

| Step | Audit / behaviour |
|------|-------------------|
| Impact preview (unchanged) | **`GOV_POLICY_IMPACT_PREVIEW`** |
| **POST …/drafts** | **`GOV_POLICY_DRAFT_CREATE`**, **`GOV_POLICY_DRAFT_SUBMIT`** — requires valid **`impact_preview_hash`** |
| **POST …/drafts/:id/approve** | **`GOV_POLICY_DRAFT_APPROVE`** — **approver ≠ requester** |
| **POST …/drafts/:id/reject** | **`GOV_POLICY_DRAFT_REJECT`** — operator **≠** requester; **`REJECTED`** rows stay listed (auditable); cannot activate |
| **POST …/drafts/:id/cancel** | **`GOV_POLICY_DRAFT_CANCEL`** — **requester only**; **`CANCELLED`** rows stay listed; cannot activate |
| **POST …/drafts/:id/activate** | **`GOV_POLICY_VERSION_CREATE`** (includes **`governance_policy_draft_id`**, **`impact_preview_hash`**) + **`GOV_POLICY_DRAFT_ACTIVATE`** — draft status **`ACTIVATED`**, **`activation_policy_id`** set |

**Prisma:** `PayrollGovernancePolicyDraft` (see **GOV-6A** API table). **`REJECTED`** / **`CANCELLED`** are set by **PR-PAYRUN-GOV-7B-2** (**Reject / Cancel**).

### PR-PAYRUN-GOV-7B-2 — Reject / Cancel drafts

**Goal:** Close the pending-draft lifecycle without activation — **Reject / Cancel** with explicit audit and UI affordances.

**Rules:** Requester **cannot approve** but **may cancel** own **`PENDING_APPROVAL`** draft. A **different** operator (**`payrun:admin`**) **may reject** a pending draft. **`REJECTED`** / **`CANCELLED`** drafts **cannot activate**; rows **remain** in **`payroll_governance_policy_drafts`** for investigation.

**Admin UI:** **`GovernancePolicies.tsx`** — **Reject** (non-requester, pending), **Cancel** (requester, pending), status badges for **Rejected** / **Cancelled**.

**Further work:** role split beyond SoD (dedicated reject permission), SLA / escalation, multi-party approval — evolve with **GOV-7B-LOCK** / **PR-PAYRUN-GOV-7B-2-LOCK** artefacts.

---

## PR-PAYRUN-GOV-7B-2-LOCK — Reject / cancel draft lifecycle baseline locked

**Reject/cancel are baseline locked.** The policy-change chain is complete through terminal draft states: **Preview → Hash → Acknowledge → Draft → Approve / Reject / Cancel → Activate → Audit** — **`REJECTED`** and **`CANCELLED`** rows stay in **`payroll_governance_policy_drafts`** for evidence.

### Required checks

- **Policy drift:** `npm run check:payrun-governance-policy-drift` — **`rejectGovernancePolicyDraft`** / **`cancelGovernancePolicyDraft`**, **`GOV_POLICY_DRAFT_REJECT`** / **`GOV_POLICY_DRAFT_CANCEL`**, UI **`/reject`** / **`/cancel`** paths, **GOV-7B-2-LOCK** doc anchors.
- **Unit specs:** `payroll-governance-policy.service.spec.ts` — reject/cancel SoD, **`REJECTED`** cannot activate, audit actions.
- **E2E (Playwright):** `test/playwright/governance-policies-admin.spec.ts` — **Reject** / **Cancel** flows (API-mocked shell).

### Forbidden regressions

- **Requester rejecting own draft** — server must forbid; UI must not enable **Reject** for the requester on a pending row.
- **Non-requester cancelling draft** — server must forbid; UI must not enable **Cancel** unless **`user_id`** matches **`requested_by_user_id`**.
- **Rejected/cancelled draft activating** — **`activateGovernancePolicyDraft`** must require **`APPROVED`** only.
- **Reject/cancel without audit** — successful transitions must write **`GOV_POLICY_DRAFT_REJECT`** / **`GOV_POLICY_DRAFT_CANCEL`** to **`audit_logs`**.
- **UI hiding terminal statuses** — **`GovernancePolicies`** must keep **Rejected** / **Cancelled** (and other states) visible in the drafts table with badges after load (no filtering that drops terminal rows from the operator view without an intentional redesign documented here and in drift).

### Ownership rule

**Reject/cancel routes**, **`PayrollGovernancePolicyService`** reject/cancel transitions, **`GovernancePolicies.tsx`** buttons and status badges, **audit payloads**, **`payroll-governance-policy.service.spec.ts`**, **`governance-policies-admin.spec.ts`**, **`check_payrun_governance_policy_drift.ts`**, and **this doc** (including **PR-PAYRUN-GOV-7B-2-LOCK**) are **one governance change-set** for **PR-PAYRUN-GOV-7B-2** regressions.

---

## PR-PAYRUN-GOV-7B-LOCK — Policy change approval baseline locked

**Policy change approval baseline locked.** The governance-change **authorization** chain is operational: **preview → hash → acknowledgement → draft → approve / reject / cancel → activate → audit** (no direct active row create from the admin UI; **`POST …/governance-policies`** remains **410 Gone**).

### Required checks

- **Policy drift:** `npm run check:payrun-governance-policy-drift` — draft routes (incl. **reject / cancel**), **`PayrollGovernancePolicyDraft`** schema anchors, **GOV-7B-LOCK** / **PR-PAYRUN-GOV-7B-2** / **PR-PAYRUN-GOV-7B-2-LOCK** doc text, UI must not call deprecated direct POST, **`GOV_POLICY_DRAFT_*`** / **`GOV_POLICY_DIRECT_CREATE_DEPRECATED`** in service.
- **Unit specs:** `payroll-governance-policy.service.spec.ts` (410 on direct create, draft create, approve SoD, reject / cancel SoD, activate + **`GOV_POLICY_VERSION_CREATE`**).
- **E2E (Playwright):** `test/playwright/governance-policies-admin.spec.ts` — draft POST, approve / activate / **reject / cancel** shell, **no** successful direct **`POST …/governance-policies`**.

### Forbidden regressions

- **Direct active policy creation from UI** — **`GovernancePolicies.tsx`** must not call **`api.post('/api/payroll-cycle/governance-policies',`** (single-arg legacy create); activation only via **`POST …/drafts/:id/activate`** after approval.
- **Direct `POST /governance-policies` re-enabled** — service must keep **`createPolicyVersion`** as **410 Gone** with **`GOV_POLICY_DIRECT_CREATE_DEPRECATED`** unless an intentional redesign replaces the draft workflow and updates **this doc** + drift.
- **Draft without valid impact preview hash** — **`POST …/drafts`** must reject missing or mismatched **`impact_preview_hash`**; activation must re-verify hash from stored draft fields.
- **Approval by requester** — **`approveGovernancePolicyDraft`** must reject when **`actorUserId === requestedByUserId`**.
- **Activation before approval** — **`activateGovernancePolicyDraft`** must require draft status **`APPROVED`** (transaction re-check).
- **Activation without `GOV_POLICY_VERSION_CREATE`** — successful activate must write **`GOV_POLICY_VERSION_CREATE`** (with **`governance_policy_draft_id`**, **`impact_preview_hash`**) and **`GOV_POLICY_DRAFT_ACTIVATE`**.
- **Reject / cancel bypassing SoD** — requester must not **`reject`** own draft (**use cancel**); non-requester must not **`cancel`** another user’s draft.
- **Activate rejected or cancelled draft** — **`activateGovernancePolicyDraft`** must refuse **`REJECTED`** / **`CANCELLED`** / non-**`APPROVED`** states.
- **Reject / cancel without audit** — **`GOV_POLICY_DRAFT_REJECT`** and **`GOV_POLICY_DRAFT_CANCEL`** must remain on successful transitions.

### Ownership rule

**`PayrollGovernancePolicyDraft` model + migration**, **draft list / create / approve / reject / cancel / activate routes**, **`PayrollGovernancePolicyService`** (draft lifecycle + **`applyActiveGovernancePolicyVersionInTx`**), **`GovernancePolicies.tsx`** draft table + actions, **audit actions** (`GOV_POLICY_DRAFT_*`, version create), **`payroll-governance-policy.service.spec.ts`**, **`governance-policies-admin.spec.ts`**, **`check_payrun_governance_policy_drift.ts`**, and **this doc** (including **GOV-7B-LOCK**, **PR-PAYRUN-GOV-7B-2**, and **PR-PAYRUN-GOV-7B-2-LOCK**) are **one governance change-set** for GOV-7B regressions.

## Related

- `docs/PAYROLL_GOVERNANCE_CONSTITUTION.md` — GOV-META-1 + **PR-PAYRUN-GOV-META-2-LOCK** (charter + executable constitution drift baseline)
- `docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md` — consolidated map (GOV-1 … GOV-7: docs, drift, tests, CI, permissions, routes, ownership)
- `docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md` — GOV-3D
- `docs/PAYRUN_POST_REVERSAL_IMPACT.md` — GOV-4
- `docs/PAYRUN_FINANCIAL_CONTROL.md` — GOV-3A
