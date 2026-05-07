-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  r2_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('video', 'audio')),
  status TEXT NOT NULL CHECK(status IN ('uploading', 'processing', 'completed', 'failed')) DEFAULT 'processing',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Transcriptions table (original language transcription)
CREATE TABLE IF NOT EXISTS transcriptions (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  language TEXT NOT NULL,
  subtitle_path TEXT NOT NULL,
  word_count INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE(video_id, language)
);

-- Translations table
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  transcription_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  subtitle_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
  UNIQUE(transcription_id, target_language)
);

-- Processing jobs table (for async processing)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK(job_type IN ('transcription', 'translation')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  target_languages TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Performance metrics table (for monitoring and analytics)
CREATE TABLE IF NOT EXISTS performance_metrics (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK(metric_type IN ('upload', 'transcription', 'translation', 'total')),
  duration_ms INTEGER NOT NULL,
  file_size_bytes INTEGER,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')) DEFAULT 'success',
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Upload history table (for tracking user uploads)
CREATE TABLE IF NOT EXISTS upload_history (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  duration_seconds REAL NOT NULL,
  target_languages TEXT NOT NULL,
  upload_duration_ms INTEGER NOT NULL,
  transcription_duration_ms INTEGER,
  translation_duration_ms INTEGER,
  total_duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')) DEFAULT 'success',
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Performance analytics table (aggregated stats)
CREATE TABLE IF NOT EXISTS performance_analytics (
  id TEXT PRIMARY KEY,
  date_str TEXT NOT NULL,
  total_uploads INTEGER DEFAULT 0,
  successful_uploads INTEGER DEFAULT 0,
  failed_uploads INTEGER DEFAULT 0,
  avg_upload_duration_ms REAL,
  avg_transcription_duration_ms REAL,
  avg_translation_duration_ms REAL,
  avg_file_size_bytes REAL,
  total_files_processed_bytes BIGINT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(date_str)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_transcriptions_video_id ON transcriptions(video_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_language ON transcriptions(language);
CREATE INDEX IF NOT EXISTS idx_translations_transcription_id ON translations(transcription_id);
CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_video_id ON performance_metrics(video_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_history_video_id ON upload_history(video_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_created_at ON upload_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON performance_analytics(date_str DESC);
