import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Upload handling
const uploadDir = process.env.UPLOAD_DIR || '/tmp/uploads';
const subtitlesDir = path.join(uploadDir, 'subtitles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(subtitlesDir)) {
  fs.mkdirSync(subtitlesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  }
});

// In-memory database (will be replaced with D1)
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
  subtitles: Record<string, string>; // language -> vtt content
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

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Video Subtitle Translator API',
    endpoints: {
      health: '/api/health',
      upload: 'POST /api/upload',
      videos: 'GET /api/videos',
      progress: 'GET /api/progress/:videoId',
      subtitles: 'GET /api/subtitles/:videoId/:language'
    }
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/upload', upload.single('file'), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const videoId = uuidv4();
    const title = req.body.title || req.file.originalname;
    const languages = req.body.languages ? JSON.parse(req.body.languages) : ['zh'];

    console.log(`[Upload] Video: ${videoId}, File: ${req.file.filename}, Size: ${req.file.size} bytes`);

    // Create video record
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

    // Return success
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

    // Process async (transcription will be done via Worker)
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

app.get('/api/videos', async (_req: Request, res: Response) => {
  try {
    const videos = Array.from(videosDb.values()).map(v => ({
      id: v.id,
      title: v.title,
      status: v.status,
      createdAt: v.createdAt,
      transcribed: v.transcribed,
      subtitles: v.subtitles
    }));

    res.json({
      success: true,
      data: { videos }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch videos' });
  }
});

app.get('/api/progress/:videoId', async (req: Request, res: Response) => {
  try {
    const videoId = req.params.videoId;
    const record = videosDb.get(videoId);

    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: videoId,
        status: record.status,
        transcribed: record.transcribed,
        translationsCount: Object.keys(record.subtitles).length,
        languages: record.languages,
        createdAt: record.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// Subtitle download endpoint
app.get('/api/subtitles/:videoId/:language', async (req: Request, res: Response) => {
  try {
    const { videoId, language } = req.params;
    const record = videosDb.get(videoId);

    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    const vttContent = record.subtitles[language];
    if (!vttContent) {
      res.status(404).json({ success: false, error: 'Subtitle not found' });
      return;
    }

    const langName = languageCodeMap[language] || language;
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${record.title}-${langName}.vtt"`);
    res.send(vttContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch subtitle' });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
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

// Generate VTT subtitle format
function generateVTT(_transcript: string, translatedText: string): string {
  // Simple VTT generation - split text into chunks with timestamps
  const lines = translatedText.split(/[\n.!?]+/).filter(l => l.trim());
  
  let vtt = 'WEBVTT\n\n';
  let currentTime = 0;
  const wordsPerSecond = 2.5; // Average reading speed

  lines.forEach((line) => {
    const words = line.trim().split(/\s+/).length;
    const duration = words / wordsPerSecond;
    
    const startTime = formatTime(currentTime);
    const endTime = formatTime(currentTime + duration);
    
    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${line.trim()}\n\n`;
    
    currentTime += duration;
  });

  return vtt;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Get file endpoint (for Worker to fetch and transcribe)
app.get('/api/get-file/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const record = videosDb.get(videoId);

    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    // Send file as binary
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(record.filePath);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch file' });
  }
});

// Receive transcription from Worker
app.post('/api/store-transcript/:videoId', express.json(), async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { text, language } = req.body;

    const record = videosDb.get(videoId);
    if (!record) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    record.transcript = text;
    record.transcribed = true;

    // Generate VTT subtitles for original language
    record.subtitles[language || 'en'] = generateVTT(text, text);

    // Generate subtitles for other requested languages (placeholder for now)
    for (const lang of record.languages) {
      if (lang !== (language || 'en') && !record.subtitles[lang]) {
        record.subtitles[lang] = generateVTT(text, text); // Same text as placeholder
      }
    }

    record.status = 'completed';
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to store transcript' });
  }
});

// Main processing function
async function processVideo(videoId: string) {
  try {
    const record = videosDb.get(videoId);
    if (!record) {
      throw new Error('Video record not found');
    }

    console.log(`[Process] Starting processing for ${videoId}`);

    // Trigger Worker to transcribe (async)
    // The Worker will call back to /api/store-transcript when done
    const workerUrl = `${process.env.WORKER_URL || 'https://subtitle.myzhangyujie.com'}/api/transcribe-video/${videoId}`;
    
    try {
      const transcribeResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, filePath: record.filePath })
      });

      if (transcribeResponse.ok) {
        const result = await transcribeResponse.json() as any;
        const text = result.data?.text || '';
        
        // Store transcript
        record.transcript = text;
        record.transcribed = true;
        record.subtitles['en'] = generateVTT(text, text);
        
        for (const lang of record.languages) {
          if (lang !== 'en') {
            record.subtitles[lang] = generateVTT(text, text);
          }
        }
        
        record.status = 'completed';
      }
    } catch (err) {
      console.error(`[Transcription Error] ${videoId}:`, err);
      // Continue with placeholder if transcription fails
      const placeholderText = "Transcription service is processing this video...";
      record.transcript = placeholderText;
      record.transcribed = true;
      record.subtitles['en'] = generateVTT(placeholderText, placeholderText);
      record.status = 'completed';
    }

    console.log(`[Process] Completed for ${videoId}`);

  } catch (error) {
    console.error(`[Process Error] ${videoId}:`, error);
    const record = videosDb.get(videoId);
    if (record) {
      record.status = 'failed';
      record.error = error instanceof Error ? error.message : String(error);
    }
  }
}
