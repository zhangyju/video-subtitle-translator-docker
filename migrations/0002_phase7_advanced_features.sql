-- Phase 7: Advanced Features - Database Schema

-- Transcription Progress Tracking Table
-- Tracks progress of each transcription/translation task
CREATE TABLE IF NOT EXISTS transcription_progress (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  status TEXT DEFAULT 'processing', -- processing, transcribed, completed, failed
  progress_percent INTEGER DEFAULT 0, -- 0-100
  transcribed_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE(video_id)
);

CREATE INDEX IF NOT EXISTS idx_transcription_progress_video_id ON transcription_progress(video_id);
CREATE INDEX IF NOT EXISTS idx_transcription_progress_status ON transcription_progress(status);
CREATE INDEX IF NOT EXISTS idx_transcription_progress_created_at ON transcription_progress(created_at);

-- Audit Logs Table
-- Tracks all user actions for analytics and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- upload, transcribe, download, delete, language_add, etc.
  resource_type TEXT, -- video, subtitle, etc.
  resource_id TEXT,
  details TEXT, -- JSON with action details
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_date ON audit_logs(user_id, action, created_at);

-- Quota Reset Tracking Table
-- Tracks when quotas reset and consumption per user
CREATE TABLE IF NOT EXISTS quota_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reset_type TEXT NOT NULL, -- monthly, daily
  reset_date DATE NOT NULL,
  storage_used_gb REAL DEFAULT 0,
  storage_limit_gb REAL NOT NULL,
  transcriptions_used INTEGER DEFAULT 0,
  transcriptions_limit INTEGER NOT NULL,
  daily_processing_used_gb REAL DEFAULT 0,
  daily_processing_limit_gb REAL NOT NULL,
  reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, reset_type, reset_date)
);

CREATE INDEX IF NOT EXISTS idx_quota_resets_user_id ON quota_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_resets_user_reset_date ON quota_resets(user_id, reset_date);
CREATE INDEX IF NOT EXISTS idx_quota_resets_reset_type ON quota_resets(reset_type);

-- Analytics Summary Table (optional, for faster queries)
-- Pre-aggregated data for quick dashboard/analytics queries
CREATE TABLE IF NOT EXISTS analytics_summary (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  summary_date DATE NOT NULL,
  total_videos INTEGER DEFAULT 0,
  total_subtitles INTEGER DEFAULT 0,
  total_storage_gb REAL DEFAULT 0,
  transcriptions_completed INTEGER DEFAULT 0,
  transcriptions_failed INTEGER DEFAULT 0,
  languages_used TEXT, -- JSON array of language codes
  top_language TEXT,
  avg_processing_seconds INTEGER,
  success_rate REAL, -- percentage
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_summary_user_id ON analytics_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_date ON analytics_summary(summary_date);

-- Language Statistics Table
-- Tracks usage of each language for analytics
CREATE TABLE IF NOT EXISTS language_statistics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_language_statistics_user_id ON language_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_language_statistics_language ON language_statistics(language_code);
