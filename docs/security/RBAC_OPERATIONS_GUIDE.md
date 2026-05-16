# RBAC Operations Guide

> Operational reference for maintaining, testing, and releasing the contractor-cms RBAC system.

---

## Prerequisites

### Required Versions

| Dependency | Version | Notes |
|---|---|---|
| `prisma` | **^6.x** | v7 uses a JS/WASM client engine requiring driver adapters. Stay on v6 until the project migrates to adapter-based Prisma. |
| `@prisma/client` | **^6.x** | Must match the `prisma` CLI version. |
| Node.js | ≥18 | Required by NestJS and Prisma. |
| PostgreSQL | 16 | Running via Docker (`contractor-cms-db`). |

> [!CAUTION]
> **Do not upgrade to Prisma 7** without first installing `@prisma/adapter-pg` and updating `PrismaService` to use an adapter constructor. Prisma 7 removed the `library` and `binary` engine types entirely.

### Database Setup

The E2E tests require a running PostgreSQL instance. The project uses Docker:

```bash
docker compose up -d db
```

### `.env.test` Requirements

The file `backend/.env.test` must exist and contain valid credentials for the test database:

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:<port>/<database>
JWT_SECRET=test
API_KEY_SALT=test
```

**Docker defaults** (from `docker-compose.yml`):

```env
DATABASE_URL=postgresql://contractor_cms:password@localhost:5433/contractor_cms
```

> [!WARNING]
> The Docker container maps to host port **5433**, not 5432. Port 5432 may be occupied by other PostgreSQL instances.

Verify connectivity before running tests:

```bash
npx prisma db execute \
  --url "postgresql://contractor_cms:password@localhost:5433/contractor_cms" \
  --stdin <<< "SELECT 1"
```

### Schema Sync

Ensure the database schema matches `prisma/schema.prisma`:

```bash
cd backend
DATABASE_URL="..." npx prisma db push
```

---

## RBAC Scripts

All scripts run from the **repository root**:

| Command | Purpose |
|---|---|
| `npm run rbac:generate` | Regenerate `permissions.catalog.json` and `frontend/lib/permissions.generated.ts` from the backend catalog |
| `npm run rbac:verify` | Generate + `git diff --exit-code` to confirm no drift |
| `npm run rbac:check` | Run backend unit tests (includes permission invariant checks) |

---

## Release Gate Checklist

Before closing any RBAC-related PR, **all four gates must pass**:

### 1. Permission Drift Verification

```bash
npm run rbac:verify
```

Confirms backend catalog, frontend constants, and JSON export are in sync.

### 2. Unit Tests

```bash
cd backend && npm run test:unit
```

Validates:
- Every `@Permissions()` decorator references a cataloged permission
- Every seeded role permission exists in the catalog
- Every controller handler has `@Permissions()` or `@Public()`

### 3. RBAC Matrix E2E Tests

```bash
cd backend && NODE_ENV=test npm run test:e2e -- --testPathPattern=rbac-matrix
```

Validates:
- Cross-tenant isolation (Org A ↛ Org B)
- Scoped list filtering (user sees only their org's data)
- Global role access (CMS_ADMIN sees all orgs)
- Missing context denial (no org context → 403)

### 4. Build

```bash
cd backend && npm run build
```

Confirms no TypeScript compilation errors.

---

## PR6 Release Evidence

### RBAC Matrix Results

```
PASS test/rbac-matrix.e2e-spec.ts
  RBAC Matrix (e2e)
    Cross-tenant Isolation
      ✓ should deny Org A user from reading Org B data
      ✓ should deny Org A user from mutating Org B data
    Scoped List Results
      ✓ should only show Org A results to Org A user
      ✓ should only show Org B results to Org B user
    Global Role Access
      ✓ should allow CMS_ADMIN to read Org A data
      ✓ should allow CMS_ADMIN to read Org B data
      ✓ should allow CMS_ADMIN to view all organizations data if requested globally
    Missing Context
      ✓ should return 403 when creating a resource in another org context without global role

Tests: 8 passed, 8 total
```

### Resolved Blockers

| Blocker | Root Cause | Fix |
|---|---|---|
| Prisma engine mismatch | Prisma 7 defaults to `client` engine requiring adapter | Downgraded to Prisma 6.19.3 |
| Test DB credentials | `.env.test` pointed to wrong port/user | Updated to Docker container credentials |
| AuthModule provider visibility | `OrgContextResolverService` not globally available | Added `@Global()` to `AuthModule` |
| Prisma null composite key | `upsert` rejects null in composite unique `where` | `findFirst` + `create` for global roles |
| Controller typing | `@Request() req` missing explicit type | Added `: any` annotations |
| Factory schema drift | `accountNumber` vs `bankAccountNumber` | Aligned field names to schema |
| Org-context wiring | `findAll` required query param conflicting with DTO validation | Changed to `currentUser` context |
| Response assertion mismatch | Tests expected array, API returns paginated `{ data }` | Fixed to use `response.body.data` |

---

## Troubleshooting

### `PrismaClientConstructorValidationError: Using engine type "client"`

**Cause:** Prisma 7 is installed.

**Fix:**

```bash
cd backend
npm install prisma@6 @prisma/client@6
npx prisma generate
```

### `Authentication failed against database server`

**Cause:** Wrong credentials or port in `DATABASE_URL`.

**Fix:** Check `docker ps` for the correct port mapping and `docker inspect` for the `POSTGRES_USER`/`POSTGRES_PASSWORD`.

### `Nest can't resolve dependencies of PermissionsGuard`

**Cause:** `AuthModule` is not `@Global()`, so `OrgContextResolverService` isn't available in domain modules.

**Fix:** Ensure `@Global()` is on `AuthModule` in `src/core/auth/auth.module.ts`.

### `Argument organizationId must not be null` in tests

**Cause:** Prisma rejects `null` in composite unique key `where` clauses.

**Fix:** For global role assignments (null org), use `findFirst` + `create` instead of `upsert`.
