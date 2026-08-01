# Payroll Supplemental & Opening Balances Imports

Once the primary organizational structure and employees are imported via the **Bootstrap Pack**, the next phase of implementation involves uploading payroll-specific data. This is divided into two separate imports: **Supplemental** (recurring payroll data) and **Opening Balances** (YTD totals for mid-year go-lives).

Both imports accept `.xlsx` workbooks where the sheet names correspond to the dataset names.

## Payroll import baseline (locked)

The **payroll import program is baseline locked**: onboarding behaviour, schema parity, and guardrails are enforced in CI. Treat changes here as a **cross-cutting contract**, not a single-file tweak.

### Required checks (CI)

- **`npm run check:payroll-import-drift`** — static contract vs parsers, tenant templates, admin import consoles, grouped error workbook tabs, and readiness wording (`scripts/check_payroll_import_drift.ts`).
- **Payroll import contract spec** — `src/modules/data-imports/__tests__/payroll-import-contract.spec.ts` (workbook export shape, supplemental precheck without import-job writes, opening balances financial rollups, template buffers).
- **`payroll-import-e2e`** — GitHub Actions job: migrated DB + seeds (global pay items + CI pay group / legal entity), Nest API + admin `vite preview`, blocking Playwright import-console suite (`npm run test:playwright:payroll-imports`).

### Forbidden regressions

- Reintroducing the legacy workbook tab **`taxprofiles`** outside the single allowlisted legacy-detection module (see drift script).
- **Hardcoded dropdown lists** in the supplemental tenant template (values must flow from reference data / hidden `__reference_values` sheet).
- **Server upload before precheck** passes with **`ready === true`** for the same workbook (and for opening balances, the same country / tax year / as-of context).
- **Opening balances publish** before operator **totals review** (checkbox; publish control stays disabled until satisfied).

### Ownership rule (import schema / contract changes)

Any change to import **schema or contract** must land **together**:

1. Parser and validation (required sheets, columns, types).  
2. Tenant **template** generation (`template-generation.service.ts`).  
3. **This document** (`docs/PAYROLL_IMPORTS.md`).  
4. **Precheck**, upload, and preview/publish flows (services + admin consoles).  
5. **Grouped error export** (`export-errors.ts` — Summary, Errors, Warnings, Reference Values, How to Fix).  
6. **Drift gate** (`scripts/check_payroll_import_drift.ts`) so CI continues to encode the contract.

---

> [!TIP]
> **Reference Data**: To ensure your import is successful, download the latest tenant-specific reference data (such as valid Pay Groups, Component Codes, and Deduction Codes) by calling the `GET /v1/payroll/reference-data` endpoint.

---

## 1. Payroll Supplemental Import

This import configures the ongoing payroll rules and baseline data for each employee. It requires **four distinct sheets** in the workbook.

| Sheet Name | Description |
|------------|-------------|
| `compensation` | Base salaries, hourly rates, and core earnings. |
| `bankaccounts` | Employee direct deposit information. |
| `recurringdeductions` | Ongoing deductions (medical aid, union fees, etc.). |
| `payrolleligibility` | Defines which pay group the employee belongs to and their active status. |

### Required Columns

**Compensation** (`compensation`)
- `employee_no`
- `effective_from`
- `component_code`
- `component_type`
- `amount`
- `frequency`
- `currency`

**Bank Accounts** (`bankaccounts`)
- `employee_no`
- `bank_name`
- `account_number`
- `account_type`
- `verified` (Boolean/Yes/No indicating if the account has passed pre-note validation)

**Recurring Deductions** (`recurringdeductions`)
- `employee_no`
- `deduction_code`
- `amount`
- `frequency`
- `effective_from`

**Payroll Eligibility** (`payrolleligibility`)
- `employee_no`
- `pay_group_code`
- `payroll_status`
- `effective_from`

---

## 2. Payroll Opening Balances Import

If you are migrating mid-tax-year, this import sets the Year-to-Date (YTD) financial totals so that subsequent tax calculations (like PAYE) calculate correctly. 

| Sheet Name | Description | Required? |
|------------|-------------|-----------|
| `payrollopeningbalances` | The core financial YTD totals. | **Yes** |
| `leavebalances` | Outstanding leave/vacation days. | No |
| `loanbalances` | Outstanding employee loan/advance balances. | No |

### Required Columns

**Payroll Opening Balances** (`payrollopeningbalances`)
- `employee_no`
- `tax_year` (The year these balances apply to)
- `ytd_gross` (Total gross income YTD)
- `ytd_taxable` (Total taxable income YTD)
- `ytd_paye` (Total tax paid YTD)
- `ytd_net` (Total net pay YTD)

**Leave Balances** (`leavebalances`)
- `employee_no`
- `leave_type`
- `balance` *(can also use column alias `balance_days`)*
- `as_of_date` *(can also use column alias `balance_date`)*

**Loan Balances** (`loanbalances`)
- `employee_no`
- `deduction_code`
- `remaining_balance`
- `as_of_date`

> **Data Integrity Check**: The import process will provide a validation preview outlining the total rows `toInsert`, `toUpdate`, `toSkip`, and `failed`. For Opening Balances, it also calculates and displays the sum of `ytdGross`, `ytdPaye`, and `ytdNet` so you can cross-reference against your legacy payroll reports before finalizing the import.
