# Hubsec Workforce Platform

**Hubsec Workforce Platform** is an enterprise workforce management platform providing payroll operations, compliance management, workforce lifecycle processes, and integration with downstream identity governance systems.

The platform includes:

- **Hubsec Workforce Admin** — Administrative console for payroll, HCM, compliance, and governance
- **Hubsec Workforce Employee Portal** — Self-service portal for payslips, leave, expenses, and benefits

> **Product naming:** [docs/NAMING.md](docs/NAMING.md) • **Reference architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) • **Bootstrap:** [docs/BOOTSTRAP.md](docs/BOOTSTRAP.md) • **Customer reset:** [docs/CUSTOMER_ENVIRONMENT.md](docs/CUSTOMER_ENVIRONMENT.md)

## 🚀 Features

### Core Payroll Features
- **Multi-Country Support**: South Africa and Lesotho with country-specific tax calculations
- **Payrun Management**: Create, approve, and process payroll with maker-checker workflows
- **Tax Calculations**: Automated PAYE, UIF, SDL, and other statutory deductions
- **Bank File Generation**: ACB format for South African banks
- **GL Journal Export**: General ledger integration
- **Payslip Generation**: PDF and HTML payslips for employees

### Benefits Administration
- **Benefit Plans**: Medical aid, retirement, life insurance, disability, and custom benefits
- **Multi-Tier Plans**: Different coverage levels (Bronze, Silver, Gold, Platinum)
- **Enrollment Management**: Employee enrollment with approval workflows
- **Dependent Management**: Add family members to benefit plans
- **Contribution Tracking**: Employee and employer contributions
- **Reports**: Enrollment reports, cost analysis, and benefit summaries

### Expense Management
- **Expense Categories**: Configurable categories with policies and limits
- **Claim Workflow**: Draft → Submit → Review → Approve/Reject → Paid
- **Multi-Currency Support**: Track expenses in different currencies
- **Receipt Attachments**: Upload and manage expense receipts
- **Approval Workflows**: Manager and finance approval
- **Expense Reports**: Category analysis, policy compliance reports
- **Payment Batches**: Bulk payment processing for approved claims

### Loan & Advance Management
- **Loan Types**: Personal loans, salary advances, emergency loans, etc.
- **Loan Calculator**: Calculate repayments with interest
- **Application Workflow**: Apply → Submit → Approve → Disburse
- **Repayment Schedules**: Automatic schedule generation
- **Interest Calculations**: Simple and compound interest
- **Repayment Tracking**: Monitor payments and outstanding balances
- **Integration**: Automatic payroll deductions

### Performance Management
- **Performance Cycles**: Annual, semi-annual, quarterly review periods
- **Goal Management**: SMART goals with progress tracking
- **Performance Reviews**: Self-assessment, manager review, 360-degree feedback
- **Rating Scales**: Competencies, values, and overall performance
- **Feedback System**: Peer, direct report, and skip-level feedback
- **Performance Improvement Plans (PIPs)**: Track underperformance
- **Analytics**: Performance trends and statistics

### Analytics & Reports Dashboard
- **Dashboard Overview**: Real-time metrics for employees, payroll, leave, expenses, loans, and performance
- **Payroll Trends**: Monthly, quarterly, and yearly analysis
- **Department Analysis**: Cost breakdown by department
- **Tax Reports**: Comprehensive tax summary and breakdown
- **Turnover Analysis**: Employee retention metrics
- **Expense Analytics**: Category-wise expense tracking
- **Loan Portfolio**: Active loans and repayment status
- **Performance Stats**: Review completion and rating trends
- **Saved Reports**: Create and schedule custom reports
- **KPI Tracking**: Key performance indicators with targets
- **Export Options**: CSV, Excel, PDF exports

### SARS Tax Forms ⭐ NEW
- **IRP5 Certificates**: Automatic annual employee tax certificate generation
- **EMP201 Returns**: Monthly employer declarations to SARS
- **Tax Period Management**: Track annual and monthly tax periods
- **Comprehensive Tax Codes**: Support for all IRP5 codes (3601-4493)
  - Income codes (employment, bonuses, commission, overtime, allowances)
  - Fringe benefits (company car, accommodation, loans)
  - Deductions (pension, retirement annuity, medical aid)
  - Tax deductions (PAYE, UIF, SDL)
  - Employer contributions
- **Medical Aid Tax Credits**: Automatic calculation with dependent tracking
- **Bulk Certificate Generation**: Generate IRP5s for all employees
- **SARS Submission Tracking**: Audit trail for all submissions
- **EMP501 Reconciliation**: Year-end reconciliation (foundation)
- **CSV/XML Export**: Ready for eFiling integration

### Time & Attendance ⭐ NEW
- **Clock In/Out**: Web-based time tracking for employees
- **Shift Management**: Define and assign work schedules
  - Regular, night, weekend, and public holiday shifts
  - Configurable break times and durations
  - Overtime multipliers (1.5x, 2.0x)
  - Grace periods for late arrivals
- **Shift Assignment**: Assign employees to shifts with work-day patterns
- **Attendance Tracking**: Automatic recording of work hours
  - Daily attendance records
  - Late arrival tracking
  - Early departure monitoring
  - Break time management
- **Overtime Management**: Request and approve overtime
  - Pre-approved overtime requests
  - Automatic overtime calculation
  - Integration with payroll
- **Attendance Summaries**: Monthly statistics
  - Days present/absent/on leave
  - Total hours worked
  - Regular vs overtime hours
  - Attendance percentage
  - Punctuality metrics
- **Location Tracking**: Optional GPS/IP logging
- **Device Support**: Web, mobile, biometric integration ready
- **Time Adjustments**: Manual corrections with approval workflow
- **Clock Events Log**: Complete audit trail of all clock events

### Notifications & Automation ⭐ NEW
- **Multi-Channel Notifications**: Email, SMS, and in-app notifications
- **User Preferences**: Configurable notification settings per user
  - Email on/off toggle
  - SMS on/off toggle
  - Custom notification preferences
- **SMS Integration**: Twilio-powered SMS delivery
  - Critical alerts
  - EMP201 deadline reminders
  - Payroll completion notifications
  - Approval request alerts
  - Bulk SMS sending
  - Delivery status tracking
  - Automatic retry for failed messages
- **Workflow Notifications**: Automated notifications for approval workflows
  - Expense approval notifications
  - Leave approval notifications
  - Loan approval notifications
  - Overtime approval notifications
  - Performance review notifications
  - Multi-channel delivery (email + in-app)
- **Scheduled Alerts**: Cron-based deadline reminders
  - EMP201 submission reminders (5th of each month at 9 AM)
  - IRP5 submission reminders (May 15th annually at 9 AM)
  - Payroll processing reminders (25th of each month at 9 AM)
  - Performance review reminders (quarterly)
  - Custom alert schedules with cron expressions
- **Automated Reports**: Scheduled report generation
  - Daily, weekly, monthly report schedules
  - Email delivery to recipients
  - Multiple report types supported
- **In-App Notifications**: Notification bell system
  - Unread notification count
  - Action-required notifications
  - Read/unread status tracking
  - Archive functionality
  - Automatic cleanup (archive after 30 days, delete after 90 days)
- **Notification History**: Complete audit trail
  - Email notification log
  - SMS delivery tracking
  - Workflow notification history
  - Retry tracking
  - Failed notification monitoring
- **Background Jobs**: Automated maintenance tasks
  - Process alert schedules (hourly)
  - Process scheduled reports (hourly)
  - Retry failed notifications (every 6 hours)
  - Cleanup old notifications (daily at 2 AM)

### Mobile API Enhancements ⭐ NEW
- **Mobile-First Architecture**: Optimized endpoints for mobile apps
- **Device Management**: Register and manage multiple mobile devices per user
  - Device registration (iOS & Android)
  - Push notification token management
  - Device deactivation and logout
  - Multi-device session support
- **Mobile Authentication**: Secure mobile authentication with refresh tokens
  - JWT access tokens (15-minute expiry)
  - Refresh tokens (30-day expiry)
  - Device-specific sessions
  - Secure token refresh mechanism
  - Logout from single or all devices
- **Push Notifications**: Firebase Cloud Messaging (FCM) & Apple Push Notification service (APNs)
  - Real-time push notifications
  - High-priority and normal-priority messages
  - Topic-based subscriptions
  - Scheduled push notifications
  - Delivery status tracking
  - Automatic retry for failed notifications
  - Invalid token handling
- **Mobile Dashboard**: Lightweight dashboard API for mobile apps
  - Quick stats (attendance, leave, notifications, approvals)
  - Recent activities feed
  - Customizable dashboard widgets
  - Minimal payload sizes for mobile networks
- **Mobile Timesheet**: Quick clock in/out functionality
  - One-tap clock in/out
  - Geolocation capture (latitude/longitude/accuracy)
  - Late arrival detection
  - Early departure tracking
  - Shift-aware clock events
  - Attendance history with monthly summaries
  - Upcoming shifts view
  - Overtime request submission
- **Mobile (Hubsec Workforce Employee Portal)**: Self-service features for employees
  - Lightweight profile API
  - Profile picture upload
  - Payslip access and download
  - Leave request submission and tracking
  - Expense claim submission with receipt photos
  - Loan applications
  - Document access
- **Offline Support**: Database-backed offline sync queue
  - Offline data capture
  - Conflict resolution (server wins / client wins / manual)
  - Automatic sync when online
  - Retry mechanism for failed syncs
- **Feature Flags**: Dynamic feature rollout for mobile apps
  - Platform-specific features (iOS, Android, all)
  - Minimum app version enforcement
  - Gradual rollout with percentage-based enablement
  - Default features: biometric auth, offline mode, push notifications
- **Mobile Analytics**: Track mobile app usage
  - API endpoint tracking
  - Response time monitoring
  - Payload size tracking
  - Error logging
  - User behavior insights

### Advanced Compliance & Statutory Reporting ⭐ NEW
- **UIF (Unemployment Insurance Fund)**: Complete UIF management
  - Monthly UIF declarations
  - Automatic calculation (1% employer + 1% employee)
  - UIF threshold and cap handling (R17,712 monthly)
  - Line-item employee breakdown
  - CSV export for submission
  - Declaration status tracking (draft, submitted, accepted)
  - Audit trail
- **SDL (Skills Development Levy)**: SDL management and reporting
  - Monthly SDL declarations
  - 1% levy calculation on total remuneration
  - Exemption handling (R500,000 annual threshold)
  - SIC code tracking
  - Payment recording
  - CSV export
  - Multi-year reporting
- **COIDA (Compensation Fund)**: Compensation assessments
  - Annual COIDA assessments
  - Return of earnings generation
  - Risk class and tariff rate management
  - Assessment calculation
  - Payment tracking with balance due
  - Due date management (March 31st annually)
  - CSV export for submission
- **Garnishment Management**: Court orders and deductions
  - Emolument attachment orders
  - Maintenance orders
  - Debt review deductions
  - Administration orders
  - Protected earnings (Section 65J - 25% protection)
  - Priority-based deduction sequencing
  - Automatic balance tracking
  - Court order document management
  - Suspend/reactivate orders
  - Deduction history per payslip
  - Creditor payment tracking
- **Compliance Dashboard**: Centralized compliance overview
  - Real-time compliance status
  - Upcoming deadlines (7-day view)
  - Overdue item tracking
  - Active alerts management
  - Statutory status summary (UIF, SDL, COIDA, SARS)
  - Checklist management (monthly, quarterly, annual)
  - Alert acknowledgment and dismissal
- **Statutory Deadlines**: Automated deadline tracking
  - SARS EMP201 (7th of month)
  - UIF declarations (7th of month)
  - SDL payment (7th of month)
  - IRP5 submission (annually)
  - EMP501 reconciliation (annually)
  - COIDA assessment (March 31st)
  - Customizable alert thresholds
- **Legislative Changes**: Track regulatory updates
  - Change announcements
  - Effective dates
  - Impact assessment
  - Implementation tracking
  - Reference documentation
  - Automatic notifications
  - Examples: Minimum wage increases, UIF rate changes, SDL thresholds
- **Compliance Alerts**: Proactive notification system
  - Upcoming deadline alerts
  - Overdue task warnings
  - Legislative change notifications
  - Critical compliance issues
  - Severity levels (info, warning, error, critical)
  - Auto-expire functionality
- **Audit Trail**: Enhanced compliance auditing
  - Complete garnishment history
  - Declaration submission tracking
  - Payment recording
  - Status change logs
  - User action tracking
- **Background Jobs**: Automated compliance tasks
  - Daily deadline checks (8 AM)
  - Monthly checklist generation (1st of month at 6 AM)
  - Alert expiry management
  - Overdue item detection

### External System Integrations ⭐ NEW
- **Banking Integrations**: Real-time payment submission
  - API-based payment submissions (vs file-based)
  - Support for major SA banks (Standard Bank, FNB, ABSA, Nedbank)
  - Batch payment processing
  - Real-time payment status tracking
  - OAuth2 authentication
  - Payment reconciliation
  - Transaction line-item tracking
  - Failed payment retry logic
  - Bank response logging
- **Accounting Integrations**: Sync with accounting systems
  - Xero integration (GL journals, employees, payments)
  - QuickBooks integration
  - Sage integration
  - Auto-sync GL journals after payrun
  - Employee sync (bidirectional)
  - Payment tracking
  - Field mapping customization
  - Sync queue with retry
  - Conflict resolution
- **SARS eFiling Integration**: Direct SARS submissions
  - EMP201 API submission
  - IRP5 bulk submission
  - EMP501 reconciliation submission
  - Submission status tracking
  - SARS reference number capture
  - XML payload generation
  - Validation error handling
  - Automatic retry on failure
- **Pension Fund Integrations**: Automated pension submissions
  - Member contribution files
  - Employer contribution tracking
  - CSV/XML export formats
  - Fund-specific formatting
  - Submission history
  - Payment reconciliation
- **Integration Framework**: Extensible architecture
  - Connection management (OAuth2, API key, basic auth)
  - Credential encryption
  - Access token refresh
  - Connection health monitoring
  - Sync logging and audit trail
  - Field mapping engine
  - Webhook support
  - Scheduled sync (realtime, hourly, daily)
  - Error tracking and retry logic
- **Webhook Management**: Inbound webhook processing
  - Payment status updates
  - Account synchronization
  - Invoice paid notifications
  - Event signature verification
  - Webhook event logging
  - Automatic retry for failed processing

### Enterprise Features ⭐ NEW
- **Multi-Company Consolidation**: Enterprise-wide reporting
  - Company group hierarchies
  - Multi-entity consolidation
  - Consolidated payroll reports by group
  - Consolidated compliance reporting (PAYE, UIF, SDL)
  - Consolidated headcount by department/location
  - Percentage-based consolidation (for partial ownership)
  - Multi-currency consolidation
  - Group-level analytics and KPIs
- **Advanced Approval Workflows**: Configurable multi-level approvals
  - Workflow designer (payrun, payment, salary changes, terminations)
  - Multi-step approval chains
  - Parallel and sequential approval steps
  - Auto-approval rules (amount thresholds)
  - Approval delegation
  - Escalation management (automatic escalation after X days)
  - Approval history and audit trail
  - Conditional approvals
  - Manager hierarchy-based routing
  - Role-based approvers
  - Email and SMS approval notifications
  - Pending approvals dashboard
  - Approval analytics
- **Comprehensive Audit Trail**: Enterprise-grade auditing
  - Complete change tracking (old values → new values)
  - User action logging (create, update, delete, approve, export)
  - API request logging
  - Security event tracking (login, logout, failed login, MFA)
  - Compliance action auditing
  - POPIA-compliant data export logging
  - Entity history timeline
  - Advanced audit queries (by user, entity, action, date range)
  - Compliance audit reports
  - Severity levels (info, warning, error, critical)
  - Retention policy integration
  - Automatic cleanup of old audit logs
- **Advanced RBAC**: Granular role-based access control
  - Custom role creation
  - Role inheritance and hierarchies
  - Granular permissions (resource:action model)
  - Permission categories (Payroll, Employees, Reports, Administration, Compliance)
  - Allow/Deny grant types
  - Conditional permissions (department-scoped, entity-scoped)
  - Time-based role assignments (effective from/to dates)
  - User-role-entity assignments
  - Permission caching for performance
  - Role templates (Enterprise Admin, Payroll Manager, HR Manager, Finance Manager)
  - Permission audit logging
- **Data Archiving & Retention**: Automated lifecycle management
  - Configurable retention policies by entity type
  - Auto-archive based on age (payslips, payruns, employees, audit logs)
  - Compressed storage (gzip compression)
  - Archive batches with status tracking
  - Point-in-time restore capability
  - Restore count tracking
  - Archive search and query
  - Legal hold support
  - Compliance-driven retention (5 years for tax, 7 years for employees)
  - Scheduled archival jobs (daily at 2 AM)
  - Archive batch monitoring
  - Manual archive/restore
- **Delegation & Proxy Access**: Temporary access delegation
  - Full, partial, approval-only, and view-only delegation types
  - Time-bound delegations (start/end dates)
  - Entity-scoped delegations (specific companies or departments)
  - Permission-specific delegations
  - Transaction amount limits
  - MFA requirement for delegated actions
  - Delegation usage logging
  - Active delegation dashboard
  - Automatic expiry
  - Revocation support
  - Delegation statistics and analytics
- **Cost Center Management**: Advanced cost allocation
  - Hierarchical cost center structure
  - Cost center types (department, project, location, product)
  - Employee cost allocation (percentage-based splits)
  - Multi-cost center assignments per employee
  - GL account mapping
  - Cost center managers
  - Budget management and tracking
  - Budget utilization monitoring
  - Budget alert thresholds (e.g., 90% utilized)
  - Budget variance reporting
  - Fiscal year management
  - Budget types (salaries, benefits, total compensation, headcount)
  - Monthly/Quarterly/Annual budgets
  - Cost center reports with allocation breakdown
  - Automatic budget calculation from payslips
- **Bulk Operations**: Mass data processing
  - Bulk employee import (CSV)
  - Bulk salary updates
  - Bulk terminations
  - Batch job tracking
  - Row-by-row validation
  - Success/failure tracking
  - Validation error reporting
  - Progress monitoring (percentage complete)
  - Batch job history
  - Item-level error messages
  - Rollback capability
  - Dry-run mode
  - CSV parsing with Papa Parse
  - Job status (pending, validating, in_progress, completed, failed, partially_completed)
- **API Usage Tracking & Rate Limiting**: Monitor and control API usage
  - API key management
  - Rate limiting (per minute, hour, day)
  - Usage logging per endpoint
  - Response time tracking
  - Payload size monitoring
  - Error rate tracking
  - API key expiration
  - Usage analytics dashboard
  - Overage alerts
  - Key types (internal, partner, customer, integration)
  - Last used tracking

### Payroll Cycle Management ⭐ NEW
- **Payroll Calendar Management**: Automated period generation
  - Multiple calendar frequencies (weekly, bi-weekly, semi-monthly, monthly, quarterly, annual)
  - Automated period generation
  - Configurable payment and cutoff dates
  - Calendar inheritance and templates
  - Period naming conventions
  - Future period visibility (12+ months ahead)
- **Payroll Period Tracking**: Complete lifecycle management
  - Period statuses (upcoming, open, locked, processing, completed, closed)
  - Period locking/unlocking controls
  - Link periods to payruns
  - Period closure with audit trail
  - Current and upcoming period views
- **Payroll Checklists**: Task management for payroll processing
  - Customizable checklist templates
  - Pre-payroll, during-payroll, post-payroll, compliance, and reporting tasks
  - Automatic checklist generation from templates
  - Task assignment to users and roles
  - Due date management with offsets
  - Task completion tracking
  - Progress monitoring (percentage complete)
  - Task categories and ordering
  - Required vs optional tasks
  - Estimated duration tracking
  - 16 pre-configured tasks in standard template
- **Payroll Exceptions & Alerts**: Proactive issue detection
  - Automated exception detection:
    - Negative net pay detection
    - Zero pay with positive gross
    - High overtime alerts (>50 hours)
    - Significant variance from previous period (>20%)
    - Missing timesheet detection
  - Exception categories (data_missing, calculation_error, variance, compliance, approval_required)
  - Severity levels (info, warning, error, critical)
  - Resolution workflow
  - Dismissal with reason tracking
  - Exception statistics dashboard
  - Employee-level exception tracking
- **Payroll Reconciliation**: Variance analysis
  - Period-over-period reconciliation
  - Budget vs actual comparison
  - Forecast vs actual comparison
  - Line-item variance tracking (gross pay, deductions, net pay, PAYE, UIF, headcount)
  - Variance explanation and documentation
  - Automated variance calculation (amount and percentage)
  - Reconciliation history
  - Reconciliation status tracking
- **Payroll Forecasting**: Predictive budgeting
  - Multiple forecast methods:
    - Historical average (6-month average)
    - Trend analysis (linear regression)
    - Manual forecasting
    - Budget-based forecasting
  - Monthly, quarterly, and annual forecasts
  - Forecast assumptions tracking
  - Actual vs forecast variance analysis
  - Forecast items by type (basic salary, overtime, bonuses, benefits, deductions)
  - Automatic variance calculation
  - Forecast status management (draft, active, archived)
- **Payroll Milestones & Timeline**: Process tracking
  - Milestone types (cutoff, data_collection, validation, approval, processing, payment, reporting, completion)
  - Scheduled vs actual date tracking
  - Milestone status (pending, in_progress, completed, delayed, skipped)
  - Duration tracking per milestone
  - Milestone ordering and sequencing
  - Completion audit trail
- **Payroll Sign-off**: Multi-stage approvals
  - Sign-off stages (data verification, calculation review, management approval, final approval)
  - Role-based sign-off requirements
  - User assignment per stage
  - Approval/rejection workflow
  - Rejection reason tracking
  - Sign-off history and audit trail
- **Recurring Payroll Items**: Automation
  - Recurring earnings and deductions
  - Frequency options (every period, monthly, quarterly, annual)
  - Start and end date management
  - Auto-creation in payruns
  - Item activation/deactivation
  - Employee-specific recurring items
- **Payroll Adjustments**: Correction tracking
  - Adjustment types (correction, backpay, overpayment recovery, bonus, other)
  - Reason tracking for all adjustments
  - Original vs adjusted vs new amount tracking
  - Approval workflow for adjustments
  - Applied status tracking
  - Field-level adjustment tracking

### Recruitment & Onboarding ⭐ NEW
- **Job Requisition Management**: Complete hiring lifecycle
  - Job posting creation and approval workflow
  - Job levels (entry, junior, mid, senior, lead, manager, director, executive)
  - Employment types (permanent, contract, temporary, internship, part-time)
  - Salary range management
  - Posting to multiple channels (LinkedIn, job boards, career sites)
  - Requisition status tracking (draft, pending_approval, approved, posted, on_hold, filled, cancelled)
  - Headcount planning integration
  - Department and hiring manager assignment
  - Vacancy tracking
- **Candidate & Application Tracking**: Full applicant tracking system (ATS)
  - Candidate profile management
  - Resume and document upload
  - Application source tracking (job board, referral, LinkedIn, company website, recruitment agency, other)
  - Duplicate candidate prevention (email-based)
  - Multi-stage application pipeline (applied, screening, interview, assessment, offer, hired, rejected)
  - Application status management
  - Stage progression tracking
  - Rejection reason documentation
  - Candidate communication history
  - Skills and experience tracking
  - Candidate status (new, screening, interviewing, offer_extended, hired, rejected, withdrawn)
- **Interview Management**: Scheduling and feedback collection
  - Interview scheduling with calendar integration
  - Multiple interview types (phone_screen, video, in_person, panel, technical, hr)
  - Interview round tracking (auto-increment for multiple rounds)
  - Panel interview support (multiple interviewers)
  - Interview status (scheduled, completed, cancelled, no_show)
  - Structured feedback collection
  - Rating system (1-5 scale for skills, culture fit, communication, technical)
  - Hiring recommendation tracking (strong_yes, yes, maybe, no, strong_no)
  - Interview notes and comments
  - Interviewer assignment
  - Interview outcome tracking
- **Offer Management**: Offer letter generation and acceptance
  - Offer creation and approval workflow
  - Offer types (full_time, part_time, contract, temporary, internship)
  - Comprehensive offer components:
    - Job title and department
    - Reporting structure
    - Start date and offer expiry date
    - Salary (amount, currency, frequency)
    - Signing bonus and relocation assistance
    - Benefits summary
    - Equity/stock options
    - Probation period (months)
    - Contract duration (for fixed-term contracts)
  - Offer status tracking (draft, pending_approval, approved, sent, accepted, declined, expired, withdrawn)
  - Offer acceptance/decline workflow
  - Decline reason tracking
  - Offer letter path storage
  - Automatic application stage update (to 'hired' on acceptance)
  - Multiple offer versions per application
  - Offer approval chain
- **Onboarding Workflows**: New hire onboarding automation
  - Template-based onboarding checklists
  - Customizable onboarding templates by department/role
  - Pre-start and post-start task scheduling
  - Task categories (documentation, equipment, it_access, training, orientation, compliance, paperwork)
  - Onboarding workflow status (not_started, in_progress, on_hold, completed, cancelled)
  - Task assignment to HR, IT, managers, and employees
  - Due date calculation with offset days (negative for pre-start tasks)
  - Task completion tracking with percentage progress
  - Pre-configured 20-task standard template:
    - Pre-start: contract signing, background checks, reference checks
    - Day 1: office tour, IT setup, team introduction
    - Week 1: HR orientation, policy review, payroll setup, benefits enrollment
    - Month 1: training programs, manager 1-on-1s, performance expectations
  - Document collection tracking
    - Required documents (ID, tax forms, bank details, qualifications, etc.)
    - Document upload and verification
    - Submission date tracking
  - Equipment provisioning
    - Equipment requests (laptop, monitor, phone, desk, chair, access card, etc.)
    - Status tracking (pending, ordered, assigned, returned)
    - Serial number and asset tracking
    - Return date management
  - System access provisioning
    - System access requests (email, HR system, payroll, ERP, CRM, Slack, VPN, etc.)
    - Access status (pending, provisioned, active, suspended, revoked)
    - Username tracking
    - Provisioned/revoked date tracking
  - Onboarding progress monitoring
  - Buddy/mentor assignment
  - Onboarding completion certification

## 📊 Technology Stack

### Backend
- **Framework**: NestJS (Node.js + TypeScript)
- **Database**: MySQL 8.0
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger/OpenAPI
- **Scheduling**: @nestjs/schedule for cron jobs
- **SMS**: Twilio for SMS notifications
- **Email**: Nodemailer for email delivery
- **Push Notifications**: Firebase Cloud Messaging (FCM) with firebase-admin
- **File Upload**: Multer for multipart/form-data
- **Testing**: Jest + Supertest for E2E tests

### Frontend
- **Hubsec Workforce Admin**: React + TypeScript + Vite
- **Hubsec Workforce Employee Portal**: React + TypeScript + Vite
- **State Management**: React Hooks
- **Styling**: Tailwind CSS
- **Testing**: Playwright for E2E UI tests

## 🛠️ Installation

### Prerequisites
```bash
Node.js >= 18.0.0
MySQL >= 8.0
npm or yarn
```

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd hubsec-workforce-platform
```

2. **Install dependencies**
```bash
# Backend
npm install

# Hubsec Workforce Admin
cd admin-portal
npm install
cd ..

# Hubsec Workforce Employee Portal
cd employee-portal
npm install
cd ..
```

3. **Database Setup**
```bash
# Create database
mysql -u root -p
CREATE DATABASE payroll_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE payroll_test_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Run migrations
npm run db:migrate
```

4. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your database credentials and settings
```

Required environment variables for notifications:
```bash
# Email Configuration (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@payroll.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Push Notifications (Firebase Cloud Messaging)
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-service-account.json
```

To set up Firebase Cloud Messaging:
1. Create a Firebase project at https://console.firebase.google.com
2. Go to Project Settings > Service Accounts
3. Generate a new private key (downloads a JSON file)
4. Save the JSON file securely and set the path in FIREBASE_SERVICE_ACCOUNT_PATH
```

5. **Start the application**
```bash
# Backend
npm run start:dev

# Hubsec Workforce Admin (in new terminal)
cd admin-portal
npm run dev

# Hubsec Workforce Employee Portal (in new terminal)
cd employee-portal
npm run dev
```

### Running with Docker (Recommended)

Run the entire platform (backend, admin portal, employee portal, PostgreSQL, Redis, SeaweedFS) from Docker:

```bash
# From the project root
docker compose up -d

# Or with npm
npm run docker:up
```

**Services:**
- **Hubsec Workforce Admin**: http://localhost:3001
- **Hubsec Workforce Employee Portal**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

The admin portal runs in a container with hot-reload (src is mounted). API calls from the browser use `localhost:4000` to reach the backend.

For **customer/production** deployment (no demo data), use `docker-compose.customer.yml` and run the bootstrap one-off. See [docs/BOOTSTRAP.md](docs/BOOTSTRAP.md).

```bash
# Stop all services
docker compose down

# Rebuild after dependency changes
docker compose up -d --build
```

## 🧪 Testing

### Run E2E Tests
```bash
# Backend API tests
npm run test:e2e

# Specific test file
npm run test:e2e -- analytics.e2e-spec

# Frontend UI tests
npx playwright test

# With UI mode
npx playwright test --ui
```

See [TEST_DOCUMENTATION.md](./TEST_DOCUMENTATION.md) for comprehensive testing guide.

## 📁 Project Structure

```
hubsec-workforce-platform/
├── src/
│   ├── modules/
│   │   ├── auth/              # Authentication & authorization
│   │   ├── employees/         # Employee management
│   │   ├── payruns/           # Payroll processing
│   │   ├── benefits/          # Benefits administration
│   │   ├── expenses/          # Expense management
│   │   ├── loans/             # Loan & advance management
│   │   ├── performance/       # Performance reviews
│   │   ├── reports/           # Reports & analytics
│   │   ├── recruitment/       # Recruitment & onboarding ⭐ NEW
│   │   └── ...
│   ├── common/                # Shared utilities
│   ├── config/                # Configuration
│   └── main.ts
├── migrations/                # Database migrations
├── test/
│   ├── e2e/                   # Backend API tests
│   ├── playwright/            # Frontend UI tests
│   ├── helpers/               # Test utilities
│   └── fixtures/              # Test data
├── admin-portal/              # Admin UI
│   └── src/
│       └── pages/
│           ├── AnalyticsDashboard.tsx
│           ├── PayrollReports.tsx
│           ├── BenefitPlans.tsx
│           ├── ExpenseClaims.tsx
│           ├── LoanApplications.tsx
│           ├── SARSReports.tsx        ⭐ NEW - IRP5/EMP201 management
│           ├── ShiftManagement.tsx    ⭐ NEW - Shift CRUD & assignments
│           └── AttendanceDashboard.tsx ⭐ NEW - Team attendance monitoring
└── employee-portal/           # Employee UI
    └── src/
        └── pages/
            ├── MyGoals.tsx
            ├── MyBenefits.tsx
            ├── MyLoans.tsx
            └── TimeTracking.tsx        ⭐ NEW - Clock in/out interface
```

## 🔑 API Endpoints

### Analytics & Reports
```
GET    /api/analytics/dashboard              # Dashboard overview metrics
GET    /api/analytics/payroll/trends         # Payroll trends (monthly/quarterly/yearly)
GET    /api/analytics/departments            # Department cost analysis
GET    /api/analytics/tax/summary            # Tax summary and breakdown
GET    /api/analytics/turnover               # Employee turnover analysis
GET    /api/analytics/expenses               # Expense analytics by category
GET    /api/analytics/loans/portfolio        # Loan portfolio summary
GET    /api/analytics/performance            # Performance review statistics
POST   /api/analytics/reports/saved          # Create saved report
GET    /api/analytics/reports/saved          # Get saved reports
GET    /api/analytics/kpis                   # Get KPIs
POST   /api/analytics/kpis/:id/update        # Update KPI value
```

### Performance Management
```
GET    /api/performance/cycles               # Get performance cycles
POST   /api/performance/cycles               # Create performance cycle
GET    /api/performance/goals                # Get goals
POST   /api/performance/goals                # Create goal
PUT    /api/performance/goals/:id/progress   # Update goal progress
POST   /api/performance/reviews              # Create review
POST   /api/performance/reviews/:id/self-assessment
POST   /api/performance/reviews/:id/manager-review
```

### Loans & Advances
```
GET    /api/loans/types                      # Get loan types
POST   /api/loans/applications               # Create loan application
POST   /api/loans/applications/:id/submit    # Submit for approval
POST   /api/loans/applications/:id/approve   # Approve application
POST   /api/loans/active/disburse            # Disburse loan
POST   /api/loans/active/:id/repay           # Record repayment
```

### Benefits
```
GET    /api/benefits/plans                   # Get benefit plans
POST   /api/benefits/plans                   # Create benefit plan
POST   /api/benefits/enrollments             # Create enrollment
POST   /api/benefits/enrollments/:id/approve # Approve enrollment
```

### Expenses
```
GET    /api/expenses/categories              # Get expense categories
POST   /api/expenses/claims                  # Create expense claim
POST   /api/expenses/claims/:id/submit       # Submit claim
POST   /api/expenses/claims/:id/approve      # Approve claim
```

### SARS Tax Forms ⭐ NEW
```
GET    /api/sars/tax-periods                 # Get tax periods (annual/monthly)
POST   /api/sars/irp5/generate/:tax_period_id              # Generate all IRP5 certificates
POST   /api/sars/irp5/generate/:tax_period_id/:employee_id # Generate IRP5 for employee
GET    /api/sars/irp5/:tax_period_id        # Get IRP5 certificates
GET    /api/sars/irp5/:id/pdf                # Download IRP5 certificate as PDF
GET    /api/sars/irp5/bulk/:tax_period_id/pdf  # Download all IRP5s as single PDF
POST   /api/sars/emp201/generate/:tax_period_id  # Generate EMP201 return
GET    /api/sars/emp201                      # Get EMP201 returns
GET    /api/sars/emp201/:id/csv              # Download EMP201 as CSV
GET    /api/sars/emp201/:id/efiling-csv      # Download EMP201 as SARS eFiling CSV
POST   /api/sars/emp201/:id/submit           # Mark EMP201 as submitted
```

### Time & Attendance ⭐ NEW
```
POST   /api/time-attendance/clock-in         # Clock in for the day
POST   /api/time-attendance/clock-out        # Clock out for the day
GET    /api/time-attendance/status           # Get current attendance status
GET    /api/time-attendance/attendance/:employee_id  # Get attendance records
GET    /api/time-attendance/summary/:employee_id/:month  # Get monthly summary
GET    /api/time-attendance/shifts           # Get all shifts
POST   /api/time-attendance/shifts           # Create new shift
POST   /api/time-attendance/shifts/assign    # Assign shift to employee
POST   /api/time-attendance/overtime/request # Request overtime
POST   /api/time-attendance/overtime/:id/approve  # Approve overtime
```

### Recruitment & Onboarding ⭐ NEW
```
# Job Requisitions
GET    /api/recruitment/requisitions             # Get all job requisitions
POST   /api/recruitment/requisitions             # Create job requisition
POST   /api/recruitment/requisitions/:id/approve # Approve requisition
POST   /api/recruitment/requisitions/:id/post    # Post requisition
POST   /api/recruitment/requisitions/:id/close   # Close requisition
GET    /api/recruitment/requisitions/open        # Get open requisitions

# Candidates & Applications
POST   /api/recruitment/candidates               # Create/get candidate
PUT    /api/recruitment/candidates/:id           # Update candidate
GET    /api/recruitment/candidates/:id           # Get candidate profile
POST   /api/recruitment/applications             # Submit application
PUT    /api/recruitment/applications/:id/stage   # Move application stage
POST   /api/recruitment/applications/:id/reject  # Reject application
GET    /api/recruitment/applications/:requisition_id  # Get applications for requisition

# Interviews
POST   /api/recruitment/interviews               # Schedule interview
POST   /api/recruitment/interviews/:id/feedback  # Submit interview feedback
POST   /api/recruitment/interviews/:id/complete  # Mark interview complete
GET    /api/recruitment/interviews/:application_id  # Get interviews for application
GET    /api/recruitment/interviews/my-interviews # Get my upcoming interviews
GET    /api/recruitment/interviews/:id           # Get interview details

# Offers
POST   /api/recruitment/offers                   # Create offer
POST   /api/recruitment/offers/:id/approve       # Approve offer
POST   /api/recruitment/offers/:id/send          # Send offer to candidate
POST   /api/recruitment/offers/:id/accept        # Accept offer
POST   /api/recruitment/offers/:id/decline       # Decline offer
GET    /api/recruitment/offers/:id               # Get offer details
GET    /api/recruitment/offers/application/:application_id  # Get offers for application
GET    /api/recruitment/offers/pending           # Get pending offers

# Onboarding
POST   /api/recruitment/onboarding               # Create onboarding workflow
POST   /api/recruitment/onboarding/:id/checklist # Create onboarding checklist from template
POST   /api/recruitment/onboarding/:id/task/complete  # Complete onboarding task
POST   /api/recruitment/onboarding/:id/document  # Add required document
POST   /api/recruitment/onboarding/:id/equipment # Add equipment request
POST   /api/recruitment/onboarding/:id/access    # Add system access request
GET    /api/recruitment/onboarding/:id           # Get onboarding workflow
GET    /api/recruitment/onboarding/employee/:employee_id  # Get employee onboarding
GET    /api/recruitment/onboarding/:id/tasks     # Get onboarding tasks
GET    /api/recruitment/onboarding/templates     # Get onboarding templates
POST   /api/recruitment/onboarding/:id/complete  # Mark onboarding complete
```

See Swagger documentation at `/api/docs` when running the backend.

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control (RBAC)**: Admin, Manager, Employee roles
- **Permission Guards**: Granular permissions for API endpoints
- **Audit Logging**: Track all critical operations
- **Maker-Checker Workflows**: Approval workflows for sensitive operations
- **Data Encryption**: Sensitive data encryption at rest

## 📈 Analytics & KPIs

The platform tracks the following KPIs:
- Total Payroll Cost
- Average Employee Salary
- Active Employee Count
- Employee Turnover Rate
- Leave Utilization Rate
- Expense to Payroll Ratio
- Loan Default Rate
- Average Performance Rating
- Tax Filing Compliance

## 🌍 Country Packs

### South Africa (ZAF)
- PAYE (Pay As You Earn)
- UIF (Unemployment Insurance Fund)
- SDL (Skills Development Levy)
- Medical Aid Tax Credit
- Pension Fund Tax Deductions

### Lesotho (LSO)
- PAYE (Pay As You Earn)
- Social Security contributions
- Pension Fund deductions

## 📝 Database Migrations

Migration files are located in the `migrations/` directory:
```
001_create_base_tables.sql
002_create_payrun_tables.sql
...
011_create_loan_tables.sql
012_create_performance_tables.sql
013_create_analytics_tables.sql
```

Run migrations in order:
```bash
mysql -u root -p payroll_db < migrations/001_create_base_tables.sql
mysql -u root -p payroll_db < migrations/002_create_payrun_tables.sql
# ... etc
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## 📄 License

ISC License

## 🆘 Support

For issues or questions:
1. Check [TEST_DOCUMENTATION.md](./TEST_DOCUMENTATION.md)
2. Review API documentation at `/api/docs`
3. Contact the development team

## 🎯 Roadmap

### Completed ✅
- [x] Core payroll processing
- [x] Benefits administration
- [x] Expense management
- [x] Loan & advance management
- [x] Performance management
- [x] Analytics & reports dashboard
- [x] Comprehensive E2E testing
- [x] SARS tax forms (IRP5, EMP201) ⭐ NEW
- [x] Time & attendance management ⭐ NEW
- [x] Recruitment & onboarding ⭐ NEW

### Planned 🚧
- [ ] Training & development
- [ ] Employee self-service enhancements
- [ ] Mobile applications
- [ ] Advanced reporting with charting libraries
- [ ] Multi-currency payroll
- [ ] Integration with accounting systems
- [ ] SARS eFiling integration
- [ ] Biometric device integration

## 🎯 Phase 1 Implementation (December 2024)

The following Phase 1 features have been implemented for SARS Tax Forms and Time & Attendance:

### SARS Tax Forms - Phase 1 ✅
- ✅ **Frontend UI**: `SARSReports.tsx` admin page for managing IRP5/EMP201
  - Tax period selector (annual for IRP5, monthly for EMP201)
  - Tabbed interface for IRP5 and EMP201
  - Bulk certificate generation
  - Employee-level certificate details
  - Export and submit functionality
- ✅ **PDF Generation**: `IRP5PdfService` for professional tax certificates
  - Individual IRP5 PDF downloads
  - Bulk PDF generation (all certificates in one file)
  - SARS-compliant formatting with all tax codes
  - Automatic employer and employee details
- ✅ **CSV Export**: `EMP201CsvService` for SARS eFiling
  - Standard CSV format for reporting
  - SARS eFiling-compatible CSV format
  - Data validation before export
  - Automatic UIF/PAYE/SDL calculations
- ✅ **Export Endpoints**: REST API for downloads
  - `GET /api/sars/irp5/:id/pdf` - Individual certificate
  - `GET /api/sars/irp5/bulk/:tax_period_id/pdf` - Bulk download
  - `GET /api/sars/emp201/:id/csv` - Standard CSV
  - `GET /api/sars/emp201/:id/efiling-csv` - eFiling format

### Time & Attendance - Phase 1 ✅
- ✅ **Hubsec Workforce Employee Portal**: `TimeTracking.tsx` clock in/out interface
  - Real-time clock with live updates
  - Large clock in/out buttons
  - Working time counter (live when clocked in)
  - Today's status cards (times and hours)
  - Recent 30-day attendance history
  - Location tracking integration
- ✅ **Admin UI**: `ShiftManagement.tsx` for shift administration
  - View all shifts with details
  - Create shifts (name, times, breaks, overtime multipliers)
  - Edit shift configurations
  - Assign shifts to employees with work-day patterns
  - Shift type classification (regular/night/weekend)
- ✅ **Attendance Dashboard**: `AttendanceDashboard.tsx` for managers
  - Real-time KPI cards (present, absent, late, clocked in)
  - Daily attendance view with employee details
  - Monthly summary view with statistics
  - Date range filtering
  - Export functionality (planned)
- ✅ **E2E Tests**: Comprehensive test coverage
  - `test/sars.e2e-spec.ts` - Tax form workflows
  - `test/time-attendance.e2e-spec.ts` - Clock in/out workflows
  - Security and permission tests
  - Export functionality validation

## 📊 Test Coverage

The platform includes comprehensive E2E tests:
- **Performance Management**: Goals, reviews, 360-degree feedback
- **Loan Management**: Applications, approvals, disbursements, repayments
- **Analytics**: Dashboard metrics, trends, reports, KPIs
- **SARS Tax Forms**: IRP5 generation, EMP201 returns, PDF/CSV exports ⭐ NEW
- **Time & Attendance**: Clock in/out, shift management, attendance tracking ⭐ NEW
- **Frontend UI**: Employee portal workflows with Playwright

Run `npm run test:e2e` for backend tests and `npx playwright test` for frontend tests.

## 🏗️ Architecture

### Backend Architecture
- **Modular Design**: Each feature is a separate NestJS module
- **Service Layer**: Business logic separated from controllers
- **Repository Pattern**: Database access through dedicated services
- **DTOs**: Data Transfer Objects for API validation
- **Guards & Interceptors**: Authentication, authorization, and response transformation

### Database Design
- **Normalized Schema**: Optimized for data integrity
- **Audit Tables**: Track all changes to critical data
- **Indexes**: Performance-optimized queries
- **JSON Fields**: Flexible storage for dynamic configurations

### Frontend Architecture
- **Component-Based**: Reusable React components
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **API Integration**: Centralized API service layer
- **State Management**: React Hooks for local state

---

**Version**: 0.3.0 - Phase 1 Complete (SARS Tax Forms + Time & Attendance)
**Last Updated**: December 29, 2024

## 🎯 Phase 2 Implementation (December 2024) - Enhanced SARS Features ⭐ NEW

Phase 2 adds advanced tax compliance, automation, and workflow management:

### EMP501 Year-End Reconciliation ✅
- ✅ **Reconciliation Service**: `EMP501ReconciliationService` for annual tax reconciliation
  - Automatic reconciliation of IRP5 certificates with EMP201 returns
  - Discrepancy detection and reporting
  - PAYE, UIF, and SDL variance analysis
  - Reconciliation status tracking (draft, discrepancies_found, reconciled, approved)
  - CSV export for SARS submission
- ✅ **API Endpoints**:
  - `POST /api/sars/emp501/reconcile/:tax_period_id` - Generate reconciliation
  - `GET /api/sars/emp501/:id` - Get reconciliation details
  - `POST /api/sars/emp501/:id/approve` - Approve reconciliation
  - `GET /api/sars/emp501/:id/csv` - Download as CSV

### SARS Validation Engine ✅
- ✅ **Validation Service**: `SarsValidationService` with comprehensive rule engine
  - Pre-submission validation for IRP5, EMP201, and EMP501
  - 11 built-in validation rules (ID numbers, tax numbers, calculations)
  - Severity levels (error, warning, info)
  - Bulk validation support
  - Validation history tracking
- ✅ **Validation Rules**:
  - IRP5: ID number/tax number requirements, PAYE validation, remuneration checks
  - EMP201: Employee count, UIF calculations, liability totals, tax reference format
  - EMP501: IRP5 count, discrepancy thresholds, monthly returns completion
- ✅ **API Endpoints**:
  - `POST /api/sars/validate/irp5/:id` - Validate IRP5 certificate
  - `POST /api/sars/validate/emp201/:id` - Validate EMP201 return
  - `POST /api/sars/validate/emp501/:id` - Validate EMP501 reconciliation
  - `POST /api/sars/validate/irp5/bulk/:tax_period_id` - Bulk validate IRP5s

### Bulk Submission Workflows ✅
- ✅ **Submission Service**: `BulkSubmissionService` for batch processing
  - Queue-based submission system
  - Priority-based processing
  - Automatic retry on failure (configurable max retries)
  - Batch status tracking (queued, processing, completed, failed)
  - Submission result tracking with SARS reference numbers
- ✅ **API Endpoints**:
  - `POST /api/sars/submit/bulk/irp5/:tax_period_id` - Queue IRP5 batch
  - `POST /api/sars/submit/bulk/emp201/:tax_year` - Queue EMP201 batch
  - `POST /api/sars/submit/process/:batch_id` - Process batch
  - `GET /api/sars/submit/batch/:batch_id/status` - Get batch status
  - `POST /api/sars/submit/batch/:batch_id/retry` - Retry failed submissions

### Email Notification System ✅
- ✅ **Email Service**: `EmailNotificationService` with nodemailer integration
  - Automated IRP5 certificate email distribution
  - Professional HTML email templates
  - Attachment support (PDFs, CSVs)
  - Delivery tracking and retry logic
  - Email notification history
  - Bounce and failure handling
- ✅ **Features**:
  - Send individual IRP5 certificates to employees
  - Bulk email all IRP5 certificates for a tax year
  - Payslip email distribution (extensible)
  - Custom reminder notifications
  - Failed email retry mechanism
- ✅ **API Endpoints**:
  - `POST /api/sars/irp5/:id/email` - Email IRP5 to employee
  - `POST /api/sars/irp5/bulk/:tax_period_id/email` - Bulk email IRP5s

### Database Enhancements ✅
- ✅ **New Tables**:
  - `emp501_reconciliations` - Year-end reconciliation records
  - `email_notifications` - Email tracking and delivery status
  - `sars_validation_rules` - Configurable validation rules
  - `sars_validation_results` - Validation run results and history
  - `sars_submission_queue` - Bulk submission queue management

### Phase 2 Technical Stack
- **Email**: nodemailer with SMTP support
- **Queue Processing**: Database-backed queue with priority and retry
- **Validation**: Rule engine with JSON-based logic
- **Reconciliation**: Automated variance detection
- **Audit Trail**: Complete submission and validation history

### Phase 2 Benefits
- 📧 Automated tax certificate distribution to employees
- ✅ Pre-submission validation reduces SARS rejections
- 🔄 Batch processing for efficient bulk submissions
- 📊 Year-end reconciliation ensures data accuracy
- 📝 Complete audit trail for compliance
- ⚡ Retry logic for resilient operations

## 🎯 Phase 9 Implementation (December 2024) - Recruitment & Onboarding ⭐ NEW

Phase 9 adds complete hiring lifecycle management from job posting through employee onboarding:

### Job Requisition Management ✅
- ✅ **Requisition Service**: `JobRequisitionService` for job posting lifecycle
  - Job requisition creation with complete details (title, level, type, salary range)
  - Multi-stage approval workflow (draft → pending_approval → approved → posted)
  - Job posting to multiple channels (LinkedIn, job boards, career sites)
  - Vacancy management and headcount planning
  - Hiring manager and department assignment
  - Requisition closure tracking
- ✅ **API Endpoints**:
  - `POST /api/recruitment/requisitions` - Create job requisition
  - `POST /api/recruitment/requisitions/:id/approve` - Approve requisition
  - `POST /api/recruitment/requisitions/:id/post` - Post to job boards
  - `GET /api/recruitment/requisitions/open` - Get open positions

### Candidate & Application Tracking ✅
- ✅ **Candidate Service**: `CandidateService` for full ATS functionality
  - Candidate profile management with resume and document upload
  - Duplicate prevention (email-based matching)
  - Application source tracking (job board, referral, LinkedIn, etc.)
  - Multi-stage application pipeline (applied → screening → interview → offer → hired)
  - Stage progression with automatic status updates
  - Rejection workflow with reason tracking
  - Skills and experience tracking
- ✅ **API Endpoints**:
  - `POST /api/recruitment/candidates` - Create/get candidate (prevents duplicates)
  - `POST /api/recruitment/applications` - Submit application
  - `PUT /api/recruitment/applications/:id/stage` - Move to next stage
  - `POST /api/recruitment/applications/:id/reject` - Reject application
  - `GET /api/recruitment/candidates/:id` - Get candidate profile

### Interview Management ✅
- ✅ **Interview Service**: `InterviewService` for scheduling and feedback
  - Interview scheduling with multiple types (phone, video, in-person, panel, technical, HR)
  - Auto-increment interview rounds for multiple interviews
  - Panel interview support with multiple interviewers
  - Structured feedback collection
  - Rating system (1-5 scale) for skills, culture fit, communication, technical ability
  - Hiring recommendations (strong_yes, yes, maybe, no, strong_no)
  - Interview status tracking (scheduled, completed, cancelled, no_show)
- ✅ **API Endpoints**:
  - `POST /api/recruitment/interviews` - Schedule interview
  - `POST /api/recruitment/interviews/:id/feedback` - Submit feedback
  - `GET /api/recruitment/interviews/my-interviews` - Upcoming interviews for interviewer

### Offer Management ✅
- ✅ **Offer Service**: `OfferService` for offer lifecycle
  - Comprehensive offer creation (salary, bonuses, benefits, equity, probation, contract terms)
  - Offer approval workflow
  - Offer letter generation and delivery
  - Acceptance/decline tracking with reason capture
  - Offer expiry date management
  - Automatic application stage update to 'hired' on acceptance
  - Automatic candidate status update to 'hired'
  - Multiple offer versions per application
- ✅ **API Endpoints**:
  - `POST /api/recruitment/offers` - Create offer
  - `POST /api/recruitment/offers/:id/approve` - Approve offer
  - `POST /api/recruitment/offers/:id/send` - Send to candidate
  - `POST /api/recruitment/offers/:id/accept` - Accept offer
  - `POST /api/recruitment/offers/:id/decline` - Decline offer
  - `GET /api/recruitment/offers/pending` - Get pending offers

### Onboarding Workflows ✅
- ✅ **Onboarding Service**: `OnboardingService` for new hire automation
  - Template-based onboarding checklists (customizable by department/role)
  - Pre-configured 20-task standard template covering:
    - Pre-start tasks (contract, background checks, references)
    - Day 1 tasks (office tour, IT setup, introductions)
    - Week 1 tasks (HR orientation, policy review, payroll/benefits setup)
    - Month 1 tasks (training, 1-on-1s, performance expectations)
  - Automated task scheduling with offset days (supports pre-start tasks)
  - Task assignment to HR, IT, managers, and employees
  - Progress tracking with percentage completion
  - Document collection tracking (ID, tax forms, bank details, qualifications)
  - Equipment provisioning (laptop, monitor, phone, desk, chair, access card)
  - System access provisioning (email, HR system, payroll, ERP, CRM, Slack, VPN)
  - Status tracking for all components (pending, ordered, assigned, provisioned, etc.)
  - Buddy/mentor assignment
- ✅ **API Endpoints**:
  - `POST /api/recruitment/onboarding` - Create onboarding workflow
  - `POST /api/recruitment/onboarding/:id/checklist` - Generate from template
  - `POST /api/recruitment/onboarding/:id/task/complete` - Complete task
  - `POST /api/recruitment/onboarding/:id/document` - Add required document
  - `POST /api/recruitment/onboarding/:id/equipment` - Add equipment request
  - `POST /api/recruitment/onboarding/:id/access` - Add system access
  - `GET /api/recruitment/onboarding/:id` - Get workflow details

### Database Implementation ✅
- ✅ **New Tables** (15 tables created):
  - `job_requisitions` - Job posting management
  - `candidates` - Candidate profiles
  - `job_applications` - Application tracking
  - `interviews` - Interview scheduling
  - `interview_feedback` - Structured feedback collection
  - `job_offers` - Offer management
  - `onboarding_workflows` - Onboarding orchestration
  - `onboarding_checklist_templates` - Reusable templates
  - `onboarding_template_tasks` - Template task definitions
  - `onboarding_tasks` - Active onboarding tasks
  - `onboarding_documents` - Document collection
  - `onboarding_equipment` - Equipment provisioning
  - `onboarding_access` - System access tracking
- ✅ **Seeded Data**:
  - 1 standard onboarding template with 20 pre-configured tasks

### Phase 9 Technical Stack
- **Applicant Tracking**: Full ATS with duplicate prevention
- **Workflow Engine**: Status-based state machines for hiring pipeline
- **Template System**: Reusable onboarding templates with offset-based scheduling
- **Progress Tracking**: Percentage completion monitoring
- **Asset Management**: Equipment and access provisioning tracking

### Phase 9 Benefits
- 👥 Complete hiring lifecycle from requisition to onboarding
- 🔄 Automated workflow transitions reduce manual work
- 📋 Template-based onboarding ensures consistency
- 📊 Application pipeline visibility and tracking
- ✅ Structured interview feedback and ratings
- 📝 Comprehensive offer management with approval workflows
- 🎯 Task assignment and progress monitoring
- 🔧 Equipment and access provisioning tracking
- 📅 Pre-start and post-start task automation
- 🤝 Integration with employee records (automatic hire status update)
