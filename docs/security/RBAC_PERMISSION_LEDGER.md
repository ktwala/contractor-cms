# RBAC Permission Ledger

> **Last updated:** 2026-04-26
>
> This document records every permission in the system, where it's used, and its lifecycle status.
> Update this ledger whenever permissions are added, modified, or deprecated.

## Permission Catalog (47 permissions across 12 resources)

---

### Suppliers

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `suppliers:create` | `POST /suppliers` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/suppliers` (create btn) | ✅ Active |
| `suppliers:read` | `GET /suppliers`, `GET /suppliers/:id` | CMS_ADMIN (via `*:*`), FINANCE_USER, CONTRACTOR_MANAGER | `/suppliers` | ✅ Active |
| `suppliers:update` | `PATCH /suppliers/:id`, `PATCH /suppliers/:id/status` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/suppliers/:id` (edit) | ✅ Active |
| `suppliers:delete` | `DELETE /suppliers/:id` | CMS_ADMIN (via `*:*`) | `/suppliers/:id` (delete) | ✅ Active |

---

### Contractors

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `contractors:create` | `POST /contractors` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/contractors` (create) | ✅ Active |
| `contractors:read` | `GET /contractors`, `GET /contractors/:id` | CMS_ADMIN (via `*:*`), FINANCE_USER, CONTRACTOR_MANAGER | `/contractors` | ✅ Active |
| `contractors:update` | `PATCH /contractors/:id`, `PATCH /contractors/:id/status` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/contractors/:id` (edit) | ✅ Active |
| `contractors:delete` | `DELETE /contractors/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Contracts

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `contracts:create` | `POST /contracts` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/contracts` (create) | ✅ Active |
| `contracts:read` | `GET /contracts`, `GET /contracts/:id` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/contracts` | ✅ Active |
| `contracts:update` | `PATCH /contracts/:id`, `PATCH /contracts/:id/status`, `PATCH /contracts/:id/renew` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/contracts/:id` (edit) | ✅ Active |
| `contracts:delete` | `DELETE /contracts/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Engagements

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `engagements:create` | `POST /engagements` | CMS_ADMIN (via `*:*`) | `/engagements` (create) | ✅ Active |
| `engagements:read` | `GET /engagements`, `GET /engagements/:id` | CMS_ADMIN (via `*:*`) | `/engagements` | ✅ Active |
| `engagements:update` | `PATCH /engagements/:id`, `PATCH /engagements/:id/status` | CMS_ADMIN (via `*:*`) | `/engagements/:id` (edit) | ✅ Active |
| `engagements:delete` | `DELETE /engagements/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Timesheets

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `timesheets:create` | `POST /timesheets` | CMS_ADMIN (via `*:*`), CONTRACTOR | `/timesheets` (create) | ✅ Active |
| `timesheets:read` | `GET /timesheets`, `GET /timesheets/:id` | CMS_ADMIN (via `*:*`), FINANCE_USER, CONTRACTOR_MANAGER, CONTRACTOR | `/timesheets` | ✅ Active |
| `timesheets:update` | `PATCH /timesheets/:id` | CMS_ADMIN (via `*:*`), CONTRACTOR | `/timesheets/:id` (edit) | ✅ Active |
| `timesheets:delete` | `DELETE /timesheets/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `timesheets:submit` | `PATCH /timesheets/:id/submit` | CMS_ADMIN (via `*:*`) | `/timesheets/:id` (submit btn) | ✅ Active |
| `timesheets:approve` | `PATCH /timesheets/:id/approve`, `PATCH /timesheets/:id/reject` | CMS_ADMIN (via `*:*`), FINANCE_USER, CONTRACTOR_MANAGER | `/timesheets/:id` (approve/reject) | ✅ Active |

---

### Invoices

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `invoices:create` | `POST /invoices`, `POST /invoices/auto-generate` | CMS_ADMIN (via `*:*`), CONTRACTOR | `/invoices` (create) | ✅ Active |
| `invoices:read` | `GET /invoices`, `GET /invoices/:id` | CMS_ADMIN (via `*:*`), FINANCE_USER, CONTRACTOR | `/invoices` | ✅ Active |
| `invoices:update` | `PATCH /invoices/:id`, `PATCH /invoices/:id/payment-info`, `PATCH /invoices/:id/write-off` | CMS_ADMIN (via `*:*`) | `/invoices/:id` (edit) | ✅ Active |
| `invoices:delete` | `DELETE /invoices/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `invoices:submit` | `PATCH /invoices/:id/submit` | CMS_ADMIN (via `*:*`) | `/invoices/:id` (submit btn) | ✅ Active |
| `invoices:approve` | `PATCH /invoices/:id/approve`, `PATCH /invoices/:id/reject` | CMS_ADMIN (via `*:*`), FINANCE_USER | `/invoices/:id` (approve/reject) | ✅ Active |

---

### Tax Classifications

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `tax-classifications:create` | `POST /tax-classifications` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/tax-classifications` | ✅ Active |
| `tax-classifications:read` | `GET /tax-classifications`, `GET /tax-classifications/:id`, `GET /tax-classifications/contractor/:id` | CMS_ADMIN (via `*:*`), CONTRACTOR_MANAGER | `/tax-classifications` | ✅ Active |
| `tax-classifications:update` | `PATCH /tax-classifications/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `tax-classifications:delete` | `DELETE /tax-classifications/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `tax-classifications:approve` | `PATCH /tax-classifications/:id/approve` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Withholding

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `withholding:create` | `POST /withholding` | CMS_ADMIN (via `*:*`) | `/withholding` | ✅ Active |
| `withholding:read` | `GET /withholding`, `GET /withholding/:id` | CMS_ADMIN (via `*:*`) | `/withholding` | ✅ Active |
| `withholding:update` | `PATCH /withholding/:id`, `PATCH /withholding/:id/status`, `PATCH /withholding/:id/recalculate` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `withholding:delete` | `DELETE /withholding/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Projects

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `projects:create` | `POST /projects` | CMS_ADMIN (via `*:*`) | `/projects` (create) | ✅ Active |
| `projects:read` | `GET /projects`, `GET /projects/:id`, `GET /projects/:id/summary` | CMS_ADMIN (via `*:*`) | `/projects` | ✅ Active |
| `projects:update` | `PATCH /projects/:id` | CMS_ADMIN (via `*:*`) | `/projects/:id` (edit) | ✅ Active |
| `projects:delete` | `DELETE /projects/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Organizations

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `organizations:create` | `POST /organizations` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `organizations:read` | `GET /organizations/:id` | CMS_ADMIN (via `*:*`) | — | ✅ Active |
| `organizations:update` | `PATCH /organizations/:id`, `PATCH /organizations/:id/settings` | CMS_ADMIN (via `*:*`) | — | ✅ Active |

---

### Analytics

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `analytics:read` | `GET /analytics/dashboard`, `GET /analytics/revenue`, `GET /analytics/contractors`, `GET /analytics/compliance`, `GET /analytics/projects`, `GET /analytics/trends` | CMS_ADMIN (via `*:*`) | `/analytics` | ✅ Active |

---

### Profile

| Permission | Backend Endpoints | Seed Roles | Frontend Route | Status |
|---|---|---|---|---|
| `profile:read` | _(no decorator yet)_ | CONTRACTOR | — | ⏳ Pending |
| `profile:update` | _(no decorator yet)_ | CONTRACTOR | — | ⏳ Pending |

> [!NOTE]
> `profile:read` and `profile:update` are defined in the catalog and seeded for the CONTRACTOR role,
> but no controller endpoint currently uses these decorators. They exist as placeholders for
> a future self-service profile endpoint.

---

## Seed Role ↔ Permission Matrix

| Permission | CMS_ADMIN | FINANCE_USER | CONTRACTOR_MANAGER | CONTRACTOR |
|---|:---:|:---:|:---:|:---:|
| `*:*` (all) | ✅ | | | |
| `invoices:read` | ✅ | ✅ | | ✅ |
| `invoices:approve` | ✅ | ✅ | | |
| `suppliers:read` | ✅ | ✅ | ✅ | |
| `suppliers:create` | ✅ | | ✅ | |
| `suppliers:update` | ✅ | | ✅ | |
| `contractors:read` | ✅ | ✅ | ✅ | |
| `contractors:create` | ✅ | | ✅ | |
| `contractors:update` | ✅ | | ✅ | |
| `contracts:create` | ✅ | | ✅ | |
| `contracts:read` | ✅ | | ✅ | |
| `contracts:update` | ✅ | | ✅ | |
| `timesheets:read` | ✅ | ✅ | ✅ | ✅ |
| `timesheets:approve` | ✅ | ✅ | ✅ | |
| `timesheets:create` | ✅ | | | ✅ |
| `timesheets:update` | ✅ | | | ✅ |
| `tax-classifications:create` | ✅ | | ✅ | |
| `tax-classifications:read` | ✅ | | ✅ | |
| `profile:read` | ✅ | | | ✅ |
| `profile:update` | ✅ | | | ✅ |

> CMS_ADMIN has `*:*` which expands to all 47 permissions.
> Only explicit grants are shown for other roles.

---

## Changelog

| Date | Change | PR |
|---|---|---|
| 2026-04-26 | Initial ledger created | PR1.5 |
| 2026-04-26 | Fixed `classifications:*` → `tax-classifications:*` | PR1 |
| 2026-04-26 | Removed dead `invoices:reject` from FINANCE_USER | PR1 |
