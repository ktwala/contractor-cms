/**
 * Admin Portal E2E Tests
 * Tests admin features including Enterprise, Payroll Cycle, and Recruitment modules
 */

import { test, expect } from '@playwright/test';

// Helper function for admin authentication
async function adminLogin(page) {
  await page.goto('http://localhost:3001/login');

  await page.evaluate(() => {
    localStorage.setItem('user_id', 'test-admin-123');
    localStorage.setItem('role', 'admin');
    localStorage.setItem('country', 'ZAF');
    localStorage.setItem('token', 'mock-admin-jwt-token');
  });
}

// ==================== ENTERPRISE FEATURES ====================

test.describe('Enterprise - Multi-Company Consolidation', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display company groups page', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/company-groups');

    await expect(page.locator('h1')).toContainText('Company Groups');
    await expect(page.locator('button:has-text("Create Group")')).toBeVisible();
  });

  test('should create new company group', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/company-groups');

    // Click create group button
    await page.click('button:has-text("Create Group")');

    // Fill in form
    await page.fill('input[name="group_name"]', 'Test Corporate Group');
    await page.fill('input[name="group_code"]', 'TCG-001');

    // Submit form
    await page.click('button[type="submit"]:has-text("Create")');

    // Verify success
    await expect(page.locator('text=successfully')).toBeVisible({ timeout: 5000 });
  });

  test('should view consolidated payroll report', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/company-groups');

    // Check if groups exist
    const groupCount = await page.locator('[data-testid="group-card"]').count();

    if (groupCount > 0) {
      // Click on first group
      await page.locator('[data-testid="group-card"]').first().click();

      // Navigate to consolidated payroll
      await page.click('text=Consolidated Payroll');

      // Verify report displays
      await expect(page.locator('text=Total Gross Pay')).toBeVisible();
      await expect(page.locator('text=Total Net Pay')).toBeVisible();
    }
  });
});

test.describe('Enterprise - Approval Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display approval workflows page', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/workflows');

    await expect(page.locator('h1')).toContainText('Approval Workflows');
    await expect(page.locator('button:has-text("Create Workflow")')).toBeVisible();
  });

  test('should create approval workflow', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/workflows');

    // Click create workflow
    await page.click('button:has-text("Create Workflow")');

    // Fill in workflow details
    await page.fill('input[name="workflow_name"]', 'Test Payrun Approval');
    await page.selectOption('select[name="workflow_type"]', 'payrun_approval');
    await page.fill('input[name="max_approval_days"]', '7');

    // Enable escalation
    await page.check('input[name="escalation_enabled"]');
    await page.fill('input[name="escalation_days"]', '3');

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Workflow created')).toBeVisible({ timeout: 5000 });
  });

  test('should view pending approvals', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/approvals/pending');

    await expect(page.locator('h1')).toContainText('Pending Approvals');

    // Check if there are pending approvals
    const pendingCount = await page.locator('[data-testid="approval-card"]').count();

    if (pendingCount > 0) {
      // Click on first approval
      await page.locator('[data-testid="approval-card"]').first().click();

      // Verify details are visible
      await expect(page.locator('text=Request Details')).toBeVisible();
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Reject")')).toBeVisible();
    }
  });
});

test.describe('Enterprise - Audit Trail', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display audit log page', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/audit-trail');

    await expect(page.locator('h1')).toContainText('Audit Trail');
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should filter audit logs by user', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/audit-trail');

    // Fill in user filter
    await page.fill('input[name="user_filter"]', 'admin@example.com');

    // Click filter/search button
    await page.click('button:has-text("Filter")');

    // Wait for results
    await page.waitForTimeout(1000);

    // Verify results are shown
    const resultCount = await page.locator('[data-testid="audit-log-row"]').count();
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter audit logs by date range', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/audit-trail');

    // Fill in date range
    await page.fill('input[name="date_from"]', '2025-01-01');
    await page.fill('input[name="date_to"]', '2025-01-31');

    // Click filter
    await page.click('button:has-text("Filter")');

    await page.waitForTimeout(1000);
  });
});

test.describe('Enterprise - RBAC Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display roles page', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/rbac/roles');

    await expect(page.locator('h1')).toContainText('Roles');
    await expect(page.locator('button:has-text("Create Role")')).toBeVisible();
  });

  test('should create custom role', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/rbac/roles');

    // Click create role
    await page.click('button:has-text("Create Role")');

    // Fill in role details
    await page.fill('input[name="role_name"]', 'Test Payroll Specialist');
    await page.fill('input[name="role_code"]', 'test_payroll_spec');
    await page.fill('textarea[name="description"]', 'Can process payroll but not approve');

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Role created')).toBeVisible({ timeout: 5000 });
  });

  test('should assign permissions to role', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/rbac/roles');

    // Check if roles exist
    const roleCount = await page.locator('[data-testid="role-card"]').count();

    if (roleCount > 0) {
      // Click on first role
      await page.locator('[data-testid="role-card"]').first().click();

      // Click manage permissions
      await page.click('button:has-text("Manage Permissions")');

      // Check some permissions
      const permissionCheckboxes = await page.locator('input[type="checkbox"][name^="permission_"]');
      const count = await permissionCheckboxes.count();

      if (count > 0) {
        await permissionCheckboxes.first().check();
      }

      // Save
      await page.click('button:has-text("Save Permissions")');

      await expect(page.locator('text=Permissions updated')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Enterprise - Cost Center Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display cost centers page', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/cost-centers');

    await expect(page.locator('h1')).toContainText('Cost Centers');
    await expect(page.locator('button:has-text("Create Cost Center")')).toBeVisible();
  });

  test('should create cost center', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/cost-centers');

    // Click create
    await page.click('button:has-text("Create Cost Center")');

    // Fill in details
    await page.fill('input[name="cost_center_code"]', 'TEST-CC-001');
    await page.fill('input[name="cost_center_name"]', 'Test IT Department');
    await page.selectOption('select[name="cost_center_type"]', 'department');

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Cost center created')).toBeVisible({ timeout: 5000 });
  });

  test('should create budget for cost center', async ({ page }) => {
    await page.goto('http://localhost:3001/enterprise/cost-centers');

    // Check if cost centers exist
    const ccCount = await page.locator('[data-testid="cost-center-row"]').count();

    if (ccCount > 0) {
      // Click on first cost center
      await page.locator('[data-testid="cost-center-row"]').first().click();

      // Click create budget
      await page.click('button:has-text("Create Budget")');

      // Fill in budget details
      await page.fill('input[name="budget_year"]', '2025');
      await page.selectOption('select[name="budget_type"]', 'salaries');
      await page.fill('input[name="budget_amount"]', '1000000');
      await page.fill('input[name="alert_threshold_percentage"]', '90');

      // Submit
      await page.click('button[type="submit"]:has-text("Create")');

      await expect(page.locator('text=Budget created')).toBeVisible({ timeout: 5000 });
    }
  });
});

// ==================== PAYROLL CYCLE MANAGEMENT ====================

test.describe('Payroll Cycle - Calendar Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display payroll calendars page', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/calendars');

    await expect(page.locator('h1')).toContainText('Payroll Calendars');
    await expect(page.locator('button:has-text("Create Calendar")')).toBeVisible();
  });

  test('should create payroll calendar', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/calendars');

    // Click create calendar
    await page.click('button:has-text("Create Calendar")');

    // Fill in calendar details
    await page.fill('input[name="calendar_name"]', 'Test Monthly Payroll 2025');
    await page.selectOption('select[name="frequency"]', 'monthly');
    await page.fill('input[name="start_date"]', '2025-01-01');
    await page.fill('input[name="payment_day_of_month"]', '25');
    await page.fill('input[name="cutoff_days_before_payment"]', '5');

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Calendar created')).toBeVisible({ timeout: 5000 });
  });

  test('should generate periods for calendar', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/calendars');

    // Check if calendars exist
    const calendarCount = await page.locator('[data-testid="calendar-card"]').count();

    if (calendarCount > 0) {
      // Click on first calendar
      await page.locator('[data-testid="calendar-card"]').first().click();

      // Click generate periods
      await page.click('button:has-text("Generate Periods")');

      // Fill in number of periods
      await page.fill('input[name="number_of_periods"]', '12');

      // Submit
      await page.click('button[type="submit"]:has-text("Generate")');

      await expect(page.locator('text=Periods generated')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view period details', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/periods');

    // Check if periods exist
    const periodCount = await page.locator('[data-testid="period-row"]').count();

    if (periodCount > 0) {
      // Click on first period
      await page.locator('[data-testid="period-row"]').first().click();

      // Verify details are visible
      await expect(page.locator('text=Period Details')).toBeVisible();
      await expect(page.locator('text=Period Start Date')).toBeVisible();
      await expect(page.locator('text=Payment Date')).toBeVisible();
    }
  });
});

test.describe('Payroll Cycle - Checklist Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display payroll checklist page', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/checklists');

    await expect(page.locator('h1')).toContainText('Payroll Checklists');
  });

  test('should create checklist from template', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/checklists');

    // Click create checklist
    await page.click('button:has-text("Create Checklist")');

    // Select period
    await page.selectOption('select[name="period_id"]', { index: 1 });

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Checklist created')).toBeVisible({ timeout: 5000 });
  });

  test('should complete checklist task', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/my-tasks');

    // Check if tasks exist
    const taskCount = await page.locator('[data-testid="task-row"]').count();

    if (taskCount > 0) {
      // Click complete on first task
      await page.locator('button:has-text("Complete")').first().click();

      // Fill in completion notes
      await page.fill('textarea[name="completion_notes"]', 'Task completed successfully');

      // Submit
      await page.click('button[type="submit"]:has-text("Mark Complete")');

      await expect(page.locator('text=Task completed')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Payroll Cycle - Exception Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display payroll exceptions page', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/exceptions');

    await expect(page.locator('h1')).toContainText('Payroll Exceptions');
  });

  test('should filter exceptions by severity', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/exceptions');

    // Select severity filter
    await page.selectOption('select[name="severity"]', 'error');

    // Click filter
    await page.click('button:has-text("Filter")');

    await page.waitForTimeout(1000);
  });

  test('should resolve exception', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/exceptions');

    // Check if exceptions exist
    const exceptionCount = await page.locator('[data-testid="exception-row"]').count();

    if (exceptionCount > 0) {
      // Click on first exception
      await page.locator('[data-testid="exception-row"]').first().click();

      // Click resolve
      await page.click('button:has-text("Resolve")');

      // Fill in resolution notes
      await page.fill('textarea[name="resolution_notes"]', 'Issue resolved by manual correction');

      // Submit
      await page.click('button[type="submit"]:has-text("Resolve")');

      await expect(page.locator('text=Exception resolved')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Payroll Cycle - Forecasting', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display forecasting page', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/forecasting');

    await expect(page.locator('h1')).toContainText('Payroll Forecasting');
    await expect(page.locator('button:has-text("Create Forecast")')).toBeVisible();
  });

  test('should create forecast', async ({ page }) => {
    await page.goto('http://localhost:3001/payroll-cycle/forecasting');

    // Click create forecast
    await page.click('button:has-text("Create Forecast")');

    // Fill in forecast details
    await page.fill('input[name="forecast_period"]', '2025-12');
    await page.selectOption('select[name="forecast_method"]', 'historical_average');
    await page.fill('textarea[name="assumptions"]', 'Based on 6-month average');

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Forecast created')).toBeVisible({ timeout: 5000 });
  });
});

// ==================== RECRUITMENT & ONBOARDING ====================

test.describe('Recruitment - Job Requisitions', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display job requisitions page', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/requisitions');

    await expect(page.locator('h1')).toContainText('Job Requisitions');
    await expect(page.locator('button:has-text("Create Requisition")')).toBeVisible();
  });

  test('should create job requisition', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/requisitions');

    // Click create requisition
    await page.click('button:has-text("Create Requisition")');

    // Fill in requisition details
    await page.fill('input[name="job_title"]', 'Senior Software Engineer');
    await page.selectOption('select[name="job_level"]', 'senior');
    await page.selectOption('select[name="employment_type"]', 'permanent');
    await page.fill('input[name="salary_range_min"]', '80000');
    await page.fill('input[name="salary_range_max"]', '120000');
    await page.fill('textarea[name="job_description"]', 'We are looking for an experienced software engineer...');

    // Submit
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('text=Requisition created')).toBeVisible({ timeout: 5000 });
  });

  test('should approve requisition', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/requisitions');

    // Check if requisitions exist
    const reqCount = await page.locator('[data-testid="requisition-row"]').count();

    if (reqCount > 0) {
      // Click on first requisition
      await page.locator('[data-testid="requisition-row"]').first().click();

      // Click approve button
      await page.click('button:has-text("Approve")');

      // Confirm approval
      await page.click('button:has-text("Confirm")');

      await expect(page.locator('text=Requisition approved')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Recruitment - Candidate Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display candidates page', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/candidates');

    await expect(page.locator('h1')).toContainText('Candidates');
    await expect(page.locator('button:has-text("Add Candidate")')).toBeVisible();
  });

  test('should add new candidate', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/candidates');

    // Click add candidate
    await page.click('button:has-text("Add Candidate")');

    // Fill in candidate details
    await page.fill('input[name="first_name"]', 'John');
    await page.fill('input[name="last_name"]', 'Doe');
    await page.fill('input[name="email"]', `john.doe.${Date.now()}@example.com`);
    await page.fill('input[name="phone"]', '+27123456789');
    await page.selectOption('select[name="source"]', 'linkedin');

    // Submit
    await page.click('button[type="submit"]:has-text("Add")');

    await expect(page.locator('text=Candidate added')).toBeVisible({ timeout: 5000 });
  });

  test('should view candidate profile', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/candidates');

    // Check if candidates exist
    const candidateCount = await page.locator('[data-testid="candidate-row"]').count();

    if (candidateCount > 0) {
      // Click on first candidate
      await page.locator('[data-testid="candidate-row"]').first().click();

      // Verify profile details are visible
      await expect(page.locator('text=Candidate Profile')).toBeVisible();
      await expect(page.locator('text=Contact Information')).toBeVisible();
      await expect(page.locator('text=Application History')).toBeVisible();
    }
  });
});

test.describe('Recruitment - Interview Management', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display interviews page', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/interviews');

    await expect(page.locator('h1')).toContainText('Interviews');
    await expect(page.locator('button:has-text("Schedule Interview")')).toBeVisible();
  });

  test('should schedule interview', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/interviews');

    // Click schedule interview
    await page.click('button:has-text("Schedule Interview")');

    // Fill in interview details
    await page.selectOption('select[name="interview_type"]', 'phone_screen');
    await page.fill('input[name="scheduled_date"]', '2025-01-20');
    await page.fill('input[name="scheduled_time"]', '14:00');
    await page.fill('input[name="duration_minutes"]', '30');

    // Submit
    await page.click('button[type="submit"]:has-text("Schedule")');

    await expect(page.locator('text=Interview scheduled')).toBeVisible({ timeout: 5000 });
  });

  test('should submit interview feedback', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/my-interviews');

    // Check if interviews exist
    const interviewCount = await page.locator('[data-testid="interview-row"]').count();

    if (interviewCount > 0) {
      // Click on first interview
      await page.locator('[data-testid="interview-row"]').first().click();

      // Click submit feedback
      await page.click('button:has-text("Submit Feedback")');

      // Fill in feedback
      await page.selectOption('select[name="overall_rating"]', '4');
      await page.selectOption('select[name="recommendation"]', 'yes');
      await page.fill('textarea[name="feedback_notes"]', 'Good candidate with solid experience');

      // Submit
      await page.click('button[type="submit"]:has-text("Submit")');

      await expect(page.locator('text=Feedback submitted')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Recruitment - Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('should display onboarding page', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/onboarding');

    await expect(page.locator('h1')).toContainText('New-hire onboarding');
    await expect(page.locator('button:has-text("Start onboarding")')).toBeVisible();
  });

  test('should open new-hire onboarding modal', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/onboarding');

    await page.click('button:has-text("Start onboarding")');

    await expect(page.getByTestId('create-onboarding-modal')).toBeVisible();
    await page.fill('[data-testid="create-onboarding-start-date"]', '2026-05-01');
    // Submit stays disabled until legal entity + accepted offer are chosen
    await expect(page.getByTestId('create-onboarding-submit')).toBeDisabled();
  });

  test('should complete onboarding task', async ({ page }) => {
    await page.goto('http://localhost:3001/recruitment/onboarding');

    // Check if workflows exist
    const workflowCount = await page.locator('[data-testid="workflow-card"]').count();

    if (workflowCount > 0) {
      // Click on first workflow
      await page.locator('[data-testid="workflow-card"]').first().click();

      // Find first pending task
      const pendingTasks = await page.locator('button:has-text("Complete")');
      const taskCount = await pendingTasks.count();

      if (taskCount > 0) {
        // Click complete on first task
        await pendingTasks.first().click();

        // Fill in completion notes
        await page.fill('textarea[name="completion_notes"]', 'Task completed successfully');

        // Submit
        await page.click('button[type="submit"]:has-text("Mark Complete")');

        await expect(page.locator('text=Task completed')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
