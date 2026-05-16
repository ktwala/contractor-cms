# Contractor CMS

**Full-Stack Contractor Management Platform with South African Tax Compliance**

A comprehensive contractor management system built with NestJS, Prisma, PostgreSQL (backend) and Next.js 15, TypeScript, Tailwind CSS (frontend), featuring multi-tenant architecture, **RBAC with a generated permission catalog**, **immutable audit logging and risk insights**, a **Policy Decision Platform (PDP)** for governance (activation rules, shadow telemetry, exception workflows), SARS tax classification, timesheet and invoice workflows, and role-aware dashboards.

---

## 🎯 Overview

Contractor CMS is a production-ready SaaS platform designed to manage:
- **Suppliers** (Companies and Individuals)
- **Contractors** (Worker profiles and engagements)
- **Contracts** (MSA, SOW, rate cards)
- **Tax Compliance** (SARS classification, BBBEE, withholding instructions)
- **Time & Invoicing** (Timesheets, approvals, invoice generation)
- **Projects** (Budget tracking and utilization)
- **Analytics** (Interactive charts and dashboards)
- **Governance & PDP** (Enforcement levels, activation rules, evaluation preview, exception queue, shadow-mode telemetry)
- **Security Operations** (Audit log listing and CSV export, high-risk and anomaly-style audit insights)
- **Administration** (Users, roles, organization settings including optional HCM adapter metadata)
- **HCM readiness** (Canonical withholding payloads and per-organization `hcmType` / `hcmConfig`; outbound NATS adapters are the integration target—see *HCM Integration* below)

---

## ✨ Key Features

### 🎨 Frontend (Next.js 15)
- **Authentication**: Login, registration, JWT session handling via shared auth context
- **Permission-aware UI**: Client checks against generated permissions ([`frontend/lib/permissions.generated.ts`](frontend/lib/permissions.generated.ts)); protected routes and dashboard variants by role
- **Dashboards**: Analytics (full charts), Finance, Operational, and Contractor self-service workspaces
- **CRUD & workflows**: Contractors, contracts, engagements, timesheets, invoices, projects, suppliers
- **Settings**: User management, role management, **audit log browser**, **audit insights** (summary cards, high-risk tables, timelines), **PDP activation console**, **PDP exception queue**
- **Bulk operations & CSV export** on list views where supported
- **Budget tracking**, status badges, and responsive Tailwind layouts

### 🔧 Backend (NestJS)
- **RESTful API** with Swagger (`/api/docs`)
- **Multi-tenant data** with organization-scoped queries and org-context resolution for sensitive resources
- **Authentication**: JWT (default global guard), local login, **API keys** (Passport custom strategy) for integrations
- **Authorization**: Permission decorator + `PermissionsGuard`, catalog in [`backend/src/core/auth/permissions.catalog.json`](backend/src/core/auth/permissions.catalog.json)
- **Domains**: Suppliers, contractors, contracts, engagements, timesheets, invoices, projects, tax classification, withholding, organizations, analytics, users, roles
- **Audit module**: Paginated audit logs, detail retrieval, bounded CSV export
- **Audit insights**: Aggregated risk-oriented views for security dashboards
- **PDP module**: Telemetry, activation rule CRUD, evaluation preview, exception request/approve/reject APIs
- **Tax compliance**: SARS-style classification and withholding instruction storage (canonical JSON for downstream adapters)
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: E2E suites (including RBAC matrix), focused Jest configs (`jest.unit.config.js`), PDP and audit specs

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **Docker** and **Docker Compose**
- **PostgreSQL** 16+ (or use Docker)

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd contractor-cms

# 2. Install backend dependencies
cd backend && npm install && cd ..

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Environment files
cp backend/.env.example backend/.env
# Frontend: create frontend/.env.local (no committed example in-repo) with at least:
# NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# 5. Update .env files with your configuration
# Edit DATABASE_URL, JWT_SECRET, API_KEY_SALT, CORS_ORIGIN, etc.

# 6. Start infrastructure (see Docker note below) or point DATABASE_URL at your own Postgres

# 7. Generate Prisma Client
npm run db:generate

# 8. Run database migrations
npm run db:migrate

# 9. (Optional) Seed database with test data
npm run db:seed
```

Seeding (`backend/prisma/seed.ts`) creates demo **organization**, **users/roles**, **supplier** (company), **contractor** (linked to the contractor user), **one supplier contract** (`DEMO-MSA-001`), **one contractor engagement** on that contract, plus **timesheets** and **invoices** when none exist yet. Other environments without this seed will have empty Contracts/Engagements until data is created via the API or a custom seed.

### Running the Application

```bash
# Terminal 1 — backend (from repository root)
npm run backend:dev
# or: cd backend && npm run start:dev

# Terminal 2 — frontend
npm run frontend:dev
# or: cd frontend && npm run dev
```

**Full stack with Docker Compose** (PostgreSQL + API + UI):

```bash
npm run docker:up
```

Compose maps host port **5433** to Postgres inside the network (`localhost:5433` from your machine). The `backend` service uses `postgres:5432` internally. For a local Prisma connection from the host against the compose database, use a URL like `postgresql://contractor_cms:password@localhost:5433/contractor_cms`.

The application will be available at:
- **Frontend UI:** http://localhost:3001
- **Backend API:** http://localhost:3000/api/v1 (global prefix `api/v1`)
- **Swagger Docs:** http://localhost:3000/api/docs
- **Health Check:** http://localhost:3000/api/v1/health

Set `NEXT_PUBLIC_API_URL` to the same API base the browser should call (for example `http://localhost:3000/api/v1` when using Docker Compose defaults).

---

## 🎨 User experience highlights

- **Role-aware home**: `/dashboard` selects **Analytics**, **Finance**, **Operational**, or **Contractor** dashboards based on role and the `analytics:read` permission.
- **Settings & security**: `/settings/*` covers **users**, **roles**, **audit logs**, **audit insights**, **PDP activation**, and **PDP exceptions** (each gated by permissions).
- **403** route for denied navigation.
- **Shared layout** via `DashboardLayout` for consistent navigation across modules.

---

## 📦 Available Scripts

### Repository root (`package.json`)

```bash
npm run backend:dev       # NestJS watch mode (cd backend)
npm run backend:build     # Production build
npm run backend:test      # Jest default suite (cd backend)
npm run backend:test:e2e # E2E tests (cd backend)

npm run frontend:dev      # Next.js dev server
npm run frontend:build    # Next.js production build

npm run docker:up         # docker-compose: Postgres + backend + frontend
npm run docker:down
npm run docker:logs

npm run db:generate         # Prisma client (backend)
npm run db:migrate          # prisma migrate dev
npm run db:push             # prisma db push (dev)
npm run db:seed
npm run db:studio

npm run rbac:generate       # Regenerate permission artifacts
npm run rbac:check          # Backend unit permission tests
npm run rbac:verify         # Generate + fail if git diff (catalog vs generated)
```

### Backend only (`backend/package.json`)

```bash
cd backend
npm run start:dev         # Watch mode
npm run start:debug       # Debugger + watch
npm run build
npm run start:prod
npm run test              # Default Jest
npm run test:unit         # Unit config
npm run test:e2e          # E2E (runInBand)
npm run db:migrate:prod   # prisma migrate deploy (production)
npm run lint
npm run format
```

### Frontend only (`frontend/package.json`)

```bash
cd frontend
npm run dev
npm run build
npm run start
npm run test        # Jest (see __tests__/)
npm run lint
```

---

## 🗄️ Database Schema

### Core Entities

**Authentication & Authorization**
- `User` - CMS users (internal, federated, contractors)
- `Role`, `UserRole` - RBAC system
- `ApiKey` - System integration keys
- `UserSession` - JWT session tracking

**Multi-Tenancy**
- `Organization` - Tenant configuration + HCM integration

**Core Domain**
- `Supplier` - Companies and Individuals (vendors)
- `Contractor` - Worker profiles
- `SupplierDocument` - Tax certificates, BBBEE, etc.

**Contracts & Engagements**
- `SupplierContract` - Master agreements, SOW, rate cards
- `ContractorEngagement` - Project assignments

**Tax & Compliance**
- `ContractorTaxClassification` - SARS assessment results
- `WithholdingInstruction` - Canonical format for HCM

**Work Management**
- `Project`, `Task` - Project tracking with budget
- `Timesheet`, `TimesheetEntry` - Time tracking with approval workflow

**Financial**
- `Invoice`, `InvoiceLineItem` - Invoice management with payment tracking

**Governance & audit**
- `AuditLog` - Immutable security and admin events (actor, target, before/after JSON, severity, tags)
- `PdpActivationRule` - PDP rollout dimensions (enforcement level, shadow vs block, priority, dual approval)
- `PdpExceptionRequest` - Human-in-the-loop overrides tied to evaluations / reason codes

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- NestJS (Node.js framework)
- Prisma ORM
- PostgreSQL 16
- JWT authentication, Passport (JWT, local, API key)
- Swagger/OpenAPI
- `nats` client dependency (reserved for outbound HCM/event publishing; application services do not yet open a broker connection by default)

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Recharts (Data visualization)
- Axios (HTTP client)
- date-fns (Date formatting)

### Hybrid Authentication Model
```
CMS-Native Users        Federated Users (HCM)     API Keys (M2M)
├── CMS Admins          ├── External Managers      ├── Withholding Bridge
├── Finance/AP          ├── HCM Staff              ├── Custom Integrations
└── Contractors         └── OIDC/OAuth 2.0         └── Scoped Permissions
```

### Multi-Tenant Architecture
- Organization-scoped data isolation
- Per-organization HCM configuration
- Country-specific tax rules (South Africa, Lesotho)

### Event-Driven Integration (target architecture)

```
CMS → WithholdingInstruction (Canonical) → NATS → Adapters → HCM Systems
```

The **data model** (`WithholdingInstruction.canonicalPayload`, `adapterType`, `syncStatus`, organization `hcmType` / `hcmConfig`) and documentation describe this path. **Runtime publishing** to a NATS cluster is the integration milestone—verify your deployment’s adapter services separately.

### Policy & audit plane

- **PDP engine** evaluates governance rules (supplier, contractor, purchase order, financial domains) with reason codes and explainability hooks documented under `docs/security/`.
- **Audit** captures mutating actions for dashboards, CSV export, and insights.

---

### Backend (.env)

```bash
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://contractor_cms:password@localhost:5432/contractor_cms?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# API Keys
API_KEY_SALT=your-api-key-salt-change-in-production

# CORS
CORS_ORIGIN=http://localhost:3001
```

### Frontend (frontend/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

---

## 📚 API Documentation

Once the backend is running, visit:

**Swagger UI:** http://localhost:3000/api/docs

API endpoints are organized by tags (non-exhaustive):
- `auth` - Authentication (register, login, profile)
- `users` - User management
- `roles` - Role catalog and assignments
- `suppliers` - Supplier CRUD
- `contractors` - Contractor management
- `contracts` - Contract management
- `engagements` - Engagement management
- `projects` - Project & budget tracking
- `timesheets` - Time tracking with approval workflow
- `invoices` - Invoice management with payment tracking
- `tax-classifications` - SARS-style assessments
- `withholding` - Withholding instructions
- `organizations` - Tenant settings (includes HCM metadata)
- `analytics` - Dashboard analytics and reporting
- `audit-logs` - Immutable audit trail (list, detail, CSV export)
- `audit-insights` - Aggregated risk-oriented audit views (`/settings/audit-insights`)
- `pdp` - PDP telemetry, activation rules, preview evaluation, exception workflow
- `health` - Health checks

---

## 🇿🇦 South African Tax Compliance

### SARS Classification Engine

Determines if a contractor is:
- **True Independent Contractor** (no withholding)
- **Deemed Employee** (withholding required)

Classification based on:
- Statutory tests
- Common law principles
- Conservative approach

### BBBEE Tracking

- BBBEE level and expiry dates
- Document management
- Compliance reporting

### Withholding Instructions

Canonical JSON payloads are stored on `WithholdingInstruction` (and related DTOs) for downstream **HCM adapters** or payroll bridges. Example shape:

```json
{
  "instructionId": "wi-123",
  "classification": "DEEMED_EMPLOYEE",
  "withholdingRequired": true,
  "components": [
    { "type": "PAYE", "amount": 1500.00 },
    { "type": "SDL", "amount": 50.00 },
    { "type": "UIF", "amount": 100.00 }
  ]
}
```

---

## 🔌 HCM Integration

### Adapter pattern (integration boundary)

CMS stores **canonical** withholding payloads and organization-level adapter hints. **Outbound** adapters (Oracle HCM Cloud, SAP SuccessFactors, Workday, or custom subscribers) are expected to consume **NATS** (or equivalent bus) topics and translate payloads into vendor APIs.

The repository includes the **`nats` npm dependency** for future broker clients; wire-up lives outside the core REST modules unless your fork adds a publisher service.

### Published Events (contract)

```typescript
contractor.onboarded
classification.assessed
timesheet.submitted
timesheet.approved
invoice.submitted
invoice.approved
contract.signed
withholding.instruction.created
```

Event names are part of the integration contract documented in [`docs/security/`](docs/security/) and [`docs/business/`](docs/business/) ADRs—keep catalogs aligned when extending the bus.

### Business & operating model (governance docs)

| Document | Purpose |
|----------|---------|
| [`docs/business/CURRENT_STATE_DISCOVERY.md`](docs/business/CURRENT_STATE_DISCOVERY.md) | Repo-backed current state (Q+A); **Appendix A** = questions-only workshop pack |
| [`docs/business/CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](docs/business/CURRENT_STATE_VS_TARGET_GAP_MATRIX.md) | Current vs target gaps (fill target after Operating Model approval) |
| [`docs/business/CONTRACTOR_OPERATING_MODEL_V1.md`](docs/business/CONTRACTOR_OPERATING_MODEL_V1.md) | **v0.5** — **§25 sponsor** + **§24 IGA boundary** doctrine lock; ADR-EXTID-001 draft OK; **v1.0** = formal approval |
| [`docs/business/OPERATING_MODEL_DECISION_LOG.md`](docs/business/OPERATING_MODEL_DECISION_LOG.md) | OD register: owner, status, rationale, interim default, blocked-by (synced with operating model §16) |
| [`docs/business/OPERATING_MODEL_MARKET_BENCHMARK.md`](docs/business/OPERATING_MODEL_MARKET_BENCHMARK.md) | Appendix B–style market pattern summary (workshop alignment; not a vendor audit) |
| [`docs/business/EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](docs/business/EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) | **V1.0 prep** — sequenced doctrine→implementation streams, gates, maturity classes |
| [`docs/business/PR-EXTID-SCHEMA-1_DESIGN.md`](docs/business/PR-EXTID-SCHEMA-1_DESIGN.md) | **Execution** — additive **PR-EXTID-SCHEMA-1** schema design (identity, sponsor, IGA boundary, gates) |
| [`docs/business/IMPLEMENTATION_DRIFT_GATES.md`](docs/business/IMPLEMENTATION_DRIFT_GATES.md) | **Execution** — PR alignment header + drift rules (maps to governance/security scripts) |
| [`docs/business/V1_0_RATIFICATION_RECORD.md`](docs/business/V1_0_RATIFICATION_RECORD.md) | **Execution** — v1.0 sign-off template; **ADR → PROPOSED** trigger; blocks **PR-EXTID-SCHEMA-1A** until §7 |
| [`docs/business/EXTID_MIGRATION_SAFETY_CHECKLIST.md`](docs/business/EXTID_MIGRATION_SAFETY_CHECKLIST.md) | **Execution** — migration / seed / DTO / API / frontend no-break checklist for schema PRs |
| [`docs/business/SCHEMA_DIFF_REVIEW.md`](docs/business/SCHEMA_DIFF_REVIEW.md) | **Execution** — template: what changed / not / deferred; **required before merge** of **PR-EXTID-SCHEMA-1A** |
| [`docs/business/RATIFICATION_STATE_CONSISTENCY_CHECK.md`](docs/business/RATIFICATION_STATE_CONSISTENCY_CHECK.md) | **Execution** — one-time after **§7.4**, before **1A**: doc/header parity, no stale **DRAFT**/v0.5 |
| [`docs/business/ROLE_TRANSITION_MATRIX_V1.md`](docs/business/ROLE_TRANSITION_MATRIX_V1.md) | Seed/target roles; **STREAM B** / **PR-RBAC-REALIGN-1** (after schema design lock) |
| [`docs/business/SCHEMA_IMPACT_REGISTER_V1.md`](docs/business/SCHEMA_IMPACT_REGISTER_V1.md) | Additive schema **candidates** (sponsor, IGA status, `external_person_id`) |
| [`docs/security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md`](docs/security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) | **DRAFT** ADR — identity, sponsorship, IGA boundary; lifecycle **§11** (**DRAFT→PROPOSED→ACCEPTED**) |

**Doctrine baseline:** [`CONTRACTOR_OPERATING_MODEL_V1.md`](docs/business/CONTRACTOR_OPERATING_MODEL_V1.md) — **v0.5** (§25 **sponsor accountability plane**, §24 **IGA integration boundary**, four-way accountability §7.1a; **OD-06/OD-07 doctrine LOCKED**). **ADR-EXTID-001** draft shell: [`docs/security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md`](docs/security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) — **not** **PROPOSED** until **[`V1_0_RATIFICATION_RECORD.md`](docs/business/V1_0_RATIFICATION_RECORD.md) §7** is executed; **no** **PR-EXTID-SCHEMA-1A** before that unless waived. **After §7 + doc updates (ratification record §7.4):** **production-bound governance active for Schema Stream 1A only** — additive Prisma only per [`PR-EXTID-SCHEMA-1_DESIGN.md`](docs/business/PR-EXTID-SCHEMA-1_DESIGN.md); RBAC / HCM / IGA / UI streams **separately gated**. **V1.0 prep package:** [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](docs/business/EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md), [`ROLE_TRANSITION_MATRIX_V1.md`](docs/business/ROLE_TRANSITION_MATRIX_V1.md), [`SCHEMA_IMPACT_REGISTER_V1.md`](docs/business/SCHEMA_IMPACT_REGISTER_V1.md). **Execution governance:** [`PR-EXTID-SCHEMA-1_DESIGN.md`](docs/business/PR-EXTID-SCHEMA-1_DESIGN.md), [`IMPLEMENTATION_DRIFT_GATES.md`](docs/business/IMPLEMENTATION_DRIFT_GATES.md), [`V1_0_RATIFICATION_RECORD.md`](docs/business/V1_0_RATIFICATION_RECORD.md), [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](docs/business/EXTID_MIGRATION_SAFETY_CHECKLIST.md), [`SCHEMA_DIFF_REVIEW.md`](docs/business/SCHEMA_DIFF_REVIEW.md), [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](docs/business/RATIFICATION_STATE_CONSISTENCY_CHECK.md).

## 🧪 Testing

### E2E Tests (Backend)

```bash
cd backend
npm run test:e2e

# Run a specific suite
npm run test:e2e -- test/auth.e2e-spec.ts
```

**Automated suites (high level):**
- **E2E** under [`backend/test/`](backend/test/) — auth, RBAC, RBAC matrix, domain, financial, integration, experience layers
- **Decorators / guards** — org-context decorator E2E under `backend/src/core/auth/decorators/__tests__/`
- **Unit / focused specs** — PDP engine, activation, exceptions, telemetry, audit services, drift-style catalog tests in `backend/src/**/__tests__/`

Run focused Jest targets with `npm run test` / `npm run test:unit` from `backend/`.

---

## 🛠️ Development

### Project Structure

```
contractor-cms/
├── backend/
│   ├── prisma/                 # schema, migrations, seed
│   ├── src/
│   │   ├── core/               # auth, audit, config, database, common filters
│   │   ├── domain/             # suppliers, contractors, contracts, …
│   │   ├── pdp/                # PDP engine, activation, exceptions, telemetry
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── test/                   # E2E specs + fixtures
├── frontend/
│   ├── app/                    # App Router routes (dashboard, entities, settings, …)
│   ├── components/             # UI, dashboards, audit-insights, PDP consoles
│   ├── lib/                    # api clients, auth, permissions.generated.ts, …
│   ├── pages/                  # Legacy/aux pages (e.g. PDP console specs co-located)
│   ├── services/               # Typed PDP and domain service wrappers
│   └── __tests__/              # Jest tests
├── docs/
│   ├── business/               # ADRs, review packs, discovery, operating model v1 (§24/§25), decision log, benchmark
│   └── security/               # RBAC, PDP, audit catalogs, drift rules, ADR-EXTID-001 (draft)
├── scripts/                    # governance-drift-check, security-drift-check, catalog verifiers
├── .github/workflows/          # governance + security drift gates
├── docker-compose.yml          # Postgres + backend + frontend (dev-oriented)
├── package.json                # Monorepo orchestration scripts
└── README.md
```

### Governance CI & local checks

Pull requests against `main` run workflow checks such as:
- **Governance drift** — [`scripts/governance-drift-check.ts`](scripts/governance-drift-check.ts) (terminology, evaluation order, registered catalogs)
- **Security drift** — [`scripts/security-drift-check.sh`](scripts/security-drift-check.sh)

Supporting scripts also live under [`scripts/`](scripts/) for audit and permission catalog verification. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the documentation progression model (ADR → matrix → review pack → catalog → runtime).

---

## 🔒 Security

- **Helmet** — Security headers
- **CORS** — Configurable origins
- **Argon2** — Password hashing
- **JWT** — Default authenticated API surface; refresh token flow where enabled
- **API keys** — Separate Passport strategy for machine integrations
- **RBAC** — Permission constants + guard + generated catalog (`rbac:verify` in CI)
- **Org context** — Sensitive domain routes resolve tenant scope explicitly
- **Audit trail** — Append-only `AuditLog` rows for privileged actions
- **PDP** — Graduated enforcement (shadow → hard block) with auditable activation rules and exceptions
- **ADR-EXTID-001 (draft)** — [External workforce identity, sponsorship, and IGA boundary](docs/security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) — architecture codification after operating model v0.5; **bind** to implementation at **v1.0**
- **Validation** — class-validator + class-transformer
- **SQL injection** — Prisma parameterized queries

---

## 📈 Monitoring & Health

### Health Check Endpoints

```bash
# General health (database check)
GET /api/v1/health

# Liveness probe (Kubernetes)
GET /api/v1/health/liveness

# Readiness probe (Kubernetes)
GET /api/v1/health/readiness
```

---

## 🗺️ Implementation Status

### ✅ Recently delivered (high level)

**Backend**
- Core contractor management domains (suppliers through analytics) with Prisma models and REST controllers
- **Audit** service + **audit insights** aggregation + CSV export guardrails
- **PDP** services (engine, activation admin, exceptions, telemetry) with Nest module wiring
- **RBAC** expansion (permission catalog, guards, API key path, org-context resolver)
- **Health** probes suitable for container orchestration
- Broad automated tests (E2E layers, RBAC matrix, PDP unit specs)

**Frontend**
- Role-aware **dashboard** surfaces (Analytics / Finance / Operational / Contractor)
- **Settings** area for users, roles, audit logs, audit insights, PDP activation, PDP exceptions
- **403** handling and permission-aware navigation
- **Dockerfile** for UI and API images used by compose

**Platform**
- **Docker Compose** stack for Postgres + API + Next.js
- **GitHub Actions** governance and security drift workflows
- **Contributor governance** documentation ([`CONTRIBUTING.md`](CONTRIBUTING.md))

### 🚧 Roadmap (examples)

- Email / webhook notifications for approvals and PDP outcomes
- Richer reporting (scheduled PDFs, scheduled CSV drops)
- Deeper HCM bidirectional sync (beyond withholding payloads and `workerExternalId`)
- First-party NATS publisher service with idempotent outbox semantics (if not provided externally)
- Mobile / offline experiences

### Implementation record (demo data & contractor UI)

```text
CLOSED — Contractor CMS demo data, supplier display, seed coverage, engagements access, and org-context drift protection are aligned.
```

```text
PR-PDP-UI-ALIGN-1 — PDP Activation and Governance Exceptions now conform to the standard Contractor CMS page shell. The change is UI-only: PDP services, API-backed data behavior, simulation, rule management, and exception approval/rejection flows are unchanged. Regression tests enforce correct page titles, PDP-specific settings layout behavior, light card/table styling, and removal of the dark PDP panel treatment.
```

Architectural closure is documented here and enforced below; a browser pass is optional final confirmation, not a blocker to the conclusion.

**Protections in place**

- README implementation record (this section)
- Regression tests (supplier display helper, contractor list `supplier.type` select, seed script shape)
- Seed verification and demo contract / engagement rows after `npm run db:seed`
- Governance drift check ([`scripts/governance-drift-check.ts`](scripts/governance-drift-check.ts)) — `@RequiresOrgContext` required on **suppliers**, **contractors**, **contracts**, and **engagements** controllers so `PermissionsGuard` cannot silently drop org-scoped roles

---

## 🐳 Docker Deployment

**Local full stack** (recommended for demos):

```bash
npm run docker:up
```

Services: **postgres** (host port `5433`), **backend** (`3000`), **frontend** (`3001`). Dockerfiles live at [`backend/Dockerfile`](backend/Dockerfile) and [`frontend/Dockerfile`](frontend/Dockerfile).

**Single-service images** (Kubernetes / ECS style) build from each package directory, for example:

```bash
docker build -t contractor-cms-api:latest ./backend
docker build -t contractor-cms-web:latest ./frontend
```

Pass the same environment variables you would use in `.env` files (`DATABASE_URL`, `JWT_SECRET`, `API_KEY_SALT`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, etc.).

---

## 📊 Database Migrations

### Create Migration

```bash
cd backend
# After modifying prisma/schema.prisma
npm run db:migrate
# Name your migration descriptively, e.g. "add_audit_log_indexes"
```

### Production Deployment

```bash
cd backend && npm run db:migrate:prod
```

(Or your pipeline’s equivalent `prisma migrate deploy` against the production `DATABASE_URL`.)

---

## 🔍 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
npm run docker:logs

# Verify DATABASE_URL in backend/.env
# Default compose mapping: localhost:5433 (host) -> 5432 (container)
```

### Prisma Client Out of Sync

```bash
# Regenerate Prisma Client
npm run db:generate
```

### Port Already in Use

```bash
# Change PORT in .env
PORT=3001

# For frontend, change in package.json
"dev": "next dev -p 3002"
```

### Frontend API Connection Issues

```bash
# Verify NEXT_PUBLIC_API_URL in frontend/.env.local matches the backend prefix, e.g.:
# http://localhost:3000/api/v1
# Ensure the backend is reachable from the browser at that origin.
```

---

## 🤝 Contributing

See **[`CONTRIBUTING.md`](CONTRIBUTING.md)** for governance doctrine, drift checks, and the required documentation chain when changing policy surfaces.

---

## 📝 License

ISC

---

## 📞 Support

(TODO: Add support contact)

---

Built with NestJS, Prisma, PostgreSQL, Next.js, and TypeScript.
