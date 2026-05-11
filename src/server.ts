import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@libsql/client';
import { MockR2StorageService } from './r2-service';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// D1 Database connection
const dbUrl = process.env.DB_URL || 'file:./.wrangler/state/v3/d1/video-subtitle-db.sqlite';
const db = createClient({ url: dbUrl });

const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// R2 Storage Service (for local development, uses mock service)
const r2Service = new MockR2StorageService('/tmp/r2-storage');

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// QuotaService for local development
class QuotaService {
  async canUpload(userId: string, fileSizeBytes: number): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const result = await db.execute({
        sql: 'SELECT quota_storage_gb, storage_used_gb FROM users WHERE id = ?',
        args: [userId]
      });

      if (result.rows.length === 0) {
        return { allowed: false, reason: 'User not found' };
      }

      const user = result.rows[0] as any;
      const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);
      const remainingQuota = user.quota_storage_gb - user.storage_used_gb;

      if (fileSizeGb > remainingQuota) {
        return {
          allowed: false,
          reason: `Insufficient storage quota. Required: ${fileSizeGb.toFixed(2)}GB, Available: ${remainingQuota.toFixed(2)}GB`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[QuotaService] Error checking upload quota:', error);
      return { allowed: false, reason: 'Error checking quota' };
    }
  }

  async canTranscribe(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const result = await db.execute({
        sql: 'SELECT quota_transcriptions, transcriptions_this_month FROM users WHERE id = ?',
        args: [userId]
      });

      if (result.rows.length === 0) {
        return { allowed: false, reason: 'User not found' };
      }

      const user = result.rows[0] as any;
      const remainingTranscriptions = user.quota_transcriptions - user.transcriptions_this_month;

      if (remainingTranscriptions <= 0) {
        return {
          allowed: false,
          reason: `Transcription quota exceeded. Monthly limit: ${user.quota_transcriptions}, used: ${user.transcriptions_this_month}`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[QuotaService] Error checking transcription quota:', error);
      return { allowed: false, reason: 'Error checking quota' };
    }
  }

  async canProcessDaily(userId: string, additionalGb: number): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const result = await db.execute({
        sql: 'SELECT quota_daily_processing_gb, processing_today_gb, processing_date_reset FROM users WHERE id = ?',
        args: [userId]
      });

      if (result.rows.length === 0) {
        return { allowed: false, reason: 'User not found' };
      }

      const user = result.rows[0] as any;
      const today = new Date().toISOString().split('T')[0];

      if (user.processing_date_reset !== today) {
        // Reset daily quota
        await db.execute({
          sql: 'UPDATE users SET processing_today_gb = 0, processing_date_reset = ? WHERE id = ?',
          args: [today, userId]
        });
        return { allowed: true };
      }

      const remainingDaily = user.quota_daily_processing_gb - user.processing_today_gb;

      if (additionalGb > remainingDaily) {
        return {
          allowed: false,
          reason: `Daily processing quota exceeded. Limit: ${user.quota_daily_processing_gb}GB, used: ${user.processing_today_gb}GB, additional: ${additionalGb}GB`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[QuotaService] Error checking daily processing quota:', error);
      return { allowed: false, reason: 'Error checking quota' };
    }
  }

  async consumeStorageQuota(userId: string, fileSizeBytes: number): Promise<boolean> {
    try {
      const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);
      await db.execute({
        sql: 'UPDATE users SET storage_used_gb = storage_used_gb + ? WHERE id = ?',
        args: [fileSizeGb, userId]
      });

      console.log(`[QuotaService] Consumed ${fileSizeGb.toFixed(2)}GB storage for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[QuotaService] Error consuming storage quota:', error);
      return false;
    }
  }

  async consumeTranscriptionQuota(userId: string): Promise<boolean> {
    try {
      await db.execute({
        sql: 'UPDATE users SET transcriptions_this_month = transcriptions_this_month + 1 WHERE id = ?',
        args: [userId]
      });

      console.log(`[QuotaService] Consumed transcription for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[QuotaService] Error consuming transcription quota:', error);
      return false;
    }
  }

  async getQuotaStatus(userId: string): Promise<any> {
    try {
      const result = await db.execute({
        sql: `SELECT 
          quota_storage_gb, storage_used_gb,
          quota_transcriptions, transcriptions_this_month,
          quota_daily_processing_gb, processing_today_gb,
          processing_date_reset
        FROM users WHERE id = ?`,
        args: [userId]
      });

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0] as any;
      const today = new Date().toISOString().split('T')[0];

      // Reset daily quota if needed
      if (user.processing_date_reset !== today) {
        await db.execute({
          sql: 'UPDATE users SET processing_today_gb = 0, processing_date_reset = ? WHERE id = ?',
          args: [today, userId]
        });
        user.processing_today_gb = 0;
        user.processing_date_reset = today;
      }

      return {
        storage: {
          limit: user.quota_storage_gb,
          used: user.storage_used_gb,
          remaining: user.quota_storage_gb - user.storage_used_gb,
          percentage: Math.round((user.storage_used_gb / user.quota_storage_gb) * 100)
        },
        transcriptions: {
          limit: user.quota_transcriptions,
          used: user.transcriptions_this_month,
          remaining: user.quota_transcriptions - user.transcriptions_this_month,
          percentage: Math.round((user.transcriptions_this_month / user.quota_transcriptions) * 100)
        },
        dailyProcessing: {
          limit: user.quota_daily_processing_gb,
          used: user.processing_today_gb,
          remaining: user.quota_daily_processing_gb - user.processing_today_gb,
          percentage: Math.round((user.processing_today_gb / user.quota_daily_processing_gb) * 100),
          resetDate: user.processing_date_reset
        }
      };
    } catch (error) {
      console.error('[QuotaService] Error getting quota status:', error);
      return null;
    }
  }

  async logAction(userId: string, action: string, resourceType: string | null, resourceId: string | null, details: any): Promise<void> {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.execute({
        sql: `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [id, userId, action, resourceType || null, resourceId || null, JSON.stringify(details)]
      });

      console.log(`[QuotaService] Logged action: ${action} for user ${userId}`);
    } catch (error) {
      console.error('[QuotaService] Error logging action:', error);
    }
  }
}

const quotaService = new QuotaService();

interface VideoRecord {
  id: string;
  title: string;
  originalFileName: string;
  fileSize: number;
  filePath: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  transcribed: boolean;
  transcript?: string;
  subtitles: Record<string, string>;
  languages: string[];
  error?: string;
}

const videosDb = new Map<string, VideoRecord>();

// Language mapping
const languageCodeMap: Record<string, string> = {
  'zh': 'Chinese',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'ja': 'Japanese',
  'ko': 'Korean',
  'pt': 'Portuguese'
};

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const videoId = uuidv4();
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const title = req.body.title || req.file.originalname;
    const languages = req.body.languages ? JSON.parse(req.body.languages) : ['en'];

    // Check user quota (if authenticated)
    if (userId !== 'anonymous') {
      // Check storage quota
      const quotaCheck = await quotaService.canUpload(userId, req.file.size);
      if (!quotaCheck.allowed) {
        res.status(400).json({ success: false, error: quotaCheck.reason || 'Storage quota exceeded' });
        return;
      }

      // Check daily processing quota
      const fileSizeGb = req.file.size / (1024 * 1024 * 1024);
      const dailyCheck = await quotaService.canProcessDaily(userId, fileSizeGb);
      if (!dailyCheck.allowed) {
        res.status(400).json({ success: false, error: dailyCheck.reason || 'Daily processing quota exceeded' });
        return;
      }

      // Log the action
      await quotaService.logAction(userId, 'upload', 'video', videoId, {
        title,
        fileSize: req.file.size,
        languages
      });
    }

    // Upload to R2 (or mock R2 for local dev)
    const fileData = fs.readFileSync(req.file.path);
    const { url: r2Url, key: r2Key } = await r2Service.uploadVideo(
      userId,
      videoId,
      fileData,
      req.file.originalname,
      req.file.mimetype
    );

    // Save to D1
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO videos (id, user_id, title, original_filename, file_size, status, created_at, languages, r2_url, r2_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [videoId, userId, title, req.file.originalname, req.file.size, 'processing', createdAt, JSON.stringify(languages), r2Url, r2Key]
    });

    // Store locally for processing (keep original file for transcription)
    const videoRecord: VideoRecord = {
      id: videoId,
      title,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: req.file.path,
      status: 'processing',
      createdAt,
      transcribed: false,
      subtitles: {},
      languages
    };

    videosDb.set(videoId, videoRecord);

    // Consume storage quota (if authenticated)
    if (userId !== 'anonymous') {
      const fileSizeGb = req.file.size / (1024 * 1024 * 1024);
      await quotaService.consumeStorageQuota(userId, req.file.size);
      
      // Also consume from daily processing quota
      const today = new Date().toISOString().split('T')[0];
      await db.execute({
        sql: 'UPDATE users SET processing_today_gb = processing_today_gb + ? WHERE id = ?',
        args: [fileSizeGb, userId]
      });
    }

    console.log(`[Upload] Video: ${videoId}, User: ${userId}, Title: ${title}, R2 URL: ${r2Url}`);

    res.status(201).json({
      success: true,
      data: {
        id: videoId,
        title,
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        status: 'processing',
        createdAt,
        languages
      }
    });

    // Start async processing
    processVideo(videoId, userId).catch(err => {
      console.error(`[Error] Processing video ${videoId}:`, err);
      const record = videosDb.get(videoId);
      if (record) {
        record.status = 'failed';
        record.error = err instanceof Error ? err.message : String(err);
      }
      // Update D1
      db.execute({
        sql: 'UPDATE videos SET status = ? WHERE id = ?',
        args: ['failed', videoId]
      }).catch(e => console.error('[DB Error]', e));
    });

  } catch (error) {
    console.error('[Upload Error]', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Get all videos (for authenticated user)
app.get('/api/videos', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    
    const result = await db.execute({
      sql: 'SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC',
      args: [userId]
    });

    const videos = result.rows.map((v: any) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      createdAt: v.created_at,
      originalFileName: v.original_filename,
      fileSize: v.file_size,
      r2Url: v.r2_url,
      languages: v.languages ? JSON.parse(v.languages) : [],
      transcribed: v.status === 'completed'
    }));

    res.json({ success: true, data: { videos } });
  } catch (error) {
    console.error('[Get Videos Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch videos' });
  }
});

// Get video progress
app.get('/api/progress/:videoId', async (req: Request, res: Response) => {
  try {
    const videoId = req.params.videoId;
    
    // Try to get from memory first
    const record = videosDb.get(videoId);

    if (!record) {
      // Try to fetch from D1 database
      const dbResult = await db.execute({
        sql: 'SELECT * FROM videos WHERE id = ?',
        args: [videoId]
      });

      if (dbResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Video not found' });
        return;
      }

      const video = dbResult.rows[0] as any;
      const languages = video.languages ? JSON.parse(video.languages) : [];

      res.json({
        success: true,
        data: {
          id: video.id,
          title: video.title,
          status: video.status,
          progress: calculateProgress(video.status, languages),
          transcribed: video.status === 'completed',
          subtitlesCount: languages.length,
          totalLanguages: languages.length,
          languages: languages,
          createdAt: video.created_at,
          updatedAt: video.updated_at || video.created_at
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: record.id,
        title: record.title,
        status: record.status,
        progress: calculateProgress(record.status, record.languages),
        transcribed: record.transcribed,
        subtitlesCount: Object.keys(record.subtitles).length,
        totalLanguages: record.languages.length,
        languages: record.languages,
        createdAt: record.createdAt
      }
    });
  } catch (error) {
    console.error('[Progress Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// Helper function to calculate progress
function calculateProgress(status: string, languages: string[]): number {
  switch (status) {
    case 'processing':
      return 30;
    case 'transcribed':
      return 60;
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}

// Get video details for playback
app.get('/api/watch/:videoId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const record = videosDb.get(req.params.videoId);
    
    if (!record) {
      // Try to fetch from D1 if not in memory
      const dbResult = await db.execute({
        sql: 'SELECT * FROM videos WHERE id = ?',
        args: [req.params.videoId]
      });

      if (dbResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Video not found' });
        return;
      }

      const video = dbResult.rows[0] as any;
      const lang = req.query.lang as string || 'en';

      res.json({
        success: true,
        data: {
          id: video.id,
          title: video.title,
          originalFileName: video.original_filename,
          status: video.status,
          createdAt: video.created_at,
          r2Url: video.r2_url, // R2 CDN URL for video playback
          availableSubtitles: video.languages ? JSON.parse(video.languages) : [],
          currentLanguage: lang
        }
      });
      return;
    }

    const lang = req.query.lang as string || 'en';
    const subtitle = record.subtitles[lang];

    res.json({
      success: true,
      data: {
        id: record.id,
        title: record.title,
        originalFileName: record.originalFileName,
        status: record.status,
        createdAt: record.createdAt,
        r2Url: r2Service.getVideoUrl(userId, record.id, record.originalFileName.split('.').pop() || 'mp4'),
        availableSubtitles: Object.keys(record.subtitles),
        subtitle: subtitle || null,
        currentLanguage: lang
      }
    });
  } catch (error) {
    console.error('[Watch Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch video' });
  }
});

// Download subtitle
app.get('/api/subtitles/:videoId/:language', async (req: Request, res: Response) => {
  try {
    const record = videosDb.get(req.params.videoId);

    if (!record || !record.subtitles[req.params.language]) {
      res.status(404).json({ success: false, error: 'Subtitle not found' });
      return;
    }

    const langName = languageCodeMap[req.params.language] || req.params.language;
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${record.title}-${langName}.vtt"`);
    res.send(record.subtitles[req.params.language]);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch subtitle' });
  }
});

// Serve R2 files locally (for development)
app.get('/r2/*', (req: Request, res: Response) => {
  try {
    const key = req.params[0];
    const filePath = (r2Service as any).getLocalFilePath(key);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    const mimeType = getMimeType(filePath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(filePath);
  } catch (error) {
    console.error('[R2 Serve Error]', error);
    res.status(500).json({ success: false, error: 'Failed to serve file' });
  }
});

// Get file for Worker transcription
app.get('/api/get-file/:videoId', async (req: Request, res: Response) => {
  try {
    const record = videosDb.get(req.params.videoId);

    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    if (!fs.existsSync(record.filePath)) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    console.log(`[Server] Sending file for ${req.params.videoId}`);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(record.filePath);
  } catch (error) {
    console.error('[Error] Get file:', error);
    res.status(500).json({ success: false, error: 'Failed to get file' });
  }
});

// Store transcription result from Worker
app.post('/api/store-transcript/:videoId', express.json(), async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { transcript, subtitles } = req.body;

    const record = videosDb.get(videoId);
    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    record.transcript = transcript;
    record.transcribed = true;
    record.subtitles = subtitles || {};
    record.status = 'completed';

    console.log(`[Store] Transcript for ${videoId}: ${Object.keys(subtitles).length} languages`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to store transcript' });
  }
});

// Error handling
app.use((error: any, _req: Request, res: Response, _next: any) => {
  console.error('[Error]', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// Analytics endpoint
app.get('/api/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (userId === 'anonymous') {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Get user's videos
    const videosResult = await db.execute({
      sql: 'SELECT * FROM videos WHERE user_id = ?',
      args: [userId]
    });

    const videos = videosResult.rows as any[];

    // Calculate metrics
    const totalVideos = videos.length;
    const completedVideos = videos.filter(v => v.status === 'completed').length;
    const failedVideos = videos.filter(v => v.status === 'failed').length;
    const successRate = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

    // Get storage statistics
    const storageResult = await db.execute({
      sql: 'SELECT SUM(file_size) as total_size FROM videos WHERE user_id = ?',
      args: [userId]
    });

    const totalStorageBytes = (storageResult.rows[0] as any)?.total_size || 0;
    const totalStorageGb = totalStorageBytes / (1024 * 1024 * 1024);

    // Get language statistics
    const langResult = await db.execute({
      sql: `SELECT language_code, COUNT(*) as count 
            FROM video_languages 
            WHERE video_id IN (SELECT id FROM videos WHERE user_id = ?)
            GROUP BY language_code 
            ORDER BY count DESC`,
      args: [userId]
    });

    const languageDistribution = langResult.rows.map((row: any) => ({
      language: row.language_code,
      count: row.count
    }));

    // Get audit logs for action distribution
    const auditResult = await db.execute({
      sql: `SELECT action, COUNT(*) as count 
            FROM audit_logs 
            WHERE user_id = ? 
            GROUP BY action`,
      args: [userId]
    });

    const actionDistribution = auditResult.rows.map((row: any) => ({
      action: row.action,
      count: row.count
    }));

    // Calculate average processing time
    let avgProcessingTime = 0;
    if (completedVideos > 0) {
      let totalTime = 0;
      for (const video of videos.filter(v => v.status === 'completed')) {
        // For now, estimate based on file size (rough approximation)
        const fileSizeGb = video.file_size / (1024 * 1024 * 1024);
        totalTime += Math.ceil(fileSizeGb * 10); // Rough estimate: 10 seconds per GB
      }
      avgProcessingTime = Math.round(totalTime / completedVideos);
    }

    // Get user quota info
    const userResult = await db.execute({
      sql: `SELECT 
              quota_storage_gb, storage_used_gb,
              quota_transcriptions, transcriptions_this_month,
              quota_daily_processing_gb, processing_today_gb
            FROM users WHERE id = ?`,
      args: [userId]
    });

    const user = userResult.rows[0] as any;

    res.json({
      success: true,
      data: {
        summary: {
          totalVideos,
          completedVideos,
          failedVideos,
          successRate,
          totalStorageGb: Math.round(totalStorageGb * 100) / 100,
          avgProcessingSeconds: avgProcessingTime
        },
        languageDistribution,
        actionDistribution,
        quota: {
          storage: {
            limit: user.quota_storage_gb,
            used: user.storage_used_gb,
            percentage: Math.round((user.storage_used_gb / user.quota_storage_gb) * 100)
          },
          transcriptions: {
            limit: user.quota_transcriptions,
            used: user.transcriptions_this_month,
            percentage: Math.round((user.transcriptions_this_month / user.quota_transcriptions) * 100)
          },
          dailyProcessing: {
            limit: user.quota_daily_processing_gb,
            used: user.processing_today_gb,
            percentage: Math.round((user.processing_today_gb / user.quota_daily_processing_gb) * 100)
          }
        }
      }
    });
  } catch (error) {
    console.error('[Analytics Error]', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analytics'
    });
  }
});

// Dashboard page
app.get('/dashboard', (req: Request, res: Response) => {
  const dashboardHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户仪表板 - 视频字幕翻译器</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 { font-size: 28px; }
        .header button {
            background: rgba(255,255,255,0.2);
            border: 1px solid white;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        .container {
            max-width: 1200px;
            margin: 30px auto;
            padding: 0 20px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card h3 { color: #667eea; margin-bottom: 10px; font-size: 14px; }
        .card .value { font-size: 32px; font-weight: bold; color: #333; }
        .card .unit { font-size: 12px; color: #999; margin-top: 5px; }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #eee;
            border-radius: 4px;
            margin-top: 10px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s;
        }
        
        .section-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
        }
        
        .video-list {
            display: grid;
            gap: 15px;
        }
        .video-item {
            background: white;
            border-radius: 8px;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .video-info h4 { font-size: 16px; margin-bottom: 5px; }
        .video-meta {
            font-size: 12px;
            color: #999;
        }
        .video-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .status-completed { background: #d4edda; color: #155724; }
        .status-processing { background: #fff3cd; color: #856404; }
        .status-failed { background: #f8d7da; color: #721c24; }
        
        .language-tags {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }
        .lang-tag {
            background: #e8e8ff;
            color: #667eea;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
        }
        
        .loading { text-align: center; padding: 40px; color: #999; }
        .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 用户仪表板</h1>
        <button onclick="logout()">退出登录</button>
    </div>

    <div class="container">
        <div id="error" class="error" style="display:none;"></div>
        <div id="loading" class="loading">加载中...</div>
        
        <div id="content" style="display:none;">
            <!-- Quota Section -->
            <div class="section-title">📦 配额使用情况</div>
            <div class="grid">
                <div class="card">
                    <h3>存储空间</h3>
                    <div class="value" id="storageUsed">-</div>
                    <div class="unit">GB</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="storageProgress"></div>
                    </div>
                    <div class="unit" id="storageText">0%</div>
                </div>
                
                <div class="card">
                    <h3>本月转录次数</h3>
                    <div class="value" id="transcriptionsUsed">-</div>
                    <div class="unit">次</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="transcriptionsProgress"></div>
                    </div>
                    <div class="unit" id="transcriptionsText">0%</div>
                </div>
                
                <div class="card">
                    <h3>今日处理数据量</h3>
                    <div class="value" id="processingUsed">-</div>
                    <div class="unit">GB</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="processingProgress"></div>
                    </div>
                    <div class="unit" id="processingText">0%</div>
                </div>
            </div>

            <!-- Videos Section -->
            <div class="section-title">🎬 我的视频</div>
            <div class="grid">
                <div class="card">
                    <h3>总视频数</h3>
                    <div class="value" id="totalVideos">0</div>
                </div>
                <div class="card">
                    <h3>已完成</h3>
                    <div class="value" id="completedVideos">0</div>
                </div>
                <div class="card">
                    <h3>处理中</h3>
                    <div class="value" id="processingVideos">0</div>
                </div>
                <div class="card">
                    <h3>处理失败</h3>
                    <div class="value" id="failedVideos">0</div>
                </div>
            </div>

            <!-- Video List -->
            <div class="section-title" style="margin-top: 40px;">📝 视频列表</div>
            <div id="videoList" class="video-list">
                <div class="loading">加载视频列表中...</div>
            </div>

            <!-- Languages Section -->
            <div class="section-title" style="margin-top: 40px;">🌐 语言统计</div>
            <div class="card">
                <h3>最常使用的语言</h3>
                <div id="topLanguages" style="margin-top: 15px;"></div>
            </div>
        </div>
    </div>

    <script>
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');

        if (!userId || !token) {
            window.location.href = '/';
            window.stop();
        }

        async function loadDashboard() {
            try {
                const response = await fetch('/api/dashboard', {
                    headers: { 'x-user-id': userId }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        window.location.href = '/';
                        return;
                    }
                    throw new Error('Failed to load dashboard');
                }

                const data = await response.json();
                if (data.success) {
                    renderDashboard(data.data);
                } else {
                    showError(data.error || '加载失败');
                }
            } catch (error) {
                showError(error.message || '加载失败');
            }
        }

        function renderDashboard(data) {
            const { user, videos, quota, languages } = data;

            // Update quota cards
            document.getElementById('storageUsed').textContent = quota.storage.used.toFixed(2);
            document.getElementById('storageProgress').style.width = quota.storage.percentage + '%';
            document.getElementById('storageText').textContent = \`\${quota.storage.percentage}% (\${quota.storage.limit}GB)\`;

            document.getElementById('transcriptionsUsed').textContent = quota.transcriptions.used;
            document.getElementById('transcriptionsProgress').style.width = quota.transcriptions.percentage + '%';
            document.getElementById('transcriptionsText').textContent = \`\${quota.transcriptions.percentage}% (\${quota.transcriptions.limit}次)\`;

            document.getElementById('processingUsed').textContent = quota.dailyProcessing.used.toFixed(2);
            document.getElementById('processingProgress').style.width = quota.dailyProcessing.percentage + '%';
            document.getElementById('processingText').textContent = \`\${quota.dailyProcessing.percentage}% (\${quota.dailyProcessing.limit}GB)\`;

            // Update video statistics
            document.getElementById('totalVideos').textContent = videos.total;
            document.getElementById('completedVideos').textContent = videos.completed;
            document.getElementById('processingVideos').textContent = videos.processing;
            document.getElementById('failedVideos').textContent = videos.failed;

            // Render video list
            const videoListHTML = videos.list.length > 0
                ? videos.list.map(v => \`
                    <div class="video-item">
                        <div class="video-info">
                            <h4>\${v.title}</h4>
                            <div class="video-meta">
                                大小: \${(v.fileSize / (1024*1024)).toFixed(2)}MB | 创建于: \${new Date(v.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                            <div style="margin-top: 8px;">
                                <div class="language-tags">
                                    \${v.languages.map(lang => \`<span class="lang-tag">\${lang}</span>\`).join('')}
                                </div>
                            </div>
                        </div>
                        <span class="video-status status-\${v.status}">\${v.status === 'completed' ? '已完成' : v.status === 'processing' ? '处理中' : '失败'}</span>
                    </div>
                \`).join('')
                : '<div class="loading">还没有视频，<a href="/">立即上传</a></div>';

            document.getElementById('videoList').innerHTML = videoListHTML;

            // Render top languages
            const topLangsHTML = languages.topLanguages.length > 0
                ? languages.topLanguages.map(lang => \`
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>\${lang.language}</span>
                            <span style="font-weight: bold;">\${lang.count}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${(lang.count / languages.topLanguages[0].count * 100)}%"></div>
                        </div>
                    </div>
                \`).join('')
                : '<div class="loading">暂无数据</div>';

            document.getElementById('topLanguages').innerHTML = topLangsHTML;

            // Show content, hide loading
            document.getElementById('loading').style.display = 'none';
            document.getElementById('content').style.display = 'block';
        }

        function showError(message) {
            document.getElementById('error').textContent = '❌ ' + message;
            document.getElementById('error').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
        }

        function logout() {
            localStorage.removeItem('userId');
            localStorage.removeItem('token');
            window.location.href = '/';
        }

        // Load dashboard on page load
        document.addEventListener('DOMContentLoaded', loadDashboard);
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(dashboardHTML);
});

// Dashboard endpoint
app.get('/api/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (userId === 'anonymous') {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Get user info
    const userResult = await db.execute({
      sql: `SELECT email, full_name,
              quota_storage_gb, storage_used_gb,
              quota_transcriptions, transcriptions_this_month,
              quota_daily_processing_gb, processing_today_gb
            FROM users WHERE id = ?`,
      args: [userId]
    });

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const user = userResult.rows[0] as any;

    // Get user's videos with language info
    const videosResult = await db.execute({
      sql: `SELECT v.*, 
              GROUP_CONCAT(vl.language_code, ',') as languages,
              COUNT(DISTINCT vl.language_code) as language_count
            FROM videos v
            LEFT JOIN video_languages vl ON v.id = vl.video_id
            WHERE v.user_id = ?
            GROUP BY v.id
            ORDER BY v.created_at DESC`,
      args: [userId]
    });

    const videos = videosResult.rows.map((v: any) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      fileSize: v.file_size,
      languages: v.languages ? v.languages.split(',') : [],
      languageCount: v.language_count || 0,
      createdAt: v.created_at,
      r2Url: v.r2_url
    }));

    // Calculate quota percentages
    const storagePercentage = Math.round((user.storage_used_gb / user.quota_storage_gb) * 100);
    const transcriptionsPercentage = Math.round((user.transcriptions_this_month / user.quota_transcriptions) * 100);
    const dailyProcessingPercentage = Math.round((user.processing_today_gb / user.quota_daily_processing_gb) * 100);

    // Get language statistics
    const langResult = await db.execute({
      sql: `SELECT language_code, COUNT(*) as count 
            FROM video_languages 
            WHERE video_id IN (SELECT id FROM videos WHERE user_id = ?)
            GROUP BY language_code 
            ORDER BY count DESC
            LIMIT 5`,
      args: [userId]
    });

    const topLanguages = langResult.rows.map((row: any) => ({
      language: row.language_code,
      count: row.count
    }));

    res.json({
      success: true,
      data: {
        user: {
          email: user.email,
          fullName: user.full_name
        },
        videos: {
          total: videos.length,
          completed: videos.filter((v: any) => v.status === 'completed').length,
          processing: videos.filter((v: any) => v.status === 'processing').length,
          failed: videos.filter((v: any) => v.status === 'failed').length,
          list: videos
        },
        quota: {
          storage: {
            limit: user.quota_storage_gb,
            used: user.storage_used_gb,
            remaining: user.quota_storage_gb - user.storage_used_gb,
            percentage: storagePercentage
          },
          transcriptions: {
            limit: user.quota_transcriptions,
            used: user.transcriptions_this_month,
            remaining: user.quota_transcriptions - user.transcriptions_this_month,
            percentage: transcriptionsPercentage
          },
          dailyProcessing: {
            limit: user.quota_daily_processing_gb,
            used: user.processing_today_gb,
            remaining: user.quota_daily_processing_gb - user.processing_today_gb,
            percentage: dailyProcessingPercentage
          }
        },
        languages: {
          topLanguages,
          totalLanguages: topLanguages.reduce((sum: number, lang: any) => sum + lang.count, 0)
        }
      }
    });
  } catch (error) {
    console.error('[Dashboard Error]', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${uploadDir}`);
});

// Helper function to get MIME type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.vtt': 'text/vtt;charset=utf-8',
    '.json': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Main processing function
async function processVideo(videoId: string, userId: string) {
  try {
    const record = videosDb.get(videoId);
    if (!record) {
      throw new Error('Video record not found');
    }

    console.log(`[Process] Starting for ${videoId}: ${record.title}`);

    // Check transcription quota (if authenticated)
    if (userId !== 'anonymous') {
      const quotaCheck = await quotaService.canTranscribe(userId);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.reason || 'Transcription quota exceeded');
      }

      // Log transcription action
      await quotaService.logAction(userId, 'transcribe', 'video', videoId, {
        title: record.title,
        languages: record.languages.length
      });
    }

    // Call Worker to transcribe and translate
    const workerUrl = `${process.env.WORKER_URL || 'https://subtitle.myzhangyujie.com'}/api/transcribe-video`;
    
    const transcribeResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({
        videoId,
        filePath: record.filePath,
        languages: record.languages,
        title: record.title
      })
    });

    if (!transcribeResponse.ok) {
      throw new Error(`Worker returned status ${transcribeResponse.status}`);
    }

    const result = await transcribeResponse.json() as any;

    if (result.success) {
      record.transcript = result.data?.transcript || '';
      record.transcribed = true;
      record.subtitles = result.data?.subtitles || {};
      record.status = 'completed';
      
      // Consume transcription quota (if authenticated)
      if (userId !== 'anonymous') {
        await quotaService.consumeTranscriptionQuota(userId);
      }
      
      // Update D1 with completed status and R2 URL
      await db.execute({
        sql: 'UPDATE videos SET status = ?, r2_url = ? WHERE id = ?',
        args: ['completed', result.data?.r2Url || '', videoId]
      });
      
      console.log(`[Process] Completed for ${videoId}: ${Object.keys(record.subtitles).length} subtitles generated`);
    } else {
      throw new Error(result.error || 'Unknown error from worker');
    }

  } catch (error) {
    console.error(`[Process Error] ${videoId}:`, error);
    const record = videosDb.get(videoId);
    if (record) {
      record.status = 'failed';
      record.error = error instanceof Error ? error.message : String(error);
    }
  }
}
