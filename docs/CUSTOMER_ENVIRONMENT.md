# Customer Environment Setup

How to prepare a clean Hubsec Workforce Platform instance for a new customer.

---

## Clean Slate Reset

To clear all data and prepare for a fresh customer:

### Local (with DATABASE_URL)

```bash
DATABASE_URL="postgresql://payroll:payroll_secret@localhost:5432/payroll_platform" npm run db:reset-for-customer
```

### Docker

Run the reset script inside the app container:

```bash
docker exec -it payroll-app npm run db:reset-for-customer
```

Or, if the app isn’t running:

```bash
docker compose run --rm app npm run db:reset-for-customer
```

After reset, reseed using [After Reset](#after-reset) below.

---

## What the Reset Does

| Action | Description |
|--------|-------------|
| **Truncates** | All tables in the `public` schema |
| **Resets sequences** | Auto-increment IDs start from 1 again |
| **Preserves** | Schema, migrations history (`_prisma_migrations`) |
| **Does not** | Drop the database, modify schema, or reseed data |

---

## After Reset

### Option A: Customer environment (Docker)

```bash
# 1. Start in customer mode
docker compose -f docker-compose.yml -f docker-compose.customer.yml up -d

# 2. Create first admin (one-off)
docker compose -f docker-compose.yml -f docker-compose.customer.yml run --rm \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@company.com \
  -e BOOTSTRAP_ADMIN_PASSWORD=SecurePass123 \
  app npm run bootstrap:admin
```

### Option B: Customer environment (local)

```bash
npm run db:seed
BOOTSTRAP_ADMIN_EMAIL=admin@company.com BOOTSTRAP_ADMIN_PASSWORD=SecurePass123 npm run bootstrap:admin
```

### Option C: Demo / sandbox data

```bash
# Docker (default)
docker compose up -d

# Or local
npm run db:seed && npm run demo:seed
```

Login: `admin@demo.payroll` / `admin123`.

See [BOOTSTRAP.md](BOOTSTRAP.md) for full details.

---

## Full Rebuild (schema + data)

Development (with demo data):

```bash
docker compose down -v
docker compose up -d
```

Customer (no demo data):

```bash
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.customer.yml up -d
# Then run bootstrap:admin one-off (see Option A above)
```

---

*Last updated: March 2026*
