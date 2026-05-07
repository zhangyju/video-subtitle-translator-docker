import { v4 as uuidv4 } from 'uuid';
import { Video, Worker } from '../types';
import { aiService } from '../services/ai-service';
import { ProgressService } from '../services/progress-service';
import { MetricsService } from '../services/metrics-service';

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export async function uploadHandler(
  request: Request,
  env: Worker,
  _ctx?: any
): Promise<Response> {
  const uploadStartTime = Date.now();

  try {
    console.log('[Upload] Parsing FormData...');
    
    // Clone the request to safely parse it
    const clonedRequest = request.clone();
    let formData: any;
    
    try {
      // Use formData with a reasonable timeout assumption
      formData = await clonedRequest.formData();
      console.log('[Upload] FormData received successfully');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[Upload] FormData parse error:', errorMsg);
      
      // If it's a memory error, suggest using a smaller file
      if (errorMsg.includes('Memory') || errorMsg.includes('memory')) {
        throw new Error(`File too large for direct upload. Please use a file smaller than 100MB.`);
      }
      throw new Error(`Failed to parse upload: ${errorMsg}`);
    }
    
    const file = formData.get('file') as File;
    console.log('[Upload] File info:', { name: file?.name, size: file?.size, type: file?.type });
    
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const title = (formData.get('title') as string) || file.name;
    const targetLanguagesStr = formData.get('languages') as string;
    console.log('[Upload] Target languages:', targetLanguagesStr);
    let targetLanguages: string[] = [];
    
    if (targetLanguagesStr) {
      try {
        targetLanguages = JSON.parse(targetLanguagesStr);
      } catch (e) {
        console.warn('Failed to parse languages:', e);
      }
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid file type: ${file.type}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File size exceeds 500MB limit`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const videoId = uuidv4();
    const fileExt = file.name.split('.').pop() || 'mp4';
    const r2Path = `videos/${videoId}/original.${fileExt}`;

    // Determine file type
    const fileType = file.type.startsWith('video') ? 'video' : 'audio';

    // Convert file to ArrayBuffer for R2 upload
    const fileBuffer = await file.arrayBuffer();

    // Upload to R2
    await env.R2_BUCKET.put(r2Path, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Create video record in database
    const video: Video = {
      id: videoId,
      title,
      originalFileName: file.name,
      r2Path,
      fileType,
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert into database
    await env.DB.prepare(
      `INSERT INTO videos (id, title, original_file_name, r2_path, file_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      video.id,
      video.title,
      video.originalFileName,
      video.r2Path,
      video.fileType,
      video.status,
      video.createdAt,
      video.updatedAt
    ).run();

     const uploadDurationMs = Date.now() - uploadStartTime;
     
      // Record upload metrics (async, non-blocking)
      MetricsService.recordMetric(
        videoId,
        'upload',
        uploadDurationMs,
        file.size,
        'success',
        undefined,
        env
      ).catch(e => console.error('Failed to record metrics:', e));

      // Send initial progress message
      ProgressService.sendProgress(videoId, 'uploading', 100, '文件上传完成，准备转录');

      // Trigger transcription asynchronously (in background)
      // For best performance, transcribe in background
      transcribeAndSaveSubtitles(videoId, file, env, targetLanguages, uploadDurationMs).catch(e => console.error('Transcription failed:', e));

     return new Response(
       JSON.stringify({
         success: true,
         data: {
           ...video,
           wsUrl: `/api/progress/${videoId}`, // WebSocket URL for client
         },
       }),
       {
         status: 201,
         headers: { 'Content-Type': 'application/json' },
       }
     );
   } catch (error) {
     console.error('Upload error:', error);
     const errorMsg = error instanceof Error ? error.message : String(error);
     console.error('Error details:', errorMsg);
     return new Response(
       JSON.stringify({
         success: false,
         error: `Upload failed: ${errorMsg}`,
       }),
       { status: 500, headers: { 'Content-Type': 'application/json' } }
     );
   }
}

/**
 * Transcribe audio and save subtitles, then trigger translations
 */
async function transcribeAndSaveSubtitles(
  videoId: string,
  file: File,
  env: Worker,
  targetLanguages: string[] = [],
  uploadDurationMs: number = 0
): Promise<void> {
  const transcriptionStartTime = Date.now();

  try {
    console.log(`Starting transcription for video ${videoId}`);
    ProgressService.sendProgress(videoId, 'transcription', 5, '正在转录音频...');

    // Convert file to ArrayBuffer
    const audioBuffer = await file.arrayBuffer();

    // Transcribe using Whisper (with progress tracking)
    const { text, timestamps } = await aiService.transcribeAudio(audioBuffer, env, 'en', videoId);
    
    // Generate VTT subtitles
    ProgressService.sendProgress(videoId, 'transcription', 90, '生成字幕文件...');
    const vttContent = aiService.generateVTT(text, timestamps);

    // Save subtitles to R2
    const vttPath = `videos/${videoId}/subtitles_en.vtt`;
    await env.R2_BUCKET.put(vttPath, vttContent, {
      httpMetadata: {
        contentType: 'text/vtt',
      },
    });

    // Create transcription record in database
    const transcriptionId = uuidv4();
    await env.DB.prepare(
      `INSERT INTO transcriptions (id, video_id, language, subtitle_path, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      transcriptionId,
      videoId,
      'en',
      vttPath,
      new Date().toISOString()
    ).run();

    const transcriptionDurationMs = Date.now() - transcriptionStartTime;

    // Record transcription metrics
    await MetricsService.recordMetric(
      videoId,
      'transcription',
      transcriptionDurationMs,
      undefined,
      'success',
      undefined,
      env
    );

    ProgressService.sendProgress(videoId, 'transcription', 100, '转录完成');

    // Trigger translations for each target language
    if (targetLanguages && targetLanguages.length > 0) {
      ProgressService.sendProgress(
        videoId,
        'translation',
        5,
        `准备翻译为 ${targetLanguages.join(', ')}...`
      );

      for (const targetLang of targetLanguages) {
        translateAndSaveSubtitles(videoId, transcriptionId, vttContent, targetLang, env, uploadDurationMs, transcriptionDurationMs)
          .catch(e => console.error(`Translation to ${targetLang} failed:`, e));
      }
    } else {
      // No translations needed - record upload history
      await MetricsService.recordUploadHistory(
        videoId,
        file.name,
        file.size,
        (file.type.startsWith('video') ? 'video' : 'audio') as 'video' | 'audio',
        0,
        targetLanguages,
        uploadDurationMs,
        transcriptionDurationMs,
        undefined,
        uploadDurationMs + transcriptionDurationMs,
        'success',
        undefined,
        env
      );

      ProgressService.sendComplete(videoId, '处理完成（仅转录）');
    }

    // Update video status to completed
    await env.DB.prepare(
      `UPDATE videos SET status = 'completed', updated_at = ? WHERE id = ?`
    ).bind(
      new Date().toISOString(),
      videoId
    ).run();

    console.log(`Transcription completed for video ${videoId}`);
  } catch (error) {
    console.error(`Transcription failed for video ${videoId}:`, error);
    ProgressService.sendError(
      videoId,
      `转录失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'TRANSCRIPTION_FAILED'
    );
    
    // Update video status to failed
    try {
      await env.DB.prepare(
        `UPDATE videos SET status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(
        new Date().toISOString(),
        videoId
      ).run();
    } catch (updateError) {
      console.error('Failed to update video status:', updateError);
    }
  }
}

/**
 * Translate and save subtitles to R2 and database
 */
async function translateAndSaveSubtitles(
  videoId: string,
  transcriptionId: string,
  vttContent: string,
  targetLanguage: string,
  env: Worker,
  _uploadDurationMs: number = 0,
  _transcriptionDurationMs: number = 0
): Promise<void> {
  const translationStartTime = Date.now();

  try {
    console.log(`Starting translation to ${targetLanguage} for video ${videoId}`);
    ProgressService.sendProgress(
      videoId,
      'translation',
      10,
      `正在翻译为 ${targetLanguage}...`,
      targetLanguage
    );

    // Translate VTT content (with progress tracking)
    const translatedVTT = await aiService.translateVTT(vttContent, targetLanguage, env, videoId);

    // Save translated subtitles to R2
    ProgressService.sendProgress(
      videoId,
      'translation',
      95,
      `保存 ${targetLanguage} 字幕...`,
      targetLanguage
    );

    const translatedPath = `videos/${videoId}/subtitles_${targetLanguage}.vtt`;
    await env.R2_BUCKET.put(translatedPath, translatedVTT, {
      httpMetadata: {
        contentType: 'text/vtt',
      },
    });

    const translationDurationMs = Date.now() - translationStartTime;

    // Record translation metrics
    await MetricsService.recordMetric(
      videoId,
      'translation',
      translationDurationMs,
      undefined,
      'success',
      undefined,
      env
    );

    // Create translation record in database
    const translationId = uuidv4();
    await env.DB.prepare(
      `INSERT INTO translations (id, transcription_id, target_language, subtitle_path, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      translationId,
      transcriptionId,
      targetLanguage,
      translatedPath,
      new Date().toISOString()
    ).run();

    ProgressService.sendProgress(
      videoId,
      'translation',
      100,
      `${targetLanguage} 翻译完成`,
      targetLanguage
    );

    console.log(`Translation to ${targetLanguage} completed for video ${videoId}`);
  } catch (error) {
    console.error(`Translation to ${targetLanguage} failed for video ${videoId}:`, error);
    ProgressService.sendError(
      videoId,
      `翻译为 ${targetLanguage} 失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'TRANSLATION_FAILED'
    );
  }
}
