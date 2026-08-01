# PR-SHELL-NAV-CONTEXT-1 — Admin vs Supplier Portal navigation

**Principle:** Finance visibility is permission-gated (`PR-FINANCE-RBAC-1`). Navigation shell is a **role/context** problem, not a URL prefix problem.

## Rules

| Actor | Nav shell | Sidebar |
|-------|-----------|---------|
| **CMS_ADMIN** / internal operators (`suppliers:read` or `users:read`) | `internal` | Full CMS menu; **no** `/supplier-portal/*` duplicates |
| **FINANCE_USER** | `internal` | Operations + invoices (amounts when finance grants exist) |
| **SUPPLIER_ADMIN / SUPPLIER_MANAGER** | `supplier-portal` | Dashboard + supplier profile / contractors / timesheets only |
| **GOVERNANCE_AUDITOR** | `internal` | Governance + read-only evidence routes |
| **Preview / impersonation** (future) | `supplier-portal` when `supplierPortalPreview: true` | Portal menu only |

Visiting `/supplier-portal/*` as an internal operator **does not** shrink the sidebar.

## Implementation

- `frontend/lib/nav-shell-context.ts` — `resolveNavShell()`, route classification
- `buildSidebarNavSections()` — filters `PROTECTED_ROUTES` by shell, not `pathname`
- `isSupplierPortalUser()` — unchanged; supplier portal when portal perms exist **and** no `suppliers:read`

## Acceptance (with PR-FINANCE-RBAC-1)

- **CMS_ADMIN:** full admin menu, Invoices visible, amounts/bank redacted without finance grants
- **FINANCE_USER:** finance fields visible, not necessarily full system admin
- **SUPPLIER_USER:** supplier portal menu only
- **GOVERNANCE_AUDITOR:** governance + read-only evidence, no bank/payment/amounts unless granted
