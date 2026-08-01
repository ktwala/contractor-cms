# Demo login credentials (UI testing)

> **NON-PRODUCTION ONLY** — These accounts and passwords exist only in local/demo seed data.
> Never use in production. Rotate or disable before any shared or hosted environment.

**Status:** Seeded by `backend/prisma/seed.ts`. Docker runs seed on backend startup; for local API use `cd backend && npm run db:seed` if login returns *Invalid credentials*.

**Email domain:** `@ewp.demo` — reflects **External Workforce Platform** demo personas (replaces legacy `@contractor-cms.com`).

**Organization:** Demo Organization (`DEMO`) — `ORACLE_ONLY` suppliers, `CMS_ONLY` contractors (HCM import; EWP authoritative after import)

**Connector & governance platform:** [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md) · **Connector UAT:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md) · **MTN story data:** [`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md) · **Demo package:** [`DEMO_ARCHITECTURE_WALKTHROUGH.md`](./DEMO_ARCHITECTURE_WALKTHROUGH.md) · **Managing an External Workforce:** [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md) · **Working as a Supplier:** [`DEMO-SUPPLIER-PORTAL.md`](./DEMO-SUPPLIER-PORTAL.md) · **Platform Architecture:** [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md) · **Cheat sheet:** [`DEMO-CHEATSHEET.md`](./DEMO-CHEATSHEET.md)

**Source of truth (code):** `backend/prisma/demo-login-credentials.ts` · `frontend/lib/demo-login-personas.ts`

> **Demo super-user is not a production role.** `workforce.import@ewp.demo` is for connector UAT only — not least-privilege production governance.

---

## Primary demo personas

| Experience | Email | Password | Use for |
|------------|-------|----------|---------|
| **Managing an External Workforce** | `ops.admin@ewp.demo` | `Admin123!` | MTN operations demo — suppliers, workforce review, engagements |
| **Working as a Supplier (MTN story)** | `supplier.admin@atlas.demo` | `SupplierAdmin123!` | Atlas Consulting portal — see [`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md) |
| **Working as a Supplier (legacy)** | `supplier.admin@ewp.demo` | `SupplierAdmin123!` | Legacy single-supplier seed path |
| **Workforce Import** | `workforce.import@ewp.demo` | `GovOps123!` | Oracle HCM connector, worker linking, governance scan |

The login page (non-production) shows quick-fill buttons for these and other personas.

---

## All demo users

### Client-side (internal)

| Audience | Email | Password | RBAC bundle *(internal)* |
|----------|-------|----------|--------------------------|
| Operations admin | `ops.admin@ewp.demo` | `Admin123!` | CMS_ADMIN |
| Finance | `finance@ewp.demo` | `Finance123!` | FINANCE_USER |
| Operations manager | `ops.manager@ewp.demo` | `Manager123!` | CONTRACTOR_MANAGER |
| Workforce Import / connector UAT *(demo composite)* | `workforce.import@ewp.demo` | `GovOps123!` | GOVERNANCE_OPERATIONS_ADMIN |
| Supplier sync operator | `integration@ewp.demo` | `IntegrationOps123!` | GOVERNANCE_INTEGRATION_OPERATOR |
| Supplier approvals reviewer | `supplier.reviewer@ewp.demo` | `SupplierReview123!` | SUPPLIER_GOVERNANCE_REVIEWER |
| Workforce governance reviewer | `governance.reviewer@ewp.demo` | `GovReview123!` | GOVERNANCE_REVIEWER |
| Engagement operations | `engagement.ops@ewp.demo` | `ContractorOps123!` | CONTRACTOR_MANAGER |
| Governance read-only | `governance.viewer@ewp.demo` | `GovView123!` | GOVERNANCE_VIEWER |
| External worker self-service | `external.worker@ewp.demo` | `Contractor123!` | CONTRACTOR |
| Sponsor inbox *(optional)* | `sponsor@ewp.demo` | `Sponsor123!` | SPONSOR |

### Supplier portal (external)

| Audience | Email | Password | RBAC bundle *(internal)* |
|----------|-------|----------|--------------------------|
| Atlas Consulting admin *(MTN)* | `supplier.admin@atlas.demo` | `SupplierAdmin123!` | SUPPLIER_ADMIN |
| Nexa Technologies admin *(MTN)* | `supplier.admin@nexa.demo` | `SupplierAdmin123!` | SUPPLIER_ADMIN |
| Ubuntu Field Services admin *(MTN)* | `supplier.admin@ubuntu.demo` | `SupplierAdmin123!` | SUPPLIER_ADMIN |
| Vertex Projects admin *(MTN)* | `supplier.admin@vertex.demo` | `SupplierAdmin123!` | SUPPLIER_ADMIN |
| Horizon Staffing admin *(MTN)* | `supplier.admin@horizon.demo` | `SupplierAdmin123!` | SUPPLIER_ADMIN |
| Supplier admin *(legacy)* | `supplier.admin@ewp.demo` | `SupplierAdmin123!` | SUPPLIER_ADMIN |
| Supplier portal operator | `supplier.portal@ewp.demo` | `SupplierPortal123!` | SUPPLIER_ADMIN |
| Supplier manager | `supplier.manager@ewp.demo` | `SupplierManager123!` | SUPPLIER_MANAGER |

---

## Legacy emails (retired on reseed)

After `db:seed`, accounts ending in `@contractor-cms.com` are **deactivated**. Use the `@ewp.demo` addresses above.

| Legacy | New |
|--------|-----|
| `admin@contractor-cms.com` | `ops.admin@ewp.demo` |
| `governance.ops@contractor-cms.com` | `workforce.import@ewp.demo` |
| `contractor@contractor-cms.com` | `external.worker@ewp.demo` |
| `manager@contractor-cms.com` | `ops.manager@ewp.demo` |

---

## Business sponsor (reference-only default)

Production sponsors are **HCM employee references** on engagements (`sponsorEmployeeId`). EWP publishes sponsor context to IGA/workflow; sponsors do **not** log into EWP by default.

Optional sponsor inbox (scoped lists + task queue) requires:

```bash
export SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true
docker compose exec -e SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true backend npm run db:seed
```

Then `sponsor@ewp.demo` is seeded for local smoke. Without the flag, `sponsor@` is not created.

See: [`docs/business/SPONSOR_ACCOUNTABILITY_MODEL.md`](business/SPONSOR_ACCOUNTABILITY_MODEL.md)

---

## Endpoints (local dev)

| Surface | URL |
|---------|-----|
| Frontend | `http://localhost:3001` |
| API (Docker) | `http://localhost:3000/api/v1` |
| API (local backend) | `http://localhost:3010/api/v1` (if `PORT=3010`) |
| Login | `POST /auth/login` with `{ "email", "password" }` |

---

## Connector demo (UAT)

**Docker (use this):**

```bash
docker compose up -d
npm run docker:reset:connector-demo
```

Login as `workforce.import@ewp.demo` / `GovOps123!` → [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md)

---

## Troubleshooting “Login failed”

1. **Reseed** — `docker compose exec backend npm run db:seed`
2. **Backend health** — `curl http://localhost:3000/api/v1/health/liveness`
3. **Use @ewp.demo emails** — legacy `@contractor-cms.com` accounts are deactivated after reseed

---

## Notes

- **RBAC role names** (e.g. `CMS_ADMIN`) remain internal engineering identifiers — demo emails use business-facing personas instead.
- **Supplier users** are bound to Demo Supplier Ltd via `SupplierMembership`.
- **Do not commit real production credentials.**
