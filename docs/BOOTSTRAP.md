# Bootstrap & Deployment

How to deploy a fresh Hubsec Workforce Platform instance.

---

## Architecture

```
Database
    ↓
Prisma migrate deploy (or db push)
    ↓
Seed roles & permissions (db:seed)
    ↓
Bootstrap admin (bootstrap:admin)
    ↓
Admin configures organisation via UI
```

---

## Fresh Customer Deployment

For a clean production or customer environment (no demo data):

```bash
# 1. Apply schema
prisma migrate deploy
# Or, if using db push: prisma db push

# 2. Create roles and permissions
npm run db:seed

# 3. Create first administrator
BOOTSTRAP_ADMIN_EMAIL=admin@company.com \
BOOTSTRAP_ADMIN_PASSWORD=SecurePass123 \
BOOTSTRAP_ADMIN_FIRST_NAME=System \
BOOTSTRAP_ADMIN_LAST_NAME=Admin \
npm run bootstrap:admin
```

**Result:** One admin user with `TENANT_ADMIN` (GLOBAL scope). No demo data.

The admin then configures:

- Legal entities
- Org structure
- Employees
- Payroll configuration

via **Hubsec Workforce Admin** and **Data Import Console**.

---

## Development / Sandbox

For local development with full demo data:

```bash
# 1. Apply schema
npm run db:migrate
# Or: prisma db push

# 2. Seed roles and permissions
npm run db:seed

# 3. Seed demo data (legal entity, employees, demo users)
npm run demo:seed
```

**Result:** Demo users (`admin@demo.workforce`, `hr@demo.workforce`, etc.) with password `admin123`, plus sample employees and payroll setup.

---

## Script Reference

| Script | Purpose |
|--------|---------|
| `npm run db:seed` | Creates roles, permissions, role-permission mappings. Idempotent. |
| `npm run bootstrap:admin` | Creates first admin user. Skips if any users exist. |
| `npm run demo:seed` | Creates demo data (legal entity, employees, demo users). Skips if demo already exists. |
| `npm run db:reset-for-customer` | Clears all data for a clean slate. See [CUSTOMER_ENVIRONMENT.md](CUSTOMER_ENVIRONMENT.md). |

---

## Bootstrap Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOOTSTRAP_ADMIN_EMAIL` | Yes | — | Admin email address |
| `BOOTSTRAP_ADMIN_PASSWORD` | Yes | — | Password (min 12 chars, upper, lower, number, special) |
| `BOOTSTRAP_ADMIN_FIRST_NAME` | No | System | Admin first name |
| `BOOTSTRAP_ADMIN_LAST_NAME` | No | Admin | Admin last name |

---

## Production Automation

Example for CI/CD or infrastructure scripts:

```bash
DATABASE_URL="postgresql://..." \
BOOTSTRAP_ADMIN_EMAIL="admin@customer.com" \
BOOTSTRAP_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
npm run bootstrap:admin
```

Store the generated password securely and provide it to the customer.

---

## First-Time Setup UI

When no users exist, the admin portal detects bootstrap mode and shows a **Create First Administrator** page instead of the login form.

**Flow:**

1. Admin opens the admin portal URL.
2. App fetches `GET /v1/bootstrap/status`.
3. If `bootstrap_required: true` → redirect to `/setup/admin`.
4. User fills the form and submits → `POST /v1/bootstrap/admin` creates the first admin and returns an access token.
5. User is logged in and redirected to the organisation dashboard.

`POST /v1/bootstrap/admin` only succeeds when `user_count === 0`. After the first admin is created, the setup route is no longer accessible.

---

## Bootstrap API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/bootstrap/status` | Returns bootstrap status and user count |
| `POST` | `/v1/bootstrap/admin` | Creates first admin (when no users exist) |

### Rules

- **No auth required** — Both endpoints work without `Authorization` header.
- **User count gate** — `POST /v1/bootstrap/admin` only succeeds when `user_count === 0`.
- **Same response as login** — On success, returns `access_token`, `expires_in`, and `user` (roles, permissions, legal_entity_access).
- **Disabled after first user** — Once any user exists, the endpoint returns 409 Conflict.
- **Race protection** — Uses a transaction with serializable isolation to prevent double-admin on concurrent requests.

### GET /v1/bootstrap/status

**Response:**
```json
{
  "bootstrap_required": true,
  "user_count": 0
}
```

### POST /v1/bootstrap/admin

**Request:**
```json
{
  "first_name": "System",
  "last_name": "Admin",
  "email": "admin@company.com",
  "password": "StrongPassword123!"
}
```

**Password rules:** Minimum 12 characters, at least one uppercase, one lowercase, one number, one special character (`@$!%*?&#` etc.).

**Response (success):** Same structure as `POST /auth/login`.

---

## Docker Deployment

### Development (default)

Uses `docker-compose.yml` as-is. The app container runs `db:seed` and `demo:seed` on startup:

```bash
docker compose up -d
```

**Result:** Demo users (`admin@demo.workforce` / `admin123`) and sample data. Ready for local development.

---

### Customer / Production

1. **Start with customer mode** (no demo data):

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.customer.yml up -d
   ```

   The app runs `db:seed` only. No demo users or data.

2. **Create first admin** (one-off, secrets not stored in container):

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.customer.yml run --rm \
     -e BOOTSTRAP_ADMIN_EMAIL=admin@customer.com \
     -e BOOTSTRAP_ADMIN_PASSWORD=YourSecurePassword \
     app npm run bootstrap:admin
   ```

3. **App is ready** – login at the admin portal with the bootstrap credentials.

---

### Environment variable

| Variable           | Values        | Default     | Effect                                      |
|-------------------|---------------|------------|---------------------------------------------|
| `DEPLOYMENT_MODE` | `development` | development | Runs `demo:seed` (demo users + sample data) |
| `DEPLOYMENT_MODE` | `customer`    | —           | Skips `demo:seed` (roles only, no users)   |

---

### Bootstrap inside running container

If the app is already running:

```bash
docker exec -it payroll-app \
  env BOOTSTRAP_ADMIN_EMAIL=admin@company.com \
      BOOTSTRAP_ADMIN_PASSWORD=SecurePass123 \
  npm run bootstrap:admin
```

**Note:** Avoid long-lived app containers with bootstrap secrets in env. Prefer the one-off `run` command above.

---

## Seed Structure

| File | Creates |
|------|---------|
| `prisma/seed.ts` | Roles, permissions, role-permission mappings |
| `prisma/scripts/bootstrap-admin.ts` | First admin user + TENANT_ADMIN (GLOBAL) |
| `prisma/scripts/demo-seed.ts` | Demo legal entity, employees, demo users, pay items, tax tables |

---

*Last updated: March 2026*
