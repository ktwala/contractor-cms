-- Migration: Mobile API Enhancements
-- Description: Tables for mobile app support, push notifications, and offline sync
-- Author: System
-- Date: 2025-12-29

-- =====================================================
-- 1. Mobile Device Registration
-- =====================================================
CREATE TABLE IF NOT EXISTS mobile_devices (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_type ENUM('ios', 'android') NOT NULL,
  device_name VARCHAR(255),
  device_model VARCHAR(255),
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  push_token VARCHAR(512),
  push_provider ENUM('fcm', 'apns') DEFAULT 'fcm',
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at DATETIME,
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_push_token (push_token(255)),
  INDEX idx_is_active (is_active),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. Mobile Sessions (Refresh Tokens)
-- =====================================================
CREATE TABLE IF NOT EXISTS mobile_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  refresh_token VARCHAR(512) NOT NULL,
  access_token_hash VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_refresh_token (refresh_token(255)),
  INDEX idx_is_active (is_active),
  INDEX idx_expires_at (expires_at),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES mobile_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. Push Notification Queue
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36),
  notification_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSON,
  priority ENUM('high', 'normal', 'low') DEFAULT 'normal',
  status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
  provider ENUM('fcm', 'apns') NOT NULL,
  provider_message_id VARCHAR(255),
  provider_response TEXT,
  scheduled_for DATETIME,
  sent_at DATETIME,
  delivered_at DATETIME,
  failed_reason TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_status (status),
  INDEX idx_scheduled_for (scheduled_for),
  INDEX idx_notification_type (notification_type),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES mobile_devices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. Offline Sync Queue
-- =====================================================
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  operation ENUM('create', 'update', 'delete') NOT NULL,
  data JSON NOT NULL,
  sync_status ENUM('pending', 'synced', 'failed', 'conflict') DEFAULT 'pending',
  conflict_resolution ENUM('server_wins', 'client_wins', 'manual') DEFAULT 'server_wins',
  client_timestamp DATETIME NOT NULL,
  server_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,

  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_sync_status (sync_status),
  INDEX idx_client_timestamp (client_timestamp),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES mobile_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. Mobile App Settings
-- =====================================================
CREATE TABLE IF NOT EXISTS mobile_app_settings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36),
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_user_device_setting (user_id, device_id, setting_key),
  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_setting_key (setting_key),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES mobile_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. Mobile API Usage Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS mobile_api_usage (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  payload_size_bytes INT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_endpoint (endpoint),
  INDEX idx_created_at (created_at),
  INDEX idx_status_code (status_code),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES mobile_devices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. Mobile Feature Flags
-- =====================================================
CREATE TABLE IF NOT EXISTS mobile_feature_flags (
  id CHAR(36) PRIMARY KEY,
  feature_key VARCHAR(100) NOT NULL UNIQUE,
  feature_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  min_app_version VARCHAR(50),
  platform ENUM('all', 'ios', 'android') DEFAULT 'all',
  rollout_percentage INT DEFAULT 100,
  config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_feature_key (feature_key),
  INDEX idx_is_enabled (is_enabled),
  INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Seed Data: Mobile Feature Flags
-- =====================================================
INSERT INTO mobile_feature_flags (id, feature_key, feature_name, description, is_enabled, platform, rollout_percentage) VALUES
(UUID(), 'biometric_auth', 'Biometric Authentication', 'Enable fingerprint/face ID authentication', TRUE, 'all', 100),
(UUID(), 'offline_mode', 'Offline Mode', 'Enable offline data access and sync', TRUE, 'all', 100),
(UUID(), 'push_notifications', 'Push Notifications', 'Enable push notifications', TRUE, 'all', 100),
(UUID(), 'geolocation_clock', 'Geolocation Clock In/Out', 'Require location for clock in/out', FALSE, 'all', 0),
(UUID(), 'mobile_payslip_download', 'Payslip Download', 'Enable payslip PDF download on mobile', TRUE, 'all', 100),
(UUID(), 'mobile_leave_request', 'Leave Request', 'Submit leave requests from mobile', TRUE, 'all', 100),
(UUID(), 'mobile_expense_claim', 'Expense Claims', 'Submit expense claims with receipt photos', TRUE, 'all', 100),
(UUID(), 'dark_mode', 'Dark Mode', 'Enable dark mode theme', TRUE, 'all', 100),
(UUID(), 'quick_clock', 'Quick Clock Actions', 'Quick clock in/out from home screen', TRUE, 'all', 100),
(UUID(), 'mobile_analytics', 'Mobile Analytics', 'View personal analytics and reports', FALSE, 'all', 50);

-- =====================================================
-- Seed Data: Default Mobile Settings
-- =====================================================
-- Common settings that will be initialized for new mobile users
-- These can be overridden per user/device
INSERT INTO mobile_feature_flags (id, feature_key, feature_name, description, is_enabled, config) VALUES
(UUID(), 'default_dashboard_widgets', 'Default Dashboard Widgets', 'Default widgets shown on mobile dashboard', TRUE,
  JSON_OBJECT(
    'widgets', JSON_ARRAY('attendance_summary', 'upcoming_shifts', 'leave_balance', 'recent_payslips')
  )
),
(UUID(), 'notification_preferences', 'Default Notification Preferences', 'Default notification settings', TRUE,
  JSON_OBJECT(
    'push_enabled', true,
    'payslip_notifications', true,
    'shift_reminders', true,
    'leave_updates', true,
    'expense_updates', true,
    'reminder_hours_before_shift', 2
  )
);
