# Hubsec Workforce Platform — Reference Architecture

This document provides the canonical reference architecture for the platform. Use it for onboarding engineers, customer presentations, and integration planning.

---

## Overview

Hubsec Workforce Platform is an enterprise workforce management platform. The architecture is organized into the following domains:

```
Hubsec Workforce Platform
├── Workforce Data Platform
├── Workforce Lifecycle
├── Payroll Engine
├── Payroll Operations
├── Compliance
├── Employee Experience
├── Governance
├── Integrations
├── Automation
└── Analytics
```

---

## Architecture Domains

### Workforce Data Platform
- **Employees** — Master employee records, employments (effective-dated)
- **Legal Entities** — Multi-entity, country (ZA/LS)
- **Pay Groups** — Country, currency, frequency, pay periods
- **Org Structure** — Org units, positions, employment assignments
- **Cost Centers** — Types, hierarchies, GL mapping
- **Company Groups** — Multi-entity consolidation
- **Data Import Console** — Validation, approval, publish for HCM datasets
- **HR Export API** — Delta export for IGA/connectors

### Workforce Lifecycle
- **Recruitment** — Requisitions, candidates, interviews, offers
- **Onboarding** — Checklists, documents, equipment provisioning
- **Performance** — Cycles, goals, reviews, 360° feedback
- **Benefits** — Plans, enrollments, dependents
- **Leave** — Balances, accruals, requests
- **Expenses** — Claims, categories, approval
- **Loans** — Applications, schedules, payroll deductions

### Payroll Engine
- **Payruns** — Create, calculate, approve, finalize; maker-checker workflows
- **Pay Items & Rules** — Earnings, deductions, tax rules
- **Tax** — PAYE, UIF, SDL; ZA + Lesotho tables
- **Payslips** — HTML/PDF generation, storage
- **Bank Files** — ACB format (SA EFT)
- **GL Exports** — General ledger journal export
- **Country Packs** — ZA/LS tax rules, statutory configs

### Payroll Operations
- **Payroll Cycle** — Calendars, checklists, forecasting
- **Payment Batches** — Bulk payment processing
- **Change Requests** — Effective-dated adjustments
- **Artifacts** — Payslips, bank files, GL exports, documents

### Compliance
- **SARS** — IRP5 certificates, EMP201 returns, EMP501 (foundation), eFiling CSV
- **UIF / SDL / COIDA** — Declarations, assessments, CSV export
- **Garnishments** — Court orders, protected earnings, deduction sequencing
- **Compliance Dashboard** — Deadlines, alerts, legislative updates

### Employee Experience
- **Self-Service** — Profile, payslips, leave, expenses, loans
- **Time & Attendance** — Clock in/out, shifts, overtime requests
- **Hubsec Workforce Employee Portal** — Self-service UI (port 3000)

### Governance
- **RBAC** — Roles, permissions (resource:action), legal-entity scoping
- **Audit** — Change tracking, API logging, security events
- **Approval Workflows** — Multi-level, delegation, escalation
- **Delegations** — Temporary role/approval handover
- **User Management** — Users, role assignments, legal-entity access
- **Hubsec Workforce Admin** — Administrative UI (port 3001)

### Identity & Access Initialization
- **Bootstrap** — First-admin creation when `user_count === 0` in a tenant/environment
- **Endpoints** — `GET /v1/bootstrap/status`, `POST /v1/bootstrap/admin` (unauthenticated)
- **Rate limiting** — 5 attempts per minute per IP on `/v1/bootstrap`
- **Audit events** — `BOOTSTRAP_STATUS_CHECKED`, `BOOTSTRAP_ADMIN_CREATED`, `BOOTSTRAP_ATTEMPT_AFTER_INITIALIZATION`
- **CLI** — `npm run bootstrap:admin` for initial admin creation in non-interactive deployments
- See [BOOTSTRAP.md](./BOOTSTRAP.md) for deployment and API details

### Integrations
- **HCM Import** — Legacy HR import
- **Data Import Console** — Generic validation/approval/publish
- **Webhooks** — Outbound events, retry, logging
- **Accounting** — Xero, QuickBooks, Sage; GL sync, employee sync
- **Banking** — API-based payments, batch processing
- **SARS eFiling** — eFiling CSV, pension submissions

### Automation
- **Notifications** — Email, SMS, in-app
- **Scheduled Alerts** — EMP201, IRP5, payroll reminders (cron)
- **Workflow Notifications** — Approval alerts, multi-channel

### Analytics
- **Dashboard** — Real-time metrics, trends
- **Reports** — Saved reports, scheduling, CSV/Excel/PDF
- **Artifacts** — Document and artifact management

---

## Visual Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Hubsec Workforce Platform                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Workforce Data Platform  │  Workforce Lifecycle  │  Payroll Engine          │
│  • Employees, Employments │  • Recruitment        │  • Payruns               │
│  • Legal Entities         │  • Onboarding         │  • Tax (PAYE/UIF/SDL)    │
│  • Org Structure          │  • Performance        │  • Payslips, Bank Files   │
│  • Data Import Console    │  • Benefits, Leave    │  • GL Export             │
│  • HR Export API          │  • Expenses, Loans    │                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payroll Operations       │  Compliance           │  Employee Experience     │
│  • Cycle, Batches         │  • SARS (IRP5/EMP201)  │  • Self-Service          │
│  • Change Requests        │  • UIF/SDL/COIDA       │  • Time & Attendance     │
│  • Artifacts              │  • Garnishments       │  • Employee Portal       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Governance               │  Integrations        │  Automation & Analytics  │
│  • RBAC, Audit            │  • Webhooks           │  • Notifications        │
│  • Workflows, Delegations  │  • Accounting/Banking │  • Reports, Dashboard    │
│  • Admin Portal           │  • SARS eFiling        │  • Scheduled Alerts      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Docs

- [MODULE_MAP.md](./MODULE_MAP.md) — Module-to-capability mapping
- [READINESS_TIERS.md](./READINESS_TIERS.md) — Production readiness (A/B/C)
- [NAMING.md](./NAMING.md) — Product naming and URL structure

---

*Last updated: March 2026*
