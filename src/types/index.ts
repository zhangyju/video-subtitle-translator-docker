export interface Video {
  id: string;
  title: string;
  originalFileName: string;
  r2Path: string;
  fileType: 'video' | 'audio';
  duration?: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transcription {
  id: string;
  videoId: string;
  language: string;
  subtitlePath: string;
  wordCount: number;
  createdAt: string;
}

export interface Translation {
  id: string;
  transcriptionId: string;
  targetLanguage: string;
  subtitlePath: string;
  createdAt: string;
}

export interface Subtitle {
  language: string;
  type: 'original' | 'translation';
  url: string;
  vttContent?: string;
}

export interface Worker {
  DB: any; // D1Database
  R2_BUCKET: any; // R2Bucket
  AI: any;
  ENVIRONMENT: string;
  waitUntil(promise: Promise<any>): void;
}

export interface TranscriptionRequest {
  videoId: string;
  sourceLanguage?: string;
}

export interface TranslationRequest {
  transcriptionId: string;
  targetLanguages: string[];
}

// WebSocket 消息类型
export type ProgressStage = 'uploading' | 'transcription' | 'translation' | 'completed' | 'failed';

export interface ProgressMessage {
  type: 'progress' | 'error' | 'complete';
  videoId: string;
  stage: ProgressStage;
  progress?: number; // 0-100
  message: string;
  timestamp: number;
  language?: string; // 用于翻译进度
  errorCode?: string;
}

export interface WebSocketConnection {
  videoId: string;
  webSocket: WebSocket;
  createdAt: number;
}
