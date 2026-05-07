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
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  }
});

// Environment will be passed at runtime

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) {
      res.status(404).json({ success: false, error: 'Index page not found' });
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
    const languages = req.body.languages ? JSON.parse(req.body.languages) : [];

    console.log(`[Upload] Video: ${videoId}, File: ${req.file.filename}, Size: ${req.file.size} bytes`);

    // Return success
    res.status(201).json({
      success: true,
      data: {
        id: videoId,
        title,
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        uploadPath: req.file.path,
        status: 'processing',
        createdAt: new Date().toISOString(),
        languages
      }
    });

    // Process async (transcription, translation, etc.)
    processVideo(videoId, title, req.file.path, languages).catch(err => {
      console.error(`[Error] Processing video ${videoId}:`, err);
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
    // TODO: Fetch from database
    res.json({
      success: true,
      data: { videos: [] }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch videos' });
  }
});

app.get('/api/progress/:videoId', async (_req: Request, res: Response) => {
  try {
    // TODO: Fetch progress from database
    res.json({
      success: true,
      data: {
        status: 'processing',
        transcribed: false,
        translationsCount: 0,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
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

async function processVideo(videoId: string, _title: string, _filePath: string, _languages: string[]) {
  try {
    console.log(`[Process] Starting processing for ${videoId}`);
    
    // TODO: Implement transcription and translation
    // 1. Run Whisper transcription
    // 2. Extract text
    // 3. Run M2M-100 translation
    // 4. Generate VTT subtitles
    // 5. Save to storage
    // 6. Update database
    
    console.log(`[Process] Completed for ${videoId}`);
  } catch (error) {
    console.error(`[Process Error] ${videoId}:`, error);
  }
}
