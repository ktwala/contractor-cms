# PR-FINANCE-RBAC-1 — Financial field separation

**Principle:** CMS administrator ≠ finance officer. Operational admins manage users, suppliers, contractors, contracts, and workflow setup; sensitive supplier financials require explicit grants.

## Permission model

| Permission | Purpose |
|------------|---------|
| `invoices:read` | Invoice list/detail (status, counts, exception flags) |
| `invoice-amounts:view` | Subtotal, VAT, totals, line-item amounts |
| `invoice-payment-status:view` | Paid date, payment reference |
| `invoices:approve` | Approve/reject financial workflow |
| `invoices:export` | CSV/export with monetary fields |
| `supplier-finance:view` | Supplier financial summary (BBEE, credit terms, etc.) |
| `supplier-bank-details:view` | Banking and tax identifiers |

**Important:** `*:*` does **not** imply finance-sensitive permissions. Finance grants must be explicit on the role.

## Seeded personas

| Role | Financial access |
|------|------------------|
| `CMS_ADMIN` | `*:*` operations only; amounts/bank hidden unless explicitly granted |
| `FINANCE_USER` | Full finance bundle (`FINANCE_ADMIN_PERMISSIONS`) |
| `CONTRACTOR_MANAGER` | `invoices:read` (summary); no amounts/bank |
| `SPONSOR` | `invoices:read` (summary); no amounts/bank |
| `GOVERNANCE_AUDITOR` | Audit/governance + `invoices:read` (summary) |

## Enforcement

- API: `finance-visibility.helper.ts` redacts invoice/supplier responses
- Guard: `permission-evaluation.ts` carve-out for route access
- UI: `frontend/lib/finance-visibility.ts` mirrors backend checks
