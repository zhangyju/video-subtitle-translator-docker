import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

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
    const title = req.body.title || req.file.originalname;
    const languages = req.body.languages ? JSON.parse(req.body.languages) : ['en'];

    const videoRecord: VideoRecord = {
      id: videoId,
      title,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: req.file.path,
      status: 'processing',
      createdAt: new Date().toISOString(),
      transcribed: false,
      subtitles: {},
      languages
    };

    videosDb.set(videoId, videoRecord);

    console.log(`[Upload] Video: ${videoId}, Title: ${title}, File: ${req.file.filename}`);

    res.status(201).json({
      success: true,
      data: {
        id: videoId,
        title,
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        status: 'processing',
        createdAt: new Date().toISOString(),
        languages
      }
    });

    // Start async processing
    processVideo(videoId).catch(err => {
      console.error(`[Error] Processing video ${videoId}:`, err);
      const record = videosDb.get(videoId);
      if (record) {
        record.status = 'failed';
        record.error = err instanceof Error ? err.message : String(err);
      }
    });

  } catch (error) {
    console.error('[Upload Error]', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Get all videos
app.get('/api/videos', async (_req: Request, res: Response) => {
  try {
    const videos = Array.from(videosDb.values()).map(v => ({
      id: v.id,
      title: v.title,
      status: v.status,
      createdAt: v.createdAt,
      originalFileName: v.originalFileName,
      fileSize: v.fileSize,
      transcribed: v.transcribed,
      subtitles: Object.keys(v.subtitles), // Return language codes
      languages: v.languages
    }));

    res.json({ success: true, data: { videos } });
  } catch (error) {
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
async function processVideo(videoId: string) {
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
      headers: { 'Content-Type': 'application/json' },
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
