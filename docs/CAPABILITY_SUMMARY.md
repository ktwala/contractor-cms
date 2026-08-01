# Hubsec Workforce Platform — Capability Summary

One-page overview of platform capabilities. For detailed docs see [README](../README.md), [FEATURE_READINESS.md](./FEATURE_READINESS.md), and [READINESS_TIERS.md](./READINESS_TIERS.md) (A/B/C production readiness). Canonical naming: [NAMING.md](./NAMING.md).

---

## Core Payroll
- **Multi-country**: South Africa (ZAF), Lesotho (LSO) with country-specific tax
- **Payrun**: Create, calculate, approve, finalize with maker-checker workflows
- **Tax**: PAYE, UIF, SDL; payslip (HTML/PDF); bank file (ACB); GL journal export
- **SARS**: IRP5 certificates, EMP201 returns, tax periods, bulk generation, eFiling CSV

## Employee & HCM
- **Employees**: CRUD, employments (effective-dated), legal entities, pay groups
- **Self-service**: Profile, payslips, leave requests, expense claims, loan applications
- **Onboarding**: Checklists, document collection, equipment provisioning (templates)

## Benefits
- **Plans**: Medical, retirement, life insurance; multi-tier (Bronze–Platinum)
- **Enrollment**: Workflows, dependents, contribution tracking, reports

## Expenses
- **Claims**: Draft → Submit → Approve/Reject → Paid
- **Categories**: Policies, limits; mileage calculation; payment batches

## Loans
- **Types**: Personal, salary advance, emergency; calculator, interest (simple/compound)
- **Workflow**: Apply → Approve → Disburse; repayment schedules; payroll deductions

## Performance
- **Cycles**: Annual, semi-annual, quarterly
- **Goals**: SMART goals, progress tracking
- **Reviews**: Self-assessment, manager review, 360° feedback; PIPs

## Time & Attendance
- **Clock in/out**: Web-based; shift management; overtime requests
- **Summaries**: Monthly stats, present/absent/late, regular vs overtime
- **Location**: Optional GPS; biometric-ready

## Compliance & Statutory
- **UIF/SDL/COIDA**: Declarations, assessments, CSV export
- **Garnishments**: Court orders, protected earnings (25%), deduction sequencing
- **Dashboard**: Real-time status, deadlines, alerts, legislative updates

## Enterprise & Governance
- **Company Groups**: Hierarchies, multi-entity consolidation, reports
- **Cost Centers**: Types (dept/project/location), GL mapping, budgets, allocations
- **Approval Workflows**: Multi-level, delegation, escalation, audit trail
- **RBAC**: Roles, permissions (resource:action), entity scoping, time-based assignments
- **Audit**: Change tracking, API logging, security events, retention

## Recruitment & Onboarding
- **Requisitions**: Create, approve, post
- **ATS**: Candidates, interview scheduling, feedback, offers
- **Onboarding**: Task checklists, documents, equipment, access provisioning

## Integrations
- **Banking**: API-based payments (SA banks), batch processing
- **Accounting**: Xero, QuickBooks, Sage; GL sync, employee sync
- **SARS**: eFiling, pension fund submissions
- **Webhooks**: Inbound events, retry, logging

## Notifications & Automation
- **Channels**: Email, SMS, in-app
- **Workflows**: Approval alerts, scheduled reminders (EMP201, IRP5, payroll)
- **Background**: Alert schedules, report generation, notification retry

## Mobile & API
- **Mobile API**: Device management, push (FCM/APNs), refresh tokens
- **Self-service**: Profile, payslips, leave, expenses, loans
- **Offline**: Sync queue, conflict resolution; feature flags

## Portals
- **Hubsec Workforce Admin** (React): Enterprise nav (Company Groups, Cost Centers, Employees, HR Export, etc.); RBAC-gated; Docker-ready
- **Hubsec Workforce Employee Portal** (React): Self-service, time tracking, leave, expenses, loans

---

*Last updated: March 2026. See README.md for full feature list and API docs. Naming: [NAMING.md](./NAMING.md).*
