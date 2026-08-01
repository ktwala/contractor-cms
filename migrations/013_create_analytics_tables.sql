-- Analytics & Reports Module
-- Manages saved reports, analytics dashboards, and report schedules

-- Saved Reports (Custom report configurations)
CREATE TABLE IF NOT EXISTS saved_reports (
  id VARCHAR(36) PRIMARY KEY,
  report_name VARCHAR(200) NOT NULL,
  report_type ENUM('payroll_summary', 'tax_summary', 'employee_costs', 'department_analysis',
                   'leave_summary', 'benefits_summary', 'expense_summary', 'loan_summary',
                   'performance_summary', 'custom') DEFAULT 'custom',
  description TEXT,

  -- Report configuration
  filters JSON, -- { country: 'ZAF', date_from: '2024-01-01', department: 'IT' }
  columns JSON, -- Array of column names to include
  grouping JSON, -- Group by fields
  sorting JSON, -- Sort configuration

  -- Scheduling
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_frequency ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually') DEFAULT NULL,
  schedule_day_of_week INT, -- 0-6 for weekly
  schedule_day_of_month INT, -- 1-31 for monthly
  next_run_date DATETIME,
  last_run_date DATETIME,

  -- Output settings
  output_format ENUM('csv', 'xlsx', 'pdf', 'json') DEFAULT 'csv',
  email_recipients JSON, -- Array of email addresses

  -- Access control
  visibility ENUM('private', 'team', 'company') DEFAULT 'private',
  created_by VARCHAR(36),
  country VARCHAR(3),
  legal_entity_id VARCHAR(36),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_saved_reports_type (report_type),
  INDEX idx_saved_reports_created_by (created_by),
  INDEX idx_saved_reports_scheduled (is_scheduled, next_run_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Report Execution History
CREATE TABLE IF NOT EXISTS report_executions (
  id VARCHAR(36) PRIMARY KEY,
  saved_report_id VARCHAR(36),
  report_name VARCHAR(200),

  -- Execution details
  execution_type ENUM('manual', 'scheduled') DEFAULT 'manual',
  executed_by VARCHAR(36),
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Results
  status ENUM('running', 'completed', 'failed', 'cancelled') DEFAULT 'running',
  record_count INT,
  execution_time_ms INT, -- Execution duration in milliseconds

  -- Output
  file_path VARCHAR(500), -- Path to generated file
  file_size_bytes BIGINT,
  file_format VARCHAR(10),

  -- Error handling
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (saved_report_id) REFERENCES saved_reports(id) ON DELETE SET NULL,
  INDEX idx_report_executions_report (saved_report_id),
  INDEX idx_report_executions_status (status),
  INDEX idx_report_executions_date (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics Snapshots (Pre-calculated metrics for performance)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  snapshot_type ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly') NOT NULL,
  country VARCHAR(3),
  legal_entity_id VARCHAR(36),

  -- Payroll Metrics
  total_employees INT DEFAULT 0,
  active_employees INT DEFAULT 0,
  total_gross_pay DECIMAL(15, 2) DEFAULT 0,
  total_net_pay DECIMAL(15, 2) DEFAULT 0,
  total_taxes DECIMAL(15, 2) DEFAULT 0,
  total_deductions DECIMAL(15, 2) DEFAULT 0,
  total_benefits DECIMAL(15, 2) DEFAULT 0,

  -- Department breakdown
  payroll_by_department JSON, -- { "IT": 50000, "Sales": 75000, ... }

  -- Employee costs
  average_salary DECIMAL(12, 2),
  median_salary DECIMAL(12, 2),

  -- Leave metrics
  total_leave_days INT DEFAULT 0,
  total_sick_days INT DEFAULT 0,

  -- Expense metrics
  total_expenses DECIMAL(15, 2) DEFAULT 0,
  pending_expenses DECIMAL(15, 2) DEFAULT 0,

  -- Loan metrics
  total_loans_disbursed DECIMAL(15, 2) DEFAULT 0,
  total_loan_repayments DECIMAL(15, 2) DEFAULT 0,
  outstanding_loan_balance DECIMAL(15, 2) DEFAULT 0,

  -- Performance metrics
  average_performance_rating DECIMAL(3, 2),
  reviews_completed INT DEFAULT 0,

  -- Additional metadata
  metadata JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_snapshot (snapshot_date, snapshot_type, country, legal_entity_id),
  INDEX idx_analytics_snapshots_date (snapshot_date),
  INDEX idx_analytics_snapshots_type (snapshot_type),
  INDEX idx_analytics_snapshots_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dashboard Widgets (User-customizable dashboard configurations)
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  widget_type ENUM('payroll_summary', 'employee_count', 'tax_breakdown', 'department_costs',
                   'leave_overview', 'expense_summary', 'loan_status', 'performance_overview',
                   'recent_payruns', 'pending_approvals', 'custom_chart') NOT NULL,

  -- Widget configuration
  title VARCHAR(200),
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  width INT DEFAULT 1,
  height INT DEFAULT 1,

  -- Data configuration
  data_config JSON, -- Widget-specific configuration
  refresh_interval INT DEFAULT 300, -- Seconds

  -- Visibility
  is_visible BOOLEAN DEFAULT TRUE,
  dashboard_page VARCHAR(50) DEFAULT 'main', -- 'main', 'payroll', 'hr', etc.

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_dashboard_widgets_user (user_id),
  INDEX idx_dashboard_widgets_page (dashboard_page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics KPIs (Key Performance Indicators tracking)
CREATE TABLE IF NOT EXISTS analytics_kpis (
  id VARCHAR(36) PRIMARY KEY,
  kpi_name VARCHAR(200) NOT NULL,
  kpi_type ENUM('payroll', 'hr', 'leave', 'expense', 'loan', 'performance', 'compliance') NOT NULL,

  -- KPI definition
  description TEXT,
  calculation_method TEXT, -- How this KPI is calculated

  -- Target values
  target_value DECIMAL(15, 2),
  warning_threshold DECIMAL(15, 2),
  critical_threshold DECIMAL(15, 2),

  -- Current value
  current_value DECIMAL(15, 2),
  previous_value DECIMAL(15, 2),

  -- Metadata
  unit VARCHAR(50), -- '%', 'days', 'ZAR', etc.
  country VARCHAR(3),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_calculated_at DATETIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_analytics_kpis_type (kpi_type),
  INDEX idx_analytics_kpis_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed some default KPIs
INSERT IGNORE INTO analytics_kpis (id, kpi_name, kpi_type, description, unit, is_active)
VALUES
('kpi-payroll-cost', 'Total Payroll Cost', 'payroll', 'Total monthly payroll cost across all entities', 'ZAR', TRUE),
('kpi-avg-salary', 'Average Employee Salary', 'payroll', 'Average gross salary per employee', 'ZAR', TRUE),
('kpi-employee-count', 'Active Employee Count', 'hr', 'Total number of active employees', 'employees', TRUE),
('kpi-turnover-rate', 'Employee Turnover Rate', 'hr', 'Percentage of employees who left in the last 12 months', '%', TRUE),
('kpi-leave-utilization', 'Leave Utilization Rate', 'leave', 'Percentage of leave days used vs allocated', '%', TRUE),
('kpi-expense-ratio', 'Expense to Payroll Ratio', 'expense', 'Total expenses as percentage of payroll', '%', TRUE),
('kpi-loan-default-rate', 'Loan Default Rate', 'loan', 'Percentage of loans with missed payments', '%', TRUE),
('kpi-performance-avg', 'Average Performance Rating', 'performance', 'Average performance rating across all reviews', 'rating', TRUE),
('kpi-tax-compliance', 'Tax Filing Compliance', 'compliance', 'Percentage of on-time tax filings', '%', TRUE);

-- Create indexes for performance
CREATE INDEX idx_report_executions_completed ON report_executions(executed_at, status);
CREATE INDEX idx_analytics_snapshots_recent ON analytics_snapshots(snapshot_date DESC, country);
