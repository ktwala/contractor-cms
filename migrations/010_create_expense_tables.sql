-- =====================================================
-- EXPENSE MANAGEMENT TABLES
-- =====================================================

-- Expense Categories (Travel, Meals, Accommodation, etc.)
CREATE TABLE IF NOT EXISTS expense_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_receipt BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Policies (Per Diem, Mileage Rates, Limits)
CREATE TABLE IF NOT EXISTS expense_policies (
  id VARCHAR(36) PRIMARY KEY,
  category_id VARCHAR(36),
  policy_type ENUM('per_diem', 'mileage_rate', 'daily_limit', 'monthly_limit', 'annual_limit', 'fixed_allowance') NOT NULL,
  country VARCHAR(3) DEFAULT 'ZAF',
  currency VARCHAR(3) DEFAULT 'ZAR',
  amount DECIMAL(10, 2),
  unit VARCHAR(20),
  description TEXT,
  effective_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  INDEX idx_category (category_id),
  INDEX idx_effective (effective_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Claims (Employee Submissions)
CREATE TABLE IF NOT EXISTS expense_claims (
  id VARCHAR(36) PRIMARY KEY,
  claim_number VARCHAR(50) NOT NULL UNIQUE,
  employee_id VARCHAR(36) NOT NULL,
  claim_date DATE NOT NULL,
  submission_date TIMESTAMP,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  purpose TEXT,
  status ENUM('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  approved_amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'ZAR',
  approval_level INT DEFAULT 0,
  requires_approval_levels INT DEFAULT 1,
  submitted_by VARCHAR(36),
  approved_by VARCHAR(36),
  approved_at TIMESTAMP,
  rejected_by VARCHAR(36),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  paid_date DATE,
  payslip_id VARCHAR(36),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee (employee_id),
  INDEX idx_status (status),
  INDEX idx_claim_date (claim_date),
  INDEX idx_claim_number (claim_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Items (Line Items in a Claim)
CREATE TABLE IF NOT EXISTS expense_items (
  id VARCHAR(36) PRIMARY KEY,
  claim_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  calculation_type ENUM('fixed_amount', 'mileage', 'per_diem', 'percentage') NOT NULL DEFAULT 'fixed_amount',
  quantity DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ZAR',
  exchange_rate DECIMAL(10, 4) DEFAULT 1.0000,
  base_currency_amount DECIMAL(10, 2),
  mileage_km DECIMAL(10, 2),
  from_location VARCHAR(200),
  to_location VARCHAR(200),
  has_receipt BOOLEAN NOT NULL DEFAULT false,
  is_billable BOOLEAN NOT NULL DEFAULT false,
  client_name VARCHAR(200),
  project_code VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  INDEX idx_claim (claim_id),
  INDEX idx_category (category_id),
  INDEX idx_date (expense_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Receipts (Uploaded Documents)
CREATE TABLE IF NOT EXISTS expense_receipts (
  id VARCHAR(36) PRIMARY KEY,
  item_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  storage_provider VARCHAR(50) DEFAULT 'local',
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  uploaded_by VARCHAR(36),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES expense_items(id) ON DELETE CASCADE,
  INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Approvals (Approval Workflow History)
CREATE TABLE IF NOT EXISTS expense_approvals (
  id VARCHAR(36) PRIMARY KEY,
  claim_id VARCHAR(36) NOT NULL,
  approver_id VARCHAR(36) NOT NULL,
  approval_level INT NOT NULL,
  action ENUM('approved', 'rejected', 'returned') NOT NULL,
  comments TEXT,
  original_amount DECIMAL(12, 2),
  approved_amount DECIMAL(12, 2),
  adjustments TEXT,
  actioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE,
  INDEX idx_claim (claim_id),
  INDEX idx_approver (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense Reimbursements (Link to Payroll)
CREATE TABLE IF NOT EXISTS expense_reimbursements (
  id VARCHAR(36) PRIMARY KEY,
  claim_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  reimbursement_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ZAR',
  payment_method ENUM('payroll', 'bank_transfer', 'cash', 'cheque') NOT NULL DEFAULT 'payroll',
  payroll_period_id VARCHAR(36),
  payslip_id VARCHAR(36),
  payment_date DATE,
  bank_reference VARCHAR(100),
  status ENUM('pending', 'processing', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_claim (claim_id),
  INDEX idx_employee (employee_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense History (Audit Trail)
CREATE TABLE IF NOT EXISTS expense_history (
  id VARCHAR(36) PRIMARY KEY,
  claim_id VARCHAR(36) NOT NULL,
  action ENUM('created', 'submitted', 'approved', 'rejected', 'cancelled', 'paid', 'item_added', 'item_removed', 'amount_adjusted') NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  old_amount DECIMAL(12, 2),
  new_amount DECIMAL(12, 2),
  description TEXT,
  metadata JSON,
  changed_by VARCHAR(36),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE,
  INDEX idx_claim (claim_id),
  INDEX idx_action (action),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SEED DATA (Common Expense Categories)
-- =====================================================

INSERT IGNORE INTO expense_categories (id, name, description, requires_receipt, icon) VALUES
('cat-travel', 'Travel', 'Transportation costs including flights, trains, buses, taxis', true, 'plane'),
('cat-accommodation', 'Accommodation', 'Hotel and lodging expenses', true, 'bed'),
('cat-meals', 'Meals & Entertainment', 'Business meals and client entertainment', true, 'utensils'),
('cat-fuel', 'Fuel', 'Vehicle fuel and parking', true, 'fuel'),
('cat-mileage', 'Mileage', 'Personal vehicle usage for business', false, 'car'),
('cat-communication', 'Communication', 'Phone, internet, data charges', true, 'phone'),
('cat-office', 'Office Supplies', 'Stationery, printing, office equipment', true, 'briefcase'),
('cat-training', 'Training & Development', 'Courses, conferences, professional development', true, 'book'),
('cat-subscriptions', 'Subscriptions', 'Software licenses, professional memberships', true, 'credit-card'),
('cat-other', 'Other', 'Miscellaneous business expenses', true, 'receipt');

-- =====================================================
-- SEED DATA (South African Expense Policies)
-- =====================================================

-- Per Diem Rates (South Africa)
INSERT IGNORE INTO expense_policies (id, category_id, policy_type, country, currency, amount, unit, description, effective_date) VALUES
('policy-sa-meals-breakfast', 'cat-meals', 'per_diem', 'ZAF', 'ZAR', 120.00, 'meal', 'Breakfast per diem (SA)', '2024-01-01'),
('policy-sa-meals-lunch', 'cat-meals', 'per_diem', 'ZAF', 'ZAR', 180.00, 'meal', 'Lunch per diem (SA)', '2024-01-01'),
('policy-sa-meals-dinner', 'cat-meals', 'per_diem', 'ZAF', 'ZAR', 250.00, 'meal', 'Dinner per diem (SA)', '2024-01-01'),
('policy-sa-meals-daily', 'cat-meals', 'per_diem', 'ZAF', 'ZAR', 550.00, 'day', 'Full day meals allowance (SA)', '2024-01-01');

-- Mileage Rates (South Africa)
INSERT IGNORE INTO expense_policies (id, category_id, policy_type, country, currency, amount, unit, description, effective_date) VALUES
('policy-sa-mileage', 'cat-mileage', 'mileage_rate', 'ZAF', 'ZAR', 4.50, 'km', 'Mileage rate per km (SA)', '2024-01-01');

-- Accommodation Limits (South Africa)
INSERT IGNORE INTO expense_policies (id, category_id, policy_type, country, currency, amount, unit, description, effective_date) VALUES
('policy-sa-accommodation', 'cat-accommodation', 'daily_limit', 'ZAF', 'ZAR', 1500.00, 'night', 'Accommodation limit per night (SA)', '2024-01-01');

-- =====================================================
-- SEED DATA (Lesotho Expense Policies)
-- =====================================================

-- Per Diem Rates (Lesotho)
INSERT IGNORE INTO expense_policies (id, category_id, policy_type, country, currency, amount, unit, description, effective_date) VALUES
('policy-ls-meals-breakfast', 'cat-meals', 'per_diem', 'LSO', 'LSL', 100.00, 'meal', 'Breakfast per diem (Lesotho)', '2024-01-01'),
('policy-ls-meals-lunch', 'cat-meals', 'per_diem', 'LSO', 'LSL', 150.00, 'meal', 'Lunch per diem (Lesotho)', '2024-01-01'),
('policy-ls-meals-dinner', 'cat-meals', 'per_diem', 'LSO', 'LSL', 200.00, 'meal', 'Dinner per diem (Lesotho)', '2024-01-01'),
('policy-ls-meals-daily', 'cat-meals', 'per_diem', 'LSO', 'LSL', 450.00, 'day', 'Full day meals allowance (Lesotho)', '2024-01-01');

-- Mileage Rates (Lesotho)
INSERT IGNORE INTO expense_policies (id, category_id, policy_type, country, currency, amount, unit, description, effective_date) VALUES
('policy-ls-mileage', 'cat-mileage', 'mileage_rate', 'LSO', 'LSL', 4.00, 'km', 'Mileage rate per km (Lesotho)', '2024-01-01');

-- =====================================================
-- PERMISSIONS
-- =====================================================

INSERT IGNORE INTO permissions (id, permission_key, description, created_at) VALUES
('exp-001', 'expense.claim.create', 'Create expense claims', NOW()),
('exp-002', 'expense.claim.view', 'View expense claims', NOW()),
('exp-003', 'expense.claim.edit', 'Edit expense claims', NOW()),
('exp-004', 'expense.claim.delete', 'Delete expense claims', NOW()),
('exp-005', 'expense.claim.submit', 'Submit expense claims for approval', NOW()),
('exp-006', 'expense.claim.approve', 'Approve expense claims', NOW()),
('exp-007', 'expense.claim.reject', 'Reject expense claims', NOW()),
('exp-008', 'expense.policy.manage', 'Manage expense policies', NOW()),
('exp-009', 'expense.category.manage', 'Manage expense categories', NOW()),
('exp-010', 'expense.reports.view', 'View expense reports', NOW()),
('exp-011', 'expense.reimbursement.process', 'Process expense reimbursements', NOW()),
('exp-012', 'expense.all.view', 'View all employee expenses', NOW());
