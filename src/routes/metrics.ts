import { MetricsService } from '../services/metrics-service';
import { Worker } from '../types';

/**
 * 性能监控 API 路由
 */
export const metricsHandler = {
  /**
   * GET /api/metrics/history - 获取上传历史
   */
  async history(request: Request, env: Worker): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const history = await MetricsService.getUploadHistory(limit, offset, env);

      return new Response(
        JSON.stringify({
          success: true,
          data: history,
          pagination: {
            limit,
            offset,
            hasMore: history.length === limit
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch history'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },

  /**
   * GET /api/metrics/stats - 获取上传统计
   */
  async stats(_request: Request, env: Worker): Promise<Response> {
    try {
      const stats = await MetricsService.getUploadStats(env);

      return new Response(
        JSON.stringify({
          success: true,
          data: stats
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Failed to fetch upload stats:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch stats'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },

  /**
   * GET /api/metrics/performance - 获取性能指标
   */
  async performance(request: Request, env: Worker): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

      const metrics = await MetricsService.getPerformanceMetrics(limit, env);

      return new Response(
        JSON.stringify({
          success: true,
          data: metrics
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch metrics'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },

  /**
   * GET /api/metrics/analytics - 获取每日分析
   */
  async analytics(request: Request, env: Worker): Promise<Response> {
    try {
      const url = new URL(request.url);
      const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 90);

      const analytics = await MetricsService.getDailyAnalytics(days, env);

      return new Response(
        JSON.stringify({
          success: true,
          data: analytics
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch analytics'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
};

export default metricsHandler;
