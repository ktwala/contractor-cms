-- SARS Tax Forms Module
-- Manages IRP5 (Employee Tax Certificates) and EMP201 (Employer Monthly Declarations)

-- Tax Periods (for tracking tax years and submission periods)
CREATE TABLE IF NOT EXISTS tax_periods (
  id VARCHAR(36) PRIMARY KEY,
  period_type ENUM('annual', 'monthly', 'bi_annual') NOT NULL,
  tax_year VARCHAR(10) NOT NULL, -- '2024', '2025'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- For monthly periods (EMP201)
  month_number INT, -- 1-12

  -- Submission details
  submission_due_date DATE,
  is_submitted BOOLEAN DEFAULT FALSE,
  submitted_at DATETIME,
  submitted_by VARCHAR(36),

  -- SARS reference
  sars_reference_number VARCHAR(100),
  sars_submission_status ENUM('draft', 'pending', 'submitted', 'accepted', 'rejected') DEFAULT 'draft',

  country VARCHAR(3) DEFAULT 'ZAF',
  legal_entity_id VARCHAR(36),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_period (period_type, tax_year, month_number, country, legal_entity_id),
  INDEX idx_tax_periods_year (tax_year),
  INDEX idx_tax_periods_type (period_type),
  INDEX idx_tax_periods_submission (is_submitted, submission_due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IRP5 Certificates (Annual Employee Tax Certificates)
CREATE TABLE IF NOT EXISTS irp5_certificates (
  id VARCHAR(36) PRIMARY KEY,
  tax_period_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,

  -- Employee details (snapshot at time of generation)
  employee_number VARCHAR(50),
  id_number VARCHAR(20),
  passport_number VARCHAR(50),
  initials VARCHAR(10),
  surname VARCHAR(100),
  first_names VARCHAR(200),
  date_of_birth DATE,

  -- Employment details
  employment_start_date DATE,
  employment_end_date DATE,
  nature_of_person ENUM('1', '2', '3', '4') DEFAULT '1', -- 1=Employee, 2=Director, 3=Labour Broker, 4=Personal Service Provider

  -- Income (Code 3601-3920)
  income_from_employment DECIMAL(15, 2) DEFAULT 0, -- Code 3601
  annual_bonus DECIMAL(15, 2) DEFAULT 0, -- Code 3605
  commission DECIMAL(15, 2) DEFAULT 0, -- Code 3606
  overtime DECIMAL(15, 2) DEFAULT 0, -- Code 3607
  travel_allowance DECIMAL(15, 2) DEFAULT 0, -- Code 3701
  subsistence_allowance DECIMAL(15, 2) DEFAULT 0, -- Code 3702
  other_allowances DECIMAL(15, 2) DEFAULT 0, -- Code 3713

  -- Taxable fringe benefits (Code 3801-3825)
  company_car_fringe_benefit DECIMAL(15, 2) DEFAULT 0, -- Code 3801
  residential_accommodation DECIMAL(15, 2) DEFAULT 0, -- Code 3802
  low_interest_loans DECIMAL(15, 2) DEFAULT 0, -- Code 3809
  other_fringe_benefits DECIMAL(15, 2) DEFAULT 0, -- Code 3810

  -- Lump sums (Code 3901-3920)
  severance_pay DECIMAL(15, 2) DEFAULT 0, -- Code 3901
  leave_payout DECIMAL(15, 2) DEFAULT 0, -- Code 3907

  -- Deductions (Code 4001-4149)
  pension_fund_contributions DECIMAL(15, 2) DEFAULT 0, -- Code 4001
  retirement_annuity_contributions DECIMAL(15, 2) DEFAULT 0, -- Code 4002
  medical_aid_contributions DECIMAL(15, 2) DEFAULT 0, -- Code 4005

  -- Tax (Code 4101-4118)
  paye_deducted DECIMAL(15, 2) DEFAULT 0, -- Code 4101
  uif_deducted DECIMAL(15, 2) DEFAULT 0, -- Code 4102
  sdl_deducted DECIMAL(15, 2) DEFAULT 0, -- Code 4141

  -- Employer contributions (Code 4474-4493)
  pension_fund_employer DECIMAL(15, 2) DEFAULT 0, -- Code 4474
  retirement_annuity_employer DECIMAL(15, 2) DEFAULT 0, -- Code 4475
  medical_aid_employer DECIMAL(15, 2) DEFAULT 0, -- Code 4476
  uif_employer DECIMAL(15, 2) DEFAULT 0, -- Code 4493

  -- Medical aid details
  medical_aid_name VARCHAR(200),
  medical_aid_number VARCHAR(50),
  main_member_id_number VARCHAR(20),
  number_of_dependants INT DEFAULT 0,

  -- Totals
  total_remuneration DECIMAL(15, 2) DEFAULT 0,
  taxable_income DECIMAL(15, 2) DEFAULT 0,
  total_tax DECIMAL(15, 2) DEFAULT 0,

  -- Certificate details
  certificate_number VARCHAR(50),
  issue_date DATE,

  -- Status
  status ENUM('draft', 'generated', 'issued', 'amended', 'cancelled') DEFAULT 'draft',
  generated_at DATETIME,
  generated_by VARCHAR(36),

  -- PDF storage
  pdf_path VARCHAR(500),
  pdf_generated_at DATETIME,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,

  UNIQUE KEY unique_irp5 (tax_period_id, employee_id),
  INDEX idx_irp5_employee (employee_id),
  INDEX idx_irp5_status (status),
  INDEX idx_irp5_certificate (certificate_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- EMP201 Monthly Declarations (Employer Monthly Returns to SARS)
CREATE TABLE IF NOT EXISTS emp201_returns (
  id VARCHAR(36) PRIMARY KEY,
  tax_period_id VARCHAR(36) NOT NULL,

  -- Employer details
  employer_paye_number VARCHAR(20) NOT NULL,
  employer_name VARCHAR(200),
  employer_trading_name VARCHAR(200),

  -- Period details
  tax_year VARCHAR(10),
  month_number INT,
  period_start DATE,
  period_end DATE,

  -- Employee counts
  total_employees INT DEFAULT 0,
  local_employees INT DEFAULT 0,
  foreign_employees INT DEFAULT 0,

  -- PAYE (Employees' Tax)
  paye_current_month DECIMAL(15, 2) DEFAULT 0,
  paye_adjustments DECIMAL(15, 2) DEFAULT 0,
  paye_total DECIMAL(15, 2) DEFAULT 0,

  -- SDL (Skills Development Levy)
  sdl_current_month DECIMAL(15, 2) DEFAULT 0,
  sdl_adjustments DECIMAL(15, 2) DEFAULT 0,
  sdl_total DECIMAL(15, 2) DEFAULT 0,

  -- UIF (Unemployment Insurance Fund)
  uif_employee_current DECIMAL(15, 2) DEFAULT 0,
  uif_employer_current DECIMAL(15, 2) DEFAULT 0,
  uif_adjustments DECIMAL(15, 2) DEFAULT 0,
  uif_total DECIMAL(15, 2) DEFAULT 0,

  -- ETI (Employment Tax Incentive)
  eti_current_month DECIMAL(15, 2) DEFAULT 0,
  eti_adjustments DECIMAL(15, 2) DEFAULT 0,
  eti_total DECIMAL(15, 2) DEFAULT 0,

  -- Total liability
  total_liability DECIMAL(15, 2) DEFAULT 0,

  -- Payment details
  payment_made BOOLEAN DEFAULT FALSE,
  payment_amount DECIMAL(15, 2) DEFAULT 0,
  payment_date DATE,
  payment_reference VARCHAR(100),

  -- Submission details
  submission_due_date DATE,
  status ENUM('draft', 'ready', 'submitted', 'paid', 'overdue', 'amended') DEFAULT 'draft',
  submitted_at DATETIME,
  submitted_by VARCHAR(36),

  -- SARS details
  sars_reference_number VARCHAR(100),
  sars_acknowledgement_number VARCHAR(100),
  sars_submission_date DATETIME,
  sars_status ENUM('pending', 'accepted', 'rejected', 'queried') DEFAULT 'pending',
  sars_response TEXT,

  -- XML/CSV storage for eFiling
  xml_path VARCHAR(500),
  csv_path VARCHAR(500),
  generated_at DATETIME,

  country VARCHAR(3) DEFAULT 'ZAF',
  legal_entity_id VARCHAR(36),

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE CASCADE,

  UNIQUE KEY unique_emp201 (tax_year, month_number, employer_paye_number, legal_entity_id),
  INDEX idx_emp201_period (tax_year, month_number),
  INDEX idx_emp201_status (status),
  INDEX idx_emp201_due (submission_due_date),
  INDEX idx_emp201_employer (employer_paye_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- EMP501 Annual Reconciliation (Year-end reconciliation - for future)
CREATE TABLE IF NOT EXISTS emp501_reconciliations (
  id VARCHAR(36) PRIMARY KEY,
  tax_period_id VARCHAR(36) NOT NULL,

  -- Employer details
  employer_paye_number VARCHAR(20) NOT NULL,
  tax_year VARCHAR(10),

  -- Summary totals
  total_employees INT DEFAULT 0,
  total_remuneration DECIMAL(15, 2) DEFAULT 0,
  total_paye DECIMAL(15, 2) DEFAULT 0,
  total_uif DECIMAL(15, 2) DEFAULT 0,
  total_sdl DECIMAL(15, 2) DEFAULT 0,

  -- Reconciliation
  emp201_total_submitted DECIMAL(15, 2) DEFAULT 0,
  emp501_total_calculated DECIMAL(15, 2) DEFAULT 0,
  variance DECIMAL(15, 2) DEFAULT 0,

  -- Status
  status ENUM('draft', 'in_progress', 'submitted', 'accepted', 'rejected') DEFAULT 'draft',
  submission_due_date DATE,
  submitted_at DATETIME,

  country VARCHAR(3) DEFAULT 'ZAF',
  legal_entity_id VARCHAR(36),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE CASCADE,
  INDEX idx_emp501_year (tax_year),
  INDEX idx_emp501_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SARS Submission Log (Audit trail for all SARS submissions)
CREATE TABLE IF NOT EXISTS sars_submissions (
  id VARCHAR(36) PRIMARY KEY,
  submission_type ENUM('IRP5', 'EMP201', 'EMP501', 'IT3a') NOT NULL,
  document_id VARCHAR(36) NOT NULL, -- ID of the related document (IRP5, EMP201, etc.)

  -- Submission details
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_by VARCHAR(36),
  submission_method ENUM('manual', 'efiling', 'api', 'csv_upload') DEFAULT 'manual',

  -- Request/Response
  request_data TEXT, -- JSON or XML payload
  response_data TEXT, -- SARS response

  -- Status
  status ENUM('pending', 'success', 'failed', 'retry') DEFAULT 'pending',
  status_code VARCHAR(10),
  error_message TEXT,

  -- SARS reference
  sars_reference VARCHAR(100),
  sars_acknowledgement VARCHAR(100),

  country VARCHAR(3) DEFAULT 'ZAF',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_sars_submissions_type (submission_type),
  INDEX idx_sars_submissions_status (status),
  INDEX idx_sars_submissions_date (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Medical Aid Tax Credits (for accurate IRP5 calculations)
CREATE TABLE IF NOT EXISTS medical_aid_tax_credits (
  id VARCHAR(36) PRIMARY KEY,
  tax_year VARCHAR(10) NOT NULL,

  -- Monthly credit amounts
  main_member_credit DECIMAL(10, 2) NOT NULL,
  first_dependent_credit DECIMAL(10, 2) NOT NULL,
  additional_dependent_credit DECIMAL(10, 2) NOT NULL,

  -- Age-based additional credits (65+)
  age_65_additional_credit DECIMAL(10, 2) DEFAULT 0,

  effective_from DATE NOT NULL,
  effective_to DATE,

  country VARCHAR(3) DEFAULT 'ZAF',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_medical_credits_year (tax_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed medical aid tax credits for 2024/2025
INSERT IGNORE INTO medical_aid_tax_credits
(id, tax_year, main_member_credit, first_dependent_credit, additional_dependent_credit, age_65_additional_credit, effective_from)
VALUES
('med-credit-2024', '2024', 364.00, 364.00, 246.00, 246.00, '2024-03-01'),
('med-credit-2025', '2025', 382.00, 382.00, 258.00, 258.00, '2025-03-01');

-- Seed tax periods for 2024 and 2025
INSERT IGNORE INTO tax_periods
(id, period_type, tax_year, period_start, period_end, submission_due_date, country)
VALUES
-- 2024 Annual
('tax-2024-annual', 'annual', '2024', '2024-03-01', '2025-02-28', '2025-05-31', 'ZAF'),

-- 2024 Monthly periods (EMP201)
('tax-2024-m01', 'monthly', '2024', '2024-03-01', '2024-03-31', '2024-04-07', 'ZAF'),
('tax-2024-m02', 'monthly', '2024', '2024-04-01', '2024-04-30', '2024-05-07', 'ZAF'),
('tax-2024-m03', 'monthly', '2024', '2024-05-01', '2024-05-31', '2024-06-07', 'ZAF'),
('tax-2024-m04', 'monthly', '2024', '2024-06-01', '2024-06-30', '2024-07-07', 'ZAF'),
('tax-2024-m05', 'monthly', '2024', '2024-07-01', '2024-07-31', '2024-08-07', 'ZAF'),
('tax-2024-m06', 'monthly', '2024', '2024-08-01', '2024-08-31', '2024-09-07', 'ZAF'),
('tax-2024-m07', 'monthly', '2024', '2024-09-01', '2024-09-30', '2024-10-07', 'ZAF'),
('tax-2024-m08', 'monthly', '2024', '2024-10-01', '2024-10-31', '2024-11-07', 'ZAF'),
('tax-2024-m09', 'monthly', '2024', '2024-11-01', '2024-11-30', '2024-12-07', 'ZAF'),
('tax-2024-m10', 'monthly', '2024', '2024-12-01', '2024-12-31', '2025-01-07', 'ZAF'),
('tax-2024-m11', 'monthly', '2024', '2025-01-01', '2025-01-31', '2025-02-07', 'ZAF'),
('tax-2024-m12', 'monthly', '2024', '2025-02-01', '2025-02-28', '2025-03-07', 'ZAF'),

-- 2025 Annual
('tax-2025-annual', 'annual', '2025', '2025-03-01', '2026-02-28', '2026-05-31', 'ZAF');

CREATE INDEX idx_irp5_tax_year ON irp5_certificates(tax_period_id, status);
CREATE INDEX idx_emp201_tax_period ON emp201_returns(tax_period_id, status);
