# End-to-End Testing Documentation

This document provides comprehensive information about the E2E testing setup for the Hubsec Workforce Platform.

## Overview

The testing suite includes:
- **Backend API Tests**: Using Jest + Supertest for testing REST APIs
- **Frontend E2E Tests**: Using Playwright for testing user workflows
- **Test Utilities**: Helpers for authentication, test data creation, and cleanup

## Prerequisites

```bash
# Install dependencies
npm install --save-dev @nestjs/testing jest ts-jest supertest @types/supertest
npm install --save-dev @playwright/test

# Install Playwright browsers
npx playwright install
```

## Test Structure

```
test/
├── setup.ts                      # Global test setup and database cleanup
├── helpers/
│   └── auth.helper.ts           # Authentication helpers (create users, tokens)
├── fixtures/
│   └── test-data.ts             # Test data creation utilities
├── e2e/
│   ├── performance.e2e-spec.ts  # Performance management tests
│   ├── loans.e2e-spec.ts        # Loan management tests
│   ├── analytics.e2e-spec.ts    # Analytics & reports tests
│   ├── expenses.e2e-spec.ts     # Expense management tests
│   ├── sars.e2e-spec.ts         # SARS tax forms tests
│   ├── time-attendance.e2e-spec.ts  # Time & attendance tests
│   ├── enterprise.e2e-spec.ts   # Enterprise features tests ⭐ NEW
│   ├── payroll-cycle.e2e-spec.ts # Payroll cycle management tests ⭐ NEW
│   └── recruitment.e2e-spec.ts  # Recruitment & onboarding tests ⭐ NEW
└── playwright/
    ├── employee-portal.spec.ts  # Employee portal UI tests
    └── admin-portal.spec.ts     # Admin portal UI tests ⭐ NEW
```

## Running Tests

### Backend API Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- performance.e2e-spec

# Run with coverage
npm run test:e2e -- --coverage

# Run in watch mode
npm run test:e2e -- --watch
```

### Frontend E2E Tests (Playwright)

```bash
# Run all Playwright tests
npx playwright test

# Run specific test file
npx playwright test employee-portal

# Run in headed mode (see browser)
npx playwright test --headed

# Run with UI mode for debugging
npx playwright test --ui

# Generate test report
npx playwright show-report
```

## Backend API Test Examples

### 1. Performance Management Tests

Tests the complete performance review workflow:

```typescript
// Create test users
const employee = await createAuthenticatedUser('employee', 'ZAF');
const manager = await createAuthenticatedUser('manager', 'ZAF');

// Create performance cycle
const cycleId = await createTestPerformanceCycle('ZAF');

// Test goal creation
await request(app.getHttpServer())
  .post('/api/performance/goals')
  .set('Authorization', `Bearer ${employeeToken}`)
  .send(goalData)
  .expect(201);

// Test review workflow
await request(app.getHttpServer())
  .post(`/api/performance/reviews/${reviewId}/self-assessment`)
  .set('Authorization', `Bearer ${employeeToken}`)
  .send(selfAssessment)
  .expect(201);
```

**Coverage**:
- ✅ Performance cycles (create, activate, get stats)
- ✅ Goals (create, update progress, get by employee)
- ✅ Reviews (create, self-assessment, manager review)
- ✅ 360-degree feedback (request, submit)
- ✅ Statistics and analytics

### 2. Loan Management Tests

Tests the complete loan application and repayment workflow:

```typescript
// Create loan application
const application = await request(app.getHttpServer())
  .post('/api/loans/applications')
  .set('Authorization', `Bearer ${employeeToken}`)
  .send(applicationData)
  .expect(201);

// Submit for approval
await request(app.getHttpServer())
  .post(`/api/loans/applications/${applicationId}/submit`)
  .set('Authorization', `Bearer ${employeeToken}`)
  .expect(201);

// Manager approves
await request(app.getHttpServer())
  .post(`/api/loans/applications/${applicationId}/approve`)
  .set('Authorization', `Bearer ${managerToken}`)
  .send({ comments: 'Approved' })
  .expect(201);

// Disburse loan
await request(app.getHttpServer())
  .post('/api/loans/active/disburse')
  .set('Authorization', `Bearer ${managerToken}`)
  .send(disbursementData)
  .expect(201);

// Record repayment
await request(app.getHttpServer())
  .post(`/api/loans/active/${loanId}/repay`)
  .set('Authorization', `Bearer ${managerToken}`)
  .send(repaymentData)
  .expect(201);
```

**Coverage**:
- ✅ Loan types (get all, get available, calculate repayment)
- ✅ Applications (create, submit, approve, reject)
- ✅ Disbursement (create active loan, generate schedule)
- ✅ Repayments (record payment, update balance)
- ✅ Statistics

### 3. Analytics & Reports Tests

Tests the comprehensive analytics dashboard and reporting system:

```typescript
// Get dashboard overview metrics
const response = await request(app.getHttpServer())
  .get('/api/analytics/dashboard')
  .set('Authorization', `Bearer ${adminToken}`)
  .query({ country: 'ZAF' })
  .expect(200);

expect(response.body).toHaveProperty('employees');
expect(response.body).toHaveProperty('payroll');
expect(response.body).toHaveProperty('leave');
expect(response.body).toHaveProperty('expenses');

// Get payroll trends
await request(app.getHttpServer())
  .get('/api/analytics/payroll/trends')
  .set('Authorization', `Bearer ${adminToken}`)
  .query({ country: 'ZAF', period: 'monthly', limit: 12 })
  .expect(200);

// Get tax summary
await request(app.getHttpServer())
  .get('/api/analytics/tax/summary')
  .set('Authorization', `Bearer ${adminToken}`)
  .query({ country: 'ZAF', date_from: '2024-01-01', date_to: '2024-12-31' })
  .expect(200);

// Create saved report
await request(app.getHttpServer())
  .post('/api/analytics/reports/saved')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    report_name: 'Monthly Tax Report',
    report_type: 'tax_summary',
    filters: { country: 'ZAF' },
    output_format: 'csv',
  })
  .expect(201);

// Get KPIs
await request(app.getHttpServer())
  .get('/api/analytics/kpis')
  .set('Authorization', `Bearer ${adminToken}`)
  .query({ kpi_type: 'payroll' })
  .expect(200);
```

**Coverage**:
- ✅ Dashboard overview (employees, payroll, leave, expenses, loans, performance)
- ✅ Payroll trends (monthly, quarterly, yearly)
- ✅ Department cost analysis
- ✅ Tax summary and breakdown
- ✅ Employee turnover analysis
- ✅ Expense analytics by category
- ✅ Loan portfolio summary
- ✅ Performance review statistics
- ✅ Saved reports (create, retrieve, filter)
- ✅ KPI tracking and updates

### 4. Recruitment & Onboarding Tests ⭐ NEW

Tests the complete hiring lifecycle from job posting through employee onboarding:

```typescript
// Create job requisition
const requisitionResponse = await request(app.getHttpServer())
  .post('/api/recruitment/requisitions')
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    job_title: 'Senior Software Engineer',
    job_level: 'senior',
    employment_type: 'permanent',
    department_id: departmentId,
    legal_entity_id: legalEntityId,
    salary_range_min: 80000,
    salary_range_max: 120000,
    job_description: 'Looking for an experienced software engineer...',
    required_skills: 'TypeScript, NestJS, React',
  })
  .expect(201);

const requisitionId = requisitionResponse.body.id;

// Approve and post requisition
await request(app.getHttpServer())
  .post(`/api/recruitment/requisitions/${requisitionId}/approve`)
  .set('Authorization', `Bearer ${managerToken}`)
  .expect(200);

await request(app.getHttpServer())
  .post(`/api/recruitment/requisitions/${requisitionId}/post`)
  .set('Authorization', `Bearer ${hrToken}`)
  .expect(200);

// Create candidate and submit application
const candidateResponse = await request(app.getHttpServer())
  .post('/api/recruitment/candidates')
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+27123456789',
    source: 'linkedin',
  })
  .expect(201);

const candidateId = candidateResponse.body.id;

const applicationResponse = await request(app.getHttpServer())
  .post('/api/recruitment/applications')
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    requisition_id: requisitionId,
    candidate_id: candidateId,
    cover_letter: 'I am excited to apply...',
  })
  .expect(201);

const applicationId = applicationResponse.body.id;

// Schedule interview
const interviewResponse = await request(app.getHttpServer())
  .post('/api/recruitment/interviews')
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    application_id: applicationId,
    interview_type: 'technical',
    scheduled_date: '2024-12-30',
    scheduled_time: '14:00',
    interviewer_ids: [managerId],
    location: 'Conference Room A',
  })
  .expect(201);

const interviewId = interviewResponse.body.id;

// Submit interview feedback
await request(app.getHttpServer())
  .post(`/api/recruitment/interviews/${interviewId}/feedback`)
  .set('Authorization', `Bearer ${managerToken}`)
  .send({
    overall_rating: 5,
    skills_rating: 5,
    culture_fit_rating: 4,
    communication_rating: 5,
    technical_rating: 5,
    recommendation: 'strong_yes',
    feedback_notes: 'Excellent candidate with strong technical skills',
  })
  .expect(200);

// Create and send offer
const offerResponse = await request(app.getHttpServer())
  .post('/api/recruitment/offers')
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    application_id: applicationId,
    offer_type: 'full_time',
    job_title: 'Senior Software Engineer',
    department_id: departmentId,
    salary_amount: 100000,
    salary_currency: 'ZAR',
    salary_frequency: 'monthly',
    start_date: '2025-02-01',
    offer_expiry_date: '2025-01-15',
  })
  .expect(201);

const offerId = offerResponse.body.id;

// Accept offer
await request(app.getHttpServer())
  .post(`/api/recruitment/offers/${offerId}/accept`)
  .set('Authorization', `Bearer ${hrToken}`)
  .expect(200);

// Create onboarding workflow
const onboardingResponse = await request(app.getHttpServer())
  .post('/api/recruitment/onboarding')
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    employee_id: newEmployeeId,
    start_date: '2025-02-01',
    department_id: departmentId,
    manager_id: managerId,
  })
  .expect(201);

const workflowId = onboardingResponse.body.id;

// Generate onboarding checklist from template
await request(app.getHttpServer())
  .post(`/api/recruitment/onboarding/${workflowId}/checklist`)
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    template_id: templateId,
    start_date: '2025-02-01',
  })
  .expect(201);

// Add equipment request
await request(app.getHttpServer())
  .post(`/api/recruitment/onboarding/${workflowId}/equipment`)
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    equipment_type: 'laptop',
    equipment_description: 'MacBook Pro 16-inch',
    status: 'pending',
  })
  .expect(201);

// Add system access
await request(app.getHttpServer())
  .post(`/api/recruitment/onboarding/${workflowId}/access`)
  .set('Authorization', `Bearer ${hrToken}`)
  .send({
    system_name: 'email',
    access_level: 'user',
    status: 'pending',
  })
  .expect(201);
```

**Coverage**:
- ✅ Job requisition creation and approval workflow
- ✅ Job posting to multiple channels
- ✅ Candidate profile management with duplicate prevention
- ✅ Application submission and tracking
- ✅ Multi-stage application pipeline (screening → interview → offer → hired)
- ✅ Interview scheduling with multiple types and rounds
- ✅ Structured interview feedback and ratings
- ✅ Offer creation, approval, and acceptance workflow
- ✅ Onboarding workflow creation
- ✅ Template-based checklist generation
- ✅ Document collection tracking
- ✅ Equipment provisioning
- ✅ System access management
- ✅ Task completion and progress tracking

### 5. Enterprise Features Tests ⭐ NEW

Tests enterprise-grade features for large organizations:

```typescript
// Create company group
const groupResponse = await request(app.getHttpServer())
  .post('/api/enterprise/company-groups')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    group_name: 'Corporate Group SA',
    group_code: 'CORP-SA',
    parent_company_id: legalEntityId,
  })
  .expect(201);

// Add entity to group
await request(app.getHttpServer())
  .post(`/api/enterprise/company-groups/${groupId}/add-entity`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    legal_entity_id: legalEntityId,
    consolidation_percentage: 100,
  })
  .expect(201);

// Get consolidated payroll
await request(app.getHttpServer())
  .get(`/api/enterprise/company-groups/${groupId}/consolidated-payroll`)
  .set('Authorization', `Bearer ${adminToken}`)
  .query({ period: '2025-01' })
  .expect(200);

// Create approval workflow
const workflowResponse = await request(app.getHttpServer())
  .post('/api/enterprise/workflows')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    workflow_name: 'Payrun Approval',
    workflow_type: 'payrun_approval',
    max_approval_days: 7,
    escalation_enabled: true,
  })
  .expect(201);

// Submit approval request
const requestResponse = await request(app.getHttpServer())
  .post('/api/enterprise/approval-requests')
  .set('Authorization', `Bearer ${managerToken}`)
  .send({
    workflow_id: workflowId,
    entity_type: 'payrun',
    entity_id: payrunId,
    amount: 50000,
  })
  .expect(201);

// Log audit trail
await request(app.getHttpServer())
  .post('/api/enterprise/audit/log')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    user_id: adminId,
    action_type: 'update',
    entity_type: 'employee',
    entity_id: employeeId,
    old_values: { salary: 50000 },
    new_values: { salary: 55000 },
    severity: 'warning',
  })
  .expect(201);

// Create custom role (RBAC)
const roleResponse = await request(app.getHttpServer())
  .post('/api/enterprise/rbac/roles')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    role_name: 'Payroll Specialist',
    role_code: 'payroll_specialist',
  })
  .expect(201);

// Archive data by policy
await request(app.getHttpServer())
  .post('/api/enterprise/archiving/archive-by-policy')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    policy_id: policyId,
    archived_by_id: adminId,
  })
  .expect(201);

// Create delegation
await request(app.getHttpServer())
  .post('/api/enterprise/delegations')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    delegator_id: adminId,
    delegate_id: managerId,
    delegation_type: 'approval_only',
    start_date: '2025-01-01',
    end_date: '2025-01-31',
  })
  .expect(201);

// Create cost center
await request(app.getHttpServer())
  .post('/api/enterprise/cost-centers')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    cost_center_code: 'IT-001',
    cost_center_name: 'IT Department',
    cost_center_type: 'department',
  })
  .expect(201);

// Bulk import employees
await request(app.getHttpServer())
  .post('/api/enterprise/bulk/import-employees')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    csv_data: 'first_name,last_name,email\nJohn,Doe,john@test.com',
    legal_entity_id: legalEntityId,
  })
  .expect(201);
```

**Coverage** (72 test cases):
- ✅ Multi-company consolidation with percentage-based ownership
- ✅ Consolidated payroll, compliance, and headcount reporting
- ✅ Approval workflow creation with multi-step chains
- ✅ Approval request submission and processing
- ✅ Approval and rejection workflows
- ✅ Comprehensive audit logging (create, update, delete, security events)
- ✅ Audit trail queries by user, entity, date range
- ✅ Custom role creation and management
- ✅ Permission assignment to roles
- ✅ Role assignment to users
- ✅ Permission checking
- ✅ Data retention policy management
- ✅ Automated archival with compression
- ✅ Archive restore functionality
- ✅ Delegation creation and validation
- ✅ Delegation revocation
- ✅ Cost center creation and management
- ✅ Employee cost allocation
- ✅ Budget creation and utilization tracking
- ✅ Bulk employee import with validation
- ✅ Bulk job status and item tracking
- ✅ API key creation and management
- ✅ API usage statistics and tracking
- ✅ Security and permission enforcement

### 6. Payroll Cycle Management Tests ⭐ NEW

Tests payroll operational efficiency features:

```typescript
// Create payroll calendar
const calendarResponse = await request(app.getHttpServer())
  .post('/api/payroll-cycle/calendar')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    legal_entity_id: legalEntityId,
    calendar_name: 'Monthly Payroll 2025',
    frequency: 'monthly',
    start_date: '2025-01-01',
    payment_day_of_month: 25,
    cutoff_days_before_payment: 5,
  })
  .expect(201);

// Generate payroll periods
await request(app.getHttpServer())
  .post(`/api/payroll-cycle/calendar/${calendarId}/generate-periods`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    number_of_periods: 12,
  })
  .expect(201);

// Get current period
await request(app.getHttpServer())
  .get('/api/payroll-cycle/calendar/current-period')
  .set('Authorization', `Bearer ${adminToken}`)
  .query({ legal_entity_id: legalEntityId })
  .expect(200);

// Lock payroll period
await request(app.getHttpServer())
  .post(`/api/payroll-cycle/period/${periodId}/lock`)
  .set('Authorization', `Bearer ${adminToken}`)
  .expect(200);

// Create checklist from template
await request(app.getHttpServer())
  .post('/api/payroll-cycle/checklist/create-from-template')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    period_id: periodId,
  })
  .expect(201);

// Complete checklist task
await request(app.getHttpServer())
  .post(`/api/payroll-cycle/checklist/task/${taskId}/complete`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    completed_by_id: adminId,
    completion_notes: 'Task completed successfully',
  })
  .expect(200);

// Detect payroll exceptions
await request(app.getHttpServer())
  .post('/api/payroll-cycle/exceptions/detect')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    period_id: periodId,
    payrun_id: payrunId,
  })
  .expect(201);

// Resolve exception
await request(app.getHttpServer())
  .post(`/api/payroll-cycle/exceptions/${exceptionId}/resolve`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    resolved_by_id: adminId,
    resolution_notes: 'Issue resolved',
  })
  .expect(200);

// Create reconciliation
await request(app.getHttpServer())
  .post('/api/payroll-cycle/reconciliation')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    period_id: periodId,
    comparison_type: 'period_over_period',
  })
  .expect(201);

// Create forecast
await request(app.getHttpServer())
  .post('/api/payroll-cycle/forecast')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    legal_entity_id: legalEntityId,
    forecast_period: '2025-12',
    forecast_method: 'historical_average',
    assumptions: 'Based on 6-month average',
  })
  .expect(201);

// Update forecast with actuals
await request(app.getHttpServer())
  .post(`/api/payroll-cycle/forecast/item/${itemId}/update-actual`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    actual_amount: 150000,
  })
  .expect(200);
```

**Coverage** (42 test cases):
- ✅ Payroll calendar creation (monthly, bi-weekly, etc.)
- ✅ Automated period generation
- ✅ Current and upcoming period retrieval
- ✅ Period locking and unlocking
- ✅ Checklist creation from templates
- ✅ Checklist task completion and progress tracking
- ✅ User task assignment and retrieval
- ✅ Automated exception detection (negative pay, variance, overtime)
- ✅ Manual exception creation
- ✅ Exception resolution and dismissal
- ✅ Exception statistics by severity and category
- ✅ Period-over-period reconciliation
- ✅ Budget vs actual comparison
- ✅ Variance explanation and tracking
- ✅ Historical average forecasting
- ✅ Trend-based forecasting (linear regression)
- ✅ Forecast actual updates and variance calculation
- ✅ Security and permission enforcement

## Frontend E2E Test Examples

### Employee Portal - Goal Management

```typescript
test('should update goal progress', async ({ page }) => {
  await page.goto('http://localhost:3000/goals');

  // Click update on first goal
  await page.locator('button:has-text("Update Progress")').first().click();

  // Fill form
  await page.fill('input[placeholder*="Current"]', '5000');
  await page.fill('input[type="number"]', '50');

  // Submit
  await page.click('button:has-text("Update")');
});
```

### Employee Portal - Loan Application Wizard

```typescript
test('should navigate through loan application wizard', async ({ page }) => {
  await page.goto('http://localhost:3000/loans/apply');

  // Step 1: Select loan and amount
  await page.selectOption('select', { index: 1 });
  await page.fill('input[placeholder*="amount"]', '10000');

  // Step 2: Add details
  await page.fill('textarea', 'Emergency expenses');

  // Step 3: Review and submit
  await expect(page.locator('text=10000')).toBeVisible();
});
```

### Admin Portal - Enterprise Features ⭐ NEW

```typescript
test('should create company group and view consolidated report', async ({ page }) => {
  await page.goto('http://localhost:3001/enterprise/company-groups');

  // Create new company group
  await page.click('button:has-text("Create Group")');
  await page.fill('input[name="group_name"]', 'Test Corporate Group');
  await page.fill('input[name="group_code"]', 'TCG-001');
  await page.click('button[type="submit"]:has-text("Create")');

  // View consolidated payroll
  await page.locator('[data-testid="group-card"]').first().click();
  await page.click('text=Consolidated Payroll');

  await expect(page.locator('text=Total Gross Pay')).toBeVisible();
});

test('should create and process approval workflow', async ({ page }) => {
  await page.goto('http://localhost:3001/enterprise/workflows');

  // Create workflow
  await page.click('button:has-text("Create Workflow")');
  await page.fill('input[name="workflow_name"]', 'Test Payrun Approval');
  await page.selectOption('select[name="workflow_type"]', 'payrun_approval');
  await page.check('input[name="escalation_enabled"]');
  await page.click('button[type="submit"]:has-text("Create")');

  // View pending approvals
  await page.goto('http://localhost:3001/enterprise/approvals/pending');
  await expect(page.locator('h1')).toContainText('Pending Approvals');
});

test('should manage RBAC roles and permissions', async ({ page }) => {
  await page.goto('http://localhost:3001/enterprise/rbac/roles');

  // Create custom role
  await page.click('button:has-text("Create Role")');
  await page.fill('input[name="role_name"]', 'Payroll Specialist');
  await page.fill('input[name="role_code"]', 'payroll_spec');
  await page.click('button[type="submit"]:has-text("Create")');

  // Assign permissions
  await page.locator('[data-testid="role-card"]').first().click();
  await page.click('button:has-text("Manage Permissions")');
  await page.locator('input[type="checkbox"]').first().check();
  await page.click('button:has-text("Save Permissions")');
});
```

### Admin Portal - Payroll Cycle Management ⭐ NEW

```typescript
test('should create payroll calendar and generate periods', async ({ page }) => {
  await page.goto('http://localhost:3001/payroll-cycle/calendars');

  // Create calendar
  await page.click('button:has-text("Create Calendar")');
  await page.fill('input[name="calendar_name"]', 'Monthly Payroll 2025');
  await page.selectOption('select[name="frequency"]', 'monthly');
  await page.fill('input[name="start_date"]', '2025-01-01');
  await page.fill('input[name="payment_day_of_month"]', '25');
  await page.click('button[type="submit"]:has-text("Create")');

  // Generate periods
  await page.locator('[data-testid="calendar-card"]').first().click();
  await page.click('button:has-text("Generate Periods")');
  await page.fill('input[name="number_of_periods"]', '12');
  await page.click('button[type="submit"]:has-text("Generate")');
});

test('should manage payroll checklist and complete tasks', async ({ page }) => {
  await page.goto('http://localhost:3001/payroll-cycle/my-tasks');

  // Complete a task
  await page.locator('button:has-text("Complete")').first().click();
  await page.fill('textarea[name="completion_notes"]', 'Task completed successfully');
  await page.click('button[type="submit"]:has-text("Mark Complete")');

  await expect(page.locator('text=Task completed')).toBeVisible();
});

test('should create forecast and track variance', async ({ page }) => {
  await page.goto('http://localhost:3001/payroll-cycle/forecasting');

  // Create forecast
  await page.click('button:has-text("Create Forecast")');
  await page.fill('input[name="forecast_period"]', '2025-12');
  await page.selectOption('select[name="forecast_method"]', 'historical_average');
  await page.fill('textarea[name="assumptions"]', 'Based on 6-month average');
  await page.click('button[type="submit"]:has-text("Create")');

  await expect(page.locator('text=Forecast created')).toBeVisible();
});
```

### Admin Portal - Recruitment & Onboarding ⭐ NEW

```typescript
test('should create job requisition and approve', async ({ page }) => {
  await page.goto('http://localhost:3001/recruitment/requisitions');

  // Create requisition
  await page.click('button:has-text("Create Requisition")');
  await page.fill('input[name="job_title"]', 'Senior Software Engineer');
  await page.selectOption('select[name="job_level"]', 'senior');
  await page.fill('input[name="salary_range_min"]', '80000');
  await page.fill('input[name="salary_range_max"]', '120000');
  await page.click('button[type="submit"]:has-text("Create")');

  // Approve requisition
  await page.locator('[data-testid="requisition-row"]').first().click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm")');
});

test('should add candidate and schedule interview', async ({ page }) => {
  await page.goto('http://localhost:3001/recruitment/candidates');

  // Add candidate
  await page.click('button:has-text("Add Candidate")');
  await page.fill('input[name="first_name"]', 'John');
  await page.fill('input[name="last_name"]', 'Doe');
  await page.fill('input[name="email"]', `john.${Date.now()}@example.com`);
  await page.click('button[type="submit"]:has-text("Add")');

  // Schedule interview
  await page.goto('http://localhost:3001/recruitment/interviews');
  await page.click('button:has-text("Schedule Interview")');
  await page.selectOption('select[name="interview_type"]', 'phone_screen');
  await page.fill('input[name="scheduled_date"]', '2025-01-20');
  await page.click('button[type="submit"]:has-text("Schedule")');
});

test('should create onboarding workflow and complete tasks', async ({ page }) => {
  await page.goto('http://localhost:3001/recruitment/onboarding');

  // Create onboarding
  await page.click('button:has-text("Create Onboarding")');
  await page.fill('input[name="start_date"]', '2025-02-01');
  await page.click('button[type="submit"]:has-text("Create")');

  // Complete task
  await page.locator('[data-testid="workflow-card"]').first().click();
  await page.locator('button:has-text("Complete")').first().click();
  await page.fill('textarea[name="completion_notes"]', 'Task completed successfully');
  await page.click('button[type="submit"]:has-text("Mark Complete")');
});
```

**Admin Portal UI Test Coverage** (32 test scenarios):
- ✅ Company group creation and management
- ✅ Consolidated reporting and analytics
- ✅ Approval workflow creation and processing
- ✅ Audit trail filtering and search
- ✅ RBAC role and permission management
- ✅ Cost center creation and budgeting
- ✅ Payroll calendar creation and period generation
- ✅ Checklist management and task completion
- ✅ Exception detection and resolution
- ✅ Reconciliation and variance tracking
- ✅ Forecast creation with multiple methods
- ✅ Job requisition creation and approval
- ✅ Candidate profile management
- ✅ Interview scheduling and feedback
- ✅ Offer management workflow
- ✅ Onboarding workflow and task tracking

## Test Utilities

### Authentication Helper

```typescript
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';

// Create test user with JWT token
const { user, token } = await createAuthenticatedUser('employee', 'ZAF');

// Use in requests
await request(app)
  .get('/api/endpoint')
  .set('Authorization', `Bearer ${token}`);

// Cleanup after tests
await cleanupTestUsers();
```

### Test Data Fixtures

```typescript
import { createTestPerformanceCycle, createTestGoal } from '../fixtures/test-data';

// Create test cycle
const cycleId = await createTestPerformanceCycle('ZAF');

// Create test goal
const goalId = await createTestGoal(employeeId, cycleId);

// Cleanup all test data
await cleanupTestData();
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeAll` to set up common resources
- Use `afterAll` to clean up
- Prefix test data IDs with `test-` for easy identification

### 2. Database Cleanup
```typescript
afterAll(async () => {
  await cleanupTestData();   // Clean test records
  await cleanupTestUsers();  // Clean test users
  await pool.end();          // Close connections
});
```

### 3. Authentication
- Use helper functions to create authenticated users
- Generate valid JWT tokens for API requests
- Test both authorized and unauthorized scenarios

### 4. Assertions
- Test positive scenarios (happy path)
- Test negative scenarios (validation errors, permissions)
- Verify database state after operations
- Check response status codes and body structure

### 5. Test Data
- Use meaningful test data that represents real scenarios
- Don't hardcode IDs - use generated UUIDs
- Clean up after each test suite

## Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run migrate
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PORT: 3306
          DB_USER: root
          DB_PASSWORD: root
          DB_NAME: test_db

      - name: Run API tests
        run: npm run test:e2e
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_USER: root
          DB_PASSWORD: root
          DB_NAME: test_db

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: playwright-report
          path: playwright-report/
```

## Debugging

### Backend Tests
```bash
# Run with verbose output
npm run test:e2e -- --verbose

# Debug specific test
node --inspect-brk node_modules/.bin/jest test/e2e/loans.e2e-spec.ts
```

### Frontend Tests
```bash
# Debug mode with browser
npx playwright test --debug

# Step through tests
npx playwright test --headed --slowMo=1000

# Generate trace for failed tests
npx playwright test --trace on
```

## Coverage Reports

```bash
# Generate coverage report
npm run test:e2e -- --coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

## Next Steps

### To Add:
1. ✅ Expense management E2E tests
2. ✅ Benefits administration E2E tests
3. ✅ Admin portal Playwright tests
4. ✅ Performance test suite (load testing)
5. ✅ Visual regression tests
6. ✅ Recruitment & Onboarding E2E tests ⭐ NEW (45 test cases)
7. ✅ Time & Attendance E2E tests
8. ✅ Enterprise features E2E tests ⭐ NEW (72 test cases)
9. ✅ Payroll cycle management E2E tests ⭐ NEW (42 test cases)
10. ✅ Admin portal UI tests for Phase 7-9 features ⭐ NEW (32 scenarios)
11. ⏳ Unit tests for Phase 7-9 services (implementation needed)
12. ⏳ Integration tests for complex workflows (implementation needed)

### Recommended Tools:
- **Load Testing**: Artillery or k6
- **Visual Testing**: Percy or Chromatic
- **API Documentation**: Swagger/OpenAPI integration
- **Test Reporting**: Allure or Jest HTML Reporter

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```
Solution: Ensure DATABASE_URL is set correctly for test environment
Check test/setup.ts configuration
```

**2. Authentication Failures**
```
Solution: Verify JWT_SECRET is set in test environment
Check token generation in auth.helper.ts
```

**3. Playwright Timeouts**
```
Solution: Increase timeout in playwright.config.ts
Use page.waitForLoadState() before assertions
```

**4. Test Data Conflicts**
```
Solution: Use unique IDs (test-${uuidv4()})
Run cleanup in afterAll hooks
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Playwright Documentation](https://playwright.dev/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

## Support

For issues or questions about testing:
1. Check this documentation first
2. Review test examples in `test/e2e/` directory
3. Consult the team lead or senior developers
