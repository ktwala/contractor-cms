# Demo login credentials (UI testing)

> **NON-PRODUCTION ONLY** — These accounts and passwords exist only in local/demo seed data.
> Never use in production. Rotate or disable before any shared or hosted environment.

**Status:** Seeded by `backend/prisma/seed.ts` — run `cd backend && npm run db:seed` before use.

**Organization:** Demo Organization (`DEMO`)

---

## Users

| Role | Email | Password | Expected sidebar |
|------|--------|----------|------------------|
| **CMS_ADMIN** | `admin@contractor-cms.com` | `Admin123!` | Operations: Dashboard, Suppliers, Contractors, Contracts, Engagements, Timesheets, Invoices, Projects · Governance: Activation, Exceptions, Audit Logs, Security Insights · Administration: Users, Roles |
| **FINANCE_USER** | `finance@contractor-cms.com` | `Finance123!` | Operations: Dashboard, Suppliers, Contractors, Timesheets, Invoices · Governance: Activation, Exceptions |
| **CONTRACTOR_MANAGER** | `manager@contractor-cms.com` | `Manager123!` | Operations: Dashboard, Suppliers, Contractors, Contracts, Engagements, Timesheets · Governance: Activation, Exceptions (no Invoices) |
| **CONTRACTOR** | `contractor@contractor-cms.com` | `Contractor123!` | Operations: Dashboard, Timesheets only (no Invoices) |
| **SUPPLIER_ADMIN** | `supplier.admin@contractor-cms.com` | `SupplierAdmin123!` | Operations: Dashboard, Supplier profile, Contractors (supplier-portal; not client Contractors registry) |
| **SUPPLIER_MANAGER** | `supplier.manager@contractor-cms.com` | `SupplierManager123!` | Operations: Dashboard, Supplier profile, Contractors, Supplier timesheets |
| **SPONSOR** | `sponsor@contractor-cms.com` | `Sponsor123!` | Operations: Dashboard, Contractors, Engagements |

---

## Endpoints (local dev)

| Surface | URL |
|---------|-----|
| Frontend | `http://localhost:3001` |
| API (Docker) | `http://localhost:3000/api/v1` |
| API (local backend) | `http://localhost:3010/api/v1` (if `PORT=3010`) |
| Login | `POST /auth/login` with `{ "email", "password" }` |

**Supplier portal API (membership-scoped):**

| Route | Permission |
|-------|------------|
| `GET/PATCH /supplier-portal/profile` | `supplier-profile:*` |
| `GET/POST /supplier-portal/contractors` | `supplier-contractors:*` |
| `GET /supplier-portal/timesheets` | `supplier-timesheets:read` |

---

## API smoke script

```bash
cd backend && npm run db:seed
API_BASE=http://localhost:3010/api/v1 ./scripts/smoke-role-personas.sh
```

See also: [`scripts/smoke-role-personas.sh`](../scripts/smoke-role-personas.sh)

---

## Notes

- **Legacy personas** (`admin`, `finance`, `manager`, `contractor`) — same emails; role bundles refresh on each reseed.
- **Target personas** (`supplier.admin`, `supplier.manager`, `sponsor`) — map to `SUPPLIER_ADMIN`, `SUPPLIER_MANAGER`, `SPONSOR` bundles.
- **CMS_ADMIN** is global (platform-wide). All other users are scoped to Demo Organization.
- **Supplier users** are bound to Demo Supplier Ltd via `SupplierMembership`; they must not use client `GET /suppliers`.
- **Do not commit real production credentials.**
