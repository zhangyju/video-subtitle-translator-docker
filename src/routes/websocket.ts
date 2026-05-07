import { ProgressService } from '../services/progress-service';

// Cloudflare Workers WebSocket types
declare const WebSocketPair: any;
declare global {
  interface WebSocket {
    accept?(): void;
  }
}

/**
 * WebSocket 路由 - 处理实时进度更新连接
 * 端点: GET /api/progress/:videoId
 * 升级为 WebSocket 连接
 */
export async function handleWebSocket(
  request: Request,
  videoId: string
): Promise<Response> {
  // 检查是否是 WebSocket 升级请求
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 400 });
  }

  // 创建 WebSocket 对
  const webSocketPair = new WebSocketPair();
  const [client, server] = [webSocketPair[0], webSocketPair[1]];

  // 服务器端处理
  server.accept();

  // 添加连接
  ProgressService.addConnection(videoId, server);

  // 处理消息
  server.addEventListener('message', (event: Event) => {
    const messageEvent = event as any;
    const message = messageEvent.data;
    console.log(`[WebSocket] Received from ${videoId}: ${message}`);

    // 可以在这里处理客户端发来的消息
    // 比如心跳检测、进度查询等
    if (message === 'ping') {
      server.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now(),
      }));
    }
  });

  // 处理连接关闭
  server.addEventListener('close', () => {
    console.log(`[WebSocket] Closed for ${videoId}`);
    ProgressService.removeConnection(videoId, server);
  });

  // 处理错误
  server.addEventListener('error', (event: Event) => {
    console.error(`[WebSocket] Error for ${videoId}:`, event);
    ProgressService.removeConnection(videoId, server);
  });

  // 发送初始连接成功消息
  server.send(JSON.stringify({
    type: 'connected',
    videoId,
    message: '已连接到实时进度更新',
    timestamp: Date.now(),
  }));

  // 返回 WebSocket 响应
  return new Response(null, {
    status: 101,
    webSocket: client,
  } as any);
}

export default handleWebSocket;
