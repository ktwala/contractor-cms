-- Performance Management Module
-- Manages performance cycles, goals, reviews, 360-degree feedback, and ratings

-- Performance Cycles (Annual/Quarterly review periods)
CREATE TABLE IF NOT EXISTS performance_cycles (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  cycle_type ENUM('annual', 'semi_annual', 'quarterly', 'monthly', 'custom') DEFAULT 'annual',

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  review_start_date DATE, -- When reviews can begin
  review_end_date DATE, -- Deadline for completing reviews

  -- Configuration
  self_assessment_enabled BOOLEAN DEFAULT TRUE,
  peer_feedback_enabled BOOLEAN DEFAULT FALSE,
  manager_review_enabled BOOLEAN DEFAULT TRUE,
  goals_required BOOLEAN DEFAULT TRUE,
  min_peer_feedbacks INT DEFAULT 0,

  -- Status
  status ENUM('draft', 'active', 'in_review', 'completed', 'archived') DEFAULT 'draft',

  -- Country/Entity
  country VARCHAR(3),
  legal_entity_id VARCHAR(36),

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),

  INDEX idx_perf_cycles_status (status),
  INDEX idx_perf_cycles_dates (start_date, end_date),
  INDEX idx_perf_cycles_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rating Scales (Competencies and rating definitions)
CREATE TABLE IF NOT EXISTS performance_ratings (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  rating_type ENUM('overall', 'competency', 'goal', 'value') DEFAULT 'overall',

  -- Scale definition
  min_value INT NOT NULL DEFAULT 1,
  max_value INT NOT NULL DEFAULT 5,
  scale_labels JSON, -- {"1": "Poor", "2": "Below Expectations", "3": "Meets", "4": "Exceeds", "5": "Outstanding"}

  -- Weighting
  weight DECIMAL(5, 2), -- For weighted averages

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  country VARCHAR(3),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_perf_ratings_type (rating_type),
  INDEX idx_perf_ratings_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance Goals
CREATE TABLE IF NOT EXISTS performance_goals (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  cycle_id VARCHAR(36) NOT NULL,

  -- Goal details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  goal_type ENUM('individual', 'team', 'departmental', 'company') DEFAULT 'individual',
  category ENUM('performance', 'development', 'behavior', 'project', 'custom') DEFAULT 'performance',

  -- Measurement
  metric VARCHAR(200), -- What to measure (e.g., "Sales Revenue", "Customer Satisfaction")
  target_value VARCHAR(200), -- Target to achieve
  current_value VARCHAR(200), -- Current progress
  unit VARCHAR(50), -- e.g., "$", "%", "units"

  -- Timeline
  start_date DATE,
  due_date DATE,
  completed_date DATE,

  -- Weighting
  weight DECIMAL(5, 2) DEFAULT 0, -- Percentage weight (0-100)

  -- Status
  status ENUM('draft', 'active', 'in_progress', 'completed', 'cancelled', 'deferred') DEFAULT 'draft',
  completion_percentage INT DEFAULT 0,

  -- Ownership
  manager_id VARCHAR(36),
  aligned_to_goal_id VARCHAR(36), -- Parent/cascade goal

  -- Rating
  self_rating INT,
  manager_rating INT,
  final_rating INT,

  -- Comments
  employee_comments TEXT,
  manager_comments TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (aligned_to_goal_id) REFERENCES performance_goals(id) ON DELETE SET NULL,
  INDEX idx_perf_goals_employee (employee_id),
  INDEX idx_perf_goals_cycle (cycle_id),
  INDEX idx_perf_goals_status (status),
  INDEX idx_perf_goals_type (goal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance Reviews
CREATE TABLE IF NOT EXISTS performance_reviews (
  id VARCHAR(36) PRIMARY KEY,
  review_number VARCHAR(50) NOT NULL UNIQUE,
  employee_id VARCHAR(36) NOT NULL,
  cycle_id VARCHAR(36) NOT NULL,
  manager_id VARCHAR(36),

  -- Review type
  review_type ENUM('self_assessment', 'manager_review', 'peer_review', 'skip_level', '360') DEFAULT 'manager_review',

  -- Overall ratings
  overall_rating INT,
  overall_rating_label VARCHAR(100),
  goals_rating INT,
  competencies_rating INT,
  values_rating INT,

  -- Calculated scores
  weighted_score DECIMAL(5, 2),
  final_score DECIMAL(5, 2),

  -- Status workflow
  status ENUM('not_started', 'in_progress', 'submitted', 'acknowledged', 'completed') DEFAULT 'not_started',

  -- Dates
  review_period_start DATE,
  review_period_end DATE,
  self_assessment_date DATETIME,
  manager_review_date DATETIME,
  acknowledgement_date DATETIME,

  -- Promotion/Compensation recommendations
  recommended_for_promotion BOOLEAN DEFAULT FALSE,
  recommended_salary_increase DECIMAL(5, 2), -- Percentage
  recommended_bonus DECIMAL(12, 2),

  -- Performance category
  performance_category ENUM('top_performer', 'high_performer', 'solid_performer', 'needs_improvement', 'unsatisfactory'),

  -- Development needs
  requires_pip BOOLEAN DEFAULT FALSE, -- Performance Improvement Plan
  development_areas TEXT,
  strengths TEXT,

  -- Comments
  employee_comments TEXT,
  manager_comments TEXT,
  skip_level_comments TEXT,
  hr_comments TEXT,

  -- Acknowledgement
  employee_acknowledged BOOLEAN DEFAULT FALSE,
  employee_signature VARCHAR(200),
  disagreement_noted BOOLEAN DEFAULT FALSE,
  disagreement_comments TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE,
  INDEX idx_perf_reviews_employee (employee_id),
  INDEX idx_perf_reviews_manager (manager_id),
  INDEX idx_perf_reviews_cycle (cycle_id),
  INDEX idx_perf_reviews_status (status),
  INDEX idx_perf_reviews_category (performance_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance Review Ratings (Individual competency/criteria ratings)
CREATE TABLE IF NOT EXISTS performance_review_ratings (
  id VARCHAR(36) PRIMARY KEY,
  review_id VARCHAR(36) NOT NULL,
  rating_id VARCHAR(36) NOT NULL,

  -- Rating values
  self_rating INT,
  manager_rating INT,
  peer_avg_rating DECIMAL(3, 1), -- Average from peer feedback
  final_rating INT,

  -- Comments
  self_comments TEXT,
  manager_comments TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES performance_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (rating_id) REFERENCES performance_ratings(id),
  INDEX idx_review_ratings_review (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 360-Degree Feedback
CREATE TABLE IF NOT EXISTS performance_feedback (
  id VARCHAR(36) PRIMARY KEY,
  review_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL, -- Person being reviewed
  feedback_provider_id VARCHAR(36) NOT NULL, -- Person giving feedback

  -- Feedback type
  feedback_type ENUM('peer', 'direct_report', 'skip_level', 'customer', 'self') DEFAULT 'peer',
  relationship VARCHAR(100), -- e.g., "Team Member", "Project Collaborator"

  -- Status
  status ENUM('requested', 'in_progress', 'submitted', 'reviewed') DEFAULT 'requested',
  is_anonymous BOOLEAN DEFAULT FALSE,

  -- Ratings (if using structured feedback)
  overall_rating INT,
  ratings JSON, -- Flexible structure for multiple criteria

  -- Narrative feedback
  strengths TEXT,
  areas_for_improvement TEXT,
  general_comments TEXT,

  -- Specific questions
  collaboration_feedback TEXT,
  leadership_feedback TEXT,
  technical_feedback TEXT,
  communication_feedback TEXT,

  -- Dates
  requested_date DATETIME,
  submitted_date DATETIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES performance_reviews(id) ON DELETE CASCADE,
  INDEX idx_perf_feedback_review (review_id),
  INDEX idx_perf_feedback_employee (employee_id),
  INDEX idx_perf_feedback_provider (feedback_provider_id),
  INDEX idx_perf_feedback_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance Improvement Plans (PIPs)
CREATE TABLE IF NOT EXISTS performance_improvement_plans (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  review_id VARCHAR(36),
  manager_id VARCHAR(36),

  -- PIP details
  title VARCHAR(500) NOT NULL,
  reason TEXT NOT NULL,
  performance_issues TEXT,
  expected_improvements TEXT,
  support_provided TEXT,

  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  review_frequency ENUM('weekly', 'bi_weekly', 'monthly') DEFAULT 'bi_weekly',

  -- Milestones
  milestones JSON, -- Array of milestone objects with dates and descriptions

  -- Status
  status ENUM('active', 'successful', 'unsuccessful', 'extended', 'cancelled') DEFAULT 'active',
  outcome TEXT,
  outcome_date DATE,

  -- Consequences
  consequences_if_unsuccessful TEXT,

  -- Sign-off
  employee_acknowledged BOOLEAN DEFAULT FALSE,
  employee_signature VARCHAR(200),
  employee_acknowledgement_date DATE,
  hr_approved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES performance_reviews(id),
  INDEX idx_pip_employee (employee_id),
  INDEX idx_pip_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance History (Audit trail)
CREATE TABLE IF NOT EXISTS performance_history (
  id VARCHAR(36) PRIMARY KEY,
  entity_type ENUM('cycle', 'goal', 'review', 'feedback', 'pip') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR(36),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_perf_history_entity (entity_type, entity_id),
  INDEX idx_perf_history_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Rating Scales
INSERT IGNORE INTO performance_ratings (id, name, description, rating_type, min_value, max_value, scale_labels, is_active, country)
VALUES
-- Overall Performance Rating (5-point scale)
('rating-overall-5pt', 'Overall Performance (5-point)', 'Standard 5-point performance rating scale', 'overall', 1, 5,
 '{"1": "Unsatisfactory", "2": "Needs Improvement", "3": "Meets Expectations", "4": "Exceeds Expectations", "5": "Outstanding"}',
 TRUE, NULL),

-- Competencies
('rating-comp-leadership', 'Leadership', 'Leadership and people management competency', 'competency', 1, 5,
 '{"1": "Poor", "2": "Developing", "3": "Proficient", "4": "Advanced", "5": "Expert"}',
 TRUE, NULL),

('rating-comp-communication', 'Communication', 'Written and verbal communication skills', 'competency', 1, 5,
 '{"1": "Poor", "2": "Developing", "3": "Proficient", "4": "Advanced", "5": "Expert"}',
 TRUE, NULL),

('rating-comp-teamwork', 'Teamwork & Collaboration', 'Ability to work effectively with others', 'competency', 1, 5,
 '{"1": "Poor", "2": "Developing", "3": "Proficient", "4": "Advanced", "5": "Expert"}',
 TRUE, NULL),

('rating-comp-problem-solving', 'Problem Solving', 'Analytical thinking and problem resolution', 'competency', 1, 5,
 '{"1": "Poor", "2": "Developing", "3": "Proficient", "4": "Advanced", "5": "Expert"}',
 TRUE, NULL),

('rating-comp-technical', 'Technical Skills', 'Job-specific technical competence', 'competency', 1, 5,
 '{"1": "Poor", "2": "Developing", "3": "Proficient", "4": "Advanced", "5": "Expert"}',
 TRUE, NULL),

-- Values
('rating-value-integrity', 'Integrity', 'Demonstrates honesty and ethical behavior', 'value', 1, 5,
 '{"1": "Rarely", "2": "Sometimes", "3": "Usually", "4": "Consistently", "5": "Exemplary"}',
 TRUE, NULL),

('rating-value-accountability', 'Accountability', 'Takes ownership and responsibility', 'value', 1, 5,
 '{"1": "Rarely", "2": "Sometimes", "3": "Usually", "4": "Consistently", "5": "Exemplary"}',
 TRUE, NULL),

('rating-value-innovation', 'Innovation', 'Creative thinking and continuous improvement', 'value', 1, 5,
 '{"1": "Rarely", "2": "Sometimes", "3": "Usually", "4": "Consistently", "5": "Exemplary"}',
 TRUE, NULL);

-- Create indexes for performance
CREATE INDEX idx_perf_reviews_dates ON performance_reviews(review_period_start, review_period_end);
CREATE INDEX idx_perf_goals_dates ON performance_goals(start_date, due_date);
CREATE INDEX idx_perf_feedback_type ON performance_feedback(feedback_type, status);
