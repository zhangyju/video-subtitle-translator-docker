# Phase 5: R2 视频存储集成

## 🎬 概述

将视频上传从本地存储迁移到 Cloudflare R2，启用全球 CDN 交付。

## 🏗️ 架构设计

### 上传流程

```
浏览器
   ↓ (视频文件)
Worker /api/upload
   ↓ (signed URL)
R2 Bucket
   ↓ (存储)
Cloudflare CDN
   ↓ (全球交付)
浏览器 (播放)
```

### 存储结构

```
R2 Bucket: video-subtitle-bucket

目录结构:
/users/{userId}/
  └─ videos/{videoId}/
      ├─ original.{ext}        (原始视频文件)
      ├─ metadata.json         (视频元数据)
      └─ subtitles/
          ├─ zh.vtt
          ├─ en.vtt
          └─ ...
```

## 🔧 实现步骤

### Step 1: R2 存储桶配置

```toml
# wrangler.toml
[[r2_buckets]]
binding = "VIDEOS"
bucket_name = "video-subtitle-bucket"
jurisdiction = "eu"  # 根据需要选择
```

### Step 2: 创建 R2 管理类

```typescript
class R2StorageService {
  constructor(env: Env) {
    this.bucket = env.VIDEOS;
  }

  /**
   * 生成上传签名 URL
   */
  async generateUploadUrl(
    userId: string,
    videoId: string,
    fileExtension: string
  ): Promise<string> {
    const key = `users/${userId}/videos/${videoId}/original.${fileExtension}`;
    
    // 在生产环境中使用签名 URL
    // 此处简化为直接上传
    return `/api/r2/upload?key=${key}`;
  }

  /**
   * 上传视频文件到 R2
   */
  async uploadVideo(
    key: string,
    fileData: ArrayBuffer,
    contentType: string
  ): Promise<{url: string; key: string}> {
    await this.bucket.put(key, fileData, {
      httpMetadata: {
        contentType,
        cacheControl: 'max-age=31536000', // 1 年缓存
      }
    });

    return {
      key,
      url: `https://r2.myzhangyujie.com/${key}`
    };
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
    
    await this.bucket.put(key, vttContent, {
      httpMetadata: {
        contentType: 'text/vtt',
        cacheControl: 'max-age=86400' // 1 天缓存
      }
    });

    return `https://r2.myzhangyujie.com/${key}`;
  }

  /**
   * 获取视频 URL
   */
  getVideoUrl(userId: string, videoId: string): string {
    return `https://r2.myzhangyujie.com/users/${userId}/videos/${videoId}/original.mp4`;
  }

  /**
   * 删除视频（用户删除时）
   */
  async deleteVideo(userId: string, videoId: string): Promise<void> {
    const prefix = `users/${userId}/videos/${videoId}/`;
    
    // 删除所有相关文件
    const objects = await this.bucket.list({ prefix });
    
    for (const object of objects.objects) {
      await this.bucket.delete(object.key);
    }
  }
}
```

### Step 3: 更新上传端点

```typescript
// 在 Express server 中
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const file = req.file!;
    
    // 1. 保存到数据库
    const videoId = uuidv4();
    await db.prepare(
      'INSERT INTO videos (id, user_id, ...) VALUES (...)'
    ).run();

    // 2. 上传到 R2
    const fileExtension = file.originalname.split('.').pop() || 'mp4';
    const r2Service = new R2StorageService(env);
    
    const fileBuffer = fs.readFileSync(file.path);
    const {url: r2Url, key: r2Key} = await r2Service.uploadVideo(
      `users/${userId}/videos/${videoId}/original.${fileExtension}`,
      fileBuffer,
      file.mimetype
    );

    // 3. 更新数据库的 R2 字段
    await db.prepare(
      'UPDATE videos SET r2_url = ?, r2_key = ? WHERE id = ?'
    ).bind(r2Url, r2Key, videoId).run();

    // 4. 清理本地文件
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      data: {
        id: videoId,
        r2_url: r2Url,
        status: 'processing'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Step 4: CDN 配置

```toml
# wrangler.toml - 配置 R2 CDN
[env.production]
routes = [
  { pattern = "r2.myzhangyujie.com/*", zone_name = "myzhangyujie.com" }
]
```

### Step 5: 视频播放时从 R2 获取

```typescript
// /api/watch/:videoId
const video = await db.prepare(
  'SELECT r2_url FROM videos WHERE id = ?'
).bind(videoId).first() as any;

res.json({
  success: true,
  data: {
    videoUrl: video.r2_url,  // R2 CDN URL
    // ... 其他数据
  }
});
```

## 📊 存储成本估算

基于 Cloudflare R2 定价（2024年）:

| 操作 | 价格 | 月均成本 |
|------|------|---------|
| 存储 | $0.015/GB | $150 (10TB) |
| API 请求 | $0.36/百万 | $36 (100M) |
| 下载带宽 | 免费 (CDN) | $0 |

**总月成本:** ~$186 (10TB存储)

## 🔒 安全配置

```typescript
// CORS 配置
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://subtitle.myzhangyujie.com',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// 限制 R2 访问
// 1. 只读公开文件
// 2. 上传需要认证
// 3. 删除需要管理员权限
```

## 📋 检查清单

- [ ] 配置 R2 存储桶
- [ ] 实现 R2StorageService 类
- [ ] 更新上传端点
- [ ] 配置 CDN 缓存策略
- [ ] 实现视频删除逻辑
- [ ] 添加 CORS 头
- [ ] 测试上传和下载
- [ ] 监控存储成本

## 🚀 部署

```bash
# 创建 R2 存储桶
wrangler r2 bucket create video-subtitle-bucket

# 部署
wrangler deploy

# 测试上传
curl -F "file=@video.mp4" \
     -H "x-user-id: user123" \
     https://subtitle.myzhangyujie.com/api/upload
```

## 📈 性能优化

1. **分片上传** - 大文件使用多部分上传
2. **压缩** - 在存储前压缩视频
3. **缓存策略** - 根据文件类型设置不同的 TTL
4. **带宽优化** - 使用 WebP/H.265 等现代格式

