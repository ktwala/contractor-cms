-- Migration: Advanced Compliance & Statutory Reporting
-- Description: UIF, SDL, COIDA, Garnishments, and Compliance Management
-- Author: System
-- Date: 2025-12-29

-- =====================================================
-- 1. UIF (Unemployment Insurance Fund) Declarations
-- =====================================================
CREATE TABLE IF NOT EXISTS uif_declarations (
  id CHAR(36) PRIMARY KEY,
  declaration_period VARCHAR(7) NOT NULL, -- YYYY-MM format
  legal_entity_id CHAR(36) NOT NULL,
  uif_reference_number VARCHAR(50),

  -- Totals
  total_employees INT DEFAULT 0,
  total_remuneration DECIMAL(15,2) DEFAULT 0.00,
  total_uif_contribution DECIMAL(15,2) DEFAULT 0.00,
  employer_contribution DECIMAL(15,2) DEFAULT 0.00,
  employee_contribution DECIMAL(15,2) DEFAULT 0.00,

  -- Status
  status ENUM('draft', 'submitted', 'accepted', 'rejected') DEFAULT 'draft',
  submission_date DATETIME,
  submission_reference VARCHAR(100),
  submission_response TEXT,

  -- Audit
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_period_entity (declaration_period, legal_entity_id),
  INDEX idx_period (declaration_period),
  INDEX idx_status (status),
  INDEX idx_legal_entity (legal_entity_id),

  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. UIF Declaration Line Items
-- =====================================================
CREATE TABLE IF NOT EXISTS uif_declaration_lines (
  id CHAR(36) PRIMARY KEY,
  uif_declaration_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,

  -- Employee Details
  id_number VARCHAR(20),
  initials VARCHAR(10),
  surname VARCHAR(100),

  -- UIF Calculation
  remuneration DECIMAL(15,2) DEFAULT 0.00,
  uif_remuneration DECIMAL(15,2) DEFAULT 0.00, -- Capped at UIF threshold
  employer_contribution DECIMAL(15,2) DEFAULT 0.00,
  employee_contribution DECIMAL(15,2) DEFAULT 0.00,
  total_contribution DECIMAL(15,2) DEFAULT 0.00,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_declaration (uif_declaration_id),
  INDEX idx_employee (employee_id),

  FOREIGN KEY (uif_declaration_id) REFERENCES uif_declarations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. SDL (Skills Development Levy) Declarations
-- =====================================================
CREATE TABLE IF NOT EXISTS sdl_declarations (
  id CHAR(36) PRIMARY KEY,
  declaration_period VARCHAR(7) NOT NULL, -- YYYY-MM format
  legal_entity_id CHAR(36) NOT NULL,
  sdl_reference_number VARCHAR(50),
  sic_code VARCHAR(10), -- Standard Industrial Classification

  -- Totals
  total_employees INT DEFAULT 0,
  total_leviable_amount DECIMAL(15,2) DEFAULT 0.00,
  sdl_levy DECIMAL(15,2) DEFAULT 0.00, -- 1% of leviable amount

  -- Exemptions
  is_exempt BOOLEAN DEFAULT FALSE,
  exemption_reason TEXT,

  -- Status
  status ENUM('draft', 'submitted', 'paid', 'rejected') DEFAULT 'draft',
  submission_date DATETIME,
  payment_date DATETIME,
  payment_reference VARCHAR(100),

  -- Audit
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_period_entity (declaration_period, legal_entity_id),
  INDEX idx_period (declaration_period),
  INDEX idx_status (status),
  INDEX idx_legal_entity (legal_entity_id),

  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. SDL Declaration Line Items
-- =====================================================
CREATE TABLE IF NOT EXISTS sdl_declaration_lines (
  id CHAR(36) PRIMARY KEY,
  sdl_declaration_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,

  -- Employee Details
  id_number VARCHAR(20),
  surname VARCHAR(100),

  -- SDL Calculation
  total_remuneration DECIMAL(15,2) DEFAULT 0.00,
  leviable_amount DECIMAL(15,2) DEFAULT 0.00,
  sdl_levy DECIMAL(15,2) DEFAULT 0.00,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_declaration (sdl_declaration_id),
  INDEX idx_employee (employee_id),

  FOREIGN KEY (sdl_declaration_id) REFERENCES sdl_declarations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. COIDA (Compensation Fund) Assessments
-- =====================================================
CREATE TABLE IF NOT EXISTS coida_assessments (
  id CHAR(36) PRIMARY KEY,
  assessment_year INT NOT NULL,
  legal_entity_id CHAR(36) NOT NULL,
  registration_number VARCHAR(50),

  -- Classification
  risk_class VARCHAR(10), -- e.g., "A", "B", "C", "D", "E"
  tariff_rate DECIMAL(5,4), -- Percentage rate

  -- Totals
  total_remuneration DECIMAL(15,2) DEFAULT 0.00,
  total_assessment DECIMAL(15,2) DEFAULT 0.00,

  -- Payments
  estimated_amount DECIMAL(15,2) DEFAULT 0.00,
  paid_amount DECIMAL(15,2) DEFAULT 0.00,
  balance_due DECIMAL(15,2) DEFAULT 0.00,

  -- Status
  status ENUM('draft', 'submitted', 'assessed', 'paid', 'overdue') DEFAULT 'draft',
  submission_date DATETIME,
  assessment_date DATETIME,
  due_date DATE,

  -- Audit
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_year_entity (assessment_year, legal_entity_id),
  INDEX idx_year (assessment_year),
  INDEX idx_status (status),
  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_due_date (due_date),

  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. COIDA Return of Earnings
-- =====================================================
CREATE TABLE IF NOT EXISTS coida_return_of_earnings (
  id CHAR(36) PRIMARY KEY,
  coida_assessment_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,

  -- Employee Details
  id_number VARCHAR(20),
  full_name VARCHAR(200),
  occupation VARCHAR(100),

  -- Earnings
  total_earnings DECIMAL(15,2) DEFAULT 0.00,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_assessment (coida_assessment_id),
  INDEX idx_employee (employee_id),

  FOREIGN KEY (coida_assessment_id) REFERENCES coida_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. Garnishment Orders (Court Orders & Maintenance)
-- =====================================================
CREATE TABLE IF NOT EXISTS garnishment_orders (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,

  -- Order Details
  order_type ENUM('emolument_attachment', 'maintenance', 'debt_review', 'administration', 'other') NOT NULL,
  order_number VARCHAR(100) NOT NULL,
  court_name VARCHAR(200),
  case_number VARCHAR(100),

  -- Creditor/Recipient
  creditor_name VARCHAR(200),
  creditor_contact VARCHAR(200),
  creditor_bank_account VARCHAR(50),
  creditor_bank_name VARCHAR(100),
  creditor_branch_code VARCHAR(10),

  -- Deduction Details
  deduction_type ENUM('fixed_amount', 'percentage', 'formula') NOT NULL,
  deduction_amount DECIMAL(15,2),
  deduction_percentage DECIMAL(5,2),
  maximum_amount DECIMAL(15,2), -- Maximum per deduction
  priority_order INT DEFAULT 99, -- Lower number = higher priority

  -- Protected Earnings
  protected_earnings_percentage DECIMAL(5,2) DEFAULT 25.00, -- Section 65J

  -- Period
  start_date DATE NOT NULL,
  end_date DATE,
  is_indefinite BOOLEAN DEFAULT FALSE,

  -- Status
  status ENUM('active', 'suspended', 'completed', 'cancelled') DEFAULT 'active',
  suspension_reason TEXT,
  completion_date DATE,

  -- Totals
  total_deducted DECIMAL(15,2) DEFAULT 0.00,
  balance_outstanding DECIMAL(15,2),

  -- Documents
  court_order_document_path VARCHAR(500),

  -- Audit
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_employee (employee_id),
  INDEX idx_order_type (order_type),
  INDEX idx_status (status),
  INDEX idx_start_date (start_date),
  INDEX idx_priority (priority_order),

  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. Garnishment Deduction History
-- =====================================================
CREATE TABLE IF NOT EXISTS garnishment_deductions (
  id CHAR(36) PRIMARY KEY,
  garnishment_order_id CHAR(36) NOT NULL,
  payslip_id CHAR(36) NOT NULL,
  payrun_id CHAR(36) NOT NULL,

  -- Calculation
  gross_pay DECIMAL(15,2) DEFAULT 0.00,
  protected_amount DECIMAL(15,2) DEFAULT 0.00,
  available_for_deduction DECIMAL(15,2) DEFAULT 0.00,
  deduction_amount DECIMAL(15,2) DEFAULT 0.00,

  -- Payment
  payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
  payment_date DATE,
  payment_reference VARCHAR(100),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_garnishment (garnishment_order_id),
  INDEX idx_payslip (payslip_id),
  INDEX idx_payrun (payrun_id),
  INDEX idx_payment_status (payment_status),

  FOREIGN KEY (garnishment_order_id) REFERENCES garnishment_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE CASCADE,
  FOREIGN KEY (payrun_id) REFERENCES payruns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. Compliance Checklist
-- =====================================================
CREATE TABLE IF NOT EXISTS compliance_checklist (
  id CHAR(36) PRIMARY KEY,
  legal_entity_id CHAR(36) NOT NULL,

  -- Checklist Details
  checklist_type ENUM('monthly', 'quarterly', 'annual', 'adhoc') NOT NULL,
  period VARCHAR(10) NOT NULL, -- YYYY-MM or YYYY-QN or YYYY

  -- Item
  item_name VARCHAR(200) NOT NULL,
  item_description TEXT,
  category VARCHAR(100), -- e.g., "SARS", "UIF", "SDL", "COIDA", "Internal"
  due_date DATE NOT NULL,

  -- Status
  status ENUM('pending', 'in_progress', 'completed', 'overdue', 'not_applicable') DEFAULT 'pending',
  completed_date DATETIME,
  completed_by CHAR(36),

  -- Notes
  notes TEXT,
  attachments JSON, -- Array of document paths

  -- Priority
  priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_period (period),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status),
  INDEX idx_category (category),

  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. Statutory Deadlines
-- =====================================================
CREATE TABLE IF NOT EXISTS statutory_deadlines (
  id CHAR(36) PRIMARY KEY,

  -- Deadline Details
  deadline_name VARCHAR(200) NOT NULL,
  deadline_type VARCHAR(100) NOT NULL, -- e.g., "SARS_EMP201", "UIF", "SDL", "COIDA"
  description TEXT,

  -- Frequency
  frequency ENUM('monthly', 'quarterly', 'biannual', 'annual') NOT NULL,

  -- Due Date Calculation
  due_day_of_month INT, -- e.g., 7 for SARS EMP201
  due_month INT, -- For annual deadlines
  due_quarter INT, -- For quarterly deadlines

  -- Alerts
  alert_days_before INT DEFAULT 7,
  is_critical BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_deadline_type (deadline_type),
  INDEX idx_frequency (frequency),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. Legislative Changes
-- =====================================================
CREATE TABLE IF NOT EXISTS legislative_changes (
  id CHAR(36) PRIMARY KEY,

  -- Change Details
  change_title VARCHAR(300) NOT NULL,
  change_description TEXT NOT NULL,
  change_category VARCHAR(100), -- e.g., "Tax", "Labour", "UIF", "SDL", "COIDA"

  -- Dates
  announcement_date DATE,
  effective_date DATE NOT NULL,
  implementation_deadline DATE,

  -- Impact
  impact_level ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
  affected_modules JSON, -- Array of module names
  action_required TEXT,

  -- Links
  reference_url VARCHAR(500),
  document_path VARCHAR(500),

  -- Status
  implementation_status ENUM('pending', 'in_progress', 'completed', 'not_applicable') DEFAULT 'pending',

  -- Notifications
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at DATETIME,

  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_effective_date (effective_date),
  INDEX idx_category (change_category),
  INDEX idx_impact_level (impact_level),
  INDEX idx_implementation_status (implementation_status),

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. Compliance Alerts
-- =====================================================
CREATE TABLE IF NOT EXISTS compliance_alerts (
  id CHAR(36) PRIMARY KEY,
  legal_entity_id CHAR(36),

  -- Alert Details
  alert_type VARCHAR(100) NOT NULL, -- e.g., "upcoming_deadline", "overdue", "legislative_change"
  alert_severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
  alert_title VARCHAR(300) NOT NULL,
  alert_message TEXT NOT NULL,

  -- References
  reference_type VARCHAR(100), -- e.g., "uif_declaration", "sdl_declaration", "checklist_item"
  reference_id CHAR(36),

  -- Status
  status ENUM('active', 'acknowledged', 'resolved', 'dismissed') DEFAULT 'active',
  acknowledged_by CHAR(36),
  acknowledged_at DATETIME,
  resolved_at DATETIME,

  -- Expiry
  expires_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_alert_type (alert_type),
  INDEX idx_status (status),
  INDEX idx_severity (alert_severity),

  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Seed Data: Statutory Deadlines
-- =====================================================
INSERT INTO statutory_deadlines (id, deadline_name, deadline_type, description, frequency, due_day_of_month, alert_days_before, is_critical) VALUES
(UUID(), 'SARS EMP201 Monthly Return', 'SARS_EMP201', 'Monthly employer declaration to SARS', 'monthly', 7, 5, TRUE),
(UUID(), 'UIF Monthly Declaration', 'UIF_MONTHLY', 'Monthly UIF declaration and payment', 'monthly', 7, 5, TRUE),
(UUID(), 'SDL Monthly Payment', 'SDL_MONTHLY', 'Skills Development Levy monthly payment', 'monthly', 7, 5, TRUE),
(UUID(), 'SARS IRP5/IT3(a) Submission', 'SARS_IRP5', 'Annual employee tax certificates submission', 'annual', NULL, 30, TRUE),
(UUID(), 'SARS EMP501 Reconciliation', 'SARS_EMP501', 'Annual employer reconciliation', 'annual', NULL, 30, TRUE),
(UUID(), 'COIDA Annual Assessment', 'COIDA_ASSESSMENT', 'Compensation Fund annual assessment', 'annual', NULL, 30, TRUE),
(UUID(), 'COIDA Return of Earnings', 'COIDA_EARNINGS', 'Annual return of earnings to Compensation Fund', 'annual', NULL, 30, TRUE);

-- =====================================================
-- Seed Data: Compliance Checklist Templates
-- =====================================================
-- Monthly checklist items
INSERT INTO compliance_checklist (id, legal_entity_id, checklist_type, period, item_name, item_description, category, due_date, priority)
SELECT
  UUID(),
  le.id,
  'monthly',
  DATE_FORMAT(CURRENT_DATE(), '%Y-%m'),
  'Process Monthly Payroll',
  'Complete and approve monthly payroll run',
  'Internal',
  LAST_DAY(CURRENT_DATE()),
  'critical'
FROM legal_entities le
LIMIT 1;

-- =====================================================
-- Seed Data: Legislative Changes (Examples)
-- =====================================================
INSERT INTO legislative_changes (id, change_title, change_description, change_category, announcement_date, effective_date, impact_level, affected_modules, action_required) VALUES
(UUID(), 'National Minimum Wage Increase 2025', 'National minimum wage increased to R27.58 per hour', 'Labour', '2024-11-01', '2025-03-01', 'high', JSON_ARRAY('payroll', 'compliance'), 'Update minimum wage validation rules in payroll system'),
(UUID(), 'UIF Contribution Rate Change', 'UIF contribution remains at 1% (employer) + 1% (employee)', 'UIF', '2024-12-01', '2025-04-01', 'medium', JSON_ARRAY('payroll', 'uif'), 'Verify UIF calculation rules'),
(UUID(), 'SDL Threshold Increase', 'SDL levy threshold increased to R500,000 annual payroll', 'SDL', '2024-11-15', '2025-04-01', 'medium', JSON_ARRAY('payroll', 'sdl'), 'Update SDL exemption logic');
