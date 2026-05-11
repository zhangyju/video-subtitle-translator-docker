import { Container, getContainer } from "@cloudflare/containers";

// Type definitions for Cloudflare bindings
type R2Bucket = any;
type D1Database = any;

interface Env {
  CONTAINER: any;
  AI: any;
  DB: any;
  R2_BUCKET?: R2Bucket;
  SENDGRID_API_KEY?: string;
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>视频字幕翻译器</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .header p {
            font-size: 14px;
            opacity: 0.9;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .card h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 20px;
        }
        .upload-area {
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            background: #f8f9ff;
        }
        .upload-area:hover {
            border-color: #764ba2;
            background: #f0f0ff;
        }
        .upload-area.dragover {
            border-color: #667eea;
            background: #e8e8ff;
        }
        .upload-area p {
            color: #667eea;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .upload-area .hint {
            color: #999;
            font-size: 12px;
        }
        #fileInput {
            display: none;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        .form-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        .languages {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }
        .lang-checkbox {
            display: flex;
            align-items: center;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            background: white;
        }
        .lang-checkbox:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        .lang-checkbox input {
            margin-right: 8px;
            cursor: pointer;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 14px;
        }
        .message.success {
            background: #e8f5e9;
            color: #2e7d32;
            border-left: 4px solid #4caf50;
        }
        .message.error {
            background: #ffebee;
            color: #c62828;
            border-left: 4px solid #f44336;
        }
        .progress-container {
            display: none;
            margin-top: 20px;
        }
        .progress-container.active {
            display: block;
        }
        .progress-item {
            margin-bottom: 15px;
        }
        .progress-label {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            color: #333;
            margin-bottom: 6px;
        }
        .progress-bar {
            background: #e0e0e0;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-fill {
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            height: 100%;
            transition: width 0.3s ease;
            width: 0%;
        }
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .video-card {
            background: #f8f9ff;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e0e0f0;
        }
        .video-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            word-break: break-word;
        }
        .video-info {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
        }
        .empty {
            text-align: center;
            color: #999;
            padding: 40px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 视频字幕翻译器</h1>
            <p>支持 50MB+ 大文件上传</p>
        </div>

        <!-- 上传标签页 -->
        <div class="card">
            <h2>📤 上传视频</h2>
            <div id="uploadMessage"></div>
            
            <div class="upload-area" id="uploadArea">
                <input type="file" id="fileInput" accept="video/*,audio/*">
                <p>点击或拖拽文件到此处上传</p>
                <p class="hint">支持: MP4, WebM, MP3, WAV, OGG (最大 500MB)</p>
            </div>

            <div id="selectedFileInfo" style="margin-top: 15px; padding: 12px; background: #f0f0ff; border-radius: 6px; display: none;">
                <div style="color: #667eea; font-weight: 600; margin-bottom: 5px;">✓ 已选择文件：</div>
                <div id="fileName" style="color: #333; word-break: break-all; font-size: 14px;"></div>
                <div id="fileSize" style="color: #999; font-size: 12px; margin-top: 3px;"></div>
            </div>

            <div class="form-group" style="margin-top: 20px;">
                <label>视频标题 (可选)</label>
                <input type="text" id="title" placeholder="给你的视频起个名字">
            </div>

            <div class="form-group">
                <label>Translation Languages</label>
                <div class="languages">
                    <label class="lang-checkbox">
                        <input type="checkbox" value="zh" checked> Chinese
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="en"> English
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="es"> Spanish
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="fr"> French
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="de"> German
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="ja"> Japanese
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="ko"> Korean
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="pt"> Portuguese
                    </label>
                </div>
            </div>

            <button class="btn btn-primary" id="uploadBtn" onclick="uploadFile()">上传并处理</button>

            <div class="progress-container" id="progressContainer">
                <div class="progress-item">
                    <div class="progress-label">
                        <span>上传进度</span>
                        <span id="uploadPercent">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="uploadProgress"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-label">
                        <span>处理进度</span>
                        <span id="processPercent">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="processProgress"></div>
                    </div>
                </div>
                <div id="completionMessage" style="color: #4caf50; font-weight: 600; margin-top: 10px; display: none;">
                    ✅ 处理完成！
                </div>
            </div>
        </div>

        <!-- 视频列表标签页 -->
        <div class="card">
            <h2>📺 视频列表</h2>
            <button class="btn btn-primary" onclick="loadVideos()" style="margin-bottom: 20px;">刷新列表</button>
            <div id="videosList" class="empty">加载中...</div>
        </div>
    </div>

    <script>
        let currentVideoId = null;
        let selectedLanguages = [];
        let progressInterval = null;

        // 文件拖拽
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            showSelectedFile();
        });

        // 文件选择变化事件
        fileInput.addEventListener('change', showSelectedFile);

        function showSelectedFile() {
            const file = fileInput.files[0];
            const fileInfo = document.getElementById('selectedFileInfo');
            
            if (file) {
                const fileName = document.getElementById('fileName');
                const fileSize = document.getElementById('fileSize');
                
                fileName.textContent = file.name;
                fileSize.textContent = '大小: ' + formatFileSize(file.size);
                fileInfo.style.display = 'block';
                
                // 自动填充标题（如果用户没有输入的话）
                const titleInput = document.getElementById('title');
                if (!titleInput.value) {
                    titleInput.value = file.name.replace(/\\.[^/.]+$/, '');
                }
            } else {
                fileInfo.style.display = 'none';
            }
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }

        // 上传文件
        async function uploadFile() {
            const file = fileInput.files[0];
            if (!file) {
                alert('请选择文件');
                return;
            }

            // 获取选中的语言
            selectedLanguages = Array.from(document.querySelectorAll('.lang-checkbox input:checked'))
                .map(el => el.value);
            
            if (!selectedLanguages.length) {
                alert('请选择至少一种语言');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', document.getElementById('title').value || file.name);
            formData.append('languages', JSON.stringify(selectedLanguages));

            try {
                document.getElementById('uploadBtn').disabled = true;
                document.getElementById('uploadMessage').innerHTML = 
                    '<div class="message success">⏳ 上传中...</div>';
                document.getElementById('progressContainer').classList.add('active');

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    currentVideoId = data.data.id;
                    document.getElementById('uploadMessage').innerHTML = 
                        '<div class="message success">✅ 上传成功！处理中...</div>';
                    
                    // 开始轮询进度
                    pollProgress();
                    progressInterval = setInterval(pollProgress, 1000);
                } else {
                    document.getElementById('uploadMessage').innerHTML = 
                        \`<div class="message error">❌ \${data.error}</div>\`;
                    document.getElementById('progressContainer').classList.remove('active');
                }
            } catch (error) {
                document.getElementById('uploadMessage').innerHTML = 
                    \`<div class="message error">❌ 错误: \${error.message}</div>\`;
                document.getElementById('progressContainer').classList.remove('active');
            } finally {
                document.getElementById('uploadBtn').disabled = false;
            }
        }

        // 轮询进度
        async function pollProgress() {
            if (!currentVideoId) return;

            try {
                const response = await fetch(\`/api/progress/\${currentVideoId}\`);
                const data = await response.json();

                if (data.success) {
                    const status = data.data.status || 'processing';
                    
                    // 更新上传进度
                    document.getElementById('uploadProgress').style.width = '100%';
                    document.getElementById('uploadPercent').textContent = '100%';

                    // 更新处理进度
                    if (status === 'processing') {
                        let processPercent = 30;
                        if (data.data.transcribed) processPercent = 60;
                        if (data.data.translationsCount > 0) {
                            processPercent = 60 + (data.data.translationsCount / selectedLanguages.length) * 30;
                        }
                        document.getElementById('processProgress').style.width = processPercent + '%';
                        document.getElementById('processPercent').textContent = Math.round(processPercent) + '%';
                    } else if (status === 'completed') {
                        document.getElementById('processProgress').style.width = '100%';
                        document.getElementById('processPercent').textContent = '100%';
                        document.getElementById('completionMessage').style.display = 'block';
                        clearInterval(progressInterval);
                    }
                }
            } catch (error) {
                console.error('Progress error:', error);
            }
        }

        // 加载视频列表
        async function loadVideos() {
            try {
                const response = await fetch('/api/videos');
                const data = await response.json();

                if (data.data && data.data.videos && data.data.videos.length > 0) {
                    let html = '';
                    data.data.videos.forEach(video => {
                        let subtitleButtons = '';
                        if (video.subtitles && Object.keys(video.subtitles).length > 0) {
                            subtitleButtons = '<div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px;">';
                            for (const [lang, subtitle] of Object.entries(video.subtitles)) {
                                const langNames = {
                                    'zh': 'Chinese',
                                    'en': 'English',
                                    'es': 'Spanish',
                                    'fr': 'French',
                                    'de': 'German',
                                    'ja': 'Japanese',
                                    'ko': 'Korean',
                                    'pt': 'Portuguese'
                                };
                                subtitleButtons += \`<a href="/api/subtitles/\${video.id}/\${lang}" style="padding: 6px 12px; background: #667eea; color: white; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: 600;" download>⬇️ \${langNames[lang] || lang}</a>\`;
                            }
                            subtitleButtons += '</div>';
                        }
                        
                        html += \`
                            <div class="video-card">
                                <div class="video-title">\${video.title || 'Untitled'}</div>
                                <div class="video-info">
                                    <div>Status: \${video.status}</div>
                                    <div>Uploaded: \${new Date(video.createdAt).toLocaleDateString()}</div>
                                    \${video.transcribed ? '<div>✅ Transcribed</div>' : '<div>⏳ Transcribing...</div>'}
                                </div>
                                \${subtitleButtons}
                            </div>
                        \`;
                    });
                    document.getElementById('videosList').innerHTML = html;
                } else {
                    document.getElementById('videosList').innerHTML = 
                        '<div class="empty">No videos yet. Upload one to get started!</div>';
                }
            } catch (error) {
                document.getElementById('videosList').innerHTML = 
                    \`<div class="empty">❌ Failed to load: \${error.message}</div>\`;
            }
        }

        // 页面加载时获取视频列表
        loadVideos();
    </script>
</body>
</html>`;

export class VideoSubtitleContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "30m";
}

// Transcription Service Class
class TranscriptionService {
  private ai: any;

  constructor(ai: any) {
    if (!ai) {
      throw new Error('AI binding not configured');
    }
    this.ai = ai;
  }

  /**
   * 使用 Whisper 转录音频（带重试）
   */
  async transcribeAudio(audioBuffer: ArrayBuffer, maxRetries: number = 3): Promise<{
    text: string;
    language: string;
    confidence: number;
  }> {
    const audioArray = Array.from(new Uint8Array(audioBuffer));

    console.log(`[Whisper] 开始转录，文件大小: ${Math.round(audioBuffer.byteLength / 1024)}KB`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.ai.run('@cf/openai/whisper', {
          audio: audioArray,
        }) as any;

        const text = response.result?.text || '';
        const language = response.result?.language || 'english';
        const confidence = response.result?.confidence || 0.8;

        console.log(`[Whisper] 转录完成（尝试 ${attempt + 1}）: ${text.substring(0, 100)}... (${language})`);

        return {
          text,
          language: this.normalizeLanguage(language),
          confidence,
        };
      } catch (error) {
        console.error(`[Whisper] 转录失败（尝试 ${attempt + 1}/${maxRetries}）:`, error);

        if (attempt === maxRetries - 1) {
          // 最后一次尝试失败，抛出错误
          throw new Error(`Transcription failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 指数退避等待
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[Whisper] 等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Transcription failed: Unknown error');
  }

  /**
   * 使用 M2M-100 翻译文本（带重试）
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en',
    maxRetries: number = 2
  ): Promise<string> {
    const languageMap: Record<string, string> = {
      'zh': 'zho',      // 中文
      'en': 'eng',      // 英文
      'es': 'spa',      // 西班牙语
      'fr': 'fra',      // 法语
      'de': 'deu',      // 德语
      'ja': 'jpn',      // 日语
      'ko': 'kor',      // 韩语
      'pt': 'por',      // 葡萄牙语
      'ru': 'rus',      // 俄语
      'it': 'ita',      // 意大利语
    };

    const sourceLangCode = languageMap[sourceLanguage] || 'eng';
    const targetLangCode = languageMap[targetLanguage] || 'eng';

    console.log(`[M2M-100] 翻译: ${sourceLanguage}(${sourceLangCode}) → ${targetLanguage}(${targetLangCode})`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.ai.run('@cf/meta/m2m-100-12b-last-ckpt', {
          text,
          source_lang: sourceLangCode,
          target_lang: targetLangCode,
        }) as any;

        const translatedText = response.result?.translated_text || text;

        console.log(`[M2M-100] 翻译完成（尝试 ${attempt + 1}）: ${translatedText.substring(0, 100)}...`);

        return translatedText;
      } catch (error) {
        console.error(`[M2M-100] 翻译失败（尝试 ${attempt + 1}/${maxRetries}）:`, error);

        if (attempt === maxRetries - 1) {
          // 最后一次尝试失败，返回原文本作为降级方案
          console.warn(`[M2M-100] 翻译失败，使用原文本`);
          return text;
        }

        // 短暂等待后重试
        const waitTime = Math.pow(2, attempt) * 500;
        console.log(`[M2M-100] 等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return text; // 降级方案：返回原文本
  }

  /**
   * 生成 VTT 字幕文件
   */
  generateVTT(text: string, language: string = 'en'): string {
    // 简化版本：分割文本为较小的段落并生成 VTT
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let vtt = 'WEBVTT\n\n';
    let currentTime = 0;
    const wordsPerSecond = 2.5; // 平均每秒字数

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      const words = trimmed.split(/\s+/).length;
      const duration = Math.max(words / wordsPerSecond, 1);

      const startTime = this.formatTime(currentTime);
      const endTime = this.formatTime(currentTime + duration);

      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${trimmed}\n\n`;

      currentTime += duration;
    }

    return vtt;
  }

  /**
   * 格式化时间为 VTT 格式
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /**
   * 规范化语言代码
   */
  private normalizeLanguage(language: string): string {
    const langMap: Record<string, string> = {
      'english': 'en',
      'chinese': 'zh',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'japanese': 'ja',
      'korean': 'ko',
      'portuguese': 'pt',
      'russian': 'ru',
      'italian': 'it',
    };

    return langMap[language.toLowerCase()] || language.substring(0, 2).toLowerCase();
  }

  /**
   * 检查是否支持语言
   */
  isSupportedLanguage(languageCode: string): boolean {
    const supportedLanguages = ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'it'];
    return supportedLanguages.includes(languageCode.toLowerCase());
  }

  /**
   * 获取所有支持的语言
   */
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'zh', name: 'Chinese' },
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'it', name: 'Italian' },
    ];
  }
}

// R2 Storage Service Class
class R2StorageService {
  private bucket: R2Bucket;
  private baseUrl: string = 'https://r2.myzhangyujie.com';

  constructor(env: Env) {
    if (!env.R2_BUCKET) {
      throw new Error('R2_BUCKET binding not configured');
    }
    this.bucket = env.R2_BUCKET;
  }

  /**
   * 上传视频文件到 R2
   */
  async uploadVideo(
    userId: string,
    videoId: string,
    fileData: ArrayBuffer,
    fileName: string,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    const fileExtension = fileName.split('.').pop() || 'mp4';
    const key = `users/${userId}/videos/${videoId}/original.${fileExtension}`;

    try {
      await this.bucket.put(key, fileData, {
        httpMetadata: {
          contentType,
          cacheControl: 'max-age=31536000', // 1 年缓存（视频不常修改）
        },
      });

      const url = `${this.baseUrl}/${key}`;
      console.log(`[R2] Video uploaded: ${key} (${Math.round(fileData.byteLength / 1024 / 1024)} MB)`);

      return { url, key };
    } catch (error) {
      console.error('[R2] Upload error:', error);
      throw new Error('Failed to upload video to R2');
    }
  }

  /**
   * 上传字幕到 R2
   */
  async uploadSubtitle(
    videoId: string,
    language: string,
    vttContent: string
  ): Promise<string> {
    const key = `videos/${videoId}/subtitles/${language}.vtt`;

    try {
      await this.bucket.put(key, vttContent, {
        httpMetadata: {
          contentType: 'text/vtt;charset=utf-8',
          cacheControl: 'max-age=86400', // 1 天缓存
        },
      });

      const url = `${this.baseUrl}/${key}`;
      console.log(`[R2] Subtitle uploaded: ${key}`);

      return url;
    } catch (error) {
      console.error('[R2] Subtitle upload error:', error);
      throw new Error('Failed to upload subtitle to R2');
    }
  }

  /**
   * 获取视频 URL
   */
  getVideoUrl(userId: string, videoId: string, fileExtension: string = 'mp4'): string {
    return `${this.baseUrl}/users/${userId}/videos/${videoId}/original.${fileExtension}`;
  }

  /**
   * 获取字幕 URL
   */
  getSubtitleUrl(videoId: string, language: string): string {
    return `${this.baseUrl}/videos/${videoId}/subtitles/${language}.vtt`;
  }

  /**
   * 删除视频及其所有相关文件
   */
  async deleteVideo(userId: string, videoId: string): Promise<void> {
    const prefix = `users/${userId}/videos/${videoId}/`;

    try {
      const listResponse = await this.bucket.list({ prefix });

      // 删除所有匹配的文件
      const deletePromises = listResponse.objects.map((obj: any) =>
        this.bucket.delete(obj.key)
      );

      await Promise.all(deletePromises);
      console.log(`[R2] Deleted video folder: ${prefix}`);
    } catch (error) {
      console.error('[R2] Delete error:', error);
      throw new Error('Failed to delete video from R2');
    }
  }

  /**
   * 获取视频元数据（大小、上传时间等）
   */
  async getVideoMetadata(userId: string, videoId: string, fileExtension: string): Promise<any> {
    const key = `users/${userId}/videos/${videoId}/original.${fileExtension}`;

    try {
      const object = await this.bucket.head(key);

      return {
        key,
        size: object?.size || 0,
        uploadedAt: object?.uploaded || new Date(),
        contentType: object?.httpMetadata?.contentType || 'video/mp4',
      };
    } catch (error) {
      console.error('[R2] Metadata error:', error);
      return null;
    }
  }

  /**
   * 上传视频元数据 JSON
   */
  async uploadMetadata(
    userId: string,
    videoId: string,
    metadata: any
  ): Promise<string> {
    const key = `users/${userId}/videos/${videoId}/metadata.json`;
    const jsonContent = JSON.stringify(metadata, null, 2);

    try {
      await this.bucket.put(key, jsonContent, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'max-age=3600', // 1 小时缓存
        },
      });

      console.log(`[R2] Metadata uploaded: ${key}`);
      return `${this.baseUrl}/${key}`;
    } catch (error) {
      console.error('[R2] Metadata upload error:', error);
      throw new Error('Failed to upload metadata to R2');
    }
  }
}

// Email Service Class
class EmailService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async sendVerificationEmail(
    email: string,
    fullName: string,
    token: string
  ): Promise<boolean> {
    const verificationLink = `https://subtitle.myzhangyujie.com/api/auth/verify?token=${token}`;
    const html = buildVerificationEmailHtml(fullName, verificationLink);
    const text = `Please verify your email by visiting: ${verificationLink}`;

    return await this.sendEmail({
      to: email,
      subject: 'Verify your email - Video Subtitle Translator',
      html,
      text
    });
  }

  async sendWelcomeEmail(
    email: string,
    fullName: string
  ): Promise<boolean> {
    const html = buildWelcomeEmailHtml(fullName);
    const text = 'Welcome to Video Subtitle Translator! Your account is now activated.';

    return await this.sendEmail({
      to: email,
      subject: 'Welcome to Video Subtitle Translator',
      html,
      text
    });
  }

  async sendPasswordResetEmail(
    email: string,
    fullName: string,
    token: string
  ): Promise<boolean> {
    const resetLink = `https://subtitle.myzhangyujie.com/reset-password?token=${token}`;
    const html = buildPasswordResetEmailHtml(fullName, resetLink);
    const text = `Reset your password by visiting: ${resetLink}`;

    return await this.sendEmail({
      to: email,
      subject: 'Reset your password - Video Subtitle Translator',
      html,
      text
    });
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    try {
      const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: options.to }],
              dkim_domain: 'subtitle.myzhangyujie.com'
            }
          ],
          from: {
            email: 'noreply@subtitle.myzhangyujie.com',
            name: 'Video Subtitle Translator'
          },
          subject: options.subject,
          content: [
            { type: 'text/html', value: options.html },
            { type: 'text/plain', value: options.text }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Email Error] MailChannels API error:', error);
        return false;
      }

      console.log(`[Email] Email sent to ${options.to}: ${options.subject}`);
      return true;
    } catch (error) {
      console.error('[Email Error]', error);
      return false;
    }
  }
}

// QuotaService: Manages user quotas for storage, transcriptions, and daily processing
class QuotaService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Check if user has sufficient quota for upload
   */
  async canUpload(
    userId: string,
    fileSizeBytes: number,
    db: D1Database
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const user = await db
        .prepare('SELECT quota_storage_gb, storage_used_gb FROM users WHERE id = ?')
        .bind(userId)
        .first<any>();

      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);
      const remainingQuota = user.quota_storage_gb - user.storage_used_gb;

      if (fileSizeGb > remainingQuota) {
        return {
          allowed: false,
          reason: `Insufficient storage quota. Required: ${fileSizeGb.toFixed(2)}GB, Available: ${remainingQuota.toFixed(2)}GB`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[QuotaService] Error checking upload quota:', error);
      return { allowed: false, reason: 'Error checking quota' };
    }
  }

  /**
   * Check if user has sufficient quota for transcription
   */
  async canTranscribe(
    userId: string,
    db: D1Database
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const user = await db
        .prepare(
          'SELECT quota_transcriptions, transcriptions_this_month FROM users WHERE id = ?'
        )
        .bind(userId)
        .first<any>();

      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const remainingTranscriptions =
        user.quota_transcriptions - user.transcriptions_this_month;

      if (remainingTranscriptions <= 0) {
        return {
          allowed: false,
          reason: `Transcription quota exceeded. Monthly limit: ${user.quota_transcriptions}, used: ${user.transcriptions_this_month}`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[QuotaService] Error checking transcription quota:', error);
      return { allowed: false, reason: 'Error checking quota' };
    }
  }

  /**
   * Check daily processing quota
   */
  async canProcessDaily(
    userId: string,
    additionalGb: number,
    db: D1Database
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const user = await db
        .prepare(
          'SELECT quota_daily_processing_gb, processing_today_gb, processing_date_reset FROM users WHERE id = ?'
        )
        .bind(userId)
        .first<any>();

      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      // Check if we need to reset daily quota (midnight in user's timezone)
      const today = new Date().toISOString().split('T')[0];
      if (user.processing_date_reset !== today) {
        // Reset daily quota
        await this.resetDailyQuota(userId, db);
        return { allowed: true };
      }

      const remainingDaily =
        user.quota_daily_processing_gb - user.processing_today_gb;

      if (additionalGb > remainingDaily) {
        return {
          allowed: false,
          reason: `Daily processing quota exceeded. Limit: ${user.quota_daily_processing_gb}GB, used: ${user.processing_today_gb}GB, additional: ${additionalGb}GB`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[QuotaService] Error checking daily processing quota:', error);
      return { allowed: false, reason: 'Error checking quota' };
    }
  }

  /**
   * Consume storage quota after upload
   */
  async consumeStorageQuota(
    userId: string,
    fileSizeBytes: number,
    db: D1Database
  ): Promise<boolean> {
    try {
      const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);
      await db
        .prepare(
          'UPDATE users SET storage_used_gb = storage_used_gb + ? WHERE id = ?'
        )
        .bind(fileSizeGb, userId)
        .run();

      console.log(
        `[QuotaService] Consumed ${fileSizeGb.toFixed(2)}GB storage for user ${userId}`
      );
      return true;
    } catch (error) {
      console.error('[QuotaService] Error consuming storage quota:', error);
      return false;
    }
  }

  /**
   * Consume transcription quota
   */
  async consumeTranscriptionQuota(userId: string, db: D1Database): Promise<boolean> {
    try {
      await db
        .prepare(
          'UPDATE users SET transcriptions_this_month = transcriptions_this_month + 1 WHERE id = ?'
        )
        .bind(userId)
        .run();

      console.log(`[QuotaService] Consumed transcription for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[QuotaService] Error consuming transcription quota:', error);
      return false;
    }
  }

  /**
   * Consume daily processing quota
   */
  async consumeDailyProcessingQuota(
    userId: string,
    fileSizeBytes: number,
    db: D1Database
  ): Promise<boolean> {
    try {
      const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);
      await db
        .prepare(
          'UPDATE users SET processing_today_gb = processing_today_gb + ? WHERE id = ?'
        )
        .bind(fileSizeGb, userId)
        .run();

      console.log(
        `[QuotaService] Consumed ${fileSizeGb.toFixed(2)}GB daily processing for user ${userId}`
      );
      return true;
    } catch (error) {
      console.error(
        '[QuotaService] Error consuming daily processing quota:',
        error
      );
      return false;
    }
  }

  /**
   * Reset daily processing quota (called at midnight)
   */
  private async resetDailyQuota(userId: string, db: D1Database): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      await db
        .prepare(
          'UPDATE users SET processing_today_gb = 0, processing_date_reset = ? WHERE id = ?'
        )
        .bind(today, userId)
        .run();

      console.log(`[QuotaService] Reset daily quota for user ${userId}`);
    } catch (error) {
      console.error('[QuotaService] Error resetting daily quota:', error);
    }
  }

  /**
   * Get user quota status
   */
  async getQuotaStatus(userId: string, db: D1Database): Promise<any> {
    try {
      const user = await db
        .prepare(
          `SELECT 
            quota_storage_gb, storage_used_gb,
            quota_transcriptions, transcriptions_this_month,
            quota_daily_processing_gb, processing_today_gb,
            processing_date_reset
          FROM users WHERE id = ?`
        )
        .bind(userId)
        .first<any>();

      if (!user) {
        return null;
      }

      // Check if daily quota needs reset
      const today = new Date().toISOString().split('T')[0];
      if (user.processing_date_reset !== today) {
        await this.resetDailyQuota(userId, db);
        user.processing_today_gb = 0;
        user.processing_date_reset = today;
      }

      return {
        storage: {
          limit: user.quota_storage_gb,
          used: user.storage_used_gb,
          remaining: user.quota_storage_gb - user.storage_used_gb,
          percentage: Math.round(
            (user.storage_used_gb / user.quota_storage_gb) * 100
          )
        },
        transcriptions: {
          limit: user.quota_transcriptions,
          used: user.transcriptions_this_month,
          remaining: user.quota_transcriptions - user.transcriptions_this_month,
          percentage: Math.round(
            (user.transcriptions_this_month / user.quota_transcriptions) * 100
          )
        },
        dailyProcessing: {
          limit: user.quota_daily_processing_gb,
          used: user.processing_today_gb,
          remaining:
            user.quota_daily_processing_gb - user.processing_today_gb,
          percentage: Math.round(
            (user.processing_today_gb / user.quota_daily_processing_gb) * 100
          ),
          resetDate: user.processing_date_reset
        }
      };
    } catch (error) {
      console.error('[QuotaService] Error getting quota status:', error);
      return null;
    }
  }

  /**
   * Log user action for audit trail
   */
  async logAction(
    userId: string,
    action: string,
    resourceType: string | null,
    resourceId: string | null,
    details: any,
    db: D1Database
  ): Promise<void> {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db
        .prepare(
          `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          id,
          userId,
          action,
          resourceType || null,
          resourceId || null,
          JSON.stringify(details)
        )
        .run();

      console.log(`[QuotaService] Logged action: ${action} for user ${userId}`);
    } catch (error) {
      console.error('[QuotaService] Error logging action:', error);
    }
  }
}

// Email Template Builder Functions
function buildVerificationEmailHtml(fullName: string, verificationLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 10px;">Welcome to Video Subtitle Translator!</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi <strong>${fullName}</strong>,
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Thank you for signing up! To complete your registration, please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin-bottom: 30px;">
                <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Verify Email
                </a>
            </div>
            <p style="color: #999; font-size: 12px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                Or copy and paste this link in your browser:<br>
                <code style="color: #667eea; word-break: break-all;">${verificationLink}</code>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                If you didn't create this account, you can safely ignore this email.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

function buildWelcomeEmailHtml(fullName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 10px;">🎉 Your account is ready!</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi <strong>${fullName}</strong>,
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your email has been verified and your account is now active. You can now:
            </p>
            <ul style="color: #666; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                <li>📤 Upload videos up to 500MB</li>
                <li>🎯 Transcribe audio with AI Whisper</li>
                <li>🌐 Translate to 8+ languages</li>
                <li>📊 View your usage statistics</li>
                <li>🔒 Secure storage in Cloudflare R2</li>
            </ul>
            <div style="text-align: center; margin-bottom: 30px;">
                <a href="https://subtitle.myzhangyujie.com/" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Go to Dashboard
                </a>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                <strong>Your quota for this month:</strong><br>
                • Storage: 10GB<br>
                • Transcriptions: 100<br>
                • Daily processing: 10GB
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

function buildPasswordResetEmailHtml(fullName: string, resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 10px;">Password Reset Request</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi <strong>${fullName}</strong>,
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                We received a request to reset your password. Click the button below to set a new password.
            </p>
            <div style="text-align: center; margin-bottom: 30px;">
                <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Reset Password
                </a>
            </div>
            <p style="color: #999; font-size: 12px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                Or copy and paste this link in your browser:<br>
                <code style="color: #667eea; word-break: break-all;">${resetLink}</code>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                This link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

// 认证路由处理
async function handleAuth(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 注册
  if (path === '/api/auth/register' && request.method === 'POST') {
    return await handleRegister(request, env);
  }

  // 登录
  if (path === '/api/auth/login' && request.method === 'POST') {
    return await handleLogin(request, env);
  }

  // 验证 email (POST 请求 - 用于 API)
  if (path === '/api/auth/verify' && request.method === 'POST') {
    return await handleVerifyEmailAPI(request, env);
  }

  // 验证 email (GET 请求 - 用于邮件链接)
  if (path === '/api/auth/verify' && request.method === 'GET') {
    return await handleVerifyEmailLink(request, env);
  }

  return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleRegister(request: Request, env: Env) {
  try {
    const { email, password, fullName } = await request.json() as any;

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查邮箱是否已存在
    const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email already registered' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 密码加密（简单实现，生产环境使用 bcrypt）
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();

    // 创建用户
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, verification_token) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, email, passwordHash, fullName, verificationToken).run();

    console.log(`[Auth] User registered: ${email}`);

    // 发送验证邮件
    const emailService = new EmailService(env);
    const emailSent = await emailService.sendVerificationEmail(
      email,
      fullName,
      verificationToken
    );

    if (!emailSent) {
      console.warn(`[Auth] Failed to send verification email to ${email}, but user was created`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: userId,
          email,
          message: emailSent 
            ? 'Registration successful. Please check your email to verify your account.'
            : 'Registration successful. But we had trouble sending the verification email. Please contact support.'
        }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Register Error]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Registration failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleLogin(request: Request, env: Env) {
  try {
    const { email, password } = await request.json() as any;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing email or password' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 查询用户
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first() as any;

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证密码
    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 生成 token
    const token = generateAuthToken(user.id);

    console.log(`[Auth] User logged in: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          verified: user.verified,
          token,
          quota: {
            storage: user.quota_storage_gb,
            transcriptions: user.quota_transcriptions,
            dailyProcessing: user.quota_daily_processing_gb
          }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Login Error]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Login failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleVerifyEmailAPI(request: Request, env: Env) {
  try {
    const { userId, token } = await request.json() as any;

    if (!userId || !token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 验证 token
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND verification_token = ?')
      .bind(userId, token)
      .first() as any;

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 标记为已验证
    await env.DB.prepare('UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?')
      .bind(userId)
      .run();

    // 发送欢迎邮件
    const emailService = new EmailService(env);
    await emailService.sendWelcomeEmail(user.email, user.full_name);

    console.log(`[Auth] Email verified: ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Email verified successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Verify Error]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Verification failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleVerifyEmailLink(request: Request, env: Env) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        buildVerifyErrorHTML('Missing verification token'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // 通过 token 查找用户
    const user = await env.DB.prepare('SELECT * FROM users WHERE verification_token = ?')
      .bind(token)
      .first() as any;

    if (!user) {
      return new Response(
        buildVerifyErrorHTML('Invalid or expired verification token'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // 标记为已验证
    await env.DB.prepare('UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?')
      .bind(user.id)
      .run();

    // 发送欢迎邮件
    const emailService = new EmailService(env);
    await emailService.sendWelcomeEmail(user.email, user.full_name);

    console.log(`[Auth] Email verified via link: ${user.email}`);

    return new Response(
      buildVerifySuccessHTML(user.full_name),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  } catch (error) {
    console.error('[Verify Error]', error);
    return new Response(
      buildVerifyErrorHTML('An error occurred during verification'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function buildVerifySuccessHTML(fullName: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>邮箱验证成功</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .icon {
            font-size: 60px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✅</div>
        <h1>邮箱验证成功！</h1>
        <p>亲爱的 <strong>${fullName}</strong>,</p>
        <p>您的邮箱已验证，账户已激活。您现在可以使用所有功能。</p>
        <a href="https://subtitle.myzhangyujie.com/" class="button">前往应用</a>
    </div>
</body>
</html>
  `;
}

function buildVerifyErrorHTML(message: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>邮箱验证失败</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .icon {
            font-size: 60px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .error-message {
            background: #ffebee;
            color: #c62828;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #f44336;
        }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>邮箱验证失败</h1>
        <div class="error-message">${message}</div>
        <p>请检查验证链接是否正确或者重新注册。</p>
        <a href="https://subtitle.myzhangyujie.com/" class="button">返回首页</a>
    </div>
</body>
</html>
  `;
}

// Helper functions
async function hashPassword(password: string): Promise<string> {
  // 简化实现，生产环境使用 bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + Math.random().toString());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // 简化实现
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashStr = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hash.includes(hashStr);
}

function generateAuthToken(userId: string): string {
  const payload = {
    userId,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}



export default {
  async fetch(request: Request, env: Env, _ctx: any) {
    try {
      const url = new URL(request.url);
      
      // Serve HTML at root
      if (url.pathname === '/') {
        return new Response(HTML_CONTENT, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Handle authentication routes
      if (url.pathname.startsWith('/api/auth/')) {
        return await handleAuth(request, env);
      }

      // Handle transcription via Cloudflare AI
      if (url.pathname === '/api/transcribe' && request.method === 'POST') {
        return await handleTranscription(request, env);
      }

      // Handle async transcription trigger
      if (url.pathname.startsWith('/api/transcribe-video/') && request.method === 'POST') {
        return await triggerTranscription(request, env);
      }

      // Forward all other requests to container
      const container = getContainer(env.CONTAINER, "default");
      const response = await container.fetch(request);
      return response;
    } catch (error) {
      console.error("[Error]", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Request failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};

async function handleTranscription(request: Request, env: Env) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ success: false, error: 'No audio file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();

    // Call Cloudflare AI Whisper
    const response = await env.AI.run('@cf/openai/whisper', {
      audio: Array.from(new Uint8Array(arrayBuffer)),
    }) as any;

    return new Response(JSON.stringify({
      success: true,
      data: {
        text: response.result?.text || '',
        language: response.result?.language || 'en'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Transcription Error]', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function triggerTranscription(request: Request, env: Env) {
  try {
    const { videoId, filePath, languages = ['zh', 'en'], title } = await request.json() as any;

    if (!videoId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing videoId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Transcription] Starting for video ${videoId}: ${title}`);

    // Initialize services
    const transcriptionService = new TranscriptionService(env.AI);
    const r2Service = new R2StorageService(env);

    // Step 1: Fetch audio file from Container
    console.log(`[Transcription] Fetching audio file from container`);
    const fileContent = await fetch(`http://localhost:3000/api/get-file/${videoId}`, {
      method: 'GET'
    });

    if (!fileContent.ok) {
      throw new Error('Failed to fetch audio file from container');
    }

    const arrayBuffer = await fileContent.arrayBuffer();
    console.log(`[Transcription] Audio file loaded: ${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB`);

    // Step 2: Transcribe audio with Whisper
    console.log(`[Transcription] Running Whisper transcription...`);
    const transcription = await transcriptionService.transcribeAudio(arrayBuffer);
    const { text: transcript, language: detectedLanguage, confidence } = transcription;

    console.log(`[Transcription] Whisper complete: ${transcript.length} chars, language: ${detectedLanguage}, confidence: ${confidence}`);

    // Step 3: Generate subtitles in requested languages
    console.log(`[Transcription] Generating subtitles for ${languages.length} languages`);
    const subtitles: Record<string, string> = {};
    const translationResults: Record<string, string> = {};

    // Add original language subtitle
    subtitles[detectedLanguage] = transcriptionService.generateVTT(transcript, detectedLanguage);
    console.log(`[Transcription] Generated subtitle for original language: ${detectedLanguage}`);

    // Translate and generate subtitles for other languages
    for (const lang of languages) {
      if (lang === detectedLanguage) {
        console.log(`[Transcription] Skipping ${lang} (same as source language)`);
        continue;
      }

      if (!transcriptionService.isSupportedLanguage(lang)) {
        console.warn(`[Transcription] Unsupported language: ${lang}, skipping`);
        continue;
      }

      try {
        console.log(`[Transcription] Translating to ${lang}...`);
        const translatedText = await transcriptionService.translateText(
          transcript,
          lang,
          detectedLanguage
        );

        subtitles[lang] = transcriptionService.generateVTT(translatedText, lang);
        translationResults[lang] = translatedText;
        console.log(`[Transcription] Translation complete for ${lang}`);
      } catch (err) {
        console.error(`[Transcription] Translation error for ${lang}:`, err);
        // Fallback: use original transcript
        subtitles[lang] = transcriptionService.generateVTT(transcript, lang);
      }
    }

    // Step 4: Upload subtitles to R2
    console.log(`[Transcription] Uploading ${Object.keys(subtitles).length} subtitles to R2`);
    const r2SubtitleUrls: Record<string, string> = {};

    for (const [lang, vttContent] of Object.entries(subtitles)) {
      try {
        const r2Url = await r2Service.uploadSubtitle(videoId, lang, vttContent);
        r2SubtitleUrls[lang] = r2Url;
        console.log(`[Transcription] R2 upload complete: ${lang}`);
      } catch (err) {
        console.error(`[Transcription] R2 upload error for ${lang}:`, err);
        // Continue uploading other subtitles even if one fails
      }
    }

    // Step 5: Store results in Container
    console.log(`[Transcription] Storing results in container`);
    const storeResponse = await fetch(`http://localhost:3000/api/store-transcript/${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        subtitles,
        r2SubtitleUrls,
        translationResults,
        detectedLanguage,
        confidence,
        processedLanguages: Object.keys(subtitles)
      })
    });

    if (!storeResponse.ok) {
      console.error('[Transcription] Failed to store transcript in container');
      throw new Error('Failed to store transcript in container');
    }

    console.log(`[Transcription] Complete for ${videoId}: ${Object.keys(subtitles).length} subtitles generated`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        videoId,
        title,
        transcript: transcript.substring(0, 500) + '...', // 只返回前 500 字符
        languages: Object.keys(subtitles),
        detectedLanguage,
        confidence,
        r2SubtitleUrls
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Transcription] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper functions
function generateVTT(text: string): string {
  const lines = text.split(/[\n.!?]+/).filter(l => l.trim());
  
  let vtt = 'WEBVTT\n\n';
  let currentTime = 0;
  const wordsPerSecond = 2.5;

  lines.forEach((line) => {
    if (!line.trim()) return;
    
    const words = line.trim().split(/\s+/).length;
    const duration = Math.max(words / wordsPerSecond, 1);
    
    const startTime = formatTime(currentTime);
    const endTime = formatTime(currentTime + duration);
    
    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${line.trim()}\n\n`;
    
    currentTime += duration;
  });

  return vtt;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function languageCodeToM2M(code: string): string {
  const mapping: Record<string, string> = {
    'zh': 'zho',
    'en': 'eng',
    'es': 'spa',
    'fr': 'fra',
    'de': 'deu',
    'ja': 'jpn',
    'ko': 'kor',
    'pt': 'por'
  };
  return mapping[code] || 'eng';
}

function detectedLanguageToM2M(lang: string): string {
  // Whisper returns language names like 'English', 'Chinese', etc.
  const mapping: Record<string, string> = {
    'english': 'eng',
    'chinese': 'zho',
    'spanish': 'spa',
    'french': 'fra',
    'german': 'deu',
    'japanese': 'jpn',
    'korean': 'kor',
    'portuguese': 'por'
  };
  return mapping[lang.toLowerCase()] || 'eng';
}
