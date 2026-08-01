-- Loan & Advance Management Module
-- Manages employee loans, salary advances, and repayment tracking

-- Loan Types (Products)
CREATE TABLE IF NOT EXISTS loan_types (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  country VARCHAR(3) NOT NULL,
  currency VARCHAR(3) NOT NULL,

  -- Loan terms
  min_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  max_amount DECIMAL(12, 2) NOT NULL,
  max_amount_type ENUM('fixed', 'times_salary', 'percentage_salary') DEFAULT 'fixed',
  max_amount_multiplier DECIMAL(5, 2), -- e.g., 2.0 for 2x salary, 0.5 for 50% salary

  -- Repayment terms
  min_tenure_months INT NOT NULL DEFAULT 1,
  max_tenure_months INT NOT NULL DEFAULT 12,
  interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- Annual percentage rate
  interest_type ENUM('flat', 'reducing', 'none') DEFAULT 'flat',

  -- Eligibility
  min_service_months INT DEFAULT 0, -- Minimum months of service required
  max_active_loans INT DEFAULT 1, -- Maximum concurrent loans allowed
  requires_guarantor BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),

  INDEX idx_loan_types_country (country),
  INDEX idx_loan_types_active (is_active),
  INDEX idx_loan_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loan Applications
CREATE TABLE IF NOT EXISTS loan_applications (
  id VARCHAR(36) PRIMARY KEY,
  application_number VARCHAR(50) NOT NULL UNIQUE,
  employee_id VARCHAR(36) NOT NULL,
  loan_type_id VARCHAR(36) NOT NULL,

  -- Application details
  requested_amount DECIMAL(12, 2) NOT NULL,
  approved_amount DECIMAL(12, 2),
  tenure_months INT NOT NULL,
  purpose TEXT,

  -- Calculated terms
  interest_rate DECIMAL(5, 2) NOT NULL,
  monthly_deduction DECIMAL(12, 2),
  total_repayment DECIMAL(12, 2),

  -- Status workflow
  status ENUM('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'disbursed', 'cancelled')
    DEFAULT 'draft',

  -- Dates
  application_date DATE NOT NULL,
  submission_date DATETIME,
  approval_date DATETIME,
  disbursement_date DATE,
  first_deduction_date DATE, -- When first repayment will be deducted

  -- Approval tracking
  approved_by VARCHAR(36),
  rejected_by VARCHAR(36),
  rejection_reason TEXT,
  approval_comments TEXT,

  -- Guarantor (if required)
  guarantor_employee_id VARCHAR(36),
  guarantor_consent BOOLEAN DEFAULT FALSE,
  guarantor_consent_date DATETIME,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  submitted_by VARCHAR(36),

  FOREIGN KEY (loan_type_id) REFERENCES loan_types(id),
  INDEX idx_loan_apps_employee (employee_id),
  INDEX idx_loan_apps_status (status),
  INDEX idx_loan_apps_type (loan_type_id),
  INDEX idx_loan_apps_number (application_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loan Approvals (Approval workflow history)
CREATE TABLE IF NOT EXISTS loan_approvals (
  id VARCHAR(36) PRIMARY KEY,
  application_id VARCHAR(36) NOT NULL,
  approver_id VARCHAR(36) NOT NULL,
  approval_level INT NOT NULL DEFAULT 1,
  action ENUM('approved', 'rejected', 'returned') NOT NULL,
  comments TEXT,
  approved_amount DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
  INDEX idx_loan_approvals_application (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Active Loans (Disbursed loans)
CREATE TABLE IF NOT EXISTS active_loans (
  id VARCHAR(36) PRIMARY KEY,
  loan_number VARCHAR(50) NOT NULL UNIQUE,
  application_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  loan_type_id VARCHAR(36) NOT NULL,

  -- Loan details
  principal_amount DECIMAL(12, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  tenure_months INT NOT NULL,
  monthly_deduction DECIMAL(12, 2) NOT NULL,
  total_repayment DECIMAL(12, 2) NOT NULL,

  -- Repayment tracking
  total_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  principal_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  interest_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  outstanding_balance DECIMAL(12, 2) NOT NULL,

  -- Dates
  disbursement_date DATE NOT NULL,
  first_deduction_date DATE NOT NULL,
  expected_completion_date DATE NOT NULL,
  actual_completion_date DATE,

  -- Status
  status ENUM('active', 'completed', 'defaulted', 'written_off', 'early_settled') DEFAULT 'active',

  -- Early settlement
  early_settlement_date DATE,
  early_settlement_amount DECIMAL(12, 2),
  early_settlement_waiver DECIMAL(12, 2), -- Interest waived

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (application_id) REFERENCES loan_applications(id),
  FOREIGN KEY (loan_type_id) REFERENCES loan_types(id),
  INDEX idx_active_loans_employee (employee_id),
  INDEX idx_active_loans_status (status),
  INDEX idx_active_loans_number (loan_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loan Repayment Schedule
CREATE TABLE IF NOT EXISTS loan_schedules (
  id VARCHAR(36) PRIMARY KEY,
  loan_id VARCHAR(36) NOT NULL,
  installment_number INT NOT NULL,

  -- Schedule details
  due_date DATE NOT NULL,
  principal_amount DECIMAL(12, 2) NOT NULL,
  interest_amount DECIMAL(12, 2) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,

  -- Payment tracking
  paid_date DATE,
  paid_amount DECIMAL(12, 2) DEFAULT 0.00,
  status ENUM('pending', 'paid', 'partial', 'missed', 'waived') DEFAULT 'pending',

  -- Link to payroll
  payroll_run_id VARCHAR(36), -- Link to payroll when deduction is made

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (loan_id) REFERENCES active_loans(id) ON DELETE CASCADE,
  INDEX idx_loan_schedule_loan (loan_id),
  INDEX idx_loan_schedule_due_date (due_date),
  INDEX idx_loan_schedule_status (status),
  UNIQUE KEY unique_loan_installment (loan_id, installment_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loan Repayments (Actual payment records)
CREATE TABLE IF NOT EXISTS loan_repayments (
  id VARCHAR(36) PRIMARY KEY,
  loan_id VARCHAR(36) NOT NULL,
  schedule_id VARCHAR(36), -- Link to schedule if applicable

  -- Payment details
  payment_date DATE NOT NULL,
  payment_amount DECIMAL(12, 2) NOT NULL,
  principal_portion DECIMAL(12, 2) NOT NULL,
  interest_portion DECIMAL(12, 2) NOT NULL,

  -- Payment method
  payment_method ENUM('payroll_deduction', 'manual', 'bank_transfer', 'cash') DEFAULT 'payroll_deduction',
  payroll_run_id VARCHAR(36), -- Link to payroll run
  reference_number VARCHAR(100),

  -- Status
  status ENUM('pending', 'processed', 'reversed', 'failed') DEFAULT 'processed',

  -- Audit
  processed_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (loan_id) REFERENCES active_loans(id),
  FOREIGN KEY (schedule_id) REFERENCES loan_schedules(id),
  INDEX idx_loan_repayments_loan (loan_id),
  INDEX idx_loan_repayments_date (payment_date),
  INDEX idx_loan_repayments_method (payment_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loan History (Audit trail)
CREATE TABLE IF NOT EXISTS loan_history (
  id VARCHAR(36) PRIMARY KEY,
  application_id VARCHAR(36),
  loan_id VARCHAR(36),
  action VARCHAR(50) NOT NULL,
  description TEXT,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by VARCHAR(36),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_loan_history_application (application_id),
  INDEX idx_loan_history_loan (loan_id),
  INDEX idx_loan_history_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Loan Types for South Africa
INSERT IGNORE INTO loan_types
(id, code, name, description, country, currency, min_amount, max_amount, max_amount_type, max_amount_multiplier,
 min_tenure_months, max_tenure_months, interest_rate, interest_type, min_service_months, max_active_loans,
 requires_guarantor, is_active, effective_from)
VALUES
-- South Africa Loan Products
('loan-type-sa-salary-advance', 'SA_SAL_ADV', 'Salary Advance',
 'Short-term advance against next salary payment (South Africa)',
 'ZAF', 'ZAR', 500.00, 5000.00, 'percentage_salary', 0.50,
 1, 1, 0.00, 'none', 3, 2, FALSE, TRUE, '2024-01-01'),

('loan-type-sa-emergency', 'SA_EMERGENCY', 'Emergency Loan',
 'Quick access loan for urgent financial needs (South Africa)',
 'ZAF', 'ZAR', 1000.00, 15000.00, 'times_salary', 1.00,
 3, 6, 5.00, 'flat', 6, 1, FALSE, TRUE, '2024-01-01'),

('loan-type-sa-personal', 'SA_PERSONAL', 'Personal Loan',
 'Medium-term personal loan with competitive rates (South Africa)',
 'ZAF', 'ZAR', 5000.00, 50000.00, 'times_salary', 2.00,
 6, 24, 8.50, 'reducing', 12, 1, TRUE, TRUE, '2024-01-01'),

('loan-type-sa-education', 'SA_EDUCATION', 'Education Loan',
 'Loan for education and training purposes (South Africa)',
 'ZAF', 'ZAR', 2000.00, 30000.00, 'times_salary', 1.50,
 6, 18, 6.00, 'reducing', 6, 1, FALSE, TRUE, '2024-01-01'),

('loan-type-sa-housing', 'SA_HOUSING', 'Housing Assistance Loan',
 'Loan for housing deposits or urgent repairs (South Africa)',
 'ZAF', 'ZAR', 10000.00, 100000.00, 'times_salary', 3.00,
 12, 36, 7.50, 'reducing', 24, 1, TRUE, TRUE, '2024-01-01'),

-- Lesotho Loan Products
('loan-type-ls-salary-advance', 'LS_SAL_ADV', 'Salary Advance',
 'Short-term advance against next salary payment (Lesotho)',
 'LSO', 'LSL', 400.00, 4000.00, 'percentage_salary', 0.50,
 1, 1, 0.00, 'none', 3, 2, FALSE, TRUE, '2024-01-01'),

('loan-type-ls-emergency', 'LS_EMERGENCY', 'Emergency Loan',
 'Quick access loan for urgent financial needs (Lesotho)',
 'LSO', 'LSL', 800.00, 12000.00, 'times_salary', 1.00,
 3, 6, 5.50, 'flat', 6, 1, FALSE, TRUE, '2024-01-01'),

('loan-type-ls-personal', 'LS_PERSONAL', 'Personal Loan',
 'Medium-term personal loan with competitive rates (Lesotho)',
 'LSO', 'LSL', 4000.00, 40000.00, 'times_salary', 2.00,
 6, 24, 9.00, 'reducing', 12, 1, TRUE, TRUE, '2024-01-01'),

('loan-type-ls-education', 'LS_EDUCATION', 'Education Loan',
 'Loan for education and training purposes (Lesotho)',
 'LSO', 'LSL', 1500.00, 25000.00, 'times_salary', 1.50,
 6, 18, 6.50, 'reducing', 6, 1, FALSE, TRUE, '2024-01-01');

-- Create indexes for performance
CREATE INDEX idx_loan_apps_dates ON loan_applications(application_date, submission_date);
CREATE INDEX idx_active_loans_dates ON active_loans(disbursement_date, expected_completion_date);
CREATE INDEX idx_loan_schedules_composite ON loan_schedules(loan_id, due_date, status);
