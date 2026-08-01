-- Migration: Create payment batch tables
-- Version: 008
-- Description: Add tables for payment batch processing, bank file generation, and audit trail

-- Payment batches table
CREATE TABLE IF NOT EXISTS payment_batches (
  id VARCHAR(36) PRIMARY KEY,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  payroll_period_id VARCHAR(36),
  total_amount DECIMAL(15, 2) NOT NULL,
  total_transactions INT NOT NULL,
  status ENUM('draft', 'pending_approval', 'approved', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'draft',
  created_by VARCHAR(36) NOT NULL,
  approved_by VARCHAR(36),
  approved_at TIMESTAMP NULL,
  processed_at TIMESTAMP NULL,
  bank_file_format ENUM('naedo', 'eft', 'standard_bank', 'fnb', 'absa', 'nedbank', 'csv') NOT NULL DEFAULT 'eft',
  bank_file_path VARCHAR(500),
  bank_file_checksum VARCHAR(64),
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batch_number (batch_number),
  INDEX idx_status (status),
  INDEX idx_payment_date (payment_date),
  INDEX idx_payroll_period (payroll_period_id),
  INDEX idx_created_by (created_by),

  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment batch items table
CREATE TABLE IF NOT EXISTS payment_batch_items (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  employee_number VARCHAR(50) NOT NULL,
  employee_name VARCHAR(200) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  branch_code VARCHAR(10) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_type ENUM('savings', 'current', 'cheque') NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  reference VARCHAR(100) NOT NULL,
  payslip_id VARCHAR(36),
  payment_status ENUM('pending', 'processing', 'completed', 'failed', 'reversed') NOT NULL DEFAULT 'pending',
  payment_reference VARCHAR(100),
  failure_reason TEXT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_batch_id (batch_id),
  INDEX idx_employee_id (employee_id),
  INDEX idx_payment_status (payment_status),

  FOREIGN KEY (batch_id) REFERENCES payment_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (payslip_id) REFERENCES payslips(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment batch audit log
CREATE TABLE IF NOT EXISTS payment_batch_audit (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  description TEXT,
  metadata JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_batch_id (batch_id),
  INDEX idx_action (action),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),

  FOREIGN KEY (batch_id) REFERENCES payment_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment reconciliation table
CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  reconciliation_date DATE NOT NULL,
  bank_statement_reference VARCHAR(100),
  total_expected DECIMAL(15, 2) NOT NULL,
  total_processed DECIMAL(15, 2) NOT NULL,
  total_failed DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_reversed DECIMAL(15, 2) NOT NULL DEFAULT 0,
  variance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status ENUM('pending', 'matched', 'unmatched', 'partially_matched') NOT NULL DEFAULT 'pending',
  reconciled_by VARCHAR(36),
  reconciled_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batch_id (batch_id),
  INDEX idx_status (status),
  INDEX idx_reconciliation_date (reconciliation_date),

  FOREIGN KEY (batch_id) REFERENCES payment_batches(id),
  FOREIGN KEY (reconciled_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment reconciliation items (for detailed matching)
CREATE TABLE IF NOT EXISTS payment_reconciliation_items (
  id VARCHAR(36) PRIMARY KEY,
  reconciliation_id VARCHAR(36) NOT NULL,
  batch_item_id VARCHAR(36) NOT NULL,
  bank_reference VARCHAR(100),
  expected_amount DECIMAL(15, 2) NOT NULL,
  processed_amount DECIMAL(15, 2),
  status ENUM('matched', 'unmatched', 'partial', 'reversed') NOT NULL,
  variance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_reconciliation_id (reconciliation_id),
  INDEX idx_batch_item_id (batch_item_id),
  INDEX idx_status (status),

  FOREIGN KEY (reconciliation_id) REFERENCES payment_reconciliations(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_item_id) REFERENCES payment_batch_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bank account validation cache (to avoid repeated API calls)
CREATE TABLE IF NOT EXISTS bank_account_validations (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  branch_code VARCHAR(10) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  is_valid BOOLEAN NOT NULL,
  validation_errors JSON,
  validation_warnings JSON,
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  INDEX idx_employee_id (employee_id),
  INDEX idx_account_details (bank_name, branch_code, account_number),
  INDEX idx_expires_at (expires_at),

  FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE KEY unique_validation (employee_id, bank_name, branch_code, account_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment approvers (who can approve batches)
CREATE TABLE IF NOT EXISTS payment_approvers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  approval_limit DECIMAL(15, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_is_active (is_active),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY unique_approver (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment notifications/alerts
CREATE TABLE IF NOT EXISTS payment_notifications (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  notification_type ENUM('created', 'submitted', 'approved', 'rejected', 'completed', 'failed') NOT NULL,
  recipient_user_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_batch_id (batch_id),
  INDEX idx_recipient (recipient_user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),

  FOREIGN KEY (batch_id) REFERENCES payment_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add payment-related permissions
INSERT IGNORE INTO permissions (id, name, description, created_at) VALUES
('pay-001', 'payment.batch.create', 'Create payment batches', NOW()),
('pay-002', 'payment.batch.view', 'View payment batches', NOW()),
('pay-003', 'payment.batch.approve', 'Approve payment batches', NOW()),
('pay-004', 'payment.batch.process', 'Process payment batches', NOW()),
('pay-005', 'payment.batch.cancel', 'Cancel payment batches', NOW()),
('pay-006', 'payment.reconciliation.create', 'Create payment reconciliations', NOW()),
('pay-007', 'payment.reconciliation.view', 'View payment reconciliations', NOW()),
('pay-008', 'payment.file.download', 'Download payment files', NOW()),
('pay-009', 'payment.approver.manage', 'Manage payment approvers', NOW());
