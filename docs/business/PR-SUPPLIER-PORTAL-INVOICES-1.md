# PR-SUPPLIER-PORTAL-INVOICES-1 — Supplier-scoped invoice visibility

**Status:** **COMPLETE**
**Depends on:** **PR-RBAC-REALIGN-3B** (COMPLETE) — `supplier-invoices:read` in catalog and seed bundles

**RBAC baseline:** [`PLATFORM_GOVERNANCE_ROLES.md`](./PLATFORM_GOVERNANCE_ROLES.md)

## Objective

Expose **membership-scoped invoice visibility** in the supplier portal for roles that already hold `supplier-invoices:read`:

| Role | Permission |
|------|------------|
| `SUPPLIER_ADMIN` | `supplier-invoices:read` |
| `SUPPLIER_MANAGER` | `supplier-invoices:read` |

Supplier Manager sees operational invoice status; Supplier Admin sees the same plus full portal administration elsewhere.

## Out of scope (v1)

- Client-side `invoices:*` (finance/AP workflows)
- Invoice create/approve from portal
- Amount/banking fields unless explicitly scoped and non–finance-sensitive

## Delivered

| # | Item | Location |
|---|------|----------|
| 1 | `GET /supplier-portal/invoices` | `supplier-portal.controller.ts` |
| 2 | Membership scope only (no `supplierId` query) | `SupplierPortalService.listInvoices` |
| 3 | Finance redaction for portal users | `presentPortalInvoice` + `redactInvoiceRecord` |
| 4 | Read-only UI + nav | `app/supplier-portal/invoices/page.tsx`, `supplier-portal-modules.ts` |
| 5 | Unit tests | `supplier-portal-invoices.spec.ts` |

## Acceptance

- `supplier.manager@` sees supplier-scoped invoices after reseed + login
- `supplier.admin@` sees same list; retains profile/users/documents admin
- No regression on PR-RBAC-REALIGN-3D SoD tests

## Related

- Supplier portal bundles: [`seed-system-role-bundles.ts`](../../backend/src/core/auth/seed-system-role-bundles.ts)
- Demo logins: [`DEMO_LOGIN_CREDENTIALS.md`](../DEMO_LOGIN_CREDENTIALS.md)
