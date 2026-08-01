# Hubsec Workforce Platform — Canonical Module Map

A structured view of platform capabilities, aligned to how modules are implemented and surfaced in Hubsec Workforce Admin and Hubsec Workforce Employee Portal.

**Product naming:** [NAMING.md](./NAMING.md) • **Reference architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Hubsec Workforce Platform

### Workforce Core

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Employees** | `EmployeesModule`, `EnterpriseModule` | CRUD, employments (effective-dated), legal entities, pay groups |
| **Employments** | `EmployeesModule` | Effective-from/to, pay group, job title |
| **Legal Entities** | `LegalEntitiesModule` | Multi-entity, country (ZA/LS) |
| **Pay Groups** | `PayGroupsModule` | Country, currency, frequency |
| **Org Structure** | `EnterpriseModule` | Org units, positions, employment assignments |
| **Cost Centers** | `EnterpriseModule` | Types, GL mapping, hierarchies |
| **Company Groups** | `EnterpriseModule` | Multi-entity consolidation, reports |
| **HR Export** | `HrModule`, `EnterpriseModule` | Export employee data for downstream systems |
| **Data Imports** | `DataImportsModule` | Validation, approval, publish for legal entities, org units, cost centers, employees, employments, assignments |

### Payroll

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Payruns** | `PayrunsModule` | Create, calculate, approve, finalize; maker-checker workflows |
| **Pay Items & Rules** | `PayItemsModule`, `RulesModule` | Earnings, deductions, tax rules |
| **Tax** | `TaxModule` | PAYE, UIF, SDL; ZA + Lesotho tables |
| **Payslips** | `ArtifactsModule`, `PayslipTemplateModule` | HTML/PDF generation, storage |
| **Bank Files** | `ExportsModule` | ACB format (SA EFT) |
| **GL Exports** | `ExportsModule` | General ledger journal export |
| **Payroll Cycle** | `PayrollCycleModule` | Calendars, checklists, forecasting |
| **Payment Batches** | `PayrunsModule` / Artifacts | Bulk payment processing |

### Compliance & Statutory

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **SARS** | `SarsModule` | IRP5 certificates, EMP201 returns, EMP501 (foundation), eFiling CSV |
| **UIF / SDL / COIDA** | `ComplianceModule` | Declarations, assessments, CSV export |
| **Garnishments** | `ComplianceModule` | Court orders, protected earnings, deduction sequencing |
| **Compliance Dashboard** | `ComplianceModule` | Deadlines, alerts, legislative updates |

### Enterprise Governance

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **RBAC** | `EnterpriseModule` (RbacService) | Roles, permissions (resource:action), legal-entity scoping |
| **Audit** | `AuditModule`, `ComplianceModule` | Change tracking, API logging, security events |
| **Approval Workflows** | `EnterpriseModule`, `ApprovalsModule` | Multi-level, delegation, escalation |
| **Delegations** | `EnterpriseModule` | Temporary role/approval handover |
| **User Management** | `EnterpriseModule` | Users, role assignments, legal-entity access |

### Employee Experience

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Self-Service** | `SelfServiceModule` | Profile, payslips, leave, expenses, loans |
| **Leave** | `LeaveModule` | Requests, balances, accruals |
| **Expenses** | `ExpensesModule` | Claims, categories, approval, payment batches |
| **Loans** | `LoansModule` | Applications, schedules, payroll deductions |
| **Time & Attendance** | `TimeAttendanceModule` | Clock in/out, shifts, overtime requests, summaries |

### Benefits

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Benefit Plans** | `BenefitsModule` | Medical, retirement, life; multi-tier |
| **Enrollment** | `BenefitsModule` | Workflows, dependents, contribution tracking |

### Talent

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Recruitment** | `RecruitmentModule` | Requisitions, candidates, interviews, offers |
| **Onboarding** | `RecruitmentModule`, `DocumentsModule` | Checklists, documents, equipment templates |
| **Performance** | `PerformanceModule` | Cycles, goals, reviews, 360° feedback, PIPs |

### Integration Layer

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **HCM Import** | `ImportsModule` | Legacy HR import (employees, employments, etc.) |
| **Data Import Console** | `DataImportsModule` | Generic validation/approval/publish for HCM datasets |
| **Webhooks** | `IntegrationsModule` | Outbound events, retry, logging |
| **Accounting** | `IntegrationsModule` | Xero, QuickBooks, Sage; GL sync, employee sync |
| **Banking** | `IntegrationsModule` | API-based payments, batch processing |
| **SARS eFiling** | `IntegrationsModule` | eFiling CSV, pension submissions |

### Notifications & Automation

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Notifications** | `NotificationsModule` | Email, SMS (Twilio), in-app |
| **Scheduled Alerts** | `NotificationsModule` | EMP201, IRP5, payroll reminders (cron) |
| **Workflow Notifications** | `NotificationsModule` | Approval alerts, multi-channel |

### Reporting & Analytics

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Dashboard** | `DashboardModule` | Real-time metrics, trends |
| **Reports** | `ReportsModule` | Saved reports, scheduling, CSV/Excel/PDF |
| **Artifacts** | `ArtifactsModule` | Payslips, bank files, GL exports, documents |

### Admin & Configuration

| Capability | Module(s) | Notes |
|------------|-----------|-------|
| **Hubsec Workforce Admin** | React app | Enterprise nav, RBAC-gated, Docker-ready |
| **Hubsec Workforce Employee Portal** | React app | Self-service, time, leave, expenses, loans |
| **Mobile API** | `MobileModule` | Device management, push (FCM/APNs) |
| **Country Packs** | `CountryPacksModule` | ZA/LS tax rules, statutory configs |
| **Tax Tables** | `TaxModule` | Admin maintenance of tax tables |

---

## Permission Families (by Domain)

A compact summary of permission prefixes used across the platform. Use `*` as a wildcard where multiple actions share a prefix.

| Domain | Permission Family | Example Codes |
|--------|-------------------|---------------|
| **Payroll** | `payrun:*` | `payrun:read`, `payrun:create`, `payrun:edit`, `payrun:snapshot`, `payrun:cancel`, `payrun:calculate`, `payrun:submit`, `payrun:approve`, `payrun:pay`, `payrun:post`, `payrun:finalize`, `payrun:adjust`, `payrun:trace:read`, `payrun:admin` |
| **SARS** | `sars:*` | `sars:tax_periods:read`, `sars:irp5:read|generate|export`, `sars:emp201:read|generate|export|submit`, `sars:emp501:read|generate|export|approve`, `sars:validation:run`, `sars:submission:manage|read`, `sars:irp5:email` |
| **Employees** | `employee:*` | `employee:read`, `employee:write` |
| **Employments** | `employment:*` | `employment:read`, `employment:write` |
| **Legal Entities** | `legal_entity:*` | `legal_entity:read`, `legal_entity:write` |
| **IAM / Governance** | `iam:*` | `iam:users:manage`, `iam:roles:manage`, `iam:permissions:manage`, `iam:legal_entities:manage` |
| **Self-Service** | `self:*` | `self:payslips:read`, `self:tax:read`, `self:profile:read`, `self:profile:update` |
| **Self-Service (alternate)** | `self_service:*` | `self_service:read`, `self_service:update` *(used by SelfService controller; seed uses `self:*`)* |
| **HR Export** | `hr:read` | `hr:read` — read-only HR export API for IGA/connectors |
| **Data Imports** | `data_import:*` | `data_import:read`, `data_import:write`, `data_import:approve`, `data_import:publish` |
| **Audit** | `audit:*` | `audit:events:read`, `audit:read` |
| **Compliance** | `compliance:*` | `compliance:read`, `compliance:write`, `compliance:export`, `compliance:delete` |
| **Auth** | `auth:read` | `auth:read` — own auth context |
| **Payroll Cycle** | `payroll:*` | `payroll:calendars:*`, `payroll:periods:*`, `payroll:checklists:*`, `payroll:exceptions:*`, `payroll:reconciliation:*`, `payroll:forecasts:*` |
| **Reports / Exports** | `report:*`, `export:*` | `report:payslip:read`, `report:bankfile:read|generate`, `report:gljournal:read`, `report:summary:read`; `export:gl`, `export:bank`, `export:statutory` |
| **Benefits** | `benefit.*` | `benefit.plan.create|view|edit`, `benefit.enrollment.create|view|approve|cancel`, `benefit.reports.view` |
| **Expenses** | `expense.*` | `expense.category.manage`, `expense.claim.view|create|submit|approve|reject|edit|delete`, `expense.policy.manage`, `expense.all.view`, `expense.reports.view` |
| **Loans** | `loan.*` | `loan.type.create|update|delete`, `loan.application.approve|reject`, `loan.disburse`, `loan.repayment.record` |
| **Leave** | `leave:*` | `leave:read`, `leave:request`, `leave:approve`, `leave:admin` |
| **Time & Attendance** | `time_attendance:*` | `time_attendance:clock:write`, `time_attendance:status:read`, `time_attendance:attendance:read`, `time_attendance:summary:read`, `time_attendance:shifts:read|create|assign`, `time_attendance:overtime:request|approve` |
| **Recruitment** | `recruitment:*` | `recruitment:requisitions:*`, `recruitment:candidates:*`, `recruitment:applications:*`, `recruitment:interviews:*`, `recruitment:offers:*`, `recruitment:onboarding:*` |
| **Performance** | `performance.*` | `performance.cycle.create|activate`, `performance.review.create|submit` |
| **Imports / Exports** | `import:*`, `export:*` | `import:read`, `import:write`; `export:read` |
| **Finance / Cost Centers** | `finance:*` | `finance:cost_centers:create|manage|view`, `finance:budgets:create|view` |
| **Workflows / Admin** | `admin:*`, `workflows:*`, `users:*` | `admin:groups:*`, `admin:workflows:*`, `admin:audit:view`, `admin:roles:*`, `admin:users:*`, `admin:permissions:*`, `admin:retention:*`, `admin:archive:*`; `workflows:requests:*`; `users:delegation:*` |
| **Bulk Operations** | `employees:bulk:*`, `bulk:*` | `employees:bulk:import|update|terminate`, `bulk:jobs:view` |
| **Notifications** | `notifications:read` | `notifications:read` |

### Quick Reference (Canonical Families)

| Family | Scope |
|--------|-------|
| `payrun:*` | Payrun lifecycle (create → calculate → approve → pay → finalize) |
| `sars:*` | SARS tax (IRP5, EMP201, EMP501, validation, submission) |
| `employee:*` | Employee CRUD |
| `employment:*` | Employment CRUD |
| `legal_entity:*` | Legal entity CRUD |
| `iam:*` | Users, roles, permissions, legal entity assignments |
| `self:*` | Own profile, payslips, tax (employee portal) |
| `hr:read` | HR export API for IGA/connectors (read-only) |
| `data_import:*` | Data Import Console (read, write, approve, publish) |

---

## Visual Hierarchy (Canonical View)

```
Hubsec Workforce Platform
├── Workforce Core
│   ├── Employees, Employments, Legal Entities, Pay Groups
│   ├── Org Structure (Org Units, Positions, Employment Assignments)
│   ├── Cost Centers, Company Groups
│   ├── HR Export
│   └── Data Imports (validation, approval, publish)
├── Payroll
│   ├── Payruns, Pay Items, Rules, Tax
│   ├── Payslips, Bank Files, GL Exports
│   ├── Payroll Cycle, Payment Batches
│   └── Country Packs (ZA/LS)
├── Compliance
│   ├── SARS (IRP5, EMP201, EMP501)
│   ├── UIF / SDL / COIDA
│   ├── Garnishments
│   └── Deadlines / Alerts
├── Enterprise Governance
│   ├── RBAC, Audit
│   ├── Workflows, Delegations
│   └── Cost Centers, User Management
├── Employee Experience
│   ├── Self-Service
│   ├── Leave, Expenses, Loans
│   └── Time & Attendance
├── Talent
│   ├── Recruitment, Offers
│   ├── Onboarding
│   └── Performance
└── Integration Layer
    ├── HR API, Data Import Console
    ├── Webhooks
    └── Accounting / Banking / SARS Connectors
```

---

*Last updated: March 2026. Aligned with CAPABILITY_SUMMARY.md and FEATURE_READINESS.md. Naming: [NAMING.md](./NAMING.md).*
