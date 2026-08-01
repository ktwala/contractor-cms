# Platform Bootstrap

Official environment startup and tenant setup flow for Hubsec Workforce Platform.

---

## System Startup States

When the platform starts, the admin portal determines the current state via:

```
GET /v1/bootstrap/status
```

| State | Condition | UI behavior |
|-------|-----------|-------------|
| **No users** | `user_count === 0` | Redirect to **Create first administrator** |
| **Users exist** | `user_count > 0` | Show **Login** |
| **Connection failure** | API unreachable | Show **Recovery screen** (Retry / Sign in / Create first administrator) |

---

## Bootstrap Flow

```
Start platform
     │
     ├─ GET /v1/bootstrap/status
     │
     ├─ users exist → Login
     │
     ├─ no users → Create first administrator
     │
     └─ connection failure → Recovery screen
```

---

## Environment Setup (Official)

### Development

```bash
prisma migrate dev
npm run db:seed
npm run demo:seed   # optional: demo users + sample data
```

Then: **Login** → Demo users (`admin@demo.payroll` / `admin123`)

---

### Customer Environment

```bash
prisma migrate deploy
npm run db:seed
npm run bootstrap:admin   # BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD
```

Then: **Login** (with credentials from bootstrap) → **Setup checklist** → Import employees

---

### Demo Environment

```bash
prisma migrate deploy
npm run db:seed
npm run demo:seed
```

Then: **Login** → Demo users and sample data. Ready for demos.

---

## Admin Creation

When no users exist, the app shows **Create first administrator**:

1. User enters first name, last name, email, password
2. Backend creates first admin with `TENANT_ADMIN` (GLOBAL scope)
3. User is auto-logged in and redirected to **Organisation Setup Checklist**

---

## Tenant Setup

After the first admin is created, the guided flow is:

```
Create first administrator
        ↓
Auto-login
        ↓
Organisation Setup Checklist (tenant readiness)
        ↓
Legal Entities → Org Structure → Cost Centers → Positions → Company Groups
        ↓
Import Employees (Data Import Wizard)
        ↓
Create Employments
        ↓
HR API ready for IGA
```

The **Tenant readiness** dashboard on `/enterprise/organisation` shows completion for each step:

- ✔ Legal Entities
- ✔ Org Structure
- ✔ Cost Centers
- ⚠ Positions (optional)
- ✔ Company Groups
- ✔ Employees
- ✔ Employments

---

## Script Reference

| Script | Purpose |
|--------|---------|
| `npm run db:seed` | Roles, permissions, role-permission mappings. Required before bootstrap or demo. |
| `npm run bootstrap:admin` | Create first admin. Use when `user_count === 0`. |
| `npm run demo:seed` | Demo users + sample employees. For development/demos. |
| `npm run db:reset-for-customer` | Clear all data. Then run db:seed and bootstrap:admin. |

---

## RBAC Model (Current)

- **TENANT_ADMIN @ GLOBAL** — Full tenant configuration, RBAC, IAM
- **Operational roles @ LEGAL_ENTITY** — Payroll, HR, SARS, etc.
- **Integration roles @ GLOBAL** — e.g. INTEGRATION_IGA (hr:read only)

No custom role builders, approval workflows, or identity federation yet. Those come after HCM core is stable.

---

## Critical Flow: Customer Onboarding

The most important flow for IGA readiness:

1. Create admin
2. Create legal entity
3. Create org units
4. Import employees
5. Capture manager hierarchy
6. Create employments
7. HR API ready for IGA

Everything else is secondary until this flow is smooth.
