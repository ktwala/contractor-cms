-- Phase 7: Enterprise Features Migration
-- Comprehensive enterprise-grade capabilities for large organizations

-- =====================================================
-- 1. MULTI-COMPANY CONSOLIDATION
-- =====================================================

-- Company groups for consolidated reporting
CREATE TABLE IF NOT EXISTS company_groups (
  id CHAR(36) PRIMARY KEY,
  group_name VARCHAR(200) NOT NULL,
  parent_group_id CHAR(36),
  group_code VARCHAR(50) UNIQUE,
  description TEXT,
  consolidation_currency VARCHAR(3) DEFAULT 'ZAR',
  is_active BOOLEAN DEFAULT TRUE,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_group_id) REFERENCES company_groups(id),
  INDEX idx_parent_group (parent_group_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Company group memberships
CREATE TABLE IF NOT EXISTS company_group_members (
  id CHAR(36) PRIMARY KEY,
  group_id CHAR(36) NOT NULL,
  legal_entity_id CHAR(36) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  consolidation_percentage DECIMAL(5,2) DEFAULT 100.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES company_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  INDEX idx_group (group_id),
  INDEX idx_entity (legal_entity_id),
  INDEX idx_effective_dates (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. APPROVAL WORKFLOWS
-- =====================================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS approval_workflows (
  id CHAR(36) PRIMARY KEY,
  workflow_name VARCHAR(200) NOT NULL,
  workflow_type VARCHAR(100) NOT NULL, -- 'payrun', 'payment', 'employee_change', 'salary_change', 'termination', 'bonus', 'custom'
  legal_entity_id CHAR(36),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  auto_approve_below_amount DECIMAL(15,2),
  max_approval_days INT DEFAULT 7,
  escalation_enabled BOOLEAN DEFAULT FALSE,
  escalation_days INT DEFAULT 3,
  config JSON, -- Additional configuration
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  INDEX idx_type (workflow_type),
  INDEX idx_entity (legal_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow steps
CREATE TABLE IF NOT EXISTS approval_workflow_steps (
  id CHAR(36) PRIMARY KEY,
  workflow_id CHAR(36) NOT NULL,
  step_order INT NOT NULL,
  step_name VARCHAR(200) NOT NULL,
  approver_type ENUM('user', 'role', 'manager', 'department_head', 'custom') NOT NULL,
  approver_user_id CHAR(36),
  approver_role_id CHAR(36),
  approval_condition JSON, -- Conditions for this step (amount thresholds, etc.)
  is_parallel BOOLEAN DEFAULT FALSE, -- Can approve in parallel with previous step
  require_all_approvers BOOLEAN DEFAULT FALSE, -- If multiple approvers, require all or any
  auto_approve_conditions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_user_id) REFERENCES users(id),
  INDEX idx_workflow (workflow_id),
  INDEX idx_order (workflow_id, step_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id CHAR(36) PRIMARY KEY,
  workflow_id CHAR(36) NOT NULL,
  request_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL, -- 'payrun', 'payment', 'employee', etc.
  entity_id CHAR(36) NOT NULL,
  legal_entity_id CHAR(36),
  requested_by CHAR(36) NOT NULL,
  current_step INT DEFAULT 1,
  status ENUM('pending', 'in_progress', 'approved', 'rejected', 'cancelled', 'escalated') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  request_data JSON, -- The data being approved
  total_amount DECIMAL(15,2),
  reason TEXT,
  approved_by CHAR(36),
  approved_at TIMESTAMP NULL,
  rejected_by CHAR(36),
  rejected_at TIMESTAMP NULL,
  rejection_reason TEXT,
  escalated_at TIMESTAMP NULL,
  due_date TIMESTAMP,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id),
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_requester (requested_by),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual approval actions
CREATE TABLE IF NOT EXISTS approval_actions (
  id CHAR(36) PRIMARY KEY,
  request_id CHAR(36) NOT NULL,
  step_id CHAR(36) NOT NULL,
  approver_id CHAR(36) NOT NULL,
  action ENUM('approved', 'rejected', 'delegated', 'commented') NOT NULL,
  comments TEXT,
  delegated_to CHAR(36),
  actioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES approval_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES approval_workflow_steps(id),
  FOREIGN KEY (approver_id) REFERENCES users(id),
  FOREIGN KEY (delegated_to) REFERENCES users(id),
  INDEX idx_request (request_id),
  INDEX idx_approver (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. AUDIT TRAIL SYSTEM
-- =====================================================

-- Comprehensive audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  legal_entity_id CHAR(36),
  user_id CHAR(36),
  action_type VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject', 'login', 'logout', 'export', 'import'
  entity_type VARCHAR(100) NOT NULL, -- 'employee', 'payrun', 'payment', 'user', 'role', etc.
  entity_id CHAR(36),
  entity_description VARCHAR(500),
  old_values JSON, -- Previous state
  new_values JSON, -- New state
  changes JSON, -- Specific fields changed
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(100),
  api_endpoint VARCHAR(500),
  request_method VARCHAR(10),
  status_code INT,
  severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
  tags JSON, -- For categorization and filtering
  metadata JSON, -- Additional context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. ADVANCED RBAC (Role-Based Access Control)
-- =====================================================

-- Enhanced roles with hierarchy
CREATE TABLE IF NOT EXISTS enterprise_roles (
  id CHAR(36) PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL,
  role_code VARCHAR(50) UNIQUE NOT NULL,
  parent_role_id CHAR(36), -- Role inheritance
  legal_entity_id CHAR(36), -- NULL for global roles
  description TEXT,
  role_type ENUM('system', 'custom', 'inherited') DEFAULT 'custom',
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 100, -- For conflict resolution
  permissions JSON, -- Cached permissions
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_role_id) REFERENCES enterprise_roles(id),
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_parent (parent_role_id),
  INDEX idx_entity (legal_entity_id),
  INDEX idx_type (role_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Granular permissions
CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) PRIMARY KEY,
  permission_code VARCHAR(200) UNIQUE NOT NULL, -- e.g., 'payroll:payrun:create', 'employees:salary:view'
  permission_name VARCHAR(200) NOT NULL,
  resource_type VARCHAR(100) NOT NULL, -- 'payroll', 'employees', 'reports', etc.
  action VARCHAR(100) NOT NULL, -- 'create', 'read', 'update', 'delete', 'approve', 'export'
  description TEXT,
  category VARCHAR(100),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resource (resource_type),
  INDEX idx_action (action),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role-Permission assignments
CREATE TABLE IF NOT EXISTS role_permissions (
  id CHAR(36) PRIMARY KEY,
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  grant_type ENUM('allow', 'deny') DEFAULT 'allow',
  conditions JSON, -- Conditional permissions (e.g., only own department)
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES enterprise_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY unique_role_permission (role_id, permission_id),
  INDEX idx_role (role_id),
  INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User-Role assignments with time-based access
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  legal_entity_id CHAR(36), -- Scope to specific entity
  department_id CHAR(36), -- Scope to specific department
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES enterprise_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_role (role_id),
  INDEX idx_entity (legal_entity_id),
  INDEX idx_effective_dates (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. DATA ARCHIVING & RETENTION
-- =====================================================

-- Retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id CHAR(36) PRIMARY KEY,
  policy_name VARCHAR(200) NOT NULL,
  entity_type VARCHAR(100) NOT NULL, -- 'payrun', 'payslip', 'employee', 'audit_log'
  retention_period_months INT NOT NULL,
  archive_after_months INT,
  legal_entity_id CHAR(36),
  is_active BOOLEAN DEFAULT TRUE,
  auto_archive BOOLEAN DEFAULT TRUE,
  auto_delete BOOLEAN DEFAULT FALSE, -- Requires explicit approval
  retention_criteria JSON, -- Additional criteria
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_entity_type (entity_type),
  INDEX idx_legal_entity (legal_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Archived records
CREATE TABLE IF NOT EXISTS archived_records (
  id CHAR(36) PRIMARY KEY,
  archive_batch_id CHAR(36) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  legal_entity_id CHAR(36),
  archive_data LONGTEXT, -- Compressed JSON
  archive_reason VARCHAR(500),
  original_created_at TIMESTAMP,
  archived_by CHAR(36),
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  restore_count INT DEFAULT 0,
  last_restored_at TIMESTAMP NULL,
  metadata JSON,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (archived_by) REFERENCES users(id),
  INDEX idx_batch (archive_batch_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_archived_at (archived_at),
  INDEX idx_legal_entity (legal_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Archive batches
CREATE TABLE IF NOT EXISTS archive_batches (
  id CHAR(36) PRIMARY KEY,
  batch_name VARCHAR(200) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  policy_id CHAR(36),
  total_records INT DEFAULT 0,
  status ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  error_message TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (policy_id) REFERENCES data_retention_policies(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_entity_type (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. DELEGATION & PROXY ACCESS
-- =====================================================

-- User delegations
CREATE TABLE IF NOT EXISTS user_delegations (
  id CHAR(36) PRIMARY KEY,
  delegator_user_id CHAR(36) NOT NULL, -- User delegating access
  delegate_user_id CHAR(36) NOT NULL, -- User receiving access
  delegation_type ENUM('full', 'partial', 'approval_only', 'view_only') DEFAULT 'partial',
  legal_entity_id CHAR(36),
  department_id CHAR(36),
  permissions JSON, -- Specific permissions delegated
  effective_from DATETIME NOT NULL,
  effective_to DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  reason TEXT,
  requires_mfa BOOLEAN DEFAULT FALSE,
  max_transaction_amount DECIMAL(15,2),
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (delegator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (delegate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_delegator (delegator_user_id),
  INDEX idx_delegate (delegate_user_id),
  INDEX idx_effective_dates (effective_from, effective_to),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Delegation usage logs
CREATE TABLE IF NOT EXISTS delegation_usage_logs (
  id CHAR(36) PRIMARY KEY,
  delegation_id CHAR(36) NOT NULL,
  delegate_user_id CHAR(36) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id CHAR(36),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delegation_id) REFERENCES user_delegations(id) ON DELETE CASCADE,
  FOREIGN KEY (delegate_user_id) REFERENCES users(id),
  INDEX idx_delegation (delegation_id),
  INDEX idx_delegate (delegate_user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. COST CENTER MANAGEMENT
-- =====================================================

-- Cost centers
CREATE TABLE IF NOT EXISTS cost_centers (
  id CHAR(36) PRIMARY KEY,
  cost_center_code VARCHAR(50) NOT NULL,
  cost_center_name VARCHAR(200) NOT NULL,
  legal_entity_id CHAR(36) NOT NULL,
  parent_cost_center_id CHAR(36),
  department_id CHAR(36),
  manager_id CHAR(36),
  is_active BOOLEAN DEFAULT TRUE,
  cost_type ENUM('department', 'project', 'location', 'product', 'custom') DEFAULT 'department',
  gl_account VARCHAR(50), -- General ledger account
  description TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (manager_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY unique_code_entity (cost_center_code, legal_entity_id),
  INDEX idx_entity (legal_entity_id),
  INDEX idx_parent (parent_cost_center_id),
  INDEX idx_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cost allocations
CREATE TABLE IF NOT EXISTS cost_allocations (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  cost_center_id CHAR(36) NOT NULL,
  allocation_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_employee (employee_id),
  INDEX idx_cost_center (cost_center_id),
  INDEX idx_effective_dates (effective_from, effective_to),
  CHECK (allocation_percentage > 0 AND allocation_percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
  id CHAR(36) PRIMARY KEY,
  budget_name VARCHAR(200) NOT NULL,
  cost_center_id CHAR(36) NOT NULL,
  fiscal_year INT NOT NULL,
  budget_period ENUM('monthly', 'quarterly', 'annual') DEFAULT 'annual',
  budget_type ENUM('salaries', 'benefits', 'total_compensation', 'headcount') DEFAULT 'total_compensation',
  budget_amount DECIMAL(15,2) NOT NULL,
  spent_amount DECIMAL(15,2) DEFAULT 0.00,
  committed_amount DECIMAL(15,2) DEFAULT 0.00,
  variance_amount DECIMAL(15,2) DEFAULT 0.00,
  variance_percentage DECIMAL(5,2) DEFAULT 0.00,
  alert_threshold_percentage DECIMAL(5,2) DEFAULT 90.00,
  status ENUM('draft', 'active', 'exceeded', 'closed') DEFAULT 'draft',
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_cost_center (cost_center_id),
  INDEX idx_fiscal_year (fiscal_year),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. BULK OPERATIONS
-- =====================================================

-- Batch jobs
CREATE TABLE IF NOT EXISTS batch_jobs (
  id CHAR(36) PRIMARY KEY,
  job_name VARCHAR(200) NOT NULL,
  job_type VARCHAR(100) NOT NULL, -- 'employee_import', 'salary_update', 'benefit_enrollment', 'termination', 'custom'
  legal_entity_id CHAR(36),
  operation_type ENUM('create', 'update', 'delete', 'import', 'export') NOT NULL,
  total_records INT DEFAULT 0,
  processed_records INT DEFAULT 0,
  successful_records INT DEFAULT 0,
  failed_records INT DEFAULT 0,
  status ENUM('pending', 'validating', 'in_progress', 'completed', 'failed', 'cancelled', 'partially_completed') DEFAULT 'pending',
  validation_errors JSON,
  execution_errors JSON,
  input_file_path VARCHAR(500),
  output_file_path VARCHAR(500),
  started_by CHAR(36),
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  estimated_duration_seconds INT,
  actual_duration_seconds INT,
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (started_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_type (job_type),
  INDEX idx_started_by (started_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Batch job items
CREATE TABLE IF NOT EXISTS batch_job_items (
  id CHAR(36) PRIMARY KEY,
  batch_job_id CHAR(36) NOT NULL,
  row_number INT NOT NULL,
  entity_type VARCHAR(100),
  entity_id CHAR(36),
  input_data JSON,
  output_data JSON,
  status ENUM('pending', 'processing', 'success', 'failed', 'skipped') DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_job_id) REFERENCES batch_jobs(id) ON DELETE CASCADE,
  INDEX idx_batch_job (batch_job_id),
  INDEX idx_status (status),
  INDEX idx_row_number (batch_job_id, row_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. API USAGE TRACKING & RATE LIMITING
-- =====================================================

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) PRIMARY KEY,
  key_name VARCHAR(200) NOT NULL,
  api_key VARCHAR(100) UNIQUE NOT NULL,
  api_secret VARCHAR(100),
  legal_entity_id CHAR(36),
  user_id CHAR(36),
  key_type ENUM('internal', 'partner', 'customer', 'integration') DEFAULT 'internal',
  permissions JSON,
  rate_limit_per_minute INT DEFAULT 60,
  rate_limit_per_hour INT DEFAULT 1000,
  rate_limit_per_day INT DEFAULT 10000,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_key (api_key),
  INDEX idx_user (user_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API usage logs
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id CHAR(36) PRIMARY KEY,
  api_key_id CHAR(36),
  user_id CHAR(36),
  endpoint VARCHAR(500) NOT NULL,
  http_method VARCHAR(10) NOT NULL,
  status_code INT,
  response_time_ms INT,
  request_size_bytes INT,
  response_size_bytes INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_api_key (api_key_id),
  INDEX idx_user (user_id),
  INDEX idx_endpoint (endpoint(255)),
  INDEX idx_created_at (created_at),
  INDEX idx_status_code (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limit tracking (in-memory cache alternative)
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id CHAR(36) PRIMARY KEY,
  api_key_id CHAR(36),
  user_id CHAR(36),
  period_type ENUM('minute', 'hour', 'day') NOT NULL,
  period_start TIMESTAMP NOT NULL,
  request_count INT DEFAULT 0,
  last_request_at TIMESTAMP,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_period (api_key_id, period_type, period_start),
  INDEX idx_period (period_type, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Seed basic permissions
INSERT INTO permissions (id, permission_code, permission_name, resource_type, action, description, category, is_system) VALUES
(UUID(), 'payroll:payrun:create', 'Create Payrun', 'payroll', 'create', 'Create new payroll runs', 'Payroll', TRUE),
(UUID(), 'payroll:payrun:approve', 'Approve Payrun', 'payroll', 'approve', 'Approve payroll runs', 'Payroll', TRUE),
(UUID(), 'employees:salary:view', 'View Salary', 'employees', 'read', 'View employee salary information', 'Employees', TRUE),
(UUID(), 'employees:salary:update', 'Update Salary', 'employees', 'update', 'Update employee salary', 'Employees', TRUE),
(UUID(), 'reports:financial:export', 'Export Financial Reports', 'reports', 'export', 'Export financial reports', 'Reports', TRUE),
(UUID(), 'admin:users:manage', 'Manage Users', 'admin', 'manage', 'Manage system users', 'Administration', TRUE),
(UUID(), 'admin:roles:manage', 'Manage Roles', 'admin', 'manage', 'Manage roles and permissions', 'Administration', TRUE),
(UUID(), 'compliance:statutory:submit', 'Submit Statutory Returns', 'compliance', 'submit', 'Submit statutory compliance returns', 'Compliance', TRUE);

-- Seed basic enterprise roles
INSERT INTO enterprise_roles (id, role_name, role_code, description, role_type, is_active, priority, created_by) VALUES
(UUID(), 'Enterprise Administrator', 'ENTERPRISE_ADMIN', 'Full system access across all entities', 'system', TRUE, 1, NULL),
(UUID(), 'Company Administrator', 'COMPANY_ADMIN', 'Full access within a single company', 'system', TRUE, 10, NULL),
(UUID(), 'Payroll Manager', 'PAYROLL_MANAGER', 'Manage payroll processing and approvals', 'system', TRUE, 20, NULL),
(UUID(), 'HR Manager', 'HR_MANAGER', 'Manage employee data and HR processes', 'system', TRUE, 20, NULL),
(UUID(), 'Finance Manager', 'FINANCE_MANAGER', 'Manage financial reports and compliance', 'system', TRUE, 20, NULL),
(UUID(), 'Department Manager', 'DEPT_MANAGER', 'Manage department employees and budgets', 'system', TRUE, 30, NULL),
(UUID(), 'Payroll Officer', 'PAYROLL_OFFICER', 'Process payroll and maintain employee records', 'system', TRUE, 40, NULL),
(UUID(), 'Read Only User', 'READ_ONLY', 'View-only access to permitted data', 'system', TRUE, 100, NULL);

-- Seed sample data retention policies
INSERT INTO data_retention_policies (id, policy_name, entity_type, retention_period_months, archive_after_months, is_active, auto_archive, auto_delete, created_by) VALUES
(UUID(), 'Payslip Retention - 5 Years', 'payslip', 60, 36, TRUE, TRUE, FALSE, NULL),
(UUID(), 'Employee Records - 7 Years', 'employee', 84, 60, TRUE, TRUE, FALSE, NULL),
(UUID(), 'Audit Logs - 3 Years', 'audit_log', 36, 24, TRUE, TRUE, FALSE, NULL),
(UUID(), 'Tax Documents - 5 Years', 'tax_certificate', 60, 12, TRUE, TRUE, FALSE, NULL);
