# Contractor CMS

**Full-Stack Contractor Management Platform with South African Tax Compliance**

A comprehensive contractor management system built with NestJS, Prisma, PostgreSQL (backend) and Next.js 15, TypeScript, Tailwind CSS (frontend), featuring multi-tenant architecture, SARS tax classification, complete timesheet approval workflows, invoice management, and advanced analytics.

---

## 🎯 Overview

Contractor CMS is a production-ready SaaS platform designed to manage:
- **Suppliers** (Companies and Individuals)
- **Contractors** (Worker profiles and engagements)
- **Contracts** (MSA, SOW, rate cards)
- **Tax Compliance** (SARS classification, BBBEE, withholding)
- **Time & Invoicing** (Timesheets, approvals, invoice generation)
- **Projects** (Budget tracking and utilization)
- **Analytics** (Interactive charts and dashboards)
- **HCM Integration** (Event-driven adapters for Oracle, SAP, Workday, etc.)

---

## ✨ Key Features

### 🎨 Frontend (Next.js 15)
- **Authentication**: Login, registration with JWT token management
- **Dashboard**: Interactive analytics with Recharts visualizations
- **CRUD Operations**: Full management for contractors, contracts, engagements, timesheets, invoices, projects
- **Workflow Management**: Multi-state approval workflows (Draft → Submitted → Approved/Rejected)
- **Bulk Operations**: Process multiple timesheets/invoices simultaneously
- **CSV Export**: Export data for all entities with proper formatting
- **Budget Tracking**: Visual budget progress bars with color-coded warnings
- **Responsive Design**: Mobile-friendly Tailwind CSS components

### 🔧 Backend (NestJS)
- **RESTful API**: Comprehensive endpoints with Swagger documentation
- **Multi-Tenant**: Organization-scoped data isolation
- **Authentication**: JWT-based auth with refresh tokens
- **Tax Compliance**: SARS classification engine for South African tax
- **Event-Driven**: NATS integration for HCM system adapters
- **Database**: PostgreSQL with Prisma ORM
- **E2E Testing**: 100+ test cases across all modules

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
npm install

# 3. Install frontend dependencies
cd frontend
npm install
cd ..

# 4. Copy environment files
cp .env.example .env
cd frontend && cp .env.example .env.local && cd ..

# 5. Update .env files with your configuration
# Edit DATABASE_URL, JWT_SECRET, etc.

# 6. Start PostgreSQL with Docker
npm run docker:up

# 7. Generate Prisma Client
npm run db:generate

# 8. Run database migrations
npm run db:migrate

# 9. (Optional) Seed database with test data
npm run db:seed
```

### Running the Application

```bash
# Terminal 1: Start backend (from root)
npm run start:dev

# Terminal 2: Start frontend (from frontend/)
cd frontend
npm run dev
```

The application will be available at:
- **Frontend UI:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/api/docs
- **Health Check:** http://localhost:3000/api/v1/health

---

## 📦 Available Scripts

### Backend (Root Directory)

```bash
# Development
npm run start:dev         # Start in watch mode
npm run start:debug       # Start with debugger
npm run build             # Build for production
npm run start:prod        # Run production build

# Database
npm run db:generate       # Generate Prisma Client
npm run db:migrate        # Run migrations (dev)
npm run db:migrate:prod   # Deploy migrations (production)
npm run db:push           # Push schema changes (dev only)
npm run db:seed           # Seed database
npm run db:studio         # Open Prisma Studio

# Docker
npm run docker:up         # Start PostgreSQL container
npm run docker:down       # Stop containers
npm run docker:logs       # View container logs

# Testing
npm run test:e2e          # Run E2E tests
npm run lint              # Lint and fix code
npm run format            # Format with Prettier
```

### Frontend (frontend/ Directory)

```bash
# Development
npm run dev               # Start development server
npm run build             # Build for production
npm run start             # Run production build
npm run lint              # Lint code
```

---

## 🎨 Frontend Features (Sprint 1-3)

### Sprint 1: Core Workflows ✅

**Reusable Components:**
- Modal dialog with keyboard navigation
- Form inputs (text, select, textarea) with validation
- Status badges with auto-coloring
- Toast notification system

**Pages Implemented:**
- **Contractors** (390 lines): Full CRUD with supplier linking
- **Contracts** (420 lines): Rate configuration, date validation
- **Engagements** (385 lines): Project assignments with auto-rate population
- **Timesheets List** (280 lines): Status filtering and quick actions
- **Timesheets Create** (295 lines): Multi-entry forms with real-time calculations
- **Timesheets Detail** (340 lines): Approval workflow with payment estimates

**Total**: 2,612 lines across 14 files

### Sprint 2: Invoices & Projects ✅

**Invoices Module:**
- Create invoices from approved timesheets
- Multi-timesheet selection with auto-calculation
- Tax calculation (configurable VAT rate)
- Complete workflow: Pending → Approved → Paid/Void
- Payment tracking with multiple methods
- PDF download functionality

**Projects Module:**
- Budget tracking with real-time utilization
- Visual progress bars (Green/Yellow/Red based on %)
- Budget warnings at 80% and 100%
- Track associated timesheets and invoices

**Components:**
- BudgetProgress component for reusable visualizations
- Enhanced API client with invoice operations

**Total**: 1,610 lines across 6 files

### Sprint 3: Advanced Features ✅

**Enhanced Dashboard:**
- 4 interactive Recharts visualizations:
  - Financial Overview (Bar Chart)
  - Timesheet Status Distribution (Pie Chart)
  - Project Status (Pie Chart)
  - Tax Withholding Breakdown (Horizontal Bar Chart)

**Bulk Operations:**
- **Timesheets**: Bulk approve/reject with success/failure reporting
- **Invoices**: Bulk approve for pending invoices
- Multi-select with checkboxes and select all
- Promise.allSettled for parallel processing
- Graceful error handling per item

**CSV Export:**
- Reusable export utility (260 lines)
- Export buttons on all list pages
- Proper CSV escaping (commas, quotes, newlines)
- Date and currency formatting
- Exports filtered/searched data
- Entities: Timesheets, Invoices, Contractors, Contracts, Projects

**Total**: +813 lines across 7 files

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

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- NestJS (Node.js framework)
- Prisma ORM
- PostgreSQL 16
- JWT Authentication
- Swagger/OpenAPI
- NATS (Event streaming)

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

### Event-Driven Integration
```
CMS → WithholdingInstruction (Canonical) → NATS → Adapters → HCM Systems
```

---

## 🔐 Environment Variables

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
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 📚 API Documentation

Once the backend is running, visit:

**Swagger UI:** http://localhost:3000/api/docs

API endpoints are organized by tags:
- `auth` - Authentication (register, login, profile)
- `users` - User management
- `suppliers` - Supplier CRUD
- `contractors` - Contractor management
- `contracts` - Contract management
- `engagements` - Engagement management
- `projects` - Project & budget tracking
- `timesheets` - Time tracking with approval workflow
- `invoices` - Invoice management with payment tracking
- `analytics` - Dashboard analytics and reporting
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

## 🧪 Testing

### E2E Tests (Backend)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- auth.e2e-spec.ts
```

**Test Coverage:**
- 100+ test cases across 6 test files
- Authentication & Authorization
- Core Domain (Suppliers, Contractors, Contracts)
- Work Management (Timesheets, Approvals)
- Financial Management (Invoices, Payments)
- Integration Layer (Projects, Withholding)
- Experience Layer (Organizations, Analytics)

---

## 🛠️ Development

### Project Structure

```
contractor-cms/
├── src/                       # Backend source code
│   ├── core/
│   │   ├── auth/              # Authentication
│   │   ├── database/          # Prisma service
│   │   └── health/            # Health checks
│   │
│   ├── modules/               # Business modules
│   │   ├── suppliers/
│   │   ├── contractors/
│   │   ├── contracts/
│   │   ├── engagements/
│   │   ├── classification/    # SARS engine
│   │   ├── timesheets/
│   │   ├── invoices/
│   │   ├── projects/
│   │   └── analytics/
│   │
│   ├── country-packs/         # Country rules
│   │   ├── south-africa/
│   │   └── lesotho/
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── frontend/                  # Frontend source code
│   ├── app/                   # Next.js App Router pages
│   │   ├── dashboard/         # Analytics dashboard
│   │   ├── contractors/       # Contractors CRUD
│   │   ├── contracts/         # Contracts CRUD
│   │   ├── engagements/       # Engagements CRUD
│   │   ├── timesheets/        # Timesheets with approval workflow
│   │   ├── invoices/          # Invoices with payment tracking
│   │   ├── projects/          # Projects with budget tracking
│   │   ├── login/             # Authentication
│   │   └── register/          # User registration
│   │
│   ├── components/            # React components
│   │   ├── ui/                # Reusable UI components
│   │   └── dashboard-layout.tsx
│   │
│   ├── lib/                   # Utilities
│   │   ├── api.ts             # API client
│   │   ├── auth-context.tsx   # Auth state management
│   │   ├── toast.tsx          # Toast notifications
│   │   └── csv-export.ts      # CSV export utilities
│   │
│   └── public/                # Static assets
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration history
│   └── seed.ts                # Seed data
│
├── test/                      # E2E tests
│   ├── utils/                 # Test utilities
│   ├── fixtures/              # Test data factories
│   └── *.e2e-spec.ts          # Test files
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🔒 Security

- **Helmet** - Security headers
- **CORS** - Configurable origins
- **Argon2** - Password hashing
- **JWT** - Stateless authentication
- **Validation** - class-validator + class-transformer
- **API Keys** - System integration security
- **XSS Protection** - Input sanitization
- **SQL Injection Prevention** - Prisma parameterized queries

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

### ✅ Completed

**Backend (Phases 1-6):**
- ✅ Database schema and migrations
- ✅ Core modules (Suppliers, Contractors, Contracts)
- ✅ Work management (Timesheets, Approvals)
- ✅ Financial management (Invoices, Payments)
- ✅ Projects with budget tracking
- ✅ Analytics and reporting
- ✅ E2E test suite (100+ tests)

**Frontend (Sprints 1-3):**
- ✅ Sprint 1: Core Workflows (Contractors, Contracts, Timesheets)
- ✅ Sprint 2: Invoices & Projects with Budget Tracking
- ✅ Sprint 3: Advanced Features (Analytics, Bulk Operations, CSV Export)

### 🚧 Roadmap

**Potential Future Enhancements:**
- Email notifications (approval reminders, status updates)
- Advanced filtering (date ranges, multi-criteria)
- User permissions & role management UI
- Audit logs and activity tracking
- PDF report generation
- Mobile app (React Native)
- Offline mode support
- Real-time collaboration features

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

# For frontend, change in package.json
"dev": "next dev -p 3002"
```

### Frontend API Connection Issues

```bash
# Verify NEXT_PUBLIC_API_URL in frontend/.env.local
# Ensure backend is running on http://localhost:3000
```

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

Built with ❤️ using NestJS, Prisma, PostgreSQL, Next.js, and TypeScript
