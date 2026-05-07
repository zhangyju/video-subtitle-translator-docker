import type { ProgressMessage, ProgressStage } from '../types/index';

/**
 * 进度追踪和 WebSocket 消息管理
 * 用于实时向客户端发送处理进度更新
 */
export class ProgressService {
  private static connections = new Map<string, Set<WebSocket>>();

  /**
   * 为视频添加 WebSocket 连接
   */
  static addConnection(videoId: string, ws: WebSocket) {
    if (!this.connections.has(videoId)) {
      this.connections.set(videoId, new Set());
    }
    this.connections.get(videoId)!.add(ws);
    console.log(`[Progress] Added connection for video ${videoId}`);
  }

  /**
   * 移除 WebSocket 连接
   */
  static removeConnection(videoId: string, ws: WebSocket) {
    const connections = this.connections.get(videoId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.connections.delete(videoId);
      }
    }
    console.log(`[Progress] Removed connection for video ${videoId}`);
  }

  /**
   * 发送进度消息给所有连接的客户端
   */
  static sendProgress(
    videoId: string,
    stage: ProgressStage,
    progress: number,
    message: string,
    language?: string
  ) {
    const progressMessage: ProgressMessage = {
      type: 'progress',
      videoId,
      stage,
      progress: Math.min(100, Math.max(0, progress)), // 确保 0-100
      message,
      timestamp: Date.now(),
      language,
    };

    this.broadcastMessage(videoId, progressMessage);
    console.log(`[Progress] ${stage}: ${progress}% - ${message}`);
  }

  /**
   * 发送完成消息
   */
  static sendComplete(videoId: string, message: string = '处理完成') {
    const progressMessage: ProgressMessage = {
      type: 'complete',
      videoId,
      stage: 'completed',
      progress: 100,
      message,
      timestamp: Date.now(),
    };

    this.broadcastMessage(videoId, progressMessage);
    console.log(`[Progress] Completed: ${message}`);
  }

  /**
   * 发送错误消息
   */
  static sendError(videoId: string, message: string, errorCode?: string) {
    const progressMessage: ProgressMessage = {
      type: 'error',
      videoId,
      stage: 'failed',
      message,
      timestamp: Date.now(),
      errorCode,
    };

    this.broadcastMessage(videoId, progressMessage);
    console.error(`[Progress] Error: ${message}`);
  }

  /**
   * 广播消息给所有连接
   */
  private static broadcastMessage(videoId: string, message: ProgressMessage) {
    const connections = this.connections.get(videoId);
    if (connections && connections.size > 0) {
      const messageStr = JSON.stringify(message);
      for (const ws of connections) {
        try {
          // WebSocket 状态检查
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(messageStr);
          }
        } catch (error) {
          console.error(`[Progress] Failed to send message: ${error}`);
          this.removeConnection(videoId, ws);
        }
      }
    }
  }

  /**
   * 获取连接数统计
   */
  static getStats() {
    let totalConnections = 0;
    const videoStats = new Map<string, number>();
    
    for (const [videoId, connections] of this.connections.entries()) {
      const count = connections.size;
      videoStats.set(videoId, count);
      totalConnections += count;
    }

    return {
      totalConnections,
      videoStats,
      activeVideos: this.connections.size,
    };
  }

  /**
   * 清理断开连接
   */
  static cleanup() {
    const before = this.connections.size;
    for (const [videoId, connections] of this.connections.entries()) {
      for (const ws of connections) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.removeConnection(videoId, ws);
        }
      }
    }
    console.log(`[Progress] Cleanup: removed dead connections. Before: ${before}, After: ${this.connections.size}`);
  }
}

/**
 * 模拟进度更新（用于测试）
 */
export function simulateProgress(
  videoId: string,
  stage: ProgressStage,
  duration: number = 10000
) {
  const steps = 20;
  const stepDuration = duration / steps;

  for (let i = 1; i <= steps; i++) {
    setTimeout(() => {
      const progress = (i / steps) * 100;
      ProgressService.sendProgress(
        videoId,
        stage,
        progress,
        `Processing... ${Math.round(progress)}%`
      );
    }, i * stepDuration);
  }
}
