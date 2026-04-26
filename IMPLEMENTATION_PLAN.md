# Contractor CMS - Implementation Plan

**Version:** 1.0
**Last Updated:** 2025-12-27
**Current Phase:** Phase 1A Complete ✅ | Phase 1B In Progress 🚧

---

## 📋 Table of Contents

- [Overview](#overview)
- [Phase 1: Foundation](#phase-1-foundation-week-1-2)
- [Phase 2: Core Domain](#phase-2-core-domain-week-3-4)
- [Phase 3: Work Management](#phase-3-work-management-week-5-6)
- [Phase 4: Financial](#phase-4-financial-week-7-8)
- [Phase 5: Integration](#phase-5-integration-week-9-10)
- [Phase 6: Experience](#phase-6-experience-week-11-12)
- [Progress Tracking](#progress-tracking)

---

## Overview

This document tracks the phased implementation of the Contractor CMS platform. Each phase builds on the previous, establishing a complete, production-ready system.

### Implementation Philosophy

1. **Foundation First** - Solid infrastructure before features
2. **Incremental Delivery** - Working software at each phase
3. **Test as You Go** - Write tests alongside implementation
4. **Document Everything** - Keep README and API docs updated
5. **Security by Default** - Never compromise on security

---

## Phase 1: Foundation (Week 1-2)

**Goal:** Establish independent CMS foundation with authentication and infrastructure.

### Phase 1A: Infrastructure ✅ COMPLETE

- [x] **Repository Setup**
  - [x] Initialize NestJS project
  - [x] Configure TypeScript (tsconfig.json)
  - [x] Set up folder structure
  - [x] Create .gitignore (remove node_modules)

- [x] **Database Setup**
  - [x] Install and configure Prisma
  - [x] Create complete schema (14 models)
  - [x] Set up Prisma service
  - [x] Database module with connection lifecycle

- [x] **Docker Environment**
  - [x] docker-compose.yml (PostgreSQL)
  - [x] npm scripts for Docker management
  - [x] .env.example template

- [x] **Core Infrastructure**
  - [x] Health check endpoints (liveness, readiness)
  - [x] Global validation pipe
  - [x] Helmet security middleware
  - [x] CORS configuration
  - [x] Swagger/OpenAPI setup

**Deliverable:** ✅ Running NestJS app with database connection and health checks

---

### Phase 1B: Authentication & Authorization 🚧 IN PROGRESS

- [ ] **User Module**
  - [ ] User entity (already in schema)
  - [ ] UserService (CRUD operations)
  - [ ] UserController (admin endpoints)
  - [ ] DTOs (CreateUserDto, UpdateUserDto)

- [ ] **Authentication Module**
  - [ ] Password service (Argon2 hashing)
  - [ ] Local strategy (email/password)
  - [ ] JWT strategy (token validation)
  - [ ] AuthService (login, register, token generation)
  - [ ] AuthController (POST /auth/login, /auth/register)
  - [ ] Refresh token logic

- [ ] **RBAC System**
  - [ ] Role model (already in schema)
  - [ ] Permission constants (suppliers:create, etc.)
  - [ ] RolesGuard (check user roles)
  - [ ] PermissionsGuard (check specific permissions)
  - [ ] @Roles() decorator
  - [ ] @Permissions() decorator
  - [ ] @CurrentUser() decorator

- [ ] **API Key Authentication**
  - [ ] ApiKey model (already in schema)
  - [ ] ApiKeyService (generate, hash, validate)
  - [ ] ApiKeyStrategy (Passport strategy)
  - [ ] ApiKeyGuard
  - [ ] Key generation endpoint (admin only)

- [ ] **Database Seed**
  - [ ] Seed script (prisma/seed.ts)
  - [ ] Default roles (CMS_ADMIN, FINANCE_USER, CONTRACTOR)
  - [ ] Admin user (admin@contractor-cms.com)
  - [ ] Sample organization
  - [ ] npm run db:seed script

- [ ] **Configuration Module**
  - [ ] Environment validation (class-validator)
  - [ ] Config service (typed config access)
  - [ ] JWT config
  - [ ] Database config
  - [ ] API config

- [ ] **Exception Handling**
  - [ ] Global exception filter
  - [ ] HTTP exception responses
  - [ ] Validation error formatting
  - [ ] Logging integration

**Deliverable:** 🎯 Authenticated API with RBAC, API keys, and seed data

**Acceptance Criteria:**
- Admin can login with email/password
- JWT tokens issued and validated
- RBAC guards protect endpoints
- API keys work for system integration
- Database seeded with admin user

---

## Phase 2: Core Domain (Week 3-4)

**Goal:** Build supplier and contractor management with contract lifecycle.

### Suppliers Module

- [ ] **Supplier Service**
  - [ ] Create supplier (COMPANY | INDIVIDUAL)
  - [ ] Update supplier details
  - [ ] Supplier status workflow (PENDING → ACTIVE → SUSPENDED)
  - [ ] List suppliers (pagination, filters)
  - [ ] Get supplier by ID

- [ ] **Supplier Controller**
  - [ ] POST /suppliers
  - [ ] GET /suppliers (with filters)
  - [ ] GET /suppliers/:id
  - [ ] PATCH /suppliers/:id
  - [ ] DELETE /suppliers/:id (soft delete)

- [ ] **Supplier Documents**
  - [ ] Upload service (S3 or local storage)
  - [ ] Document validation (file types, size)
  - [ ] Expiry tracking (tax clearance, BBBEE)
  - [ ] POST /suppliers/:id/documents
  - [ ] GET /suppliers/:id/documents

- [ ] **Validation & DTOs**
  - [ ] CreateSupplierDto (with conditional validation)
  - [ ] UpdateSupplierDto
  - [ ] UploadDocumentDto
  - [ ] Company-specific fields validation
  - [ ] Individual-specific fields validation

**Tests:**
- [ ] Supplier CRUD unit tests
- [ ] Supplier status workflow tests
- [ ] Document upload integration tests

---

### Contractors Module

- [ ] **Contractor Service**
  - [ ] Create contractor (linked to supplier)
  - [ ] Update contractor profile
  - [ ] Skills management
  - [ ] Link contractor to user account
  - [ ] Activation/deactivation

- [ ] **Contractor Controller**
  - [ ] POST /contractors
  - [ ] GET /contractors (with filters)
  - [ ] GET /contractors/:id
  - [ ] PATCH /contractors/:id
  - [ ] POST /contractors/:id/activate

- [ ] **Self-Service Registration**
  - [ ] Public registration endpoint
  - [ ] Email verification flow
  - [ ] Link contractor to User record
  - [ ] Initial password setup

**Tests:**
- [ ] Contractor CRUD tests
- [ ] User linking tests
- [ ] Self-registration flow tests

---

### Contracts Module

- [ ] **Contract Service**
  - [ ] Create supplier contract
  - [ ] Rate card management (JSON structure)
  - [ ] Contract status lifecycle
  - [ ] Contract signing workflow
  - [ ] SLA terms management

- [ ] **Contract Controller**
  - [ ] POST /contracts
  - [ ] GET /contracts (with filters)
  - [ ] GET /contracts/:id
  - [ ] PATCH /contracts/:id
  - [ ] POST /contracts/:id/sign

- [ ] **Engagements**
  - [ ] Create contractor engagement
  - [ ] Link engagement to project
  - [ ] Rate assignment (from contract rate card)
  - [ ] Engagement activation/termination

**Tests:**
- [ ] Contract lifecycle tests
- [ ] Rate card validation tests
- [ ] Engagement creation tests

---

**Phase 2 Deliverable:** 🎯 Complete supplier/contractor onboarding with contracts

**Acceptance Criteria:**
- Can onboard COMPANY and INDIVIDUAL suppliers
- Upload and track supplier documents
- Create contractors linked to suppliers
- Contractors can self-register
- Create contracts with rate cards
- Assign contractors to projects via engagements

---

## Phase 3: Work Management (Week 5-6)

**Goal:** Implement project tracking and timesheet management.

### Projects Module

- [ ] **Project Service**
  - [ ] Create project (organization-scoped)
  - [ ] Project code uniqueness validation
  - [ ] Budget tracking
  - [ ] Project status management
  - [ ] Cost center assignment

- [ ] **Project Controller**
  - [ ] POST /projects
  - [ ] GET /projects (with filters)
  - [ ] GET /projects/:id
  - [ ] PATCH /projects/:id

- [ ] **Tasks**
  - [ ] Create task under project
  - [ ] Task status workflow (OPEN → IN_PROGRESS → COMPLETED)
  - [ ] Estimated hours tracking
  - [ ] POST /projects/:id/tasks
  - [ ] PATCH /tasks/:id

**Tests:**
- [ ] Project CRUD tests
- [ ] Task lifecycle tests
- [ ] Budget validation tests

---

### Timesheets Module

- [ ] **Timesheet Service**
  - [ ] Create timesheet for period
  - [ ] Add timesheet entries
  - [ ] Calculate total hours/amount
  - [ ] Timesheet submission workflow
  - [ ] Validation (no overlapping periods)

- [ ] **Timesheet Controller**
  - [ ] POST /timesheets
  - [ ] POST /timesheets/:id/entries
  - [ ] GET /timesheets (my timesheets)
  - [ ] GET /timesheets/:id
  - [ ] POST /timesheets/:id/submit

- [ ] **Approval Workflow**
  - [ ] Submission triggers notification
  - [ ] Manager approval endpoint
  - [ ] Rejection with reason
  - [ ] POST /timesheets/:id/approve
  - [ ] POST /timesheets/:id/reject

- [ ] **Contractor Self-Service**
  - [ ] Contractors can create own timesheets
  - [ ] View submission history
  - [ ] Track approval status
  - [ ] Scoped to current user

**Tests:**
- [ ] Timesheet creation tests
- [ ] Entry validation tests
- [ ] Approval workflow tests
- [ ] Permission tests (contractor can only access own)

---

**Phase 3 Deliverable:** 🎯 Contractors can log time against projects with approval workflow

**Acceptance Criteria:**
- Projects and tasks can be created
- Contractors submit timesheets for approval
- Managers approve/reject timesheets
- No duplicate time entries
- Self-service portal working for contractors

---

## Phase 4: Financial (Week 7-8)

**Goal:** SARS tax classification and invoice generation.

### SARS Classification Module

- [ ] **Classification Tests Service**
  - [ ] Define test criteria (control, supervision, tools, etc.)
  - [ ] Assessment questionnaire structure
  - [ ] Scoring algorithm
  - [ ] Dominant impression calculation
  - [ ] Risk score (0-100)

- [ ] **Classification Service**
  - [ ] Create classification assessment
  - [ ] Store assessment payload (JSON)
  - [ ] Determine classification (TRUE_INDEPENDENT | DEEMED_EMPLOYEE)
  - [ ] Classification basis (STATUTORY_TEST | COMMON_LAW | CONSERVATIVE)
  - [ ] Time-bound validity (validFrom, validTo)

- [ ] **Classification Controller**
  - [ ] POST /contractors/:id/classify
  - [ ] GET /contractors/:id/classifications
  - [ ] GET /classifications/:id
  - [ ] POST /classifications/:id/approve

- [ ] **Country Packs**
  - [ ] South Africa SARS rules
  - [ ] Lesotho classification pack
  - [ ] Pack interface (classify method)
  - [ ] Load pack by country code

**Tests:**
- [ ] SARS classification logic tests
- [ ] Assessment scoring tests
- [ ] Validity period tests

---

### Invoices Module

- [ ] **Invoice Service**
  - [ ] Generate invoice from approved timesheets
  - [ ] Calculate subtotal, VAT, total
  - [ ] Link to tax classification
  - [ ] Invoice number generation (unique)
  - [ ] Invoice status workflow

- [ ] **Invoice Controller**
  - [ ] POST /invoices (generate from timesheets)
  - [ ] GET /invoices (with filters)
  - [ ] GET /invoices/:id
  - [ ] POST /invoices/:id/submit
  - [ ] POST /invoices/:id/approve

- [ ] **Line Items**
  - [ ] Auto-generate from timesheet entries
  - [ ] Project/cost center allocation
  - [ ] GL account codes
  - [ ] Manual line item creation

- [ ] **Approval Workflow**
  - [ ] Finance approval required
  - [ ] Rejection with reason
  - [ ] Approval triggers withholding check

**Tests:**
- [ ] Invoice generation tests
- [ ] VAT calculation tests
- [ ] Approval workflow tests

---

### Withholding Instructions

- [ ] **Withholding Service**
  - [ ] Check if withholding required (DEEMED_EMPLOYEE)
  - [ ] Calculate withholding amounts (PAYE, SDL, UIF)
  - [ ] Generate canonical payload
  - [ ] Create WithholdingInstruction record
  - [ ] Link to invoice

- [ ] **Country Pack Withholding**
  - [ ] South Africa withholding calculation
  - [ ] Tax rates (PAYE, SDL, UIF)
  - [ ] Lesotho withholding rules

**Tests:**
- [ ] Withholding calculation tests
- [ ] Canonical payload structure tests
- [ ] Invoice-to-withholding flow tests

---

**Phase 4 Deliverable:** 🎯 Full invoice lifecycle with SARS tax classification

**Acceptance Criteria:**
- SARS classification engine works
- Invoices generated from approved timesheets
- VAT calculated correctly
- Withholding instructions created for deemed employees
- Country packs functional for ZA and Lesotho

---

## Phase 5: Integration (Week 9-10)

**Goal:** Event publishing and HCM adapter framework.

### NATS Integration

- [ ] **NATS Module**
  - [ ] Install NATS client library
  - [ ] NATS connection service
  - [ ] Event publisher service
  - [ ] Event subjects/topics definition
  - [ ] Connection health check

- [ ] **Event Publishing**
  - [ ] contractor.onboarded
  - [ ] classification.assessed
  - [ ] timesheet.submitted
  - [ ] timesheet.approved
  - [ ] invoice.submitted
  - [ ] invoice.approved
  - [ ] withholding.instruction.created

- [ ] **Event Payloads**
  - [ ] Define canonical event schemas
  - [ ] Versioning strategy (v1, v2)
  - [ ] Serialization (JSON)

**Tests:**
- [ ] NATS connection tests
- [ ] Event publishing tests
- [ ] Event schema validation tests

---

### Adapter Framework

- [ ] **Base Adapter Interface**
  - [ ] IWithholdingAdapter interface
  - [ ] syncWithholdingInstruction method
  - [ ] Connection validation
  - [ ] Error handling

- [ ] **Adapter Factory**
  - [ ] Load adapter by organization hcmType
  - [ ] Dynamic adapter loading
  - [ ] Fallback to default adapter

- [ ] **Custom NATS Adapter**
  - [ ] Implement IWithholdingAdapter
  - [ ] Publish to HCM-specific NATS topic
  - [ ] Handle sync status updates
  - [ ] Retry logic (exponential backoff)

- [ ] **Oracle HCM Adapter** (Optional)
  - [ ] REST API client
  - [ ] HDL file generation
  - [ ] Authentication (OAuth 2.0)
  - [ ] Map canonical to Oracle format

- [ ] **SAP SuccessFactors Adapter** (Optional)
  - [ ] OData client
  - [ ] Map canonical to SAP format
  - [ ] Error handling

**Tests:**
- [ ] Adapter interface tests
- [ ] NATS adapter integration tests
- [ ] Retry logic tests

---

### Withholding Bridge (Separate Service - Optional)

- [ ] **Bridge Service**
  - [ ] Subscribe to withholding.instruction.created
  - [ ] Call organization's adapter
  - [ ] Update sync status in CMS
  - [ ] Error notification

**Tests:**
- [ ] Event consumption tests
- [ ] Adapter invocation tests
- [ ] Error handling tests

---

**Phase 5 Deliverable:** 🎯 WithholdingInstruction flows to HCM via NATS

**Acceptance Criteria:**
- Events published to NATS successfully
- Custom NATS adapter functional
- Adapter framework extensible (add new adapters easily)
- Sync status tracked in database
- Retry logic works for failures

---

## Phase 6: Experience (Week 11-12)

**Goal:** Contractor self-service portal and approval workflows.

### Contractor Portal

- [ ] **Dashboard**
  - [ ] Current engagement status
  - [ ] Pending timesheets
  - [ ] Recent invoices
  - [ ] Tax classification status

- [ ] **Timesheet Management**
  - [ ] Create/edit timesheets
  - [ ] Submit for approval
  - [ ] View approval status
  - [ ] Download approved timesheets

- [ ] **Profile Management**
  - [ ] Update personal details
  - [ ] Manage skills
  - [ ] Upload documents
  - [ ] View contract details

- [ ] **Notifications**
  - [ ] Email notifications (timesheet approved, etc.)
  - [ ] In-app notifications
  - [ ] Notification preferences

**Tests:**
- [ ] Portal endpoint tests
- [ ] Permission tests (contractor sees only own data)
- [ ] Notification delivery tests

---

### Approval Workflows

- [ ] **Workflow Engine**
  - [ ] Define approval chains
  - [ ] Manager assignment
  - [ ] Escalation rules
  - [ ] SLA tracking

- [ ] **Approval Dashboard**
  - [ ] Pending approvals list
  - [ ] Bulk approve/reject
  - [ ] Approval history
  - [ ] Delegation support

**Tests:**
- [ ] Workflow engine tests
- [ ] Escalation tests
- [ ] Delegation tests

---

### Reporting Module

- [ ] **Standard Reports**
  - [ ] Supplier listing
  - [ ] Contractor roster
  - [ ] Timesheet summary
  - [ ] Invoice aging
  - [ ] Tax classification breakdown

- [ ] **Report Export**
  - [ ] CSV export
  - [ ] Excel export
  - [ ] PDF generation (optional)

**Tests:**
- [ ] Report generation tests
- [ ] Export format tests
- [ ] Performance tests (large datasets)

---

**Phase 6 Deliverable:** 🎯 Complete contractor self-service experience

**Acceptance Criteria:**
- Contractors have functional portal
- Approval workflows streamlined
- Email notifications working
- Standard reports available
- Export functionality works

---

## Progress Tracking

### Overall Progress: **Phase 1A Complete (10%)**

| Phase | Module | Status | Progress |
|-------|--------|--------|----------|
| **Phase 1A** | Infrastructure | ✅ Complete | 100% |
| **Phase 1B** | Authentication | 🚧 In Progress | 0% |
| **Phase 2** | Suppliers | ⏳ Not Started | 0% |
| **Phase 2** | Contractors | ⏳ Not Started | 0% |
| **Phase 2** | Contracts | ⏳ Not Started | 0% |
| **Phase 3** | Projects | ⏳ Not Started | 0% |
| **Phase 3** | Timesheets | ⏳ Not Started | 0% |
| **Phase 4** | SARS Classification | ⏳ Not Started | 0% |
| **Phase 4** | Invoices | ⏳ Not Started | 0% |
| **Phase 4** | Withholding | ⏳ Not Started | 0% |
| **Phase 5** | NATS Integration | ⏳ Not Started | 0% |
| **Phase 5** | Adapters | ⏳ Not Started | 0% |
| **Phase 6** | Contractor Portal | ⏳ Not Started | 0% |
| **Phase 6** | Reporting | ⏳ Not Started | 0% |

---

### Legend

- ✅ **Complete** - Fully implemented and tested
- 🚧 **In Progress** - Currently being worked on
- ⏳ **Not Started** - Scheduled but not yet begun
- 🔄 **Refactoring** - Improving existing code
- ❌ **Blocked** - Waiting on dependency

---

## Testing Strategy

### Test Coverage Targets

- **Unit Tests:** 80%+ coverage
- **Integration Tests:** Key workflows covered
- **E2E Tests:** Critical user journeys

### Test Phases

- **Phase 1:** Auth flows, RBAC, API key validation
- **Phase 2:** CRUD operations, status workflows
- **Phase 3:** Timesheet approval, validation
- **Phase 4:** Tax calculation, invoice generation
- **Phase 5:** Event publishing, adapter integration
- **Phase 6:** Self-service flows, notifications

---

## Deployment Checklist

### Pre-Production

- [ ] All phases complete
- [ ] Test coverage >80%
- [ ] Security audit passed
- [ ] Performance testing done
- [ ] Documentation complete
- [ ] Seed data for demo org

### Production

- [ ] Environment variables set
- [ ] Database migrations deployed
- [ ] HTTPS configured
- [ ] Monitoring in place
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented

---

## Success Metrics

### Technical KPIs

- **API Response Time:** <200ms (p95)
- **Database Queries:** <100ms (p95)
- **Uptime:** 99.9%
- **Test Coverage:** >80%

### Business KPIs

- **Supplier Onboarding:** <5 minutes
- **Timesheet Approval:** <2 clicks
- **Invoice Generation:** Automated
- **Tax Classification:** <15 minutes

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema changes break production | High | Migration testing, rollback plan |
| SARS rules change | Medium | Country pack versioning |
| HCM integration failure | High | Retry logic, error notifications |
| Performance issues | Medium | Indexing strategy, caching layer |

---

## Next Actions

### Immediate (This Week)

1. ✅ Complete README documentation
2. ✅ Create implementation plan
3. ⏭️ Implement authentication module
4. ⏭️ Build RBAC system
5. ⏭️ Create database seed script

### Short Term (Next 2 Weeks)

1. Complete Phase 1B (Authentication)
2. Begin Phase 2 (Suppliers module)
3. Set up testing framework
4. Add CI/CD pipeline

### Medium Term (Next Month)

1. Complete Phase 2 (Core Domain)
2. Begin Phase 3 (Work Management)
3. Performance optimization
4. Security hardening

---

**Last Updated:** 2025-12-27
**Current Sprint:** Phase 1B - Authentication & Authorization
**Next Review:** After Phase 1B completion
