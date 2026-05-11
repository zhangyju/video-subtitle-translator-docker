# Phase 6: AI 转录 (Whisper + M2M-100)

## 🤖 概述

使用 Cloudflare AI 对上传的视频进行转录和多语言翻译。

## 🏗️ 转录流程

```
1. 视频上传
   ↓
2. 提取音频
   ↓
3. Whisper 转录 (英文识别)
   ↓
4. M2M-100 翻译 (多语言)
   ↓
5. 生成 VTT 字幕
   ↓
6. 存储到 D1 + R2
   ↓
7. 视频播放时加载字幕
```

## 🔧 实现步骤

### Step 1: 在 Worker 中启用 AI

```typescript
interface Env {
  AI: Ai;  // Cloudflare AI binding
  // ... 其他
}
```

### Step 2: 创建转录服务

```typescript
class TranscriptionService {
  constructor(private ai: Ai) {}

  /**
   * 使用 Whisper 转录音频
   */
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<{
    text: string;
    language: string;
    confidence: number;
  }> {
    try {
      const response = await this.ai.run('@cf/openai/whisper', {
        audio: [...new Uint8Array(audioBuffer)]
      }) as any;

      return {
        text: response.result?.text || '',
        language: response.result?.language || 'en',
        confidence: response.result?.confidence || 0.8
      };
    } catch (error) {
      console.error('[Whisper Error]', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * 使用 M2M-100 翻译
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<string> {
    try {
      // 语言代码映射
      const languageMap: Record<string, string> = {
        'zh': 'zho',      // 中文
        'en': 'eng',      // 英文
        'es': 'spa',      // 西班牙语
        'fr': 'fra',      // 法语
        'de': 'deu',      // 德语
        'ja': 'jpn',      // 日语
        'ko': 'kor',      // 韩语
        'pt': 'por'       // 葡萄牙语
      };

      const response = await this.ai.run('@cf/meta/m2m-100-12b-last-ckpt', {
        text,
        source_lang: languageMap[sourceLanguage] || 'eng',
        target_lang: languageMap[targetLanguage] || 'eng'
      }) as any;

      return response.result?.text || text;
    } catch (error) {
      console.error('[M2M-100 Error]', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * 生成 VTT 字幕
   */
  generateVTT(segments: Array<{
    start: number;
    end: number;
    text: string;
  }>): string {
    let vtt = 'WEBVTT\n\n';

    for (const segment of segments) {
      const startTime = this.formatTime(segment.start);
      const endTime = this.formatTime(segment.end);
      vtt += `${startTime} --> ${endTime}\n${segment.text}\n\n`;
    }

    return vtt;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }
}
```

### Step 3: 处理视频转录请求

```typescript
// 在 Worker 中处理转录请求
async function handleTranscribeVideo(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { videoId, languages = ['zh', 'en'] } = body;

    // 1. 从 Container 获取视频文件
    const videoResponse = await fetch(
      `http://localhost:3000/api/get-file/${videoId}`
    );
    
    if (!videoResponse.ok) {
      throw new Error('Failed to fetch video file');
    }

    const videoBuffer = await videoResponse.arrayBuffer();

    // 2. 转录音频（获取英文文本）
    const transcriptionService = new TranscriptionService(env.AI);
    const transcript = await transcriptionService.transcribeAudio(videoBuffer);
    
    console.log(`[Whisper] Transcribed: ${transcript.text.substring(0, 100)}...`);

    // 3. 翻译到多语言
    const subtitles: Record<string, string> = {
      'en': transcriptionService.generateVTT([{
        start: 0,
        end: 10,
        text: transcript.text
      }])
    };

    for (const lang of languages) {
      if (lang !== 'en' && lang !== transcript.language) {
        const translated = await transcriptionService.translateText(
          transcript.text,
          lang,
          transcript.language || 'en'
        );

        subtitles[lang] = transcriptionService.generateVTT([{
          start: 0,
          end: 10,
          text: translated
        }]);
      }
    }

    // 4. 保存字幕到 D1
    for (const [language, vttContent] of Object.entries(subtitles)) {
      await env.DB.prepare(
        `INSERT INTO subtitles (id, video_id, language, vtt_content)
         VALUES (?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        videoId,
        language,
        vttContent
      ).run();
    }

    // 5. 更新视频状态
    await env.DB.prepare(
      `UPDATE videos SET status = 'completed' WHERE id = ?`
    ).bind(videoId).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        transcript: transcript.text,
        subtitles: Object.keys(subtitles),
        languages: languages
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Transcribe Error]', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Step 4: 添加路由

```typescript
// 在 Worker 的 fetch handler 中
if (url.pathname === '/api/transcribe-video' && request.method === 'POST') {
  return await handleTranscribeVideo(request, env);
}
```

### Step 5: 进度追踪

```typescript
// 添加转录进度字段到数据库
ALTER TABLE videos ADD COLUMN transcription_progress INTEGER DEFAULT 0;

// 更新进度
await env.DB.prepare(
  'UPDATE videos SET transcription_progress = ? WHERE id = ?'
).bind(50, videoId).run();

// 前端轮询获取进度
setInterval(async () => {
  const response = await fetch(`/api/progress/${videoId}`);
  const data = await response.json();
  console.log(`转录进度: ${data.progress}%`);
}, 2000);
```

## 🎯 支持的语言

| 代码 | 语言 | M2M-100 代码 |
|------|------|-------------|
| zh | 中文 | zho |
| en | 英文 | eng |
| es | 西班牙语 | spa |
| fr | 法语 | fra |
| de | 德语 | deu |
| ja | 日语 | jpn |
| ko | 韩语 | kor |
| pt | 葡萄牙语 | por |

## ⚠️ 限制和考虑

1. **音频大小限制**: Whisper 模型有文件大小限制
   - 需要分段处理大文件
   - 建议分 30-60 秒片段

2. **处理时间**: 
   - 10 分钟视频: ~5-10 秒
   - 1 小时视频: ~30-60 秒

3. **精度**:
   - Whisper 准确度: ~95%（英文）
   - M2M-100 翻译质量取决于源文本

4. **成本**:
   - Cloudflare AI Workers 免费额度: 10,000 请求/天
   - 超出部分按使用量计费

## 📋 检查清单

- [ ] 配置 AI binding
- [ ] 实现 TranscriptionService 类
- [ ] 实现 /api/transcribe-video 端点
- [ ] 添加进度追踪
- [ ] 实现分段处理
- [ ] 添加重试逻辑
- [ ] 测试多语言翻译
- [ ] 优化性能

## 🚀 部署

```bash
# 部署 Worker
wrangler deploy

# 测试转录
curl -X POST https://subtitle.myzhangyujie.com/api/transcribe-video \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "video123",
    "languages": ["zh", "en", "es"]
  }'
```

## 🔄 完整流程示例

```typescript
// 用户上传视频
POST /api/upload
  → videoId: "abc123"
  → status: "processing"

// Worker 自动转录
POST /api/transcribe-video
  → Whisper: 英文转录
  → M2M-100: 多语言翻译
  → 保存字幕到 D1

// 用户查看进度
GET /api/progress/abc123
  → progress: 75%

// 转录完成
GET /api/videos
  → status: "completed"
  → subtitles: ["zh", "en", "es"]

// 播放视频
GET /api/watch/abc123
  → videoUrl: "https://r2.../video.mp4"
  → subtitles: { "zh": "...", "en": "..." }
```

