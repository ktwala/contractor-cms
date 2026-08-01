-- Time & Attendance Module
-- Manages employee time tracking, shifts, overtime, and attendance

-- Shifts (Define work schedules)
CREATE TABLE IF NOT EXISTS shifts (
  id VARCHAR(36) PRIMARY KEY,
  shift_name VARCHAR(100) NOT NULL,
  shift_code VARCHAR(20) NOT NULL,

  -- Shift times
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Break times
  break_duration_minutes INT DEFAULT 0,
  break_paid BOOLEAN DEFAULT FALSE,

  -- Working hours
  total_hours DECIMAL(5, 2) AS (
    TIMESTAMPDIFF(MINUTE, CONCAT(CURDATE(), ' ', start_time), CONCAT(IF(end_time < start_time, CURDATE() + INTERVAL 1 DAY, CURDATE()), ' ', end_time)) / 60 - break_duration_minutes / 60
  ) STORED,

  -- Shift type
  shift_type ENUM('regular', 'night', 'weekend', 'public_holiday') DEFAULT 'regular',

  -- Overtime configuration
  overtime_multiplier DECIMAL(3, 2) DEFAULT 1.00, -- 1.0 = regular, 1.5 = time-and-half, 2.0 = double-time

  -- Grace periods (in minutes)
  late_grace_period INT DEFAULT 0, -- Allow X minutes late without penalty
  early_clock_in_limit INT DEFAULT 30, -- Maximum minutes before shift to clock in

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  country VARCHAR(3),
  legal_entity_id VARCHAR(36),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_shifts_active (is_active),
  INDEX idx_shifts_code (shift_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shift Assignments (Assign employees to shifts)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  shift_id VARCHAR(36) NOT NULL,

  -- Assignment period
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Days of week (JSON array of 0-6, where 0=Sunday)
  work_days JSON, -- [1,2,3,4,5] = Mon-Fri

  -- Rotation
  is_rotating BOOLEAN DEFAULT FALSE,
  rotation_pattern VARCHAR(100), -- e.g., "2-2-3" for 2 days on, 2 off, 3 on

  -- Status
  status ENUM('active', 'inactive', 'pending') DEFAULT 'active',

  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,

  INDEX idx_shift_assignments_employee (employee_id),
  INDEX idx_shift_assignments_effective (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance Records (Daily clocking in/out)
CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  attendance_date DATE NOT NULL,
  shift_id VARCHAR(36),

  -- Clock times
  clock_in_time DATETIME,
  clock_out_time DATETIME,

  -- Location (optional - for GPS/IP tracking)
  clock_in_location VARCHAR(500),
  clock_out_location VARCHAR(500),
  clock_in_ip VARCHAR(50),
  clock_out_ip VARCHAR(50),

  -- Calculated hours
  total_hours DECIMAL(5, 2) DEFAULT 0,
  regular_hours DECIMAL(5, 2) DEFAULT 0,
  overtime_hours DECIMAL(5, 2) DEFAULT 0,
  break_hours DECIMAL(5, 2) DEFAULT 0,

  -- Late/Early tracking
  minutes_late INT DEFAULT 0,
  minutes_early_departure INT DEFAULT 0,

  -- Attendance status
  status ENUM('present', 'absent', 'half_day', 'late', 'on_leave', 'public_holiday') DEFAULT 'present',

  -- Leave integration
  leave_request_id VARCHAR(36),

  -- Approval
  approved_by VARCHAR(36),
  approved_at DATETIME,

  -- Notes
  employee_notes TEXT,
  admin_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,

  UNIQUE KEY unique_attendance (employee_id, attendance_date),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_attendance_employee_date (employee_id, attendance_date),
  INDEX idx_attendance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Overtime Requests (For pre-approved overtime)
CREATE TABLE IF NOT EXISTS overtime_requests (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  requested_by VARCHAR(36) NOT NULL,

  -- Overtime details
  overtime_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  estimated_hours DECIMAL(5, 2) NOT NULL,

  -- Reason
  reason TEXT,

  -- Overtime rate
  overtime_multiplier DECIMAL(3, 2) DEFAULT 1.50, -- 1.5x, 2.0x, etc.

  -- Approval workflow
  status ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'draft',
  approved_by VARCHAR(36),
  approved_at DATETIME,
  rejection_reason TEXT,

  -- Actual tracking (filled when overtime is worked)
  actual_start_time DATETIME,
  actual_end_time DATETIME,
  actual_hours DECIMAL(5, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,

  INDEX idx_overtime_employee (employee_id),
  INDEX idx_overtime_date (overtime_date),
  INDEX idx_overtime_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Time Adjustments (Manual corrections to attendance)
CREATE TABLE IF NOT EXISTS time_adjustments (
  id VARCHAR(36) PRIMARY KEY,
  attendance_record_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,

  -- Adjustment details
  adjustment_type ENUM('clock_in', 'clock_out', 'hours', 'status') NOT NULL,

  -- Before/After values
  before_value VARCHAR(200),
  after_value VARCHAR(200),

  -- Reason
  reason TEXT NOT NULL,

  -- Approval
  requested_by VARCHAR(36) NOT NULL,
  approved_by VARCHAR(36),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_at DATETIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,

  INDEX idx_adjustments_attendance (attendance_record_id),
  INDEX idx_adjustments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance Summary (Monthly summaries for performance)
CREATE TABLE IF NOT EXISTS attendance_summaries (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,

  -- Period
  summary_month DATE NOT NULL, -- First day of the month (e.g., '2024-06-01')

  -- Counts
  total_working_days INT DEFAULT 0,
  days_present INT DEFAULT 0,
  days_absent INT DEFAULT 0,
  days_half_day INT DEFAULT 0,
  days_on_leave INT DEFAULT 0,
  days_late INT DEFAULT 0,

  -- Hours
  total_hours_worked DECIMAL(8, 2) DEFAULT 0,
  regular_hours DECIMAL(8, 2) DEFAULT 0,
  overtime_hours DECIMAL(8, 2) DEFAULT 0,

  -- Percentages
  attendance_percentage DECIMAL(5, 2) AS (
    CASE WHEN total_working_days > 0
    THEN (days_present / total_working_days * 100)
    ELSE 0 END
  ) STORED,

  -- Punctuality
  total_late_minutes INT DEFAULT 0,
  average_late_minutes DECIMAL(5, 2) AS (
    CASE WHEN days_late > 0
    THEN (total_late_minutes / days_late)
    ELSE 0 END
  ) STORED,

  -- Calculated at
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,

  UNIQUE KEY unique_summary (employee_id, summary_month),
  INDEX idx_summaries_month (summary_month),
  INDEX idx_summaries_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clock Events (Detailed log of all clock-in/out events)
CREATE TABLE IF NOT EXISTS clock_events (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  attendance_record_id VARCHAR(36),

  -- Event details
  event_type ENUM('clock_in', 'clock_out', 'break_start', 'break_end') NOT NULL,
  event_time DATETIME NOT NULL,

  -- Device/Location info
  device_type ENUM('web', 'mobile', 'biometric', 'manual') DEFAULT 'web',
  ip_address VARCHAR(50),
  location VARCHAR(500),
  gps_coordinates VARCHAR(100), -- lat,lng

  -- Photo (for facial recognition systems)
  photo_url VARCHAR(500),

  -- Validation
  is_valid BOOLEAN DEFAULT TRUE,
  validation_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE SET NULL,

  INDEX idx_clock_events_employee (employee_id),
  INDEX idx_clock_events_time (event_time),
  INDEX idx_clock_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default shifts
INSERT IGNORE INTO shifts (id, shift_name, shift_code, start_time, end_time, break_duration_minutes, break_paid, shift_type, country)
VALUES
('shift-day-zaf', 'Day Shift', 'DAY', '08:00:00', '17:00:00', 60, TRUE, 'regular', 'ZAF'),
('shift-night-zaf', 'Night Shift', 'NIGHT', '20:00:00', '06:00:00', 60, TRUE, 'night', 'ZAF'),
('shift-weekend-zaf', 'Weekend Shift', 'WEEKEND', '08:00:00', '17:00:00', 60, TRUE, 'weekend', 'ZAF'),
('shift-flexi-zaf', 'Flexible Hours', 'FLEX', '00:00:00', '23:59:59', 0, FALSE, 'regular', 'ZAF');

CREATE INDEX idx_attendance_clock_in ON attendance_records(clock_in_time);
CREATE INDEX idx_attendance_employee_month ON attendance_records(employee_id, attendance_date);
