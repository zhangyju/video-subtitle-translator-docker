import { Container, getContainer } from "@cloudflare/containers";

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

            <div class="form-group" style="margin-top: 20px;">
                <label>视频标题 (可选)</label>
                <input type="text" id="title" placeholder="给你的视频起个名字">
            </div>

            <div class="form-group">
                <label>翻译语言</label>
                <div class="languages">
                    <label class="lang-checkbox">
                        <input type="checkbox" value="zh" checked> 中文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="en"> 英文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="es"> 西班牙文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="fr"> 法文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="de"> 德文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="ja"> 日文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="ko"> 韩文
                    </label>
                    <label class="lang-checkbox">
                        <input type="checkbox" value="pt"> 葡萄牙文
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
        });

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
                        html += \`
                            <div class="video-card">
                                <div class="video-title">\${video.title || '无标题'}</div>
                                <div class="video-info">
                                    <div>状态: \${video.status}</div>
                                    <div>上传时间: \${new Date(video.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        \`;
                    });
                    document.getElementById('videosList').innerHTML = html;
                } else {
                    document.getElementById('videosList').innerHTML = 
                        '<div class="empty">暂无视频，上传一个试试吧！</div>';
                }
            } catch (error) {
                document.getElementById('videosList').innerHTML = 
                    \`<div class="empty">❌ 加载失败: \${error.message}</div>\`;
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

export default {
  async fetch(request: Request, env: any, _ctx: any) {
    try {
      const url = new URL(request.url);
      
      // Serve HTML at root
      if (url.pathname === '/') {
        return new Response(HTML_CONTENT, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
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
