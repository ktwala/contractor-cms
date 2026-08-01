-- Migration: Create benefits administration tables
-- Version: 009
-- Description: Complete benefits administration system for medical aid, pension, provident fund, and statutory benefits

-- =====================================================
-- BENEFIT PLANS AND CONFIGURATION
-- =====================================================

-- Benefit plan types (medical aid, pension, provident fund, etc.)
CREATE TABLE IF NOT EXISTS benefit_plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  benefit_type ENUM(
    'medical_aid',
    'pension_fund',
    'provident_fund',
    'retirement_annuity',
    'group_life',
    'disability_insurance',
    'gap_cover',
    'funeral_cover',
    'uif',
    'sdl',
    'workmen_compensation',
    'car_allowance',
    'housing_subsidy',
    'other'
  ) NOT NULL,
  provider_name VARCHAR(200),
  provider_code VARCHAR(50),
  description TEXT,
  is_statutory BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allows_dependents BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  tax_treatment ENUM('taxable', 'non_taxable', 'tax_deductible', 'fringe_benefit') DEFAULT 'taxable',
  effective_date DATE NOT NULL,
  end_date DATE,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_benefit_type (benefit_type),
  INDEX idx_provider (provider_name),
  INDEX idx_active (is_active),

  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Benefit plan options (e.g., Hospital Plan, Comprehensive, Classic, etc.)
CREATE TABLE IF NOT EXISTS benefit_plan_options (
  id VARCHAR(36) PRIMARY KEY,
  plan_id VARCHAR(36) NOT NULL,
  option_name VARCHAR(200) NOT NULL,
  option_code VARCHAR(50),
  coverage_level ENUM('individual', 'member_spouse', 'member_children', 'family') NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plan_id (plan_id),
  INDEX idx_active (is_active),

  FOREIGN KEY (plan_id) REFERENCES benefit_plans(id) ON DELETE CASCADE,
  UNIQUE KEY unique_plan_option (plan_id, option_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Benefit contribution rates (employee and employer portions)
CREATE TABLE IF NOT EXISTS benefit_rates (
  id VARCHAR(36) PRIMARY KEY,
  plan_id VARCHAR(36) NOT NULL,
  option_id VARCHAR(36),
  rate_type ENUM('fixed_amount', 'percentage_of_salary', 'age_based', 'income_bracket', 'family_size') NOT NULL,

  -- For fixed amount
  employee_amount DECIMAL(15, 2),
  employer_amount DECIMAL(15, 2),

  -- For percentage
  employee_percentage DECIMAL(5, 2),
  employer_percentage DECIMAL(5, 2),

  -- For income brackets
  min_income DECIMAL(15, 2),
  max_income DECIMAL(15, 2),

  -- For age-based
  min_age INT,
  max_age INT,

  -- For family size
  family_size INT,

  -- Limits and caps
  monthly_cap DECIMAL(15, 2),
  annual_cap DECIMAL(15, 2),

  effective_date DATE NOT NULL,
  end_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plan_id (plan_id),
  INDEX idx_option_id (option_id),
  INDEX idx_effective_date (effective_date),

  FOREIGN KEY (plan_id) REFERENCES benefit_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES benefit_plan_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- EMPLOYEE ENROLLMENTS
-- =====================================================

-- Employee benefit enrollments
CREATE TABLE IF NOT EXISTS employee_benefits (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(36) NOT NULL,
  option_id VARCHAR(36),

  enrollment_date DATE NOT NULL,
  effective_date DATE NOT NULL,
  end_date DATE,

  status ENUM(
    'pending_approval',
    'pending_documents',
    'active',
    'suspended',
    'cancelled',
    'rejected'
  ) NOT NULL DEFAULT 'pending_approval',

  -- Contribution amounts (calculated or overridden)
  employee_contribution DECIMAL(15, 2) NOT NULL,
  employer_contribution DECIMAL(15, 2) NOT NULL,
  total_contribution DECIMAL(15, 2) GENERATED ALWAYS AS (employee_contribution + employer_contribution) STORED,

  -- Override default rates
  is_custom_rate BOOLEAN NOT NULL DEFAULT false,
  custom_rate_reason TEXT,

  -- Provider details
  member_number VARCHAR(100),
  provider_reference VARCHAR(100),

  -- Approval workflow
  approved_by VARCHAR(36),
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT,

  -- Documents
  documents_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by VARCHAR(36),
  verified_at TIMESTAMP NULL,

  notes TEXT,

  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_employee_id (employee_id),
  INDEX idx_plan_id (plan_id),
  INDEX idx_status (status),
  INDEX idx_effective_date (effective_date),
  INDEX idx_end_date (end_date),

  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (plan_id) REFERENCES benefit_plans(id),
  FOREIGN KEY (option_id) REFERENCES benefit_plan_options(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee benefit dependents
CREATE TABLE IF NOT EXISTS employee_benefit_dependents (
  id VARCHAR(36) PRIMARY KEY,
  enrollment_id VARCHAR(36) NOT NULL,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  relationship ENUM('spouse', 'child', 'partner', 'parent', 'other') NOT NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('male', 'female', 'other'),

  -- Identification
  id_number VARCHAR(50),
  passport_number VARCHAR(50),

  -- Additional info
  is_student BOOLEAN NOT NULL DEFAULT false,
  is_disabled BOOLEAN NOT NULL DEFAULT false,

  -- Provider details
  provider_member_number VARCHAR(100),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_date DATE NOT NULL,
  end_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_active (is_active),

  FOREIGN KEY (enrollment_id) REFERENCES employee_benefits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DEDUCTIONS AND CONTRIBUTIONS
-- =====================================================

-- Monthly benefit deductions (linked to payslips)
CREATE TABLE IF NOT EXISTS benefit_deductions (
  id VARCHAR(36) PRIMARY KEY,
  payslip_id VARCHAR(36) NOT NULL,
  enrollment_id VARCHAR(36) NOT NULL,

  deduction_period_start DATE NOT NULL,
  deduction_period_end DATE NOT NULL,

  employee_deduction DECIMAL(15, 2) NOT NULL,
  employer_contribution DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) GENERATED ALWAYS AS (employee_deduction + employer_contribution) STORED,

  -- Arrears handling
  is_arrears BOOLEAN NOT NULL DEFAULT false,
  arrears_months INT DEFAULT 0,
  arrears_amount DECIMAL(15, 2) DEFAULT 0,

  -- Pro-rata calculations
  is_prorated BOOLEAN NOT NULL DEFAULT false,
  prorata_days INT,
  prorata_factor DECIMAL(5, 4),

  calculation_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_payslip_id (payslip_id),
  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_period (deduction_period_start, deduction_period_end),

  FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES employee_benefits(id),
  UNIQUE KEY unique_deduction (payslip_id, enrollment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PROVIDER FILES AND RECONCILIATION
-- =====================================================

-- Benefit provider payment files
CREATE TABLE IF NOT EXISTS benefit_provider_files (
  id VARCHAR(36) PRIMARY KEY,
  plan_id VARCHAR(36) NOT NULL,

  file_type ENUM('contribution', 'member_changes', 'reconciliation', 'claims') NOT NULL,
  file_format ENUM('csv', 'xlsx', 'xml', 'custom') NOT NULL,

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  total_employees INT NOT NULL,
  total_employee_contributions DECIMAL(15, 2) NOT NULL,
  total_employer_contributions DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) GENERATED ALWAYS AS (total_employee_contributions + total_employer_contributions) STORED,

  file_path VARCHAR(500),
  file_name VARCHAR(255),
  file_size INT,
  checksum VARCHAR(64),

  status ENUM('pending', 'generated', 'sent', 'acknowledged', 'failed') NOT NULL DEFAULT 'pending',

  generated_by VARCHAR(36),
  generated_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  acknowledged_at TIMESTAMP NULL,

  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plan_id (plan_id),
  INDEX idx_period (period_start, period_end),
  INDEX idx_status (status),

  FOREIGN KEY (plan_id) REFERENCES benefit_plans(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BENEFIT DOCUMENTS
-- =====================================================

-- Employee benefit documents (enrollment forms, certificates, etc.)
CREATE TABLE IF NOT EXISTS benefit_documents (
  id VARCHAR(36) PRIMARY KEY,
  enrollment_id VARCHAR(36) NOT NULL,

  document_type ENUM(
    'enrollment_form',
    'marriage_certificate',
    'birth_certificate',
    'id_document',
    'proof_of_address',
    'bank_details',
    'medical_certificate',
    'disability_certificate',
    'student_card',
    'other'
  ) NOT NULL,

  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),

  uploaded_by VARCHAR(36),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by VARCHAR(36),
  verified_at TIMESTAMP NULL,

  notes TEXT,

  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_document_type (document_type),
  INDEX idx_verified (verified),

  FOREIGN KEY (enrollment_id) REFERENCES employee_benefits(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- AUDIT AND HISTORY
-- =====================================================

-- Benefit enrollment history (track all changes)
CREATE TABLE IF NOT EXISTS benefit_enrollment_history (
  id VARCHAR(36) PRIMARY KEY,
  enrollment_id VARCHAR(36) NOT NULL,

  action ENUM('created', 'approved', 'rejected', 'activated', 'suspended', 'cancelled', 'rate_changed', 'dependent_added', 'dependent_removed') NOT NULL,

  old_status VARCHAR(50),
  new_status VARCHAR(50),

  old_employee_contribution DECIMAL(15, 2),
  new_employee_contribution DECIMAL(15, 2),

  old_employer_contribution DECIMAL(15, 2),
  new_employer_contribution DECIMAL(15, 2),

  description TEXT,
  metadata JSON,

  changed_by VARCHAR(36) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_action (action),
  INDEX idx_changed_at (changed_at),

  FOREIGN KEY (enrollment_id) REFERENCES employee_benefits(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BENEFIT STATEMENTS
-- =====================================================

-- Annual benefit statements
CREATE TABLE IF NOT EXISTS benefit_statements (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  enrollment_id VARCHAR(36),

  statement_year INT NOT NULL,
  statement_type ENUM('annual', 'certificate_of_service', 'tax_certificate') NOT NULL,

  total_employee_contributions DECIMAL(15, 2) NOT NULL,
  total_employer_contributions DECIMAL(15, 2) NOT NULL,
  total_contributions DECIMAL(15, 2) GENERATED ALWAYS AS (total_employee_contributions + total_employer_contributions) STORED,

  file_path VARCHAR(500),
  file_name VARCHAR(255),

  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_to_employee_at TIMESTAMP NULL,

  INDEX idx_employee_id (employee_id),
  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_year (statement_year),

  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (enrollment_id) REFERENCES employee_benefits(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Add benefit-related permissions
INSERT IGNORE INTO permissions (id, name, description, created_at) VALUES
('ben-001', 'benefit.plan.create', 'Create benefit plans', NOW()),
('ben-002', 'benefit.plan.view', 'View benefit plans', NOW()),
('ben-003', 'benefit.plan.edit', 'Edit benefit plans', NOW()),
('ben-004', 'benefit.plan.delete', 'Delete benefit plans', NOW()),
('ben-005', 'benefit.enrollment.create', 'Create benefit enrollments', NOW()),
('ben-006', 'benefit.enrollment.view', 'View benefit enrollments', NOW()),
('ben-007', 'benefit.enrollment.approve', 'Approve benefit enrollments', NOW()),
('ben-008', 'benefit.enrollment.cancel', 'Cancel benefit enrollments', NOW()),
('ben-009', 'benefit.provider.file.generate', 'Generate provider files', NOW()),
('ben-010', 'benefit.provider.file.download', 'Download provider files', NOW()),
('ben-011', 'benefit.reports.view', 'View benefit reports', NOW()),
('ben-012', 'benefit.deduction.override', 'Override benefit deductions', NOW());

-- =====================================================
-- SEED DATA (South African Common Benefits)
-- =====================================================

-- Insert common South African benefit types
INSERT IGNORE INTO benefit_plans (id, name, benefit_type, provider_name, is_statutory, is_active, allows_dependents, requires_approval, tax_treatment, effective_date, created_at) VALUES
('uif-001', 'Unemployment Insurance Fund (UIF)', 'uif', 'Department of Employment and Labour', true, true, false, false, 'tax_deductible', '2024-01-01', NOW()),
('sdl-001', 'Skills Development Levy (SDL)', 'sdl', 'SARS', true, true, false, false, 'non_taxable', '2024-01-01', NOW());

-- UIF rates (1% employee + 1% employer, R177.12 monthly cap)
INSERT IGNORE INTO benefit_rates (id, plan_id, rate_type, employee_percentage, employer_percentage, monthly_cap, effective_date) VALUES
('uif-rate-001', 'uif-001', 'percentage_of_salary', 1.00, 1.00, 177.12, '2024-01-01');

-- SDL rate (1% of payroll)
INSERT IGNORE INTO benefit_rates (id, plan_id, rate_type, employee_percentage, employer_percentage, effective_date) VALUES
('sdl-rate-001', 'sdl-001', 'percentage_of_salary', 0.00, 1.00, '2024-01-01');

-- =====================================================
-- SEED DATA (Lesotho Common Benefits)
-- =====================================================

-- Insert common Lesotho benefit types
INSERT IGNORE INTO benefit_plans (id, name, benefit_type, provider_name, is_statutory, is_active, allows_dependents, requires_approval, tax_treatment, effective_date, created_at) VALUES
('ls-pension-001', 'Lesotho National Pension Scheme', 'pension_fund', 'Public Service Pension Fund', true, true, false, false, 'tax_deductible', '2024-01-01', NOW()),
('ls-nsif-001', 'National Social Insurance Fund (NSIF)', 'pension_fund', 'National Social Insurance Fund', true, true, false, false, 'tax_deductible', '2024-01-01', NOW());

-- Lesotho National Pension Scheme rates (5% employee + 5% employer)
INSERT IGNORE INTO benefit_rates (id, plan_id, rate_type, employee_percentage, employer_percentage, effective_date) VALUES
('ls-pension-rate-001', 'ls-pension-001', 'percentage_of_salary', 5.00, 5.00, '2024-01-01');

-- NSIF rates (5% employee + 5% employer)
INSERT IGNORE INTO benefit_rates (id, plan_id, rate_type, employee_percentage, employer_percentage, effective_date) VALUES
('ls-nsif-rate-001', 'ls-nsif-001', 'percentage_of_salary', 5.00, 5.00, '2024-01-01');
