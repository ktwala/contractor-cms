-- Phase 8: Payroll Cycle Management Migration
-- Operational efficiency features for payroll processing

-- =====================================================
-- 1. PAYROLL CALENDAR MANAGEMENT
-- =====================================================

-- Payroll calendars define pay frequencies and dates
CREATE TABLE IF NOT EXISTS payroll_calendars (
  id CHAR(36) PRIMARY KEY,
  calendar_name VARCHAR(200) NOT NULL,
  legal_entity_id CHAR(36) NOT NULL,
  frequency ENUM('weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'quarterly', 'annual') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  calendar_config JSON, -- Day of week for weekly, dates for semi-monthly, etc.
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_frequency (frequency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payroll periods generated from calendars
CREATE TABLE IF NOT EXISTS payroll_periods (
  id CHAR(36) PRIMARY KEY,
  calendar_id CHAR(36) NOT NULL,
  legal_entity_id CHAR(36) NOT NULL,
  period_name VARCHAR(100) NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  cutoff_date DATE NOT NULL,
  status ENUM('upcoming', 'open', 'locked', 'processing', 'completed', 'closed') DEFAULT 'upcoming',
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by CHAR(36),
  locked_at TIMESTAMP NULL,
  closed_by CHAR(36),
  closed_at TIMESTAMP NULL,
  payrun_id CHAR(36), -- Link to actual payrun
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (calendar_id) REFERENCES payroll_calendars(id),
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (locked_by) REFERENCES users(id),
  FOREIGN KEY (closed_by) REFERENCES users(id),
  FOREIGN KEY (payrun_id) REFERENCES payruns(id),
  UNIQUE KEY unique_period (calendar_id, period_start_date, period_end_date),
  INDEX idx_calendar (calendar_id),
  INDEX idx_status (status),
  INDEX idx_dates (period_start_date, period_end_date),
  INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. PAYROLL CHECKLIST & TASKS
-- =====================================================

-- Checklist templates
CREATE TABLE IF NOT EXISTS payroll_checklist_templates (
  id CHAR(36) PRIMARY KEY,
  template_name VARCHAR(200) NOT NULL,
  legal_entity_id CHAR(36),
  frequency ENUM('weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'quarterly', 'annual'),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_legal_entity (legal_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Template items (tasks)
CREATE TABLE IF NOT EXISTS payroll_checklist_template_items (
  id CHAR(36) PRIMARY KEY,
  template_id CHAR(36) NOT NULL,
  task_name VARCHAR(200) NOT NULL,
  task_description TEXT,
  task_category ENUM('pre_payroll', 'during_payroll', 'post_payroll', 'compliance', 'reporting') NOT NULL,
  task_order INT NOT NULL,
  assigned_role VARCHAR(100), -- Role responsible for this task
  due_offset_days INT DEFAULT 0, -- Days before/after period end
  is_required BOOLEAN DEFAULT TRUE,
  estimated_duration_minutes INT,
  task_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES payroll_checklist_templates(id) ON DELETE CASCADE,
  INDEX idx_template (template_id),
  INDEX idx_category (task_category),
  INDEX idx_order (template_id, task_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Actual checklist instances for periods
CREATE TABLE IF NOT EXISTS payroll_checklists (
  id CHAR(36) PRIMARY KEY,
  period_id CHAR(36) NOT NULL,
  template_id CHAR(36),
  checklist_name VARCHAR(200) NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'overdue') DEFAULT 'pending',
  total_tasks INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  completion_percentage DECIMAL(5,2) DEFAULT 0.00,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES payroll_checklist_templates(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_period (period_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Checklist tasks
CREATE TABLE IF NOT EXISTS payroll_checklist_tasks (
  id CHAR(36) PRIMARY KEY,
  checklist_id CHAR(36) NOT NULL,
  task_name VARCHAR(200) NOT NULL,
  task_description TEXT,
  task_category ENUM('pre_payroll', 'during_payroll', 'post_payroll', 'compliance', 'reporting') NOT NULL,
  task_order INT NOT NULL,
  assigned_to CHAR(36),
  due_date DATE,
  status ENUM('pending', 'in_progress', 'completed', 'skipped', 'blocked') DEFAULT 'pending',
  is_required BOOLEAN DEFAULT TRUE,
  completed_by CHAR(36),
  completed_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (checklist_id) REFERENCES payroll_checklists(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (completed_by) REFERENCES users(id),
  INDEX idx_checklist (checklist_id),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. PAYROLL TIMELINE & MILESTONES
-- =====================================================

-- Payroll processing milestones
CREATE TABLE IF NOT EXISTS payroll_milestones (
  id CHAR(36) PRIMARY KEY,
  period_id CHAR(36) NOT NULL,
  milestone_name VARCHAR(200) NOT NULL,
  milestone_type ENUM('cutoff', 'data_collection', 'validation', 'approval', 'processing', 'payment', 'reporting', 'completion') NOT NULL,
  milestone_order INT NOT NULL,
  scheduled_date TIMESTAMP,
  actual_date TIMESTAMP NULL,
  status ENUM('pending', 'in_progress', 'completed', 'delayed', 'skipped') DEFAULT 'pending',
  completed_by CHAR(36),
  duration_minutes INT, -- Time taken to complete
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id),
  INDEX idx_period (period_id),
  INDEX idx_type (milestone_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. PAYROLL EXCEPTIONS & ALERTS
-- =====================================================

-- Payroll exceptions (anomalies detected)
CREATE TABLE IF NOT EXISTS payroll_exceptions (
  id CHAR(36) PRIMARY KEY,
  period_id CHAR(36) NOT NULL,
  payrun_id CHAR(36),
  employee_id CHAR(36),
  exception_type VARCHAR(100) NOT NULL, -- 'missing_timesheet', 'variance_detected', 'negative_pay', 'zero_pay', 'high_overtime', etc.
  exception_category ENUM('data_missing', 'calculation_error', 'variance', 'compliance', 'approval_required', 'other') NOT NULL,
  severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'warning',
  exception_description TEXT NOT NULL,
  expected_value DECIMAL(15,2),
  actual_value DECIMAL(15,2),
  variance_amount DECIMAL(15,2),
  variance_percentage DECIMAL(5,2),
  status ENUM('open', 'acknowledged', 'resolved', 'dismissed') DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by CHAR(36),
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (payrun_id) REFERENCES payruns(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id),
  INDEX idx_period (period_id),
  INDEX idx_type (exception_type),
  INDEX idx_severity (severity),
  INDEX idx_status (status),
  INDEX idx_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. PAYROLL RECONCILIATION
-- =====================================================

-- Period-over-period reconciliation
CREATE TABLE IF NOT EXISTS payroll_reconciliations (
  id CHAR(36) PRIMARY KEY,
  period_id CHAR(36) NOT NULL,
  comparison_period_id CHAR(36) NOT NULL,
  reconciliation_type ENUM('period_over_period', 'budget_vs_actual', 'forecast_vs_actual') DEFAULT 'period_over_period',
  status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
  total_variance DECIMAL(15,2) DEFAULT 0.00,
  variance_percentage DECIMAL(5,2) DEFAULT 0.00,
  reconciled_by CHAR(36),
  reconciled_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id),
  FOREIGN KEY (comparison_period_id) REFERENCES payroll_periods(id),
  FOREIGN KEY (reconciled_by) REFERENCES users(id),
  INDEX idx_period (period_id),
  INDEX idx_comparison (comparison_period_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reconciliation line items
CREATE TABLE IF NOT EXISTS payroll_reconciliation_items (
  id CHAR(36) PRIMARY KEY,
  reconciliation_id CHAR(36) NOT NULL,
  item_type VARCHAR(100) NOT NULL, -- 'gross_pay', 'deductions', 'net_pay', 'employee_count', 'overtime', etc.
  current_value DECIMAL(15,2) NOT NULL,
  comparison_value DECIMAL(15,2) NOT NULL,
  variance_amount DECIMAL(15,2) NOT NULL,
  variance_percentage DECIMAL(5,2) NOT NULL,
  explanation TEXT,
  is_explained BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reconciliation_id) REFERENCES payroll_reconciliations(id) ON DELETE CASCADE,
  INDEX idx_reconciliation (reconciliation_id),
  INDEX idx_type (item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. PAYROLL FORECASTING
-- =====================================================

-- Payroll forecasts
CREATE TABLE IF NOT EXISTS payroll_forecasts (
  id CHAR(36) PRIMARY KEY,
  legal_entity_id CHAR(36) NOT NULL,
  forecast_name VARCHAR(200) NOT NULL,
  forecast_type ENUM('monthly', 'quarterly', 'annual') NOT NULL,
  forecast_period_start DATE NOT NULL,
  forecast_period_end DATE NOT NULL,
  base_period_id CHAR(36), -- Base period for forecast calculation
  forecast_method ENUM('historical_average', 'trend_analysis', 'manual', 'budget_based') DEFAULT 'historical_average',
  total_forecast_amount DECIMAL(15,2) DEFAULT 0.00,
  assumptions JSON, -- Assumptions used for forecast (growth rate, headcount changes, etc.)
  status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (base_period_id) REFERENCES payroll_periods(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_dates (forecast_period_start, forecast_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Forecast line items
CREATE TABLE IF NOT EXISTS payroll_forecast_items (
  id CHAR(36) PRIMARY KEY,
  forecast_id CHAR(36) NOT NULL,
  item_type VARCHAR(100) NOT NULL, -- 'basic_salary', 'overtime', 'bonuses', 'benefits', 'deductions', etc.
  forecast_amount DECIMAL(15,2) NOT NULL,
  actual_amount DECIMAL(15,2) DEFAULT 0.00,
  variance_amount DECIMAL(15,2) DEFAULT 0.00,
  variance_percentage DECIMAL(5,2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (forecast_id) REFERENCES payroll_forecasts(id) ON DELETE CASCADE,
  INDEX idx_forecast (forecast_id),
  INDEX idx_type (item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. PAYROLL SIGN-OFF
-- =====================================================

-- Sign-off stages
CREATE TABLE IF NOT EXISTS payroll_signoffs (
  id CHAR(36) PRIMARY KEY,
  period_id CHAR(36) NOT NULL,
  signoff_stage ENUM('data_verification', 'calculation_review', 'management_approval', 'final_approval') NOT NULL,
  signoff_order INT NOT NULL,
  required_role VARCHAR(100),
  assigned_to CHAR(36),
  status ENUM('pending', 'approved', 'rejected', 'skipped') DEFAULT 'pending',
  signed_by CHAR(36),
  signed_at TIMESTAMP NULL,
  comments TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (signed_by) REFERENCES users(id),
  INDEX idx_period (period_id),
  INDEX idx_status (status),
  INDEX idx_assigned_to (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. RECURRING PAYROLL ITEMS
-- =====================================================

-- Recurring earnings and deductions
CREATE TABLE IF NOT EXISTS recurring_payroll_items (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  item_type ENUM('earning', 'deduction', 'reimbursement') NOT NULL,
  pay_item_id CHAR(36) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  frequency ENUM('every_period', 'monthly', 'quarterly', 'annual') DEFAULT 'every_period',
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  auto_create BOOLEAN DEFAULT TRUE, -- Automatically add to payrun
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (pay_item_id) REFERENCES pay_items(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_employee (employee_id),
  INDEX idx_active (is_active),
  INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. PAYROLL ADJUSTMENTS
-- =====================================================

-- Track manual adjustments to payroll
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id CHAR(36) PRIMARY KEY,
  period_id CHAR(36) NOT NULL,
  payrun_id CHAR(36),
  employee_id CHAR(36) NOT NULL,
  adjustment_type ENUM('correction', 'backpay', 'overpayment_recovery', 'bonus', 'other') NOT NULL,
  adjustment_reason TEXT NOT NULL,
  original_amount DECIMAL(15,2),
  adjustment_amount DECIMAL(15,2) NOT NULL,
  new_amount DECIMAL(15,2),
  affected_field VARCHAR(100), -- Which field was adjusted
  approval_required BOOLEAN DEFAULT TRUE,
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by CHAR(36),
  approved_at TIMESTAMP NULL,
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMP NULL,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id),
  FOREIGN KEY (payrun_id) REFERENCES payruns(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_period (period_id),
  INDEX idx_employee (employee_id),
  INDEX idx_status (approval_status),
  INDEX idx_type (adjustment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Seed a sample monthly payroll checklist template
INSERT INTO payroll_checklist_templates (id, template_name, frequency, description, created_by) VALUES
(UUID(), 'Standard Monthly Payroll', 'monthly', 'Standard checklist for monthly payroll processing', NULL);

SET @template_id = (SELECT id FROM payroll_checklist_templates WHERE template_name = 'Standard Monthly Payroll' LIMIT 1);

-- Seed template items
INSERT INTO payroll_checklist_template_items (id, template_id, task_name, task_description, task_category, task_order, assigned_role, due_offset_days, is_required, estimated_duration_minutes) VALUES
(UUID(), @template_id, 'Collect Timesheets', 'Ensure all timesheets are submitted and approved', 'pre_payroll', 1, 'PAYROLL_OFFICER', -3, TRUE, 30),
(UUID(), @template_id, 'Review Leave Applications', 'Process and approve all leave applications', 'pre_payroll', 2, 'HR_MANAGER', -3, TRUE, 20),
(UUID(), @template_id, 'Update Employee Changes', 'Update any new hires, terminations, or changes', 'pre_payroll', 3, 'HR_MANAGER', -2, TRUE, 45),
(UUID(), @template_id, 'Review Recurring Items', 'Verify all recurring earnings and deductions', 'pre_payroll', 4, 'PAYROLL_OFFICER', -2, TRUE, 15),
(UUID(), @template_id, 'Create Payrun', 'Initialize payrun for the period', 'during_payroll', 5, 'PAYROLL_OFFICER', 0, TRUE, 10),
(UUID(), @template_id, 'Calculate Payroll', 'Run payroll calculations', 'during_payroll', 6, 'PAYROLL_OFFICER', 0, TRUE, 30),
(UUID(), @template_id, 'Review Exceptions', 'Review and resolve all payroll exceptions', 'during_payroll', 7, 'PAYROLL_MANAGER', 0, TRUE, 60),
(UUID(), @template_id, 'Reconcile with Previous Period', 'Compare with previous period and explain variances', 'during_payroll', 8, 'PAYROLL_MANAGER', 0, TRUE, 45),
(UUID(), @template_id, 'Manager Approval', 'Get payroll approved by payroll manager', 'during_payroll', 9, 'PAYROLL_MANAGER', 0, TRUE, 15),
(UUID(), @template_id, 'Finance Approval', 'Get final approval from finance', 'during_payroll', 10, 'FINANCE_MANAGER', 0, TRUE, 15),
(UUID(), @template_id, 'Generate Payslips', 'Generate and distribute payslips to employees', 'post_payroll', 11, 'PAYROLL_OFFICER', 1, TRUE, 20),
(UUID(), @template_id, 'Submit Bank File', 'Generate and submit bank payment file', 'post_payroll', 12, 'PAYROLL_OFFICER', 1, TRUE, 15),
(UUID(), @template_id, 'Generate GL Journal', 'Create and post GL journal entries', 'post_payroll', 13, 'FINANCE_MANAGER', 1, TRUE, 30),
(UUID(), @template_id, 'Submit SARS EMP201', 'Submit monthly SARS declaration', 'compliance', 14, 'PAYROLL_MANAGER', 7, TRUE, 45),
(UUID(), @template_id, 'Submit UIF Declaration', 'Submit UIF monthly declaration', 'compliance', 15, 'PAYROLL_MANAGER', 7, TRUE, 30),
(UUID(), @template_id, 'Generate Payroll Reports', 'Generate and distribute management reports', 'reporting', 16, 'PAYROLL_OFFICER', 2, FALSE, 30);
