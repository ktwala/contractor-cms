-- Test Database Setup Script
-- Run with: psql -U postgres -d payroll_platform -f scripts/test-db.sql

-- Create enums
DO $$ BEGIN
  CREATE TYPE country AS ENUM ('LS', 'ZA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE currency AS ENUM ('LSL', 'ZAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pay_frequency AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('ACTIVE', 'TERMINATED', 'ON_LEAVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pay_run_status AS ENUM ('DRAFT', 'SNAPSHOT', 'CALCULATING', 'CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pay_item_type AS ENUM ('EARNING', 'DEDUCTION', 'TAX', 'EMPLOYER_CONTRIB', 'ALLOWANCE', 'BONUS', 'STATUTORY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('CHEQUE', 'SAVINGS', 'TRANSMISSION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE residency_status AS ENUM ('RESIDENT', 'NON_RESIDENT', 'TEMPORARY_RESIDENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Legal Entity
CREATE TABLE IF NOT EXISTS legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  country country NOT NULL DEFAULT 'ZA',
  registration_no VARCHAR(100),
  tax_no VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pay Group
CREATE TABLE IF NOT EXISTS pay_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  country country NOT NULL DEFAULT 'ZA',
  currency currency NOT NULL DEFAULT 'ZAR',
  pay_frequency pay_frequency NOT NULL DEFAULT 'MONTHLY',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pay Period
CREATE TABLE IF NOT EXISTS pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_group_id UUID NOT NULL REFERENCES pay_groups(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_date DATE,
  tax_year INT NOT NULL,
  period_number INT NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Employee
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  national_id VARCHAR(50),
  email VARCHAR(255),
  status employee_status DEFAULT 'ACTIVE',
  hire_date DATE NOT NULL,
  termination_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Employment (links employee to pay group)
CREATE TABLE IF NOT EXISTS employments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  pay_group_id UUID NOT NULL REFERENCES pay_groups(id),
  country country NOT NULL DEFAULT 'ZA',
  job_title VARCHAR(255),
  cost_center VARCHAR(100),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Compensation
CREATE TABLE IF NOT EXISTS compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  base_salary DECIMAL(18,2) NOT NULL,
  currency currency NOT NULL DEFAULT 'ZAR',
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bank Account
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  bank_name VARCHAR(100) NOT NULL,
  account_number_enc VARCHAR(255) NOT NULL,
  masked_account_number VARCHAR(20) NOT NULL,
  branch_code VARCHAR(20),
  account_type account_type,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tax Profile
CREATE TABLE IF NOT EXISTS tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  country country NOT NULL,
  residency_status residency_status NOT NULL DEFAULT 'RESIDENT',
  tin VARCHAR(50),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pay Item
CREATE TABLE IF NOT EXISTS pay_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type pay_item_type NOT NULL,
  taxable BOOLEAN DEFAULT true,
  gl_account VARCHAR(50),
  sort_order INT DEFAULT 100,
  currency currency DEFAULT 'ZAR',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- PayRun
CREATE TABLE IF NOT EXISTS pay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_group_id UUID NOT NULL REFERENCES pay_groups(id),
  pay_period_id UUID NOT NULL REFERENCES pay_periods(id),
  name VARCHAR(255),
  status pay_run_status DEFAULT 'DRAFT',
  type VARCHAR(20) DEFAULT 'REGULAR',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Employee Result
CREATE TABLE IF NOT EXISTS employee_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payrun_id UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  gross DECIMAL(18,2) NOT NULL DEFAULT 0,
  taxable_income DECIMAL(18,2) NOT NULL DEFAULT 0,
  paye DECIMAL(18,2) NOT NULL DEFAULT 0,
  deductions_total DECIMAL(18,2) NOT NULL DEFAULT 0,
  net DECIMAL(18,2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT NOW(),
  calc_trace JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(payrun_id, employee_id)
);

-- Pay Line
CREATE TABLE IF NOT EXISTS pay_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_result_id UUID NOT NULL REFERENCES employee_results(id) ON DELETE CASCADE,
  pay_item_id UUID NOT NULL REFERENCES pay_items(id),
  amount DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Line Item Input
CREATE TABLE IF NOT EXISTS line_item_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payrun_id UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  pay_item_id UUID NOT NULL REFERENCES pay_items(id),
  amount DECIMAL(18,2) NOT NULL,
  currency currency DEFAULT 'ZAR',
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recurring Input
CREATE TABLE IF NOT EXISTS recurring_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  pay_item_id UUID NOT NULL REFERENCES pay_items(id),
  amount DECIMAL(18,2) NOT NULL,
  currency currency DEFAULT 'ZAR',
  start_date DATE NOT NULL,
  end_date DATE,
  meta JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert test data
INSERT INTO legal_entities (id, code, name, country, registration_no, tax_no)
VALUES ('11111111-1111-1111-1111-111111111111', 'ACME-ZA', 'Acme Corporation (Pty) Ltd', 'ZA', '2020/123456/07', '9123456789')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pay_groups (id, code, name, legal_entity_id, country, currency, pay_frequency)
VALUES ('22222222-2222-2222-2222-222222222222', 'ZA-MONTHLY-001', 'ZA Monthly Salaried', '11111111-1111-1111-1111-111111111111', 'ZA', 'ZAR', 'MONTHLY')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pay_periods (id, pay_group_id, period_start, period_end, payment_date, tax_year, period_number, status)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '2025-01-01', '2025-01-31', '2025-01-25', 2025, 1, 'OPEN')
ON CONFLICT DO NOTHING;

-- Pay Items
INSERT INTO pay_items (id, code, name, type, taxable, sort_order) VALUES
('44444444-4444-4444-4444-444444444001', 'BASIC', 'Basic Salary', 'EARNING', true, 10),
('44444444-4444-4444-4444-444444444002', 'OVERTIME', 'Overtime', 'EARNING', true, 20),
('44444444-4444-4444-4444-444444444003', 'COMMISSION', 'Commission', 'EARNING', true, 30),
('44444444-4444-4444-4444-444444444004', 'TRAVEL', 'Travel Allowance', 'ALLOWANCE', false, 40),
('44444444-4444-4444-4444-444444444005', 'PAYE', 'Pay As You Earn', 'TAX', false, 100),
('44444444-4444-4444-4444-444444444006', 'UIF_EE', 'UIF Employee', 'STATUTORY', false, 110),
('44444444-4444-4444-4444-444444444007', 'UIF_ER', 'UIF Employer', 'EMPLOYER_CONTRIB', false, 120),
('44444444-4444-4444-4444-444444444008', 'SDL', 'Skills Development Levy', 'EMPLOYER_CONTRIB', false, 130)
ON CONFLICT (code) DO NOTHING;

-- Test Employees
INSERT INTO employees (id, employee_no, first_name, last_name, national_id, email, hire_date) VALUES
('55555555-5555-5555-5555-555555555001', 'EMP001', 'John', 'Smith', '9001015800089', 'john.smith@acme.co.za', '2020-01-15'),
('55555555-5555-5555-5555-555555555002', 'EMP002', 'Sarah', 'Johnson', '8505025800087', 'sarah.johnson@acme.co.za', '2019-06-01'),
('55555555-5555-5555-5555-555555555003', 'EMP003', 'Michael', 'Williams', '7803015800085', 'michael.williams@acme.co.za', '2021-03-15')
ON CONFLICT (employee_no) DO NOTHING;

-- Employments
INSERT INTO employments (employee_id, legal_entity_id, pay_group_id, country, job_title, cost_center, effective_from) VALUES
('55555555-5555-5555-5555-555555555001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ZA', 'Software Developer', 'IT', '2020-01-15'),
('55555555-5555-5555-5555-555555555002', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ZA', 'Senior Developer', 'IT', '2019-06-01'),
('55555555-5555-5555-5555-555555555003', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ZA', 'Project Manager', 'PMO', '2021-03-15')
ON CONFLICT DO NOTHING;

-- Compensations
INSERT INTO compensations (employee_id, base_salary, currency, effective_from) VALUES
('55555555-5555-5555-5555-555555555001', 45000.00, 'ZAR', '2024-01-01'),
('55555555-5555-5555-5555-555555555002', 65000.00, 'ZAR', '2024-01-01'),
('55555555-5555-5555-5555-555555555003', 85000.00, 'ZAR', '2024-01-01')
ON CONFLICT DO NOTHING;

-- Bank Accounts
INSERT INTO bank_accounts (employee_id, bank_name, account_number_enc, masked_account_number, branch_code, account_type, effective_from) VALUES
('55555555-5555-5555-5555-555555555001', 'First National Bank', '62012345678', '****5678', '250655', 'CHEQUE', '2020-01-15'),
('55555555-5555-5555-5555-555555555002', 'Standard Bank', '041234567890', '****7890', '051001', 'CHEQUE', '2019-06-01'),
('55555555-5555-5555-5555-555555555003', 'Absa Bank', '40712345678', '****5678', '632005', 'SAVINGS', '2021-03-15')
ON CONFLICT DO NOTHING;

-- Tax Profiles
INSERT INTO tax_profiles (employee_id, country, residency_status, tin, effective_from) VALUES
('55555555-5555-5555-5555-555555555001', 'ZA', 'RESIDENT', '9001015800089', '2020-01-15'),
('55555555-5555-5555-5555-555555555002', 'ZA', 'RESIDENT', '8505025800087', '2019-06-01'),
('55555555-5555-5555-5555-555555555003', 'ZA', 'RESIDENT', '7803015800085', '2021-03-15')
ON CONFLICT DO NOTHING;

-- Create a test PayRun
INSERT INTO pay_runs (id, pay_group_id, pay_period_id, name, status)
VALUES ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'January 2025 Payrun', 'CALCULATED')
ON CONFLICT DO NOTHING;

-- Employee Results
INSERT INTO employee_results (id, payrun_id, employee_id, gross, taxable_income, paye, deductions_total, net) VALUES
('77777777-7777-7777-7777-777777777001', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555001', 45000.00, 45000.00, 8235.42, 8685.42, 36314.58),
('77777777-7777-7777-7777-777777777002', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555002', 65000.00, 65000.00, 14735.42, 15385.42, 49614.58),
('77777777-7777-7777-7777-777777777003', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555003', 85000.00, 85000.00, 22035.42, 22885.42, 62114.58)
ON CONFLICT DO NOTHING;

-- Pay Lines
INSERT INTO pay_lines (employee_result_id, pay_item_id, amount) VALUES
('77777777-7777-7777-7777-777777777001', '44444444-4444-4444-4444-444444444001', 45000.00),
('77777777-7777-7777-7777-777777777001', '44444444-4444-4444-4444-444444444005', -8235.42),
('77777777-7777-7777-7777-777777777001', '44444444-4444-4444-4444-444444444006', -450.00),
('77777777-7777-7777-7777-777777777002', '44444444-4444-4444-4444-444444444001', 65000.00),
('77777777-7777-7777-7777-777777777002', '44444444-4444-4444-4444-444444444005', -14735.42),
('77777777-7777-7777-7777-777777777002', '44444444-4444-4444-4444-444444444006', -650.00),
('77777777-7777-7777-7777-777777777003', '44444444-4444-4444-4444-444444444001', 85000.00),
('77777777-7777-7777-7777-777777777003', '44444444-4444-4444-4444-444444444005', -22035.42),
('77777777-7777-7777-7777-777777777003', '44444444-4444-4444-4444-444444444006', -850.00)
ON CONFLICT DO NOTHING;

\echo 'Database setup complete!'

-- Verify data
SELECT 'Legal Entities:' as info, count(*) as count FROM legal_entities;
SELECT 'Pay Groups:' as info, count(*) as count FROM pay_groups;
SELECT 'Pay Periods:' as info, count(*) as count FROM pay_periods;
SELECT 'Pay Items:' as info, count(*) as count FROM pay_items;
SELECT 'Employees:' as info, count(*) as count FROM employees;
SELECT 'PayRuns:' as info, count(*) as count FROM pay_runs;
SELECT 'Employee Results:' as info, count(*) as count FROM employee_results;
