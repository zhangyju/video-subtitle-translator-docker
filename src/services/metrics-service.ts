import { v4 as uuidv4 } from 'uuid';
import { Worker } from '../types';

/**
 * 性能监控服务
 * 用于记录和分析视频处理性能指标
 */
export class MetricsService {
  /**
   * 记录单个性能指标
   */
  static async recordMetric(
    videoId: string,
    metricType: 'upload' | 'transcription' | 'translation' | 'total',
    durationMs: number,
    fileSizeBytes?: number,
    status: 'success' | 'failure' = 'success',
    errorMessage?: string,
    env?: Worker
  ) {
    if (!env) return;

    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO performance_metrics (id, video_id, metric_type, duration_ms, file_size_bytes, status, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        videoId,
        metricType,
        durationMs,
        fileSizeBytes || null,
        status,
        errorMessage || null,
        now
      ).run();

      console.log(`[Metrics] Recorded ${metricType}: ${durationMs}ms`);
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  /**
   * 保存上传历史
   */
  static async recordUploadHistory(
    videoId: string,
    fileName: string,
    fileSizeBytes: number,
    fileType: 'video' | 'audio',
    durationSeconds: number,
    targetLanguages: string[],
    uploadDurationMs: number,
    transcriptionDurationMs?: number,
    translationDurationMs?: number,
    totalDurationMs?: number,
    status: 'success' | 'failure' = 'success',
    errorMessage?: string,
    env?: Worker
  ) {
    if (!env) return;

    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const completedAt = status === 'success' ? now : null;

      await env.DB.prepare(
        `INSERT INTO upload_history (
          id, video_id, file_name, file_size_bytes, file_type, duration_seconds,
          target_languages, upload_duration_ms, transcription_duration_ms,
          translation_duration_ms, total_duration_ms, status, error_message,
          created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        videoId,
        fileName,
        fileSizeBytes,
        fileType,
        durationSeconds,
        JSON.stringify(targetLanguages),
        uploadDurationMs,
        transcriptionDurationMs || null,
        translationDurationMs || null,
        totalDurationMs || uploadDurationMs,
        status,
        errorMessage || null,
        now,
        completedAt
      ).run();

      console.log(`[Metrics] Saved upload history for ${videoId}`);
    } catch (error) {
      console.error('Failed to record upload history:', error);
    }
  }

  /**
   * 获取上传历史（按时间倒序）
   */
  static async getUploadHistory(
    limit: number = 50,
    offset: number = 0,
    env?: Worker
  ): Promise<any[]> {
    if (!env) return [];

    try {
      const result = await env.DB.prepare(
        `SELECT * FROM upload_history
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(limit, offset).all();

      return (result.results || []).map((row: any) => ({
        ...row,
        target_languages: JSON.parse(row.target_languages || '[]')
      }));
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
      return [];
    }
  }

  /**
   * 获取用户的上传统计
   */
  static async getUploadStats(env?: Worker): Promise<{
    totalUploads: number;
    successfulUploads: number;
    failedUploads: number;
    avgUploadDuration: number;
    avgTranscriptionDuration: number;
    avgTranslationDuration: number;
    totalDataProcessed: number;
  }> {
    if (!env) return {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      avgUploadDuration: 0,
      avgTranscriptionDuration: 0,
      avgTranslationDuration: 0,
      totalDataProcessed: 0
    };

    try {
      const result = await env.DB.prepare(
        `SELECT
          COUNT(*) as total_uploads,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_uploads,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed_uploads,
          AVG(upload_duration_ms) as avg_upload_duration,
          AVG(transcription_duration_ms) as avg_transcription_duration,
          AVG(translation_duration_ms) as avg_translation_duration,
          SUM(file_size_bytes) as total_data_processed
         FROM upload_history`
      ).first();

      return {
        totalUploads: result?.total_uploads || 0,
        successfulUploads: result?.successful_uploads || 0,
        failedUploads: result?.failed_uploads || 0,
        avgUploadDuration: Math.round(result?.avg_upload_duration || 0),
        avgTranscriptionDuration: Math.round(result?.avg_transcription_duration || 0),
        avgTranslationDuration: Math.round(result?.avg_translation_duration || 0),
        totalDataProcessed: result?.total_data_processed || 0
      };
    } catch (error) {
      console.error('Failed to fetch upload stats:', error);
      return {
        totalUploads: 0,
        successfulUploads: 0,
        failedUploads: 0,
        avgUploadDuration: 0,
        avgTranscriptionDuration: 0,
        avgTranslationDuration: 0,
        totalDataProcessed: 0
      };
    }
  }

  /**
   * 获取性能指标（按时间倒序）
   */
  static async getPerformanceMetrics(
    limit: number = 100,
    env?: Worker
  ): Promise<any[]> {
    if (!env) return [];

    try {
      const result = await env.DB.prepare(
        `SELECT * FROM performance_metrics
         ORDER BY created_at DESC
         LIMIT ?`
      ).bind(limit).all();

      return result.results || [];
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      return [];
    }
  }

  /**
   * 更新每日性能统计
   */
  static async updateDailyAnalytics(env?: Worker) {
    if (!env) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // 获取今天的统计数据
      const stats = await env.DB.prepare(
        `SELECT
          COUNT(*) as total_uploads,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_uploads,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed_uploads,
          AVG(upload_duration_ms) as avg_upload_duration,
          AVG(transcription_duration_ms) as avg_transcription_duration,
          AVG(translation_duration_ms) as avg_translation_duration,
          AVG(file_size_bytes) as avg_file_size,
          SUM(file_size_bytes) as total_files_processed
         FROM upload_history
         WHERE DATE(created_at) = ?`
      ).bind(today).first();

      const id = uuidv4();
      const now = new Date().toISOString();

      // 插入或更新每日记录
      await env.DB.prepare(
        `INSERT INTO performance_analytics (
          id, date_str, total_uploads, successful_uploads, failed_uploads,
          avg_upload_duration_ms, avg_transcription_duration_ms,
          avg_translation_duration_ms, avg_file_size_bytes, total_files_processed_bytes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date_str) DO UPDATE SET
          total_uploads = excluded.total_uploads,
          successful_uploads = excluded.successful_uploads,
          failed_uploads = excluded.failed_uploads,
          avg_upload_duration_ms = excluded.avg_upload_duration_ms,
          avg_transcription_duration_ms = excluded.avg_transcription_duration_ms,
          avg_translation_duration_ms = excluded.avg_translation_duration_ms,
          avg_file_size_bytes = excluded.avg_file_size_bytes,
          total_files_processed_bytes = excluded.total_files_processed_bytes,
          updated_at = excluded.updated_at`
      ).bind(
        id,
        today,
        stats?.total_uploads || 0,
        stats?.successful_uploads || 0,
        stats?.failed_uploads || 0,
        Math.round(stats?.avg_upload_duration || 0),
        Math.round(stats?.avg_transcription_duration || 0),
        Math.round(stats?.avg_translation_duration || 0),
        Math.round(stats?.avg_file_size || 0),
        stats?.total_files_processed || 0,
        now,
        now
      ).run();

      console.log(`[Metrics] Updated daily analytics for ${today}`);
    } catch (error) {
      console.error('Failed to update daily analytics:', error);
    }
  }

  /**
   * 获取每日分析数据
   */
  static async getDailyAnalytics(
    days: number = 7,
    env?: Worker
  ): Promise<any[]> {
    if (!env) return [];

    try {
      const result = await env.DB.prepare(
        `SELECT * FROM performance_analytics
         ORDER BY date_str DESC
         LIMIT ?`
      ).bind(days).all();

      return result.results || [];
    } catch (error) {
      console.error('Failed to fetch daily analytics:', error);
      return [];
    }
  }
}
