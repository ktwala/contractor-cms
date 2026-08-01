-- Migration: Integration Framework & External System Connections
-- Description: Banking, Accounting, Pension Funds, SARS eFiling Integrations
-- Author: System
-- Date: 2025-12-29

-- =====================================================
-- 1. Integration Connections
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_connections (
  id CHAR(36) PRIMARY KEY,
  legal_entity_id CHAR(36) NOT NULL,

  -- Connection Details
  integration_type VARCHAR(100) NOT NULL, -- 'banking', 'accounting', 'pension', 'sars_efiling'
  provider VARCHAR(100) NOT NULL, -- 'standard_bank', 'xero', 'quickbooks', 'sage', 'alexander_forbes', etc.
  connection_name VARCHAR(200) NOT NULL,

  -- Authentication
  auth_type ENUM('oauth2', 'api_key', 'basic_auth', 'certificate') NOT NULL,
  credentials JSON, -- Encrypted credentials
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,

  -- Configuration
  config JSON, -- Provider-specific settings
  field_mappings JSON, -- Custom field mappings

  -- Status
  status ENUM('active', 'inactive', 'error', 'pending_auth') DEFAULT 'pending_auth',
  last_sync_at DATETIME,
  last_error TEXT,
  error_count INT DEFAULT 0,

  -- Features
  features JSON, -- Enabled features: payments, gl_sync, invoices, etc.
  sync_frequency VARCHAR(50), -- 'realtime', 'hourly', 'daily', 'manual'

  -- Audit
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_type_provider (integration_type, provider),
  INDEX idx_status (status),

  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. Integration Sync Logs
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,

  -- Sync Details
  sync_type VARCHAR(100) NOT NULL, -- 'payment', 'gl_journal', 'employee', 'pension_contribution', etc.
  sync_direction ENUM('outbound', 'inbound', 'bidirectional') NOT NULL,
  entity_type VARCHAR(100), -- 'payrun', 'employee', 'gl_journal', etc.
  entity_id CHAR(36),

  -- Status
  status ENUM('pending', 'in_progress', 'success', 'failed', 'partial') DEFAULT 'pending',
  started_at DATETIME,
  completed_at DATETIME,

  -- Data
  request_payload JSON,
  response_payload JSON,
  records_processed INT DEFAULT 0,
  records_failed INT DEFAULT 0,

  -- Error Handling
  error_message TEXT,
  error_code VARCHAR(50),
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_sync_type (sync_type),
  INDEX idx_status (status),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. Banking Transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS banking_transactions (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,
  payrun_id CHAR(36),

  -- Transaction Details
  transaction_type ENUM('salary_payment', 'bulk_payment', 'single_payment', 'reversal') NOT NULL,
  batch_id VARCHAR(100), -- Bank's batch reference
  transaction_reference VARCHAR(100) NOT NULL,

  -- Payment Details
  from_account VARCHAR(50) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  total_transactions INT DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'ZAR',

  -- Status
  status ENUM('pending', 'submitted', 'processing', 'completed', 'failed', 'reversed') DEFAULT 'pending',
  submission_date DATETIME,
  value_date DATE,
  processed_date DATETIME,

  -- Bank Response
  bank_response JSON,
  bank_status_code VARCHAR(50),
  bank_message TEXT,

  -- Reconciliation
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at DATETIME,
  reconciled_by CHAR(36),

  -- File Details (if file-based)
  file_path VARCHAR(500),
  file_format VARCHAR(20), -- 'ACB', 'CSV', 'XML', etc.

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_payrun (payrun_id),
  INDEX idx_batch (batch_id),
  INDEX idx_status (status),
  INDEX idx_submission_date (submission_date),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
  FOREIGN KEY (payrun_id) REFERENCES payruns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. Banking Transaction Lines
-- =====================================================
CREATE TABLE IF NOT EXISTS banking_transaction_lines (
  id CHAR(36) PRIMARY KEY,
  banking_transaction_id CHAR(36) NOT NULL,
  payslip_id CHAR(36),

  -- Beneficiary
  beneficiary_name VARCHAR(200) NOT NULL,
  beneficiary_account VARCHAR(50) NOT NULL,
  beneficiary_bank VARCHAR(100),
  branch_code VARCHAR(20),

  -- Amount
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(50),
  payment_type VARCHAR(50), -- 'salary', 'bonus', 'expense', etc.

  -- Status
  status ENUM('pending', 'submitted', 'paid', 'failed', 'reversed') DEFAULT 'pending',
  failure_reason TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_transaction (banking_transaction_id),
  INDEX idx_payslip (payslip_id),
  INDEX idx_status (status),

  FOREIGN KEY (banking_transaction_id) REFERENCES banking_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. Accounting Sync Queue
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_sync_queue (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,

  -- Entity Details
  entity_type VARCHAR(100) NOT NULL, -- 'gl_journal', 'invoice', 'bill', 'payment', 'employee'
  entity_id CHAR(36) NOT NULL,
  sync_action ENUM('create', 'update', 'delete') NOT NULL,

  -- Mapping
  external_id VARCHAR(255), -- ID in external system
  external_entity_type VARCHAR(100), -- Entity type in external system

  -- Data
  sync_data JSON NOT NULL,
  mapping_applied JSON, -- Field mappings used

  -- Status
  status ENUM('queued', 'in_progress', 'completed', 'failed') DEFAULT 'queued',
  priority INT DEFAULT 5, -- 1 = highest, 10 = lowest
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,

  -- Timestamps
  queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  retry_after DATETIME,

  -- Error
  error_message TEXT,
  error_details JSON,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_retry_after (retry_after),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. Pension Fund Submissions
-- =====================================================
CREATE TABLE IF NOT EXISTS pension_fund_submissions (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,
  payrun_id CHAR(36) NOT NULL,

  -- Fund Details
  fund_name VARCHAR(200) NOT NULL,
  fund_administrator VARCHAR(200),
  submission_period VARCHAR(7) NOT NULL, -- YYYY-MM

  -- Totals
  total_employees INT DEFAULT 0,
  total_employee_contributions DECIMAL(15,2) DEFAULT 0.00,
  total_employer_contributions DECIMAL(15,2) DEFAULT 0.00,
  total_amount DECIMAL(15,2) DEFAULT 0.00,

  -- Submission
  submission_reference VARCHAR(100),
  submission_file_path VARCHAR(500),
  submission_format VARCHAR(50), -- 'CSV', 'XML', 'API'

  -- Status
  status ENUM('draft', 'submitted', 'accepted', 'rejected', 'paid') DEFAULT 'draft',
  submitted_at DATETIME,
  accepted_at DATETIME,
  payment_reference VARCHAR(100),
  payment_date DATE,

  -- Response
  fund_response TEXT,
  validation_errors JSON,

  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_payrun (payrun_id),
  INDEX idx_period (submission_period),
  INDEX idx_status (status),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
  FOREIGN KEY (payrun_id) REFERENCES payruns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. Pension Fund Submission Lines
-- =====================================================
CREATE TABLE IF NOT EXISTS pension_fund_submission_lines (
  id CHAR(36) PRIMARY KEY,
  pension_fund_submission_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  payslip_id CHAR(36),

  -- Member Details
  member_number VARCHAR(50),
  id_number VARCHAR(20),
  full_name VARCHAR(200),

  -- Contributions
  pensionable_earnings DECIMAL(15,2) DEFAULT 0.00,
  employee_contribution DECIMAL(15,2) DEFAULT 0.00,
  employer_contribution DECIMAL(15,2) DEFAULT 0.00,
  voluntary_contribution DECIMAL(15,2) DEFAULT 0.00,
  total_contribution DECIMAL(15,2) DEFAULT 0.00,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_submission (pension_fund_submission_id),
  INDEX idx_employee (employee_id),
  INDEX idx_payslip (payslip_id),

  FOREIGN KEY (pension_fund_submission_id) REFERENCES pension_fund_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. SARS eFiling Submissions
-- =====================================================
CREATE TABLE IF NOT EXISTS sars_efiling_submissions (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36),
  legal_entity_id CHAR(36) NOT NULL,

  -- Submission Details
  submission_type VARCHAR(100) NOT NULL, -- 'EMP201', 'EMP501', 'IRP5', 'IT3A'
  tax_period VARCHAR(10) NOT NULL, -- YYYY-MM or YYYY
  reference_id CHAR(36), -- Link to emp201_returns, irp5_certificates, etc.

  -- SARS Details
  sars_reference_number VARCHAR(100),
  tracking_number VARCHAR(100),

  -- Submission
  submission_method ENUM('api', 'file_upload', 'manual') DEFAULT 'api',
  submission_file_path VARCHAR(500),
  xml_payload LONGTEXT,

  -- Status
  status ENUM('draft', 'validating', 'valid', 'submitted', 'accepted', 'rejected') DEFAULT 'draft',
  submitted_at DATETIME,
  accepted_at DATETIME,

  -- Response
  sars_response TEXT,
  validation_errors JSON,
  error_code VARCHAR(50),

  -- Retry
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at DATETIME,

  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_type_period (submission_type, tax_period),
  INDEX idx_status (status),
  INDEX idx_tracking (tracking_number),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE SET NULL,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. Integration Webhooks
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_webhooks (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36),

  -- Webhook Details
  webhook_type VARCHAR(100) NOT NULL, -- 'payment_status', 'account_sync', 'invoice_paid', etc.
  provider VARCHAR(100) NOT NULL,
  webhook_url VARCHAR(500) NOT NULL,
  secret_key VARCHAR(255),

  -- Events
  subscribed_events JSON NOT NULL, -- Array of event types

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_received_at DATETIME,
  total_received INT DEFAULT 0,
  total_processed INT DEFAULT 0,
  total_failed INT DEFAULT 0,

  -- Verification
  verification_token VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_provider (provider),
  INDEX idx_is_active (is_active),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. Webhook Events Log
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_events_log (
  id CHAR(36) PRIMARY KEY,
  webhook_id CHAR(36),

  -- Event Details
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255), -- External event ID
  provider VARCHAR(100) NOT NULL,

  -- Payload
  headers JSON,
  payload JSON NOT NULL,
  signature VARCHAR(500),

  -- Processing
  status ENUM('received', 'processing', 'processed', 'failed', 'ignored') DEFAULT 'received',
  processed_at DATETIME,
  error_message TEXT,

  -- Response
  response_status INT,
  response_body TEXT,

  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_webhook (webhook_id),
  INDEX idx_event_type (event_type),
  INDEX idx_status (status),
  INDEX idx_received_at (received_at),

  FOREIGN KEY (webhook_id) REFERENCES integration_webhooks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. Integration Field Mappings
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,

  -- Mapping Details
  entity_type VARCHAR(100) NOT NULL, -- 'employee', 'gl_account', 'payment', etc.
  source_field VARCHAR(200) NOT NULL,
  target_field VARCHAR(200) NOT NULL,

  -- Transformation
  transformation_type ENUM('direct', 'lookup', 'formula', 'conditional') DEFAULT 'direct',
  transformation_config JSON, -- Lookup tables, formulas, conditions

  -- Validation
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  validation_rules JSON,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_connection_entity_source (connection_id, entity_type, source_field),
  INDEX idx_connection (connection_id),
  INDEX idx_entity_type (entity_type),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. Integration Schedules
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_schedules (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,

  -- Schedule Details
  schedule_name VARCHAR(200) NOT NULL,
  sync_type VARCHAR(100) NOT NULL, -- 'payments', 'gl_journals', 'employees', etc.

  -- Frequency
  frequency ENUM('realtime', 'every_15_min', 'hourly', 'daily', 'weekly', 'monthly', 'manual') NOT NULL,
  cron_expression VARCHAR(100),

  -- Time
  scheduled_time TIME,
  timezone VARCHAR(50) DEFAULT 'Africa/Johannesburg',

  -- Filters
  sync_filters JSON, -- Conditions for what to sync

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at DATETIME,
  next_run_at DATETIME,
  last_run_status ENUM('success', 'failed', 'partial'),
  last_run_records INT DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_connection (connection_id),
  INDEX idx_is_active (is_active),
  INDEX idx_next_run (next_run_at),

  FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Seed Data: Integration Providers
-- =====================================================
-- Note: These are example providers that can be supported
-- Actual implementation will depend on API availability

-- Banking providers supported
INSERT INTO integration_field_mappings (id, connection_id, entity_type, source_field, target_field, transformation_type)
SELECT
  UUID(),
  '' as connection_id, -- Template, not tied to specific connection
  'payment',
  'net_pay',
  'amount',
  'direct'
WHERE NOT EXISTS (SELECT 1 FROM integration_field_mappings LIMIT 1);
