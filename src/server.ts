import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Upload handling
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

// In-memory database
interface VideoRecord {
  id: string;
  title: string;
  originalFileName: string;
  fileSize: number;
  filePath: string;
  status: string;
  createdAt: string;
  transcribed: boolean;
  transcript?: string;
  subtitles: Record<string, string>;
  languages: string[];
}

const videosDb = new Map<string, VideoRecord>();

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Video Subtitle Translator API' });
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

    // Simulate async processing
    setTimeout(() => {
      const record = videosDb.get(videoId);
      if (record) {
        record.transcribed = true;
        record.transcript = 'Sample transcript';
        record.subtitles['en'] = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nSample subtitle';
        record.status = 'completed';
      }
    }, 2000);

  } catch (error) {
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
        translationsCount: Object.keys(record.subtitles).length,
        languages: record.languages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

app.get('/api/subtitles/:videoId/:language', async (req: Request, res: Response) => {
  try {
    const record = videosDb.get(req.params.videoId);

    if (!record || !record.subtitles[req.params.language]) {
      res.status(404).json({ success: false, error: 'Subtitle not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(record.subtitles[req.params.language]);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch subtitle' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
