-- Notifications & Automation Tables (Phase 3)
-- Purpose: Comprehensive notification system with alerts, reminders, and automation

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,

  -- Email preferences
  email_enabled BOOLEAN DEFAULT TRUE,
  email_payslips BOOLEAN DEFAULT TRUE,
  email_tax_certificates BOOLEAN DEFAULT TRUE,
  email_leave_approvals BOOLEAN DEFAULT TRUE,
  email_expense_approvals BOOLEAN DEFAULT TRUE,
  email_loan_updates BOOLEAN DEFAULT TRUE,
  email_performance_reviews BOOLEAN DEFAULT TRUE,
  email_deadline_reminders BOOLEAN DEFAULT TRUE,

  -- SMS preferences
  sms_enabled BOOLEAN DEFAULT FALSE,
  sms_critical_only BOOLEAN DEFAULT TRUE,
  sms_payslips BOOLEAN DEFAULT FALSE,
  sms_deadline_reminders BOOLEAN DEFAULT TRUE,

  -- Notification frequency
  digest_enabled BOOLEAN DEFAULT FALSE,
  digest_frequency ENUM('daily', 'weekly') DEFAULT 'daily',

  -- Contact details
  primary_email VARCHAR(255),
  secondary_email VARCHAR(255),
  mobile_number VARCHAR(20),

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_prefs (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SMS Notifications Table
CREATE TABLE IF NOT EXISTS sms_notifications (
  id VARCHAR(36) PRIMARY KEY,
  notification_type VARCHAR(50) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(255),
  message TEXT NOT NULL,

  -- Related documents
  document_type VARCHAR(50),
  document_id VARCHAR(36),

  -- Status
  status ENUM('pending', 'sent', 'delivered', 'failed', 'bounced') DEFAULT 'pending',
  sent_at DATETIME,
  delivered_at DATETIME,
  failed_reason TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Provider tracking
  provider VARCHAR(50) DEFAULT 'twilio',
  provider_message_id VARCHAR(100),
  provider_status VARCHAR(50),

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_recipient (recipient_phone),
  INDEX idx_status (status),
  INDEX idx_notification_type (notification_type),
  INDEX idx_document (document_type, document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alert Schedules Table
CREATE TABLE IF NOT EXISTS alert_schedules (
  id VARCHAR(36) PRIMARY KEY,
  alert_name VARCHAR(255) NOT NULL,
  alert_type ENUM('deadline', 'reminder', 'recurring', 'one_time') DEFAULT 'reminder',
  description TEXT,

  -- Targeting
  target_type ENUM('all_users', 'role', 'department', 'specific_users') DEFAULT 'all_users',
  target_value VARCHAR(255), -- role name, department ID, or user IDs (JSON)

  -- Schedule
  schedule_type ENUM('cron', 'date', 'relative') DEFAULT 'cron',
  cron_expression VARCHAR(100), -- e.g., '0 9 * * 1' for every Monday at 9 AM
  scheduled_date DATETIME,
  relative_days INT, -- Days before event

  -- Content
  subject VARCHAR(500),
  message TEXT,
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',

  -- Channels
  send_email BOOLEAN DEFAULT TRUE,
  send_sms BOOLEAN DEFAULT FALSE,
  send_in_app BOOLEAN DEFAULT TRUE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at DATETIME,
  next_run_at DATETIME,
  run_count INT DEFAULT 0,

  -- Audit
  created_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_active (is_active),
  INDEX idx_next_run (next_run_at),
  INDEX idx_alert_type (alert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scheduled Reports Table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id VARCHAR(36) PRIMARY KEY,
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) NOT NULL, -- payroll_summary, tax_report, attendance, etc.
  description TEXT,

  -- Schedule
  schedule_type ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly') DEFAULT 'monthly',
  cron_expression VARCHAR(100),
  run_day_of_week INT, -- 0-6 for Sunday-Saturday
  run_day_of_month INT, -- 1-31
  run_time TIME DEFAULT '09:00:00',

  -- Recipients
  recipient_emails JSON, -- Array of email addresses
  recipient_roles JSON, -- Array of role names

  -- Report parameters
  parameters JSON, -- Report-specific parameters

  -- Output format
  format ENUM('pdf', 'csv', 'excel', 'html') DEFAULT 'pdf',
  include_attachments BOOLEAN DEFAULT TRUE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at DATETIME,
  next_run_at DATETIME,
  last_run_status VARCHAR(50),
  last_run_error TEXT,

  -- Audit
  created_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_active (is_active),
  INDEX idx_next_run (next_run_at),
  INDEX idx_report_type (report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow Notifications Table
CREATE TABLE IF NOT EXISTS workflow_notifications (
  id VARCHAR(36) PRIMARY KEY,
  workflow_type VARCHAR(50) NOT NULL, -- expense_approval, leave_approval, loan_approval, etc.
  workflow_id VARCHAR(36) NOT NULL, -- ID of the workflow item
  workflow_status VARCHAR(50) NOT NULL, -- submitted, approved, rejected, etc.

  -- Actor information
  actor_id VARCHAR(36), -- User who triggered the notification
  actor_name VARCHAR(255),

  -- Recipient information
  recipient_id VARCHAR(36) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),

  -- Notification content
  subject VARCHAR(500),
  message TEXT,
  action_required BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),

  -- Status
  status ENUM('pending', 'sent', 'read', 'actioned', 'expired') DEFAULT 'pending',
  sent_at DATETIME,
  read_at DATETIME,
  actioned_at DATETIME,
  expires_at DATETIME,

  -- Channels used
  sent_via_email BOOLEAN DEFAULT FALSE,
  sent_via_sms BOOLEAN DEFAULT FALSE,
  sent_via_in_app BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (recipient_id) REFERENCES users(id),
  INDEX idx_workflow (workflow_type, workflow_id),
  INDEX idx_recipient (recipient_id),
  INDEX idx_status (status),
  INDEX idx_action_required (action_required)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- In-App Notifications Table
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,

  -- Related entity
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),

  -- Action
  action_url VARCHAR(500),
  action_label VARCHAR(100),

  -- Priority and styling
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  icon VARCHAR(50),
  color VARCHAR(20),

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at DATETIME,

  -- Expiry
  expires_at DATETIME,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_unread (user_id, is_read),
  INDEX idx_notification_type (notification_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification Log Table (for audit trail)
CREATE TABLE IF NOT EXISTS notification_log (
  id VARCHAR(36) PRIMARY KEY,
  notification_id VARCHAR(36),
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- email, sms, in_app

  -- Recipient
  recipient_id VARCHAR(36),
  recipient_identifier VARCHAR(255), -- email or phone

  -- Content
  subject VARCHAR(500),
  message TEXT,

  -- Status
  status VARCHAR(50) NOT NULL,
  error_message TEXT,

  -- Metadata
  metadata JSON,

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_notification (notification_id),
  INDEX idx_recipient (recipient_id),
  INDEX idx_channel (channel),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed alert schedules for common reminders
INSERT INTO alert_schedules (id, alert_name, alert_type, description, target_type, schedule_type, cron_expression, subject, message, priority, send_email, is_active, created_by) VALUES
-- EMP201 Deadline Reminder (7th of each month)
(UUID(), 'EMP201 Monthly Submission Reminder', 'deadline', 'Reminder to submit EMP201 monthly return', 'role', 'cron', '0 9 5 * *',
 'EMP201 Submission Due in 2 Days', 'This is a reminder that the EMP201 monthly return is due on the 7th. Please ensure all submissions are completed.',
 'high', TRUE, TRUE, 'system'),

-- IRP5 Deadline Reminder (May 31st annually)
(UUID(), 'IRP5 Annual Submission Reminder', 'deadline', 'Reminder to issue IRP5 certificates', 'role', 'cron', '0 9 15 5 *',
 'IRP5 Certificates Due in 2 Weeks', 'This is a reminder that IRP5 tax certificates must be issued to employees by May 31st.',
 'high', TRUE, TRUE, 'system'),

-- Payroll Processing Reminder (25th of each month)
(UUID(), 'Monthly Payroll Processing Reminder', 'recurring', 'Reminder to process monthly payroll', 'role', 'cron', '0 9 25 * *',
 'Monthly Payroll Processing Due', 'Please ensure monthly payroll is processed by month-end.',
 'high', TRUE, TRUE, 'system'),

-- Performance Review Reminder (Quarterly)
(UUID(), 'Quarterly Performance Review Reminder', 'recurring', 'Reminder for quarterly performance reviews', 'role', 'cron', '0 9 1 1,4,7,10 *',
 'Quarterly Performance Reviews Due', 'This is a reminder to complete quarterly performance reviews for your team.',
 'medium', TRUE, TRUE, 'system');

-- Seed notification preferences for demo (would normally be created per user)
-- This is just for reference; actual preferences are created when users are created

COMMIT;
