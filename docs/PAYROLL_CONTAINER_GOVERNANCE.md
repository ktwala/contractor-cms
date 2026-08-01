# Payroll container governance (PR-PAYROLL-CONTAINER-1 … PR-PAYROLL-CONTAINER-4)

This document defines the **doctrine** for the tax-year payroll shell introduced as `Payroll` in Prisma. It is enforced together with `scripts/check_payroll_container_drift.ts` and CI (`**check:payroll-container-drift`**). The **PR-PAYROLL-CONTAINER-4-LOCK** section records the **container lifecycle baseline locked** contract (required checks, forbidden regressions, ownership).

## Doctrine (four layers)


| Layer         | Meaning                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PayGroup**  | **Who is eligible** — workforce scope: frequency, legal entity, employee assignments, eligibility grouping. **Not replaced** by the payroll container.                         |
| **Payroll**   | **Statutory / tax-year governance shell** — bounded window (`tax_year_start` … `tax_year_end`) and lifecycle (`PayrollTaxYearStatus`). Anchored to exactly one `pay_group_id`. |
| **PayPeriod** | **When** inside that shell — calendar periods; optional `payroll_id` links a period row into a tax-year shell.                                                                 |
| **PayRun**    | **Execution instance** — snapshot, calculate, pay, post (regular, adjustment, etc.). The execution lifecycle stays on PayRun; Payroll does not run calculations.               |


### Identity rule (one shell per tax window)

At most **one** `Payroll` row per `(pay_group_id, tax_year_start, tax_year_end)` — enforced by DB unique index `payrolls_pay_group_tax_year_window_key`.

**Legal entity** and **pay frequency** are **not** separate columns on `Payrolls`: they come from the linked **PayGroup** (`PayGroup.legal_entity_id`, `PayGroup.frequency`). Duplicating them on `Payroll` would drift from workforce scope.

## PR-PAYROLL-CONTAINER-2 — Migration / backfill rule

**Goal**: Backfill `pay_periods.payroll_id` for existing rows **without** changing PayGroup or payrun execution.

**Anchor**: Each period’s `**start_date`** (UTC date) determines which statutory tax-year shell it belongs to, using `**PayGroup.country**`:


| Country | Statutory window (inclusive §                                       |
| ------- | ------------------------------------------------------------------- |
| **ZA**  | 1 March → last day of February (March-year labeling `YYYY/YYYY+1`). |
| **LS**  | 1 April → 31 March (`YYYY/YYYY+1`).                                 |


**Scripts**


| Script                                               | Purpose                                                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/backfill_pay_period_payroll_ids.ts`         | Creates missing `Payroll` shells via upsert and sets `pay_periods.payroll_id` for rows where it is null (`npm run backfill:pay-period-payroll-ids`).     |
| `scripts/verify_payroll_container_period_linkage.ts` | Reports periods linked vs orphans; **fails** on duplicate shells or period→shell pay_group mismatch (`npm run verify:payroll-container-period-linkage`). |


Operational order: deploy migration (unique index) → run **backfill** once per environment → routine **verify** in CI.

## PR-PAYROLL-CONTAINER-3 — Admin hub (read-only)

**Goal**: Make the PayGroup → Payroll → PayPeriod hierarchy visible without lifecycle actions.

- **Routes**: `/payroll/payrolls` (list), `/payroll/payrolls/:id` (detail + linked periods).
- **Permissions**: `pay_group:read` for API and nav.
- **Orphans**: Hub calls `GET /v1/payrolls/linkage-health` and shows a warning when `orphan_period_count > 0` (periods with null `payroll_id` in the user’s scope).

## PR-PAYROLL-CONTAINER-4 — Archive / close governance

**Goal**: Close or archive tax-year shells **safely** — **no hard delete** of `Payroll` rows that are tied to real payroll execution.

### Permissions


| Permission                   | Action                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `payroll:containers:close`   | **POST** `/v1/payrolls/:id/close` — transition **PLANNING** / **ACTIVE** → **CLOSED** |
| `payroll:containers:archive` | **POST** `/v1/payrolls/:id/archive` — transition to **ARCHIVED** only when gates pass |


Preview (no mutation): **GET** `/v1/payrolls/:id/lifecycle-eligibility` — requires `pay_group:read`; returns `can_close`, `can_archive`, `close_blockers`, `archive_blockers`, and counts.

### Close (shell)

- Allowed only from **PLANNING** or **ACTIVE**.
- **Blocked** if any **in-flight** payrun exists on periods linked to this shell: payrun status in `DRAFT`, `SNAPSHOT`, `CALCULATING`, `CALCULATED`, `IN_REVIEW`, `APPROVED`.
- Audited as `**PAYROLL_CONTAINER_CLOSED`** on entity type `**Payroll**`.

### Archive (shell)

Stricter than close — shell must be **unused / safe**:

- **Blocked** if any linked period has governance close (`pay_periods.closed_at` set).
- **Blocked** if any **in-flight** payrun exists on linked periods (same status set as close).
- **Blocked** if any payrun on linked periods reached **PAID**, **POSTED**, or **FINALIZED** (executed payroll activity).
- Audited as `**PAYROLL_CONTAINER_ARCHIVED`** on entity type `**Payroll**`.
- **No `DELETE`** — archival is status-only.

Optional JSON body on POST: `{ "reason": "…" }` (trimmed, max 500 chars) stored in audit `newValue.reason`.

## PR-PAYROLL-CONTAINER-4-LOCK — Container lifecycle baseline locked

The tax-year shell **close**, **archive**, and **lifecycle preview** behaviour in **PR-PAYROLL-CONTAINER-4** is a **locked baseline**. Treat regressions as **merge blockers** unless the full vertical slice below is updated intentionally and reviewed together.

### Required checks


| Check                                                                         | Role                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**npm run check:payroll-container-drift`** (`check:payroll-container-drift`) | Drift gate: Prisma markers, controller surface (GET preview + audited POSTs only), governance doc sections (including this lock), forbidden UI copy, `package.json` / CI wiring. |
| `**payroll-container-lifecycle.policy.spec.ts**`                              | Locks **policy helpers**: in-flight vs activity status sets, `collectCloseBlockers`, `collectArchiveBlockers` (closed periods, activity counts).                                 |


### Forbidden regressions

Do **not** ship changes that reintroduce any of the following:

- **Hard delete** of payroll containers (or other destructive routes that erase `Payroll` history for executed work).
- **Archive with closed periods** — archiving while any linked period is governance-closed (`pay_periods.closed_at` set).
- **Archive with paid / posted / finalized activity** — archiving while any linked payrun reached **PAID**, **POSTED**, or **FINALIZED**.
- **Close with in-flight payruns** — closing while any linked payrun is still in-flight (`DRAFT` … `APPROVED` per policy).
- **UI close/archive without lifecycle preview** — admin UI must not enable **POST** `/close` or `/archive` without first using **GET** `/v1/payrolls/:id/lifecycle-eligibility` for eligibility, blockers, and gating (no blind POST from the shell UI).
- **Close/archive without audit** — **POST** close and archive must continue to emit `**PAYROLL_CONTAINER_CLOSED`** and `**PAYROLL_CONTAINER_ARCHIVED**` on entity `**Payroll**` (and keep optional `reason` on the audit payload where applicable).

### Ownership rule

**Schema, service, policy, UI, permissions, audit, docs, tests, and drift** (`**check:payroll-container-drift`**, `**payroll-container-lifecycle.policy.spec.ts**`, and related integration coverage) **must change together** when altering lifecycle semantics, gates, or surfaces. Partial edits (e.g. relaxing a gate in the service only) are **not** acceptable.

## Non-goals (cross-cutting)

- **Do not** remove or merge PayGroup into Payroll.
- **Do not** assume UI navigation replaces Run Center / Create Payrun flows.
- **Do not** hard-delete payroll containers that participated in payroll execution — use governed archive only.

## API

**Read**

- **GET** `/v1/payrolls` — optional query `pay_group_id`; requires `pay_group:read`.
- **GET** `/v1/payrolls/linkage-health` — `{ orphan_period_count }`; requires `pay_group:read`.
- **GET** `/v1/payrolls/:id/lifecycle-eligibility` — governance preview; requires `pay_group:read`.
- **GET** `/v1/payrolls/:id` — shell plus linked periods (cap 500); requires `pay_group:read`.

**Lifecycle (audited POST only)**

- **POST** `/v1/payrolls/:id/close` — requires `payroll:containers:close`.
- **POST** `/v1/payrolls/:id/archive` — requires `payroll:containers:archive`.

## Related

- Constitutional ladder: `[docs/PAYROLL_GOVERNANCE_CONSTITUTION.md](./PAYROLL_GOVERNANCE_CONSTITUTION.md)` (**PR-PAYROLL-CONTAINER-META-1**), `[docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md](./PAYROLL_GOVERNANCE_MASTER_INDEX.md)` (**CONTAINER** row)
- Drift gate: `npm run check:payroll-container-drift`
- Verify linkage: `npm run verify:payroll-container-period-linkage`
- Backfill: `npm run backfill:pay-period-payroll-ids`
- Unit tests: `payroll-container-lifecycle.policy.spec.ts`
- Schema: `Payroll`, `PayPeriod.payroll_id`, enum `PayrollTaxYearStatus`, unique `payrolls_pay_group_tax_year_window_key`.

