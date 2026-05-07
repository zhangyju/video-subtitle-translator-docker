import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@libsql/client';

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
      const user = await db.execute({
        sql: 'SELECT storage_used_gb, quota_storage_gb FROM users WHERE id = ?',
        args: [userId]
      });
      
      if (user.rows.length === 0) {
        res.status(401).json({ success: false, error: 'User not found' });
        return;
      }

      const userRecord = user.rows[0] as any;
      const fileSizeGb = req.file.size / (1024 * 1024 * 1024);
      
      if (userRecord.storage_used_gb + fileSizeGb > userRecord.quota_storage_gb) {
        res.status(400).json({ success: false, error: 'Storage quota exceeded' });
        return;
      }
    }

    // Save to D1
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO videos (id, user_id, title, original_filename, file_size, status, created_at, languages)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [videoId, userId, title, req.file.originalname, req.file.size, 'processing', createdAt, JSON.stringify(languages)]
    });

    // Store locally for processing
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

    console.log(`[Upload] Video: ${videoId}, User: ${userId}, Title: ${title}, File: ${req.file.filename}`);

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
    const record = videosDb.get(req.params.videoId);

    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: record.id,
        status: record.status,
        transcribed: record.transcribed,
        subtitlesCount: Object.keys(record.subtitles).length,
        totalLanguages: record.languages.length,
        languages: record.languages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// Get video details for playback
app.get('/api/watch/:videoId', async (req: Request, res: Response) => {
  try {
    const record = videosDb.get(req.params.videoId);
    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
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
        availableSubtitles: Object.keys(record.subtitles),
        subtitle: subtitle || null,
        currentLanguage: lang
      }
    });
  } catch (error) {
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${uploadDir}`);
});

// Main processing function
async function processVideo(videoId: string, userId: string) {
  try {
    const record = videosDb.get(videoId);
    if (!record) {
      throw new Error('Video record not found');
    }

    console.log(`[Process] Starting for ${videoId}: ${record.title}`);

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
