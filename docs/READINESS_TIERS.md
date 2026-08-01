# Hubsec Workforce Platform — Readiness Tiers

Three-tier view of platform capabilities for release planning and customer conversations. For detailed status per feature, see [FEATURE_READINESS.md](./FEATURE_READINESS.md). Product naming: [NAMING.md](./NAMING.md).

---

## A. Production-Ready / Core

Features that are complete, tested, and suitable for production deployment. Form the backbone of the platform.

| Capability | Notes |
|------------|-------|
| **Employees** | Full CRUD, effective-dated employments, bank accounts, tax profiles |
| **Employments** | Effective-from/to, pay group, legal entity, job title |
| **Legal Entities** | Multi-entity, country (ZA/LS) |
| **Pay Groups** | Country, currency, frequency, pay periods |
| **Payruns** | Create, calculate, approve, finalize; maker-checker workflows |
| **Tax Calculations** | PAYE, UIF, SDL; ZA 2024/2025 tables; Lesotho basic PAYE |
| **Payslips** | HTML/PDF generation and storage |
| **Bank Files** | ACB format (South African EFT) |
| **SARS / IRP5** | Certificate generation, bulk generation, PDF export |
| **SARS / EMP201** | Monthly returns, generate, track, CSV export |
| **HR Export API** | Delta export by employee_no; IGA/connector ready |
| **RBAC** | Roles, permissions (resource:action), legal-entity scoping |
| **Audit** | Change tracking, API logging, security events |
| **Org Structure** | Org units, positions, employment assignments |
| **Cost Centers** | Types, hierarchies, GL mapping |
| **Company Groups** | Multi-entity consolidation, reports |
| **Compliance** | UIF/SDL declarations, garnishments, compliance dashboard |
| **Approval Workflows** | Multi-level, delegation, escalation |
| **Data Import Console** | Validation, approval, publish for HCM datasets |

---

## B. Operational but Still Maturing

Core functionality works and is usable; some refinements, integrations, or UX improvements remain.

| Capability | Notes |
|------------|-------|
| **Employee Self-Service** | Profile, payslips, leave, expenses, loans; permission alignment (self vs self_service) to tidy |
| **Recruitment & Onboarding** | Requisitions, candidates, interviews, offers; resume upload needs storage |
| **Time & Attendance** | Clock in/out, shifts, overtime; GPS optional; biometric integration pending |
| **Benefits** | Plans, enrollments, dependents; full workflow |
| **Expenses** | Claims, categories, approval, payment batches; receipt storage integration needed |
| **Loans** | Types, applications, schedules, payroll deductions; full workflow |
| **Bulk Imports** | HCM import (ImportsModule); Data Import Console (validation/approve/publish) |
| **Mobile APIs** | Device registration, JWT refresh, dashboard, timesheet; push needs Firebase; offline sync partial |
| **Notifications** | In-app, workflow alerts; Email/SMS need SMTP/Twilio config |
| **GL Journal Export** | Basic export; accounting system integration to refine |
| **Performance** | Cycles, goals, reviews; 360° feedback and PIPs need workflow polish |
| **Consolidated Reports** | Multi-company; more report types to add |
| **Document Management** | Types, upload (SeaweedFS), download, verification, expiry tracking |

---

## C. Foundation / Planned / Partial

Structure or code exists; significant work or external dependencies remain before production use.

| Capability | Notes |
|------------|-------|
| **Direct SARS eFiling** | Schema ready; needs SARS practitioner credentials, API integration |
| **Accounting Integrations** | Xero/QuickBooks/Sage; code/schema exists; needs API credentials and sync logic |
| **Banking APIs** | Schema ready; needs bank OAuth2 credentials |
| **Advanced Charting** | Dashboard metrics exist; rich visualizations to add |
| **Biometric Integrations** | Schema ready; device integration pending |
| **EMP501 Reconciliation** | Schema exists; implementation incomplete |
| **Training & Development** | Not started |
| **QuickBooks** | Schema only |
| **Webhook Inbound** | Partial; retry and logging to mature |
| **Data Archiving** | Schema exists; scheduled jobs partial |
| **Offline Sync (Mobile)** | Schema exists; conflict resolution and sync logic partial |
| **Profile Picture Upload** | Code exists; storage integration needed |
| **Multi-Currency** | Schema supports it; limited UI |

---

## Quick Reference

| Tier | Use for |
|------|---------|
| **A** | Core platform pitch, production deployments, compliance/audit conversations |
| **B** | Full product demos, "works today" with caveats, roadmap priorities |
| **C** | Roadmap, RFI responses, "on our radar" items |

---

*Last updated: March 2026. Aligned with FEATURE_READINESS.md and MODULE_MAP.md. Naming: [NAMING.md](./NAMING.md).*
