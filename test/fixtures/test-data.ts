/**
 * Test Data Fixtures
 * Provides sample data for testing various modules
 */

import { v4 as uuidv4 } from 'uuid';
import pool from '../../src/config/database';

/**
 * Create a test performance cycle
 */
export async function createTestPerformanceCycle(country: string = 'ZAF') {
  const id = `test-cycle-${uuidv4()}`;

  await pool.execute(
    `INSERT INTO performance_cycles
    (id, name, description, cycle_type, start_date, end_date, review_start_date, review_end_date,
     status, country, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      id,
      'Test Performance Cycle 2024',
      'Annual performance review cycle for testing',
      'annual',
      '2024-01-01',
      '2024-12-31',
      '2024-12-01',
      '2024-12-31',
      country,
      'test-admin',
    ]
  );

  return id;
}

/**
 * Create a test goal
 */
export async function createTestGoal(employeeId: string, cycleId: string) {
  const id = `test-goal-${uuidv4()}`;

  await pool.execute(
    `INSERT INTO performance_goals
    (id, employee_id, cycle_id, title, description, goal_type, category, metric, target_value,
     start_date, due_date, weight, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      id,
      employeeId,
      cycleId,
      'Test Goal: Increase Sales',
      'Achieve 20% increase in quarterly sales',
      'individual',
      'performance',
      'Sales Revenue',
      '100000',
      '2024-01-01',
      '2024-12-31',
      50,
    ]
  );

  return id;
}

/**
 * Create a test loan application
 */
export async function createTestLoanApplication(employeeId: string, loanTypeId: string) {
  const id = `test-loan-app-${uuidv4()}`;
  const applicationNumber = `TEST-LOAN-${Math.floor(Math.random() * 10000)}`;

  await pool.execute(
    `INSERT INTO loan_applications
    (id, application_number, employee_id, loan_type_id, requested_amount, tenure_months,
     interest_rate, monthly_deduction, total_repayment, application_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'draft')`,
    [id, applicationNumber, employeeId, loanTypeId, 10000, 12, 5.0, 856.07, 10272.84]
  );

  return { id, applicationNumber };
}

/**
 * Create a test expense claim
 */
export async function createTestExpenseClaim(employeeId: string) {
  const id = `test-expense-${uuidv4()}`;
  const claimNumber = `TEST-EXP-${Math.floor(Math.random() * 10000)}`;

  await pool.execute(
    `INSERT INTO expense_claims
    (id, claim_number, employee_id, claim_date, period_start, period_end, status, total_amount)
    VALUES (?, ?, ?, CURDATE(), CURDATE(), CURDATE(), 'draft', 0)`,
    [id, claimNumber, employeeId]
  );

  return { id, claimNumber };
}

/**
 * Create a test expense item
 */
export async function createTestExpenseItem(claimId: string, categoryId: string, amount: number = 100) {
  const id = `test-expense-item-${uuidv4()}`;

  await pool.execute(
    `INSERT INTO expense_items
    (id, claim_id, category_id, expense_date, description, amount, currency)
    VALUES (?, ?, ?, CURDATE(), 'Test expense item', ?, 'ZAR')`,
    [id, claimId, categoryId, amount]
  );

  // Update claim total
  await pool.execute(
    `UPDATE expense_claims
     SET total_amount = total_amount + ?
     WHERE id = ?`,
    [amount, claimId]
  );

  return id;
}

/**
 * Clean up all test data
 */
export async function cleanupTestData() {
  const testTables = [
    'performance_goals',
    'performance_reviews',
    'performance_cycles',
    'loan_applications',
    'expense_items',
    'expense_claims',
  ];

  for (const table of testTables) {
    try {
      await pool.execute(`DELETE FROM ${table} WHERE id LIKE 'test-%'`);
    } catch (error) {
      // Table might not exist
      console.log(`Could not clean ${table}:`, error.message);
    }
  }
}

/**
 * Get a test loan type ID
 */
export async function getTestLoanType(country: string = 'ZAF'): Promise<string> {
  const [rows] = await pool.execute(
    'SELECT id FROM loan_types WHERE country = ? AND is_active = TRUE LIMIT 1',
    [country]
  );

  if (rows.length === 0) {
    throw new Error('No active loan types found for testing');
  }

  return rows[0].id;
}

/**
 * Get a test expense category ID
 */
export async function getTestExpenseCategory(): Promise<string> {
  const [rows] = await pool.execute(
    'SELECT id FROM expense_categories WHERE is_active = TRUE LIMIT 1'
  );

  if (rows.length === 0) {
    throw new Error('No active expense categories found for testing');
  }

  return rows[0].id;
}
