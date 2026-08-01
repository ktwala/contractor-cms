# JML/IGA HR Export API

Read-only HR surface at `/v1/hr` for external consumers (IGA, analytics, JML delta feeds).

## Sign-off 1: DB + Prisma

- **Employment.updatedAt** — Schema and migration are in place. Apply and regenerate:
  1. `npm run db:migrate` (or `npx prisma db push` if you don’t use migrate), then
  2. `npm run db:generate`
- **Sign-off:** DB table `employments` has `updated_at`; Prisma client types include `Employment.updatedAt`. After `db:generate`, you can remove the temporary `as any` in `src/modules/hr/hr.service.ts` (employment `where: { updatedAt: ... }`) if you want a strict-typed build.

Migration: `prisma/migrations/20260301120000_add_employment_updated_at/migration.sql`

## Sign-off 2: Integration principal + hr:read

- **Permission** `hr:read` and role **INTEGRATION_IGA** (GLOBAL) are seeded.
- **Integration user** (seeded): `iga@demo.payroll` / `admin123` — change password in production.
- **Sign-off:** Log in as that user; `GET /v1/hr/employees` returns **200**. Without `hr:read`, the same request returns **403** and audit logs **PERMISSION_DENIED**.

## P0 implemented

- **Employment.updatedAt** — Schema: `updatedAt DateTime @updatedAt @map("updated_at")` and `@@index([updatedAt])` on `Employment`.
- **GET /v1/hr/legal-entities** — Same shape as admin API plus `updated_at`. No query params.
- **GET /v1/hr/employees** — Delta feed:
  - **Query:** `changed_since` (ISO timestamp), `limit` (default 200, max 1000), `cursor` (opaque offset), `include` (default `current_employment,manager`), **`as_of`** (optional ISO date/datetime — resolve `current_employment` as of this date; omit for “as of now”. Enables point-in-time snapshots and testing future-dated changes.)
  - **Delta:** Returns employees where `Employee.updatedAt > changed_since` OR any `Employment.updatedAt > changed_since`.
  - **Response:** `employee_id`, `employee_no`, …, `current_employment` (when included), plus **`as_of`** in the root (server timestamp for checkpointing; not the requested `as_of`).
- **GET /v1/hr/employees/by-employee-no/:employee_no** — Lookup by business key (IGA-friendly). Optional query **`as_of`** for point-in-time `current_employment`.
- **GET /v1/hr/employees/:employee_no/employments** — Employment history by `employee_no`.

## Auth and permissions

- All routes require JWT (`AuthGuard('jwt')`) and **`hr:read`**.
- Add permission `hr:read` to your RBAC seed and assign it to the role used by IGA/integration service accounts.

## Vendor-neutral polling plan (don’t melt the DB)

Use this as the default for IGA/connector config. It keeps load bounded and avoids long sustained queries.

### Recommended default (start here)

| Setting | Value | Rationale |
|--------|--------|------------|
| **Poll interval** | 10 minutes | Near real-time for joiner/mover/leaver without hammering the DB. |
| **limit** | 500 | Keeps each request small; page with cursor. |
| **Lookback window** | 5 minutes | Use `changed_since = last_checkpoint - 5m` to absorb clock skew and in-flight commits. Dedupe on the consumer. |
| **Max pages per run** | 20 | Cap work per cycle: 500×20 = 10,000 rows max per poll. |

### Checkpoint logic (required)

- IGA stores **last_checkpoint** (timestamp).
- Call:  
  `GET /v1/hr/employees?changed_since=<last_checkpoint - 5m>&limit=500`
- Page with **cursor** until you have no more pages or hit 20 pages.
- **Only after a full successful run**, advance checkpoint to the response’s **as_of** (do not use “now”).
- **as_of** is the safety rail: it’s the server’s consistent point for the data you just read.

### Scaling once you know real volume

- **Faster JML:** Poll every **5 minutes**; keep `limit=500`, max pages 20.
- **High change volume or hot DB:** Keep 10 minutes; reduce `limit` to 200–300 and **max pages to 10**.
- **Slower cadence:** Poll every **15–30 minutes** if 10m is still too much.
- **Initial backfill:** Run a one-time full pull off-peak; use smaller `limit` (e.g. 300–500), allow more pages but **throttle** (e.g. 250–500 ms sleep between pages).

### What to log/measure (so you can tune)

- Rows returned per poll
- Pages per poll
- Request duration (e.g. p50 / p95)
- DB CPU or slow-query log around poll times

After 2–3 days you can decide whether to tighten to 5 min or loosen to 15–30.

### Light vs rich payload (future-proof)

The API supports **include** (e.g. `current_employment`, `manager`). Default poll can use `include=current_employment,manager`. If load is an issue, poll with minimal include and fetch detail only for changed employees when needed.

### Integration test pack

An executable script proves delta + current-employment semantics (transaction-time vs business-time). See **docs/JML_INTEGRATION_TEST_PACK.md** and run **scripts/jml-integration-test.sh** (requires server up, DB seeded, `curl`, `jq`).

### TL;DR — copy into connector config

```yaml
interval: 10m
limit: 500
lookback: 5m
max_pages: 20
# Advance checkpoint to response as_of only after full success
```

## Event envelope (future P1)

When you add `/v1/hr/events` and an outbox, use the canonical envelope and minimal event types described in the JML/IGA spec (e.g. `HCM_EMPLOYMENT_CHANGED`, `HCM_EMPLOYEE_CREATED`, etc.).

## Postman test plan

A Postman collection mirrors the bash integration test (Track A/B/C): [POSTMAN_JML_TEST_PLAN.md](./POSTMAN_JML_TEST_PLAN.md). Import `postman/JML-IGA-HCM-Test-Plan.postman_collection.json` and `postman/IGA-HCM-Local.postman_environment.json`, select the environment, and run the collection (or use Newman for CLI/CI).

## Optional later (B2)

- Add `managerEmployeeNo` to `Employment` for effective-dated manager history (Mover semantics).
