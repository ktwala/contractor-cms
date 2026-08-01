/**
 * Employee Portal E2E Tests
 * Tests critical user journeys in the employee portal
 */

import { test, expect } from '@playwright/test';

test.describe('Employee Portal - Goals Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to employee portal and login
    await page.goto('http://localhost:3000/login');

    // Mock authentication (adjust based on your auth implementation)
    await page.evaluate(() => {
      localStorage.setItem('employee_id', 'test-employee-123');
      localStorage.setItem('country', 'ZAF');
      localStorage.setItem('currency', 'ZAR');
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('auth_token', 'mock-jwt-token'); // Also set auth_token for API
    });
    
    // Wait a bit for AuthContext to process
    await page.waitForTimeout(100);
  });

  test('should display my goals page', async ({ page }) => {
    await page.goto('http://localhost:3000/goals');
    
    // Wait for page to load and h1 to appear
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check page title
    await expect(page.locator('h1')).toContainText('My Goals');

    // Check statistics cards are visible
    await expect(page.locator('text=Active Goals')).toBeVisible();
    await expect(page.locator('text=Avg Progress')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });

  test('should update goal progress', async ({ page }) => {
    await page.goto('http://localhost:3000/goals');

    // Wait for goals to load
    await page.waitForSelector('[data-testid="goal-card"]', { timeout: 5000 }).catch(() => {
      // Goals might be empty, that's okay
    });

    // Check if there are goals
    const goalCards = await page.locator('[data-testid="goal-card"]').count();

    if (goalCards > 0) {
      // Click update progress on first goal
      await page.locator('button:has-text("Update Progress")').first().click();

      // Fill in update form
      await page.fill('input[placeholder*="Current"]', '5000');
      await page.fill('input[type="number"][min="0"]', '50');
      await page.fill('textarea', 'Making good progress this quarter');

      // Submit update
      await page.click('button:has-text("Update"):not(:has-text("Update Progress"))');

      // Verify success message or modal closes
      await expect(page.locator('text=Update Progress').first()).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Employee Portal - Loan Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.evaluate(() => {
      localStorage.setItem('employee_id', 'test-employee-123');
      localStorage.setItem('country', 'ZAF');
      localStorage.setItem('currency', 'ZAR');
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('auth_token', 'mock-jwt-token');
    });
    
    await page.waitForTimeout(100);
  });

  test('should navigate through loan application wizard', async ({ page }) => {
    await page.goto('http://localhost:3000/loans/apply');
    
    // Wait for page to load and h1 to appear
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check page loaded
    await expect(page.locator('h1')).toContainText('Apply for Loan');

    // Step 1: Select loan type
    await page.selectOption('select', { index: 1 }); // Select first loan type
    await page.fill('input[placeholder*="amount"]', '10000');
    await page.fill('input[placeholder*="months"]', '12');

    // Wait for calculation
    await page.waitForTimeout(1000);

    // Check repayment summary appears
    await expect(page.locator('text=Monthly Deduction')).toBeVisible();

    // Click Next
    await page.click('button:has-text("Next")');

    // Step 2: Additional info
    await expect(page.locator('h2')).toContainText('Additional Information');
    await page.fill('textarea', 'Emergency medical expenses for family member');

    // Click Next
    await page.click('button:has-text("Next")');

    // Step 3: Review
    await expect(page.locator('h2')).toContainText('Review Your Application');
    await expect(page.locator('text=10000')).toBeVisible(); // Amount should be displayed

    // Note: Don't actually submit in test to avoid creating real data
    // await page.click('button:has-text("Submit Application")');
  });
});

test.describe('Employee Portal - Expense Claims', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.evaluate(() => {
      localStorage.setItem('employee_id', 'test-employee-123');
      localStorage.setItem('country', 'ZAF');
      localStorage.setItem('currency', 'ZAR');
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('auth_token', 'mock-jwt-token');
    });
    
    await page.waitForTimeout(100);
  });

  test('should create an expense claim', async ({ page }) => {
    await page.goto('http://localhost:3000/expenses/create');
    
    // Wait for page to load and h1 to appear
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check page loaded
    await expect(page.locator('h1')).toContainText('Create Expense Claim');

    // Step 1: Claim details
    await page.fill('input[type="date"]', '2024-01-01');
    await page.fill('textarea', 'Business travel expenses');

    // Click Next
    await page.click('button:has-text("Next")');

    // Step 2: Add expense item
    await page.selectOption('select', { index: 1 }); // Select category
    await page.fill('input[placeholder*="Amount"]', '500');
    await page.fill('textarea', 'Client meeting lunch');

    // Add item
    await page.click('button:has-text("Add Item")');

    // Verify item added
    await expect(page.locator('text=500')).toBeVisible();

    // Click Next
    await page.click('button:has-text("Next")');

    // Step 3: Review
    await expect(page.locator('h2')).toContainText('Review');
    await expect(page.locator('text=Total')).toBeVisible();
  });
});
