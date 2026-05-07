import { Worker } from '../types';

export const subtitleHandler = {
  async get(request: Request, env: Worker, videoId: string): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const language = searchParams.get('language');
      const type = searchParams.get('type') || 'original'; // 'original' or 'translation'

      if (!language) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Language parameter required',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let subtitlePath: string | null = null;

      if (type === 'original') {
        // Get original transcription
        const result = await env.DB.prepare(
          'SELECT subtitle_path FROM transcriptions WHERE video_id = ? AND language = ?'
        ).bind(videoId, language).first() as any;

        subtitlePath = result?.subtitle_path;
      } else if (type === 'translation') {
        // Get translation
        const result = await env.DB.prepare(
          `SELECT t.subtitle_path
           FROM translations t
           JOIN transcriptions tr ON t.transcription_id = tr.id
           WHERE tr.video_id = ? AND t.target_language = ?`
        ).bind(videoId, language).first() as any;

        subtitlePath = result?.subtitle_path;
      }

      if (!subtitlePath) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Subtitle not found for language: ${language}`,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get subtitle content from R2
      const object = await env.R2_BUCKET.get(subtitlePath);

      if (!object) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Subtitle file not found in storage',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const vttContent = await object.text();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            language,
            type,
            url: subtitlePath,
            vttContent,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Subtitle error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get subtitle',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
