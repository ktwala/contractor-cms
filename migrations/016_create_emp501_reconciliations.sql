-- EMP501 Reconciliation Tables
-- Purpose: Year-end reconciliation of IRP5 certificates and EMP201 returns

-- EMP501 Reconciliations Table
CREATE TABLE IF NOT EXISTS emp501_reconciliations (
  id VARCHAR(36) PRIMARY KEY,
  tax_period_id VARCHAR(36) NOT NULL,
  tax_year VARCHAR(10) NOT NULL,
  status ENUM('draft', 'discrepancies_found', 'reconciled', 'approved', 'submitted') DEFAULT 'draft',

  -- Summary totals
  total_employees INT DEFAULT 0,
  total_liability DECIMAL(15, 2) DEFAULT 0,
  total_paye DECIMAL(15, 2) DEFAULT 0,
  total_uif DECIMAL(15, 2) DEFAULT 0,
  total_sdl DECIMAL(15, 2) DEFAULT 0,

  -- Counts
  irp5_count INT DEFAULT 0,
  emp201_count INT DEFAULT 0,

  -- Discrepancies (JSON array)
  discrepancies JSON,

  -- Approval
  reconciled_by VARCHAR(100),
  reconciled_at DATETIME,
  notes TEXT,

  -- SARS submission
  submitted_at DATETIME,
  submitted_by VARCHAR(100),
  sars_reference_number VARCHAR(50),

  -- Audit
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id),
  INDEX idx_tax_year (tax_year),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Notifications Table
CREATE TABLE IF NOT EXISTS email_notifications (
  id VARCHAR(36) PRIMARY KEY,
  notification_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body TEXT,

  -- Related documents
  document_type VARCHAR(50),
  document_id VARCHAR(36),

  -- Attachments
  has_attachment BOOLEAN DEFAULT FALSE,
  attachment_path VARCHAR(500),
  attachment_name VARCHAR(255),

  -- Status
  status ENUM('pending', 'sent', 'failed', 'bounced') DEFAULT 'pending',
  sent_at DATETIME,
  failed_reason TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Tracking
  opened_at DATETIME,
  clicked_at DATETIME,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_recipient (recipient_email),
  INDEX idx_status (status),
  INDEX idx_notification_type (notification_type),
  INDEX idx_document (document_type, document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Validation Rules Table
CREATE TABLE IF NOT EXISTS sars_validation_rules (
  id VARCHAR(36) PRIMARY KEY,
  rule_code VARCHAR(50) NOT NULL UNIQUE,
  rule_name VARCHAR(255) NOT NULL,
  rule_description TEXT,
  applies_to ENUM('irp5', 'emp201', 'emp501', 'all') DEFAULT 'all',
  severity ENUM('error', 'warning', 'info') DEFAULT 'error',

  -- Rule logic (JSON)
  validation_logic JSON,
  error_message VARCHAR(500),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_applies_to (applies_to),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Validation Results Table
CREATE TABLE IF NOT EXISTS sars_validation_results (
  id VARCHAR(36) PRIMARY KEY,
  validation_run_id VARCHAR(36) NOT NULL,
  rule_id VARCHAR(36) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_id VARCHAR(36) NOT NULL,

  -- Result
  passed BOOLEAN DEFAULT FALSE,
  severity ENUM('error', 'warning', 'info') DEFAULT 'error',
  error_message TEXT,
  field_name VARCHAR(100),
  expected_value VARCHAR(255),
  actual_value VARCHAR(255),

  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(100),
  resolved_at DATETIME,
  resolution_notes TEXT,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (rule_id) REFERENCES sars_validation_rules(id),
  INDEX idx_validation_run (validation_run_id),
  INDEX idx_document (document_type, document_id),
  INDEX idx_passed (passed),
  INDEX idx_resolved (resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk Submission Queue Table
CREATE TABLE IF NOT EXISTS sars_submission_queue (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_id VARCHAR(36) NOT NULL,

  -- Priority
  priority INT DEFAULT 5,

  -- Status
  status ENUM('queued', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'queued',

  -- Processing
  processing_started_at DATETIME,
  processing_completed_at DATETIME,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Error handling
  error_message TEXT,
  last_error_at DATETIME,

  -- Result
  sars_reference_number VARCHAR(50),
  submission_result JSON,

  -- Audit
  queued_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batch (batch_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_document (document_type, document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed validation rules
INSERT INTO sars_validation_rules (id, rule_code, rule_name, rule_description, applies_to, severity, validation_logic, error_message) VALUES
-- IRP5 Validation Rules
(UUID(), 'IRP5_001', 'Employee ID Number Required', 'Employee must have a valid South African ID number or passport number', 'irp5', 'error',
 '{"field": "id_number", "required": true, "min_length": 13}',
 'Employee ID number is required and must be at least 13 digits'),

(UUID(), 'IRP5_002', 'Tax Number Required', 'Employee must have a valid tax number', 'irp5', 'error',
 '{"field": "tax_number", "required": true, "min_length": 10}',
 'Employee tax number is required'),

(UUID(), 'IRP5_003', 'PAYE Must Be Positive', 'PAYE deducted cannot be negative', 'irp5', 'error',
 '{"field": "paye_deducted", "min_value": 0}',
 'PAYE deducted cannot be negative'),

(UUID(), 'IRP5_004', 'Total Remuneration Validation', 'Total remuneration must be greater than or equal to taxable income', 'irp5', 'warning',
 '{"compare": {"field1": "total_remuneration", "operator": ">=", "field2": "taxable_income"}}',
 'Total remuneration should be greater than or equal to taxable income'),

-- EMP201 Validation Rules
(UUID(), 'EMP201_001', 'Employee Count Validation', 'Total employees must be positive', 'emp201', 'error',
 '{"field": "total_employees", "min_value": 1}',
 'Total employees must be at least 1'),

(UUID(), 'EMP201_002', 'UIF Calculation Validation', 'Employee UIF + Employer UIF should equal Total UIF', 'emp201', 'error',
 '{"sum_equals": {"fields": ["employee_uif", "employer_uif"], "equals": "total_uif", "tolerance": 0.01}}',
 'UIF totals mismatch: Employee UIF + Employer UIF must equal Total UIF'),

(UUID(), 'EMP201_003', 'Liability Calculation', 'Total liability should equal PAYE + UIF + SDL', 'emp201', 'error',
 '{"sum_equals": {"fields": ["total_paye", "total_uif", "total_sdl"], "equals": "total_liability", "tolerance": 0.01}}',
 'Total liability mismatch: PAYE + UIF + SDL must equal Total Liability'),

(UUID(), 'EMP201_004', 'Tax Reference Validation', 'Employer tax reference number must be 10 digits', 'emp201', 'error',
 '{"field": "employer_tax_number", "length": 10}',
 'Employer tax reference number must be exactly 10 digits'),

-- EMP501 Validation Rules
(UUID(), 'EMP501_001', 'IRP5 Count Validation', 'At least one IRP5 certificate must be issued', 'emp501', 'error',
 '{"field": "irp5_count", "min_value": 1}',
 'At least one IRP5 certificate must be issued for reconciliation'),

(UUID(), 'EMP501_002', 'Discrepancy Threshold', 'PAYE discrepancy should not exceed 1%', 'emp501', 'warning',
 '{"field": "paye_discrepancy_percentage", "max_value": 1.0}',
 'PAYE discrepancy exceeds acceptable threshold of 1%'),

(UUID(), 'EMP501_003', 'Monthly Returns Complete', 'All 12 monthly EMP201 returns must be submitted', 'emp501', 'error',
 '{"field": "emp201_count", "equals": 12}',
 'All 12 monthly EMP201 returns must be submitted before year-end reconciliation');

-- Seed sample email template data (optional)
-- These would typically be managed by a template system
COMMIT;
