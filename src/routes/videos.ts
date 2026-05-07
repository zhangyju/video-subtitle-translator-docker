import { Video, Worker } from '../types';

export const videosHandler = {
  async list(request: Request, env: Worker): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await env.DB.prepare(
        'SELECT COUNT(*) as total FROM videos'
      ).first() as any;

      // Get paginated videos
      const result = await env.DB.prepare(
        `SELECT id, title, original_file_name, r2_path, file_type, status, created_at, updated_at
         FROM videos
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(limit, offset).all();

      const videos = result.results?.map((row: any) => ({
        id: row.id,
        title: row.title,
        originalFileName: row.original_file_name,
        r2Path: row.r2_path,
        fileType: row.file_type,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) || [];

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            videos,
            pagination: {
              page,
              limit,
              total: countResult?.total || 0,
              totalPages: Math.ceil((countResult?.total || 0) / limit),
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('List error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list videos',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },

  async detail(_request: Request, env: Worker, videoId: string): Promise<Response> {
    try {

      const result = await env.DB.prepare(
        `SELECT id, title, original_file_name, r2_path, file_type, status, created_at, updated_at
         FROM videos WHERE id = ?`
      ).bind(videoId).first();

      if (!result) {
        return new Response(
          JSON.stringify({ success: false, error: 'Video not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const video: Video = {
        id: result.id,
        title: result.title,
        originalFileName: result.original_file_name,
        r2Path: result.r2_path,
        fileType: result.file_type,
        status: result.status,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };

      // Get transcriptions and translations
      const transcriptionsResult = await env.DB.prepare(
        'SELECT id, language, subtitle_path FROM transcriptions WHERE video_id = ?'
      ).bind(videoId).all();

      const transcriptions = transcriptionsResult.results || [];

      // Get translations for all transcriptions
      const translations: any[] = [];
      for (const transcription of transcriptions) {
        const translationsResult = await env.DB.prepare(
          'SELECT id, target_language, subtitle_path FROM translations WHERE transcription_id = ?'
        ).bind(transcription.id).all();
        translations.push(...(translationsResult.results || []));
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            video,
            transcriptions,
            translations,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Detail error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get video',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },

  async delete(_request: Request, env: Worker, videoId: string): Promise<Response> {
    try {

      // Delete from database
      await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(videoId).run();

      // TODO: Delete files from R2

      return new Response(
        JSON.stringify({ success: true, message: 'Video deleted' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Delete error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete video',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
