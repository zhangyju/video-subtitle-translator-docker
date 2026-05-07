import { Worker } from '../types';
import { aiService } from '../services/ai-service';
import { v4 as uuidv4 } from 'uuid';

export const translateHandler = {
  async request(request: Request, env: Worker, videoId: string): Promise<Response> {
    try {
      const body = await request.json() as any;
      const { targetLanguages } = body;

      if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'targetLanguages array required',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get original transcription
      const transcriptionResult = await env.DB.prepare(
        'SELECT id, subtitle_path FROM transcriptions WHERE video_id = ? LIMIT 1'
      ).bind(videoId).first() as any;

      if (!transcriptionResult) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No transcription found for this video',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const transcriptionId = transcriptionResult.id;
      const subtitlePath = transcriptionResult.subtitle_path;

      // Get original subtitle content from R2
      const subtitleObject = await env.R2_BUCKET.get(subtitlePath);
      if (!subtitleObject) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Original subtitle file not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const originalVTT = await subtitleObject.text();

      // Trigger translation asynchronously for each target language
      for (const targetLang of targetLanguages) {
        translateAndSaveSubtitles(videoId, transcriptionId, originalVTT, targetLang, env)
          .catch(e => console.error(`Translation to ${targetLang} failed:`, e));
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Translation request queued',
          data: {
            videoId,
            targetLanguages,
            transcriptionId,
          },
        }),
        {
          status: 202, // Accepted
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Translation error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to request translation',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Translate and save subtitles to R2 and database
 */
async function translateAndSaveSubtitles(
  videoId: string,
  transcriptionId: string,
  vttContent: string,
  targetLanguage: string,
  env: Worker
): Promise<void> {
  try {
    console.log(`Starting translation to ${targetLanguage} for video ${videoId}`);

    // Translate VTT content
    const translatedVTT = await aiService.translateVTT(vttContent, targetLanguage, env);

    // Save translated subtitles to R2
    const translatedPath = `videos/${videoId}/subtitles_${targetLanguage}.vtt`;
    await env.R2_BUCKET.put(translatedPath, translatedVTT, {
      httpMetadata: {
        contentType: 'text/vtt',
      },
    });

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

    console.log(`Translation to ${targetLanguage} completed for video ${videoId}`);
  } catch (error) {
    console.error(`Translation to ${targetLanguage} failed for video ${videoId}:`, error);
  }
}
