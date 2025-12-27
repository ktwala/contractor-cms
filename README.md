# Contractor CMS

**Independent SaaS Platform for Contractor Management with South African Tax Compliance**

A comprehensive contractor management system built with NestJS and Prisma, featuring multi-tenant architecture, SARS tax classification, and event-driven integration with HCM systems.

---

## 🎯 Overview

Contractor CMS is a standalone SaaS platform designed to manage:
- **Suppliers** (Companies and Individuals)
- **Contractors** (Worker profiles and engagements)
- **Contracts** (MSA, SOW, rate cards)
- **Tax Compliance** (SARS classification, BBBEE, withholding)
- **Time & Invoicing** (Timesheets, approvals, invoice generation)
- **HCM Integration** (Event-driven adapters for Oracle, SAP, Workday, etc.)

---

## 🏗️ Architecture

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

### Event-Driven Integration
```
CMS → WithholdingInstruction (Canonical) → NATS → Adapters → HCM Systems
```

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

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Update .env with your configuration
# Edit DATABASE_URL, JWT_SECRET, etc.

# 5. Start PostgreSQL with Docker
npm run docker:up

# 6. Generate Prisma Client
npm run db:generate

# 7. Run database migrations
npm run db:migrate

# 8. (Optional) Seed database with admin user
npm run db:seed

# 9. Start development server
npm run start:dev
```

The application will be available at:
- **API:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/api/docs
- **Health Check:** http://localhost:3000/api/v1/health

---

## 📦 Available Scripts

### Development
```bash
npm run start:dev         # Start in watch mode
npm run start:debug       # Start with debugger
npm run build             # Build for production
npm run start:prod        # Run production build
```

### Database
```bash
npm run db:generate       # Generate Prisma Client
npm run db:migrate        # Run migrations (dev)
npm run db:migrate:prod   # Deploy migrations (production)
npm run db:push           # Push schema changes (dev only)
npm run db:seed           # Seed database
npm run db:studio         # Open Prisma Studio
```

### Docker
```bash
npm run docker:up         # Start PostgreSQL container
npm run docker:down       # Stop containers
npm run docker:logs       # View container logs
```

### Code Quality
```bash
npm run lint              # Lint and fix code
npm run format            # Format with Prettier
npm test                  # Run tests (TODO)
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
- `Project`, `Task` - Project tracking
- `Timesheet`, `TimesheetEntry` - Time tracking

**Financial**
- `Invoice`, `InvoiceLineItem` - Invoice management

---

## 🔐 Environment Variables

Create a `.env` file based on `.env.example`:

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

---

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 📚 API Documentation

Once the application is running, visit:

**Swagger UI:** http://localhost:3000/api/docs

API endpoints are organized by tags:
- `auth` - Authentication
- `users` - User management
- `suppliers` - Supplier CRUD
- `contractors` - Contractor management
- `contracts` - Contract management
- `projects` - Project & task management
- `timesheets` - Time tracking
- `invoices` - Invoice management
- `health` - Health checks

---

## 🌍 Multi-Tenancy

Each organization is isolated by `organizationId`:

```typescript
// Example: Create a supplier scoped to organization
POST /api/v1/suppliers
{
  "organizationId": "org-123",
  "type": "COMPANY",
  "companyName": "Acme Construction",
  // ...
}
```

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

Canonical format published to NATS for HCM systems:

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

### Adapter Pattern

CMS publishes canonical events to NATS. Adapters transform for specific HCM systems:

- **Oracle HCM Cloud** (REST/HDL)
- **SAP SuccessFactors** (OData)
- **Workday** (REST)
- **Custom NATS** (Event-driven)

### Published Events

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

---

## 🛠️ Development

### Project Structure

```
contractor-cms/
├── src/
│   ├── core/
│   │   ├── auth/              # Authentication (TODO)
│   │   ├── database/          # Prisma service
│   │   └── health/            # Health checks
│   │
│   ├── modules/               # Business modules (TODO)
│   │   ├── suppliers/
│   │   ├── contractors/
│   │   ├── contracts/
│   │   ├── classification/    # SARS engine
│   │   ├── timesheets/
│   │   ├── invoices/
│   │   └── projects/
│   │
│   ├── country-packs/         # Country rules (TODO)
│   │   ├── south-africa/
│   │   └── lesotho/
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration history
│   └── seed.ts                # Seed data (TODO)
│
├── docker-compose.yml
├── package.json
└── README.md
```

### Adding a New Module

```bash
# Generate module, service, and controller
nest g module modules/suppliers
nest g service modules/suppliers
nest g controller modules/suppliers
```

---

## 🔒 Security

- **Helmet** - Security headers
- **CORS** - Configurable origins
- **Argon2** - Password hashing
- **JWT** - Stateless authentication
- **Validation** - class-validator + class-transformer
- **API Keys** - System integration security

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

## 🗺️ Roadmap

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed phased roadmap.

### Current Status: **Phase 1 - Foundation** ✅

**Next Up:** Phase 1B - Authentication Module

---

## 🤝 Contributing

(TODO: Add contribution guidelines)

---

## 📝 License

ISC

---

## 📞 Support

(TODO: Add support contact)

---

## ⚙️ Configuration

### Organization Setup

Each organization requires:
- `hcmType` - Integration adapter (ORACLE_HCM, SAP_SF, WORKDAY, CUSTOM_NATS)
- `hcmConfig` - Adapter-specific configuration (API URLs, credentials)
- `country` - Country code (ZA, LS)
- `currency` - Default currency (ZAR)

### Role-Based Access Control

Predefined roles:
- `CMS_ADMIN` - Full system access
- `FINANCE_USER` - AP/Invoice management
- `CONTRACTOR_MANAGER` - Contractor operations
- `CONTRACTOR` - Self-service portal

Permissions format: `resource:action`
- Examples: `suppliers:create`, `invoices:approve`, `timesheets:view`

---

## 🐳 Docker Deployment

```bash
# Build production image
docker build -t contractor-cms:latest .

# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  contractor-cms:latest
```

(TODO: Add docker-compose for production)

---

## 📊 Database Migrations

### Create Migration

```bash
# After modifying schema.prisma
npm run db:migrate

# Name your migration descriptively
# Example: "add_bbbee_expiry_to_suppliers"
```

### Production Deployment

```bash
# Deploy pending migrations
npm run db:migrate:prod
```

---

## 🔍 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
npm run docker:logs

# Verify DATABASE_URL in .env
# Ensure container is accessible at localhost:5432
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
```

---

Built with ❤️ using NestJS, Prisma, and PostgreSQL
