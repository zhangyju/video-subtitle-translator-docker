import { v4 as uuidv4 } from 'uuid';
import { Worker, Transcription } from '../types';
import { aiService } from '../services/ai-service';

/**
 * Process video: extract audio, transcribe, and generate subtitles
 */
export async function processVideo(
  videoId: string,
  env: Worker
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get video record
    const videoResult = await env.DB.prepare(
      'SELECT r2_path, file_type FROM videos WHERE id = ?'
    ).bind(videoId).first() as any;

    if (!videoResult) {
      throw new Error('Video not found');
    }

    // Get file from R2
    const videoObject = await env.R2_BUCKET.get(videoResult.r2_path);

    if (!videoObject) {
      throw new Error('Video file not found in storage');
    }

    // Convert to ArrayBuffer
    const audioData = await videoObject.arrayBuffer();

    // Detect language (for now, default to English)
    const detectedLanguage = 'en';

    // Transcribe audio
    const transcriptionResult = await aiService.transcribeAudio(audioData, env, detectedLanguage);
    const { text: transcribedText, timestamps } = transcriptionResult;

    // Generate VTT subtitle
    const vttContent = aiService.generateVTT(transcribedText, timestamps);

    // Save subtitle to R2
    const subtitlePath = `subtitles/${videoId}/${detectedLanguage}.vtt`;
    await env.R2_BUCKET.put(subtitlePath, vttContent, {
      httpMetadata: {
        contentType: 'text/vtt; charset=utf-8',
      },
    });

    // Save transcription to database
    const transcriptionId = uuidv4();
    const wordCount = transcribedText.split(/\s+/).length;

    const transcription: Transcription = {
      id: transcriptionId,
      videoId,
      language: detectedLanguage,
      subtitlePath,
      wordCount,
      createdAt: new Date().toISOString(),
    };

    await env.DB.prepare(
      `INSERT INTO transcriptions (id, video_id, language, subtitle_path, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      transcription.id,
      transcription.videoId,
      transcription.language,
      transcription.subtitlePath,
      transcription.wordCount,
      transcription.createdAt
    ).run();

    // Update video status
    await env.DB.prepare(
      'UPDATE videos SET status = ?, updated_at = ? WHERE id = ?'
    ).bind('completed', new Date().toISOString(), videoId).run();

    return { success: true };
  } catch (error) {
    console.error('Process error:', error);

    // Update video status to failed
    await env.DB.prepare(
      'UPDATE videos SET status = ?, error_message = ?, updated_at = ? WHERE id = ?'
    ).bind(
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      new Date().toISOString(),
      videoId
    ).run();

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle translation for a transcription
 */
export async function translateTranscription(
  transcriptionId: string,
  targetLanguages: string[],
  env: Worker
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get transcription
    const transcriptionResult = await env.DB.prepare(
      'SELECT video_id, subtitle_path FROM transcriptions WHERE id = ?'
    ).bind(transcriptionId).first() as any;

    if (!transcriptionResult) {
      throw new Error('Transcription not found');
    }

    // Get original VTT content
    const vttObject = await env.R2_BUCKET.get(transcriptionResult.subtitle_path);

    if (!vttObject) {
      throw new Error('Subtitle file not found');
    }

    const originalVTT = await vttObject.text();

    // Translate to each target language
    for (const targetLang of targetLanguages) {
      try {
        const translatedVTT = await aiService.translateVTT(originalVTT, targetLang, env);

        // Save translated subtitle to R2
        const translatedPath = `subtitles/${transcriptionResult.video_id}/${targetLang}.vtt`;
        await env.R2_BUCKET.put(translatedPath, translatedVTT, {
          httpMetadata: {
            contentType: 'text/vtt; charset=utf-8',
          },
        });

        // Save translation record to database
        const translationId = uuidv4();
        await env.DB.prepare(
          `INSERT INTO translations (id, transcription_id, target_language, subtitle_path, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          translationId,
          transcriptionId,
          targetLang,
          translatedPath,
          new Date().toISOString()
        ).run();

        console.log(`✅ Translated to ${targetLang}`);
      } catch (error) {
        console.error(`Failed to translate to ${targetLang}:`, error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Translation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
