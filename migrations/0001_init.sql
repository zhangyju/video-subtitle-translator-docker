-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT 0,
  verification_token TEXT,
  quota_storage_gb REAL DEFAULT 100,
  quota_transcriptions INTEGER DEFAULT 1000,
  quota_daily_processing_gb REAL DEFAULT 10,
  storage_used_gb REAL DEFAULT 0,
  transcriptions_this_month INTEGER DEFAULT 0,
  processing_today_gb REAL DEFAULT 0,
  processing_date_reset TEXT DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  r2_key TEXT,
  r2_url TEXT,
  status TEXT DEFAULT 'processing',
  transcript TEXT,
  detected_language TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_duration_seconds INTEGER,
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

-- Subtitles table
CREATE TABLE IF NOT EXISTS subtitles (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  vtt_content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, language_code),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subtitles_video_id ON subtitles(video_id);

-- Video languages
CREATE TABLE IF NOT EXISTS video_languages (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_languages_video_id ON video_languages(video_id);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email_to TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
