/**
 * Test Setup and Global Configuration
 * Runs before all tests to set up the testing environment
 */

import pool from '../src/config/database';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// Global test timeout
jest.setTimeout(30000);

/**
 * Clean up database before all tests
 */
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');

  // Ensure we're in test mode
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run in NODE_ENV=test');
  }

  // Clean up test data (optional - uncomment if needed)
  // await cleanDatabase();
});

/**
 * Clean up after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  // Close database connections
  await pool.end();
});

/**
 * Clean database helper (use with caution!)
 */
export async function cleanDatabase() {
  // Only allow in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database cleaning only allowed in test environment');
  }

  // Clean tables in reverse dependency order
  const tables = [
    'loan_history',
    'loan_repayments',
    'loan_schedules',
    'active_loans',
    'loan_approvals',
    'loan_applications',
    'expense_history',
    'expense_reimbursements',
    'expense_approvals',
    'expense_receipts',
    'expense_items',
    'expense_claims',
    'benefit_history',
    'benefit_enrollments',
    'performance_history',
    'performance_feedback',
    'performance_review_ratings',
    'performance_reviews',
    'performance_goals',
    'performance_improvement_plans',
  ];

  for (const table of tables) {
    try {
      await pool.execute(`DELETE FROM ${table} WHERE id LIKE 'test-%'`);
    } catch (error) {
      // Table might not exist, continue
      console.log(`Note: Could not clean table ${table}:`, error.message);
    }
  }
}
