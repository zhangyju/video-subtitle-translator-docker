import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  CONTAINER: any;
  AI: any;
  DB: any;
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

  // 验证 email
  if (path === '/api/auth/verify' && request.method === 'POST') {
    return await handleVerifyEmail(request, env);
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: userId,
          email,
          message: 'Registration successful. Please verify your email.'
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

async function handleVerifyEmail(request: Request, env: Env) {
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
    const { videoId, filePath, languages, title } = await request.json() as any;

    if (!videoId || !filePath) {
      return new Response(JSON.stringify({ success: false, error: 'Missing parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Worker] Transcribing video ${videoId}: ${title}`);

    // Read file from container storage
    const fileContent = await fetch(`http://localhost:3000/api/get-file/${videoId}`, {
      method: 'GET'
    });

    if (!fileContent.ok) {
      throw new Error('Failed to fetch file from container');
    }

    const arrayBuffer = await fileContent.arrayBuffer();
    const audioArray = Array.from(new Uint8Array(arrayBuffer));

    // Step 1: Transcribe with Cloudflare AI Whisper
    console.log(`[Worker] Running Whisper transcription`);
    const whisperResponse = await env.AI.run('@cf/openai/whisper', {
      audio: audioArray,
    }) as any;

    const transcript = whisperResponse.result?.text || '';
    const detectedLanguage = whisperResponse.result?.language || 'en';

    console.log(`[Worker] Transcription complete: ${transcript.length} chars, detected language: ${detectedLanguage}`);

    // Step 2: Generate VTT for original language
    const subtitles: Record<string, string> = {};
    subtitles[detectedLanguage] = generateVTT(transcript);

    // Step 3: Translate to other languages
    console.log(`[Worker] Translating to ${languages.length} languages`);
    for (const lang of languages) {
      if (lang !== detectedLanguage) {
        try {
          const translationResponse = await env.AI.run('@cf/meta/m2m100-1.2b', {
            text: transcript,
            source_lang: detectedLanguageToM2M(detectedLanguage),
            target_lang: languageCodeToM2M(lang)
          }) as any;

          const translatedText = translationResponse.result?.translated_text || transcript;
          subtitles[lang] = generateVTT(translatedText);
          console.log(`[Worker] Translated to ${lang}`);
        } catch (err) {
          console.error(`[Worker] Translation error for ${lang}:`, err);
          // Fallback: use original transcript
          subtitles[lang] = generateVTT(transcript);
        }
      }
    }

    // Step 4: Send back to Container to store
    console.log(`[Worker] Sending results to Container`);
    const storeResponse = await fetch('http://localhost:3000/api/store-transcript/' + videoId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        subtitles
      })
    });

    if (!storeResponse.ok) {
      console.error('[Worker] Failed to store transcript');
      throw new Error('Failed to store transcript in container');
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        videoId,
        title,
        transcript,
        subtitles
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Worker Transcription Error]', error);
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
