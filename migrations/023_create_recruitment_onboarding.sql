-- Phase 9: Recruitment & Onboarding Migration
-- Complete hiring lifecycle from job posting to employee onboarding

-- =====================================================
-- 1. JOB REQUISITIONS
-- =====================================================

-- Job requisitions (job openings)
CREATE TABLE IF NOT EXISTS job_requisitions (
  id CHAR(36) PRIMARY KEY,
  legal_entity_id CHAR(36) NOT NULL,
  job_title VARCHAR(200) NOT NULL,
  department_id CHAR(36),
  reporting_to CHAR(36), -- Manager ID
  job_level ENUM('entry', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'executive') NOT NULL,
  employment_type ENUM('permanent', 'contract', 'temporary', 'internship', 'part_time') DEFAULT 'permanent',
  location VARCHAR(200),
  remote_allowed BOOLEAN DEFAULT FALSE,
  number_of_positions INT DEFAULT 1,
  salary_range_min DECIMAL(15,2),
  salary_range_max DECIMAL(15,2),
  salary_currency VARCHAR(3) DEFAULT 'ZAR',
  job_description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  benefits TEXT,
  status ENUM('draft', 'pending_approval', 'approved', 'posted', 'on_hold', 'filled', 'cancelled') DEFAULT 'draft',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  target_start_date DATE,
  application_deadline DATE,
  created_by CHAR(36),
  approved_by CHAR(36),
  approved_at TIMESTAMP NULL,
  posted_at TIMESTAMP NULL,
  filled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (reporting_to) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_legal_entity (legal_entity_id),
  INDEX idx_status (status),
  INDEX idx_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. CANDIDATES & APPLICATIONS
-- =====================================================

-- Candidate pool
CREATE TABLE IF NOT EXISTS candidates (
  id CHAR(36) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  linkedin_url VARCHAR(500),
  portfolio_url VARCHAR(500),
  current_company VARCHAR(200),
  current_position VARCHAR(200),
  years_of_experience INT,
  current_salary DECIMAL(15,2),
  expected_salary DECIMAL(15,2),
  notice_period_days INT,
  location VARCHAR(200),
  willing_to_relocate BOOLEAN DEFAULT FALSE,
  resume_file_path VARCHAR(500),
  cover_letter TEXT,
  source ENUM('job_board', 'referral', 'linkedin', 'company_website', 'recruitment_agency', 'other') DEFAULT 'company_website',
  source_details VARCHAR(200),
  referred_by CHAR(36), -- Employee who referred
  tags JSON, -- Skills, keywords
  notes TEXT,
  status ENUM('new', 'screening', 'interviewing', 'offer_extended', 'hired', 'rejected', 'withdrawn') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES employees(id),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job applications
CREATE TABLE IF NOT EXISTS job_applications (
  id CHAR(36) PRIMARY KEY,
  requisition_id CHAR(36) NOT NULL,
  candidate_id CHAR(36) NOT NULL,
  application_stage ENUM('applied', 'screening', 'phone_screen', 'assessment', 'interview', 'final_interview', 'offer', 'hired', 'rejected') DEFAULT 'applied',
  application_status ENUM('active', 'on_hold', 'rejected', 'withdrawn', 'hired') DEFAULT 'active',
  applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  screening_score DECIMAL(5,2),
  overall_rating DECIMAL(3,2), -- 1.0 to 5.0
  rejection_reason TEXT,
  rejected_by CHAR(36),
  rejected_at TIMESTAMP NULL,
  hired_date TIMESTAMP NULL,
  notes TEXT,
  FOREIGN KEY (requisition_id) REFERENCES job_requisitions(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (rejected_by) REFERENCES users(id),
  UNIQUE KEY unique_application (requisition_id, candidate_id),
  INDEX idx_requisition (requisition_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_stage (application_stage),
  INDEX idx_status (application_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. INTERVIEWS
-- =====================================================

-- Interview schedules
CREATE TABLE IF NOT EXISTS interviews (
  id CHAR(36) PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  interview_type ENUM('phone_screen', 'video', 'in_person', 'technical', 'behavioral', 'panel', 'final') NOT NULL,
  interview_round INT DEFAULT 1,
  scheduled_date TIMESTAMP NOT NULL,
  duration_minutes INT DEFAULT 60,
  location VARCHAR(200),
  video_meeting_link VARCHAR(500),
  interviewer_id CHAR(36) NOT NULL,
  additional_interviewers JSON, -- Array of user IDs for panel interviews
  status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
  feedback_submitted BOOLEAN DEFAULT FALSE,
  notes TEXT,
  cancelled_reason TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (interviewer_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_application (application_id),
  INDEX idx_interviewer (interviewer_id),
  INDEX idx_scheduled_date (scheduled_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Interview feedback
CREATE TABLE IF NOT EXISTS interview_feedback (
  id CHAR(36) PRIMARY KEY,
  interview_id CHAR(36) NOT NULL,
  interviewer_id CHAR(36) NOT NULL,
  overall_rating DECIMAL(3,2) NOT NULL, -- 1.0 to 5.0
  technical_skills_rating DECIMAL(3,2),
  communication_rating DECIMAL(3,2),
  cultural_fit_rating DECIMAL(3,2),
  experience_rating DECIMAL(3,2),
  strengths TEXT,
  weaknesses TEXT,
  detailed_feedback TEXT,
  recommendation ENUM('strong_hire', 'hire', 'maybe', 'no_hire', 'strong_no_hire') NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
  FOREIGN KEY (interviewer_id) REFERENCES users(id),
  INDEX idx_interview (interview_id),
  INDEX idx_recommendation (recommendation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. OFFERS
-- =====================================================

-- Job offers
CREATE TABLE IF NOT EXISTS job_offers (
  id CHAR(36) PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  offer_type ENUM('permanent', 'contract', 'temporary', 'internship') NOT NULL,
  job_title VARCHAR(200) NOT NULL,
  department_id CHAR(36),
  reporting_to CHAR(36),
  start_date DATE NOT NULL,
  salary DECIMAL(15,2) NOT NULL,
  salary_currency VARCHAR(3) DEFAULT 'ZAR',
  salary_frequency ENUM('monthly', 'annual') DEFAULT 'monthly',
  signing_bonus DECIMAL(15,2),
  relocation_assistance DECIMAL(15,2),
  benefits_summary TEXT,
  equity_options VARCHAR(500),
  probation_period_months INT DEFAULT 3,
  contract_duration_months INT, -- For contract positions
  offer_expiry_date DATE NOT NULL,
  offer_letter_path VARCHAR(500),
  status ENUM('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'expired', 'withdrawn') DEFAULT 'draft',
  sent_date TIMESTAMP NULL,
  response_date TIMESTAMP NULL,
  decline_reason TEXT,
  created_by CHAR(36),
  approved_by CHAR(36),
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES job_applications(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (reporting_to) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_application (application_id),
  INDEX idx_status (status),
  INDEX idx_start_date (start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. ONBOARDING
-- =====================================================

-- Onboarding workflows
CREATE TABLE IF NOT EXISTS onboarding_workflows (
  id CHAR(36) PRIMARY KEY,
  offer_id CHAR(36) NOT NULL,
  new_employee_id CHAR(36), -- Created when employee record is created
  start_date DATE NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  completion_percentage DECIMAL(5,2) DEFAULT 0.00,
  assigned_buddy_id CHAR(36), -- Mentor/buddy
  created_by CHAR(36),
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (offer_id) REFERENCES job_offers(id),
  FOREIGN KEY (new_employee_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_buddy_id) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_offer (offer_id),
  INDEX idx_employee (new_employee_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Onboarding checklist templates
CREATE TABLE IF NOT EXISTS onboarding_checklist_templates (
  id CHAR(36) PRIMARY KEY,
  template_name VARCHAR(200) NOT NULL,
  legal_entity_id CHAR(36),
  department_id CHAR(36),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_legal_entity (legal_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Template tasks
CREATE TABLE IF NOT EXISTS onboarding_template_tasks (
  id CHAR(36) PRIMARY KEY,
  template_id CHAR(36) NOT NULL,
  task_name VARCHAR(200) NOT NULL,
  task_description TEXT,
  task_category ENUM('pre_start', 'first_day', 'first_week', 'first_month', 'probation') NOT NULL,
  assigned_to_role ENUM('hr', 'it', 'manager', 'employee', 'buddy', 'admin') NOT NULL,
  task_order INT NOT NULL,
  due_offset_days INT DEFAULT 0, -- Days from start date
  is_required BOOLEAN DEFAULT TRUE,
  task_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES onboarding_checklist_templates(id) ON DELETE CASCADE,
  INDEX idx_template (template_id),
  INDEX idx_category (task_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Onboarding tasks (actual instances)
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id CHAR(36) PRIMARY KEY,
  workflow_id CHAR(36) NOT NULL,
  task_name VARCHAR(200) NOT NULL,
  task_description TEXT,
  task_category ENUM('pre_start', 'first_day', 'first_week', 'first_month', 'probation') NOT NULL,
  assigned_to CHAR(36),
  assigned_to_role ENUM('hr', 'it', 'manager', 'employee', 'buddy', 'admin') NOT NULL,
  due_date DATE,
  status ENUM('pending', 'in_progress', 'completed', 'skipped', 'blocked') DEFAULT 'pending',
  is_required BOOLEAN DEFAULT TRUE,
  completed_by CHAR(36),
  completed_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (completed_by) REFERENCES users(id),
  INDEX idx_workflow (workflow_id),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Document collection tracking
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id CHAR(36) PRIMARY KEY,
  workflow_id CHAR(36) NOT NULL,
  document_type VARCHAR(100) NOT NULL, -- 'id_copy', 'tax_number', 'bank_details', 'qualifications', 'references', etc.
  document_name VARCHAR(200) NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  file_path VARCHAR(500),
  uploaded_by CHAR(36),
  uploaded_at TIMESTAMP NULL,
  verified_by CHAR(36),
  verified_at TIMESTAMP NULL,
  status ENUM('pending', 'uploaded', 'verified', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  INDEX idx_workflow (workflow_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipment provisioning
CREATE TABLE IF NOT EXISTS onboarding_equipment (
  id CHAR(36) PRIMARY KEY,
  workflow_id CHAR(36) NOT NULL,
  equipment_type VARCHAR(100) NOT NULL, -- 'laptop', 'monitor', 'phone', 'desk', 'chair', 'headset', etc.
  equipment_description VARCHAR(500),
  serial_number VARCHAR(100),
  is_required BOOLEAN DEFAULT TRUE,
  status ENUM('pending', 'ordered', 'received', 'assigned', 'returned') DEFAULT 'pending',
  assigned_by CHAR(36),
  assigned_at TIMESTAMP NULL,
  return_due_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  INDEX idx_workflow (workflow_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System access provisioning
CREATE TABLE IF NOT EXISTS onboarding_access (
  id CHAR(36) PRIMARY KEY,
  workflow_id CHAR(36) NOT NULL,
  system_name VARCHAR(200) NOT NULL, -- 'Email', 'Payroll System', 'CRM', 'VPN', etc.
  access_level VARCHAR(100),
  is_required BOOLEAN DEFAULT TRUE,
  status ENUM('pending', 'provisioned', 'activated', 'revoked') DEFAULT 'pending',
  username VARCHAR(200),
  provisioned_by CHAR(36),
  provisioned_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (provisioned_by) REFERENCES users(id),
  INDEX idx_workflow (workflow_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Seed a standard onboarding checklist template
INSERT INTO onboarding_checklist_templates (id, template_name, description, created_by) VALUES
(UUID(), 'Standard Employee Onboarding', 'Standard onboarding checklist for new employees', NULL);

SET @template_id = (SELECT id FROM onboarding_checklist_templates WHERE template_name = 'Standard Employee Onboarding' LIMIT 1);

-- Seed template tasks
INSERT INTO onboarding_template_tasks (id, template_id, task_name, task_description, task_category, assigned_to_role, task_order, due_offset_days, is_required) VALUES
-- Pre-start tasks
(UUID(), @template_id, 'Send welcome email', 'Send welcome email with start date details', 'pre_start', 'hr', 1, -5, TRUE),
(UUID(), @template_id, 'Prepare employment contract', 'Generate and send employment contract for signing', 'pre_start', 'hr', 2, -5, TRUE),
(UUID(), @template_id, 'Order equipment', 'Order laptop, monitor, and other required equipment', 'pre_start', 'it', 3, -5, TRUE),
(UUID(), @template_id, 'Setup workstation', 'Prepare desk, chair, and workstation', 'pre_start', 'admin', 4, -2, TRUE),
(UUID(), @template_id, 'Create system accounts', 'Create email and other system accounts', 'pre_start', 'it', 5, -2, TRUE),

-- First day tasks
(UUID(), @template_id, 'Office tour', 'Give new hire a tour of the office', 'first_day', 'hr', 6, 0, TRUE),
(UUID(), @template_id, 'Team introductions', 'Introduce new hire to the team', 'first_day', 'manager', 7, 0, TRUE),
(UUID(), @template_id, 'Assign buddy/mentor', 'Assign a buddy for the first month', 'first_day', 'manager', 8, 0, TRUE),
(UUID(), @template_id, 'Issue equipment', 'Hand over laptop, phone, and access cards', 'first_day', 'it', 9, 0, TRUE),
(UUID(), @template_id, 'Company orientation', 'Conduct company overview and culture presentation', 'first_day', 'hr', 10, 0, TRUE),
(UUID(), @template_id, 'Complete tax forms', 'Complete IRP5 and tax declaration forms', 'first_day', 'employee', 11, 0, TRUE),
(UUID(), @template_id, 'Submit bank details', 'Provide bank account details for payroll', 'first_day', 'employee', 12, 0, TRUE),

-- First week tasks
(UUID(), @template_id, 'Department orientation', 'Introduce to department processes and systems', 'first_week', 'manager', 13, 2, TRUE),
(UUID(), @template_id, 'Review job responsibilities', 'Review role expectations and KPIs', 'first_week', 'manager', 14, 3, TRUE),
(UUID(), @template_id, 'Security training', 'Complete information security training', 'first_week', 'employee', 15, 5, TRUE),
(UUID(), @template_id, 'Setup development environment', 'Configure all required tools and software', 'first_week', 'employee', 16, 5, FALSE),

-- First month tasks
(UUID(), @template_id, '30-day check-in', 'Conduct 30-day check-in meeting', 'first_month', 'manager', 17, 30, TRUE),
(UUID(), @template_id, 'Complete compliance training', 'Finish all required compliance modules', 'first_month', 'employee', 18, 30, TRUE),
(UUID(), @template_id, 'Benefits enrollment', 'Enroll in medical aid and retirement fund', 'first_month', 'employee', 19, 30, TRUE),

-- Probation tasks
(UUID(), @template_id, '90-day review', 'Conduct probation review meeting', 'probation', 'manager', 20, 90, TRUE);
