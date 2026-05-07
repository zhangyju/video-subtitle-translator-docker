import { videosHandler } from './routes/videos';
import { uploadHandler } from './routes/upload';
import { subtitleHandler } from './routes/subtitles';
import { translateHandler } from './routes/translate';
import { metricsHandler } from './routes/metrics';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Subtitle Translator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background: #f5f5f5; }
    .app { display: flex; flex-direction: column; height: 100vh; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
    .nav { display: flex; gap: 10px; margin-top: 10px; }
    .nav button { background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .nav button:hover { background: rgba(255,255,255,0.3); }
    .nav button.active { background: rgba(255,255,255,0.4); }
    .main { flex: 1; padding: 20px 30px; overflow-y: auto; }
    .page { display: none; }
    .page.active { display: block; }
    .upload-area { background: white; border-radius: 8px; padding: 30px; text-align: center; border: 2px dashed #667eea; cursor: pointer; margin-bottom: 20px; transition: all 0.3s; }
    .upload-area:hover { border-color: #764ba2; background: #f9f8ff; }
    .upload-area.dragover { border-color: #667eea; background: #f0f0ff; }
    .upload-area input { display: none; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
    .form-group input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .form-group input:focus { outline: none; border-color: #667eea; }
    .languages { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 15px; }
    .lang-checkbox { display: flex; align-items: center; padding: 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0; }
    .lang-checkbox:hover { border-color: #667eea; }
    .lang-checkbox input { margin-right: 8px; cursor: pointer; }
    .lang-checkbox label { margin: 0; cursor: pointer; flex: 1; }
    .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { margin: 0 0 15px 0; font-size: 18px; color: #333; }
    .alert-success { background: #e8f5e9; border-left: 4px solid #4caf50; color: #2e7d32; padding: 12px; border-radius: 4px; margin-bottom: 15px; }
    .alert-error { background: #ffebee; border-left: 4px solid #f44336; color: #c62828; padding: 12px; border-radius: 4px; margin-bottom: 15px; }
     .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
     .video-card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
     .video-title { font-weight: 600; color: #333; margin-bottom: 8px; }
     .video-info { font-size: 12px; color: #666; }
     .progress-container { margin-top: 20px; display: none; }
     .progress-container.active { display: block; }
     .progress-item { margin-bottom: 15px; }
     .progress-label { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 6px; display: flex; justify-content: space-between; }
     .progress-bar { background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden; }
     .progress-fill { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; transition: width 0.3s ease; }
     .language-progress { margin-left: 10px; margin-top: 10px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
     .language-progress-item { margin-bottom: 10px; font-size: 12px; }
     .completion-message { color: #4caf50; font-weight: 600; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="app">
    <div class="header">
      <h1>🎬 Video Subtitle Translator</h1>
      <div class="nav">
        <button class="nav-btn active" onclick="showPage(event,'upload')">⬆️ Upload</button>
        <button class="nav-btn" onclick="showPage(event,'videos')">📺 Videos</button>
      </div>
    </div>
    <div class="main">
      <div class="page active" id="upload">
        <div class="card">
          <h2>Upload Video or Audio</h2>
          <div id="uploadMessage"></div>
          <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()" ondrop="handleDrop(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
            <input type="file" id="fileInput" accept="video/*,audio/*" onchange="handleFileSelect(event)">
            <p style="font-size: 14px; color: #667eea; cursor: pointer;">📤 Click to upload or drag files here</p>
            <p style="font-size: 12px; color: #999; margin-top: 8px;">Supported: MP4, WebM, MP3, WAV, OGG (Max 100MB, recommended ≤50MB)</p>
          </div>
          <div class="form-group">
            <label>Video Title (Optional)</label>
            <input type="text" id="title" placeholder="Give your video a title">
          </div>
          <div class="form-group">
            <label>Target Languages</label>
            <div class="languages">
              <div class="lang-checkbox"><input type="checkbox" value="zh" id="zh" checked><label for="zh">Chinese</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="es" id="es" checked><label for="es">Spanish</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="fr" id="fr" checked><label for="fr">French</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="de" id="de"><label for="de">German</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="ja" id="ja"><label for="ja">Japanese</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="ko" id="ko"><label for="ko">Korean</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="pt" id="pt"><label for="pt">Portuguese</label></div>
              <div class="lang-checkbox"><input type="checkbox" value="ru" id="ru"><label for="ru">Russian</label></div>
            </div>
          </div>
           <button class="btn btn-primary" id="uploadBtn" onclick="uploadFile()">Upload & Process</button>
           <div class="progress-container" id="progressContainer">
             <div class="progress-item">
               <div class="progress-label">
                 <span>Uploading</span>
                 <span id="uploadProgress">0%</span>
               </div>
               <div class="progress-bar">
                 <div class="progress-fill" id="uploadBar" style="width: 0%"></div>
               </div>
             </div>
             <div class="progress-item">
               <div class="progress-label">
                 <span>Transcribing</span>
                 <span id="transcriptionProgress">0%</span>
               </div>
               <div class="progress-bar">
                 <div class="progress-fill" id="transcriptionBar" style="width: 0%"></div>
               </div>
             </div>
             <div class="progress-item" id="translationContainer" style="display: none;">
               <div class="progress-label">
                 <span>Translating</span>
               </div>
               <div id="languageProgressList" class="language-progress"></div>
             </div>
             <div class="completion-message" id="completionMessage" style="display: none;"></div>
           </div>
         </div>
       </div>
      <div class="page" id="videos">
        <div class="card">
          <h2>Your Videos</h2>
          <div id="videosList">Loading videos...</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    let currentVideoId=null,progressInterval=null,selectedLanguages=[],pollCount=0;
    function showPage(e,n){document.querySelectorAll('.page').forEach(t=>t.classList.remove('active')),document.getElementById(n).classList.add('active'),document.querySelectorAll('.nav-btn').forEach(t=>t.classList.remove('active')),e.target.classList.add('active'),'videos'===n&&loadVideos()}
    function handleDragOver(e){e.preventDefault(),document.getElementById('uploadArea').classList.add('dragover')}
    function handleDragLeave(e){e.preventDefault(),document.getElementById('uploadArea').classList.remove('dragover')}
    function handleDrop(e){e.preventDefault(),e.stopPropagation(),document.getElementById('uploadArea').classList.remove('dragover');const t=e.dataTransfer.files;t.length&&(document.getElementById('fileInput').files=t,handleFileSelect({target:{files:t}}))}
    function handleFileSelect(e){const t=e.target.files[0];if(t){const a=(t.size/1024/1024).toFixed(2);document.getElementById('uploadMessage').innerHTML='✅ Selected: '+t.name+' ('+a+'MB)'}}
    function updateProgress(e,t){const a=document.getElementById(e+'Bar'),o=document.getElementById(e+'Progress');a&&(a.style.width=t+'%'),o&&(o.textContent=t+'%')}
    function updateLanguageProgress(e,t){let a=document.getElementById('lang_'+e);a?a.querySelector('.lang-percent').textContent=t+'%':document.getElementById('languageProgressList').innerHTML+='<div class="language-progress-item" id="lang_'+e+'">'+e+': <span class="lang-percent">'+t+'%</span></div>'}
    function pollProgress(){if(!currentVideoId)return;fetch('/api/progress/'+currentVideoId).then(e=>e.text()).then(e=>{try{const t=JSON.parse(e);if(t.success){pollCount++;const a=t.data;console.log('Poll #'+pollCount,a);const o=a.status||'processing';if('uploading'===o)updateProgress('upload',50),updateProgress('transcription',0);else if('processing'===o)updateProgress('upload',100),a.transcribed?(updateProgress('transcription',90),document.getElementById('translationContainer').style.display='block',a.translationsCount>0&&selectedLanguages.forEach((e,t)=>{const i=Math.round((t+1)/selectedLanguages.length*100);updateLanguageProgress(e,i)})):updateProgress('transcription',50);else if('completed'===o)updateProgress('upload',100),updateProgress('transcription',100),selectedLanguages.forEach(e=>updateLanguageProgress(e,100)),document.getElementById('completionMessage').style.display='block',document.getElementById('completionMessage').textContent='✅ Completed!',clearInterval(progressInterval)}else console.log('API error:',t.error)}catch(t){console.error('JSON parse error:',e.substring(0,100))}}).catch(e=>console.error('Poll error:',e.message))}
    async function uploadFile(){const e=document.getElementById('fileInput').files[0];if(!e)return void alert('Please select file');const MAX_SIZE=100*1024*1024;if(e.size>MAX_SIZE){const t=(e.size/1024/1024).toFixed(1);return void alert('File too large ('+t+'MB). Max size is 100MB. For Cloudflare Workers, recommended max is 50MB.')}selectedLanguages=Array.from(document.querySelectorAll('.lang-checkbox input:checked')).map(e=>e.value);if(!selectedLanguages.length)return void alert('Select languages');const t=new FormData;t.append('file',e),t.append('title',document.getElementById('title').value||e.name),t.append('languages',JSON.stringify(selectedLanguages));try{document.getElementById('uploadBtn').disabled=!0,document.getElementById('uploadMessage').innerHTML='<div class="alert-success">⏳ Uploading '+e.name+'...</div>',document.getElementById('progressContainer').classList.add('active'),document.getElementById('translationContainer').style.display='none',document.getElementById('completionMessage').style.display='none',pollCount=0;const a=await fetch('/api/upload',{method:'POST',credentials:'include',body:t});console.log('Response status:',a.status);const o=await a.text();console.log('Response length:',o.length,'First chars:',o.substring(0,100));if(a.status!==201&&a.status!==200)return void(document.getElementById('uploadMessage').innerHTML='<div class="alert-error">❌ Server returned '+a.status+'</div>');try{const i=JSON.parse(o);if(i.success)currentVideoId=i.data.id,updateProgress('upload',25),progressInterval=setInterval(pollProgress,800),pollProgress(),console.log('✅ Video ID:',currentVideoId);else document.getElementById('uploadMessage').innerHTML='<div class="alert-error">❌ '+(i.error||'Upload failed')+'</div>',document.getElementById('progressContainer').classList.remove('active')}catch(e){console.error('Parse error:',e),document.getElementById('uploadMessage').innerHTML='<div class="alert-error">❌ Invalid response</div>',document.getElementById('progressContainer').classList.remove('active')}}catch(e){console.error('Error:',e),document.getElementById('uploadMessage').innerHTML='<div class="alert-error">❌ '+e.message+'</div>',document.getElementById('progressContainer').classList.remove('active')}finally{document.getElementById('uploadBtn').disabled=!1}}
    async function loadVideos(){try{const e=await fetch('/api/videos'),t=await e.json();if(t.data&&t.data.videos.length){let a='<div class="video-grid">';t.data.videos.forEach(e=>{a+='<div class="video-card"><div class="video-title">'+(e.title||'Untitled')+'</div><div class="video-info">Status: '+e.status+'</div></div>'}),a+='</div>',document.getElementById('videosList').innerHTML=a}else document.getElementById('videosList').innerHTML='No videos yet. Upload one!'}catch(e){document.getElementById('videosList').innerHTML='Error: '+e.message}}
  </script>
</body>
</html>`;
}

export default {
  fetch: async (request: Request, env: any, _ctx: any) => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // Serve frontend assets from R2
      if (pathname.startsWith('/assets/') || pathname === '/') {
        try {
          let r2Path: string;
          let contentType = 'application/octet-stream';
          
          if (pathname === '/') {
            r2Path = 'static/index.html';
            contentType = 'text/html; charset=utf-8';
          } else {
            r2Path = `static${pathname}`;
            if (pathname.endsWith('.js')) contentType = 'application/javascript';
            else if (pathname.endsWith('.css')) contentType = 'text/css';
            else if (pathname.endsWith('.map')) contentType = 'application/json';
          }
          
          const object = await env.R2_BUCKET.get(r2Path);
          if (object) {
            return new Response(object.body, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                ...corsHeaders
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching ${pathname}:`, error);
        }
        
        // Fallback to dashboard for root path
        if (pathname === '/') {
          return new Response(getDashboardHTML(), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
        
        return jsonResponse({ error: 'Asset not found' }, 404);
      }

      // Root path and non-API routes - serve SPA
      if (!pathname.startsWith('/api') && !pathname.startsWith('/health')) {
        const acceptHeader = request.headers.get('Accept') || '';
        
        // 如果明确要求JSON，返回API信息
        if (acceptHeader.includes('application/json')) {
          return jsonResponse({
            success: true,
            message: 'Video Subtitle Translator API',
            version: '1.0.0',
            endpoints: {
              health: 'GET /health',
              videos: {
                list: 'GET /api/videos',
                detail: 'GET /api/videos/:id',
                upload: 'POST /api/upload',
                delete: 'DELETE /api/videos/:id',
                subtitle: 'GET /api/videos/:id/subtitle',
                translate: 'POST /api/videos/:id/translate'
              }
            },
            app: 'https://subtitle.myzhangyujie.com/',
            documentation: 'https://github.com/yourusername/video-subtitle-translator'
          });
        }
        
        // 为 SPA 返回 HTML（带备用内容）
        return new Response(getDashboardHTML(), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Health check
      if (pathname === '/health') {
        return new Response('OK', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Upload handler
      if (method === 'POST' && pathname === '/api/upload') {
        const response = await uploadHandler(request, env, _ctx);
        // Add CORS headers
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      // Videos list
      if (method === 'GET' && pathname === '/api/videos') {
        const response = await videosHandler.list(request, env);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      // Videos detail and delete
      const videoDetailMatch = pathname.match(/^\/api\/videos\/([^/]+)$/);
      if (videoDetailMatch) {
        const videoId = videoDetailMatch[1];
        let response: Response;
        
        if (method === 'GET') {
          response = await videosHandler.detail(request, env, videoId);
        } else if (method === 'DELETE') {
          response = await videosHandler.delete(request, env, videoId);
        } else {
          return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
        }

        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      // Subtitles
      const subtitleMatch = pathname.match(/^\/api\/videos\/([^/]+)\/subtitle$/);
      if (method === 'GET' && subtitleMatch) {
        const videoId = subtitleMatch[1];
        const response = await subtitleHandler.get(request, env, videoId);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      // Translate
      const translateMatch = pathname.match(/^\/api\/videos\/([^/]+)\/translate$/);
      if (method === 'POST' && translateMatch) {
        const videoId = translateMatch[1];
        const response = await translateHandler.request(request, env, videoId);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      // Metrics routes
      if (method === 'GET' && pathname === '/api/metrics/history') {
        const response = await metricsHandler.history(request, env);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      if (method === 'GET' && pathname === '/api/metrics/stats') {
        const response = await metricsHandler.stats(request, env);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      if (method === 'GET' && pathname === '/api/metrics/performance') {
        const response = await metricsHandler.performance(request, env);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      if (method === 'GET' && pathname === '/api/metrics/analytics') {
        const response = await metricsHandler.analytics(request, env);
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        return newResponse;
      }

      // Progress polling endpoint - get video status
      const progressMatch = pathname.match(/^\/api\/progress\/([^/]+)$/);
      if (method === 'GET' && progressMatch) {
        const videoId = progressMatch[1];
        try {
          // Get video status and related info
          const video = await env.DB.prepare(
            'SELECT id, status, created_at FROM videos WHERE id = ?'
          ).bind(videoId).first() as any;
          
          if (!video) {
            return jsonResponse({ success: false, error: 'Video not found' }, 404);
          }
          
          let transcribed = false;
          let translationsCount = 0;
          
          try {
            const transcriptions = await env.DB.prepare(
              'SELECT COUNT(*) as count FROM transcriptions WHERE video_id = ?'
            ).bind(videoId).first() as any;
            transcribed = (transcriptions?.count || 0) > 0;
          } catch (e) {
            console.warn('Transcription query error:', e);
          }
          
          try {
            const translations = await env.DB.prepare(
              'SELECT COUNT(*) as count FROM translations WHERE video_id = ?'
            ).bind(videoId).first() as any;
            translationsCount = translations?.count || 0;
          } catch (e) {
            console.warn('Translation query error:', e);
          }
          
          return jsonResponse({
            success: true,
            data: {
              videoId,
              status: video.status,
              transcribed,
              translationsCount,
              createdAt: video.created_at
            }
          });
        } catch (error) {
          console.error('Progress query error:', error);
          return jsonResponse({ success: false, error: 'Failed to get progress' }, 500);
        }
      }

      // File download from R2
      const fileMatch = pathname.match(/^\/api\/r2\/(.+)$/);
      if (method === 'GET' && fileMatch) {
        const filePath = fileMatch[1];
        try {
          const object = await env.R2_BUCKET.get(filePath);
          if (!object) {
            return jsonResponse({ success: false, error: 'File not found' }, 404);
          }

          // Determine content type
          let contentType = 'application/octet-stream';
          if (filePath.endsWith('.mp4')) contentType = 'video/mp4';
          else if (filePath.endsWith('.webm')) contentType = 'video/webm';
          else if (filePath.endsWith('.mp3')) contentType = 'audio/mpeg';
          else if (filePath.endsWith('.wav')) contentType = 'audio/wav';
          else if (filePath.endsWith('.ogg')) contentType = 'audio/ogg';
          else if (filePath.endsWith('.vtt')) contentType = 'text/vtt';

          return new Response(object.body, {
            headers: {
              ...corsHeaders,
              'Content-Type': contentType,
              'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
              'Cache-Control': 'max-age=86400',
            },
          });
        } catch (error) {
          return jsonResponse({ success: false, error: 'Failed to retrieve file' }, 500);
        }
      }

      // 404 - Let Wrangler's static site serving handle non-API requests
      return jsonResponse({ success: false, error: 'Not Found' }, 404);
    } catch (error: any) {
      console.error('Error:', error?.message || error);
      return jsonResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  },
};
