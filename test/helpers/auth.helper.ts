/**
 * Authentication Helper for Tests
 * Provides utilities for creating test users and generating auth tokens
 */

import { sign } from 'jsonwebtoken';
import pool from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  country: string;
  role: string;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(
  role: 'employee' | 'manager' | 'admin' = 'employee',
  country: string = 'ZAF'
): Promise<TestUser> {
  const id = `test-user-${uuidv4()}`;
  const employeeNumber = `TEST${Math.floor(Math.random() * 10000)}`;

  const user: TestUser = {
    id,
    email: `test.${employeeNumber.toLowerCase()}@example.com`,
    employee_number: employeeNumber,
    first_name: 'Test',
    last_name: 'User',
    country,
    role,
  };

  // Insert test user into employees table
  await pool.execute(
    `INSERT INTO employees
    (id, employee_number, email, first_name, last_name, country, hire_date, status)
    VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'active')`,
    [id, employeeNumber, user.email, user.first_name, user.last_name, country]
  );

  // Insert into users table if it exists
  try {
    await pool.execute(
      `INSERT INTO users (id, email, password_hash, role, employee_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, user.email, 'test-hash', role, id]
    );
  } catch (error) {
    // Users table might not exist
  }

  return user;
}

/**
 * Generate a JWT token for test user
 */
export function generateAuthToken(user: TestUser): string {
  const secret = process.env.JWT_SECRET || 'test-secret-key';

  return sign(
    {
      id: user.id,
      email: user.email,
      employee_id: user.id,
      role: user.role,
    },
    secret,
    { expiresIn: '1h' }
  );
}

/**
 * Create test user with auth token
 */
export async function createAuthenticatedUser(
  role: 'employee' | 'manager' | 'admin' = 'employee',
  country: string = 'ZAF'
): Promise<{ user: TestUser; token: string }> {
  const user = await createTestUser(role, country);
  const token = generateAuthToken(user);

  return { user, token };
}

/**
 * Clean up test users
 */
export async function cleanupTestUsers() {
  await pool.execute(`DELETE FROM employees WHERE id LIKE 'test-user-%'`);

  try {
    await pool.execute(`DELETE FROM users WHERE id LIKE 'test-user-%'`);
  } catch (error) {
    // Table might not exist
  }
}
