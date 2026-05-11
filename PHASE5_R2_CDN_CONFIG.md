# Phase 5 R2 CDN 和缓存配置

## 📋 概述

本文档说明如何配置 Cloudflare R2 存储桶的 CDN 缓存策略和优化视频及字幕的交付性能。

## 🔧 缓存策略

### 1. 视频文件缓存

**配置：** `max-age=31536000` (1 年)

```typescript
// src/index.ts - R2StorageService
await this.bucket.put(key, fileData, {
  httpMetadata: {
    contentType: 'video/mp4',
    cacheControl: 'max-age=31536000', // 1 年缓存
  }
});
```

**理由：**
- 视频文件内容通常不会改变
- 长期缓存可以显著降低带宽成本
- 用户的浏览器会缓存文件，加快重播速度
- 如果需要更新，可以通过版本号或新 URL 实现

### 2. 字幕文件缓存

**配置：** `max-age=86400` (1 天)

```typescript
// 字幕可能会被修正或更新
await this.bucket.put(key, vttContent, {
  httpMetadata: {
    contentType: 'text/vtt',
    cacheControl: 'max-age=86400', // 1 天缓存
  }
});
```

**理由：**
- 字幕可能需要定期修正
- 更短的缓存时间允许快速更新
- 字幕文件通常很小，CDN 缓存命中率很高

### 3. 元数据文件缓存

**配置：** `max-age=3600` (1 小时)

```typescript
// 元数据可能会频繁更新
await this.bucket.put(key, jsonContent, {
  httpMetadata: {
    contentType: 'application/json',
    cacheControl: 'max-age=3600', // 1 小时缓存
  }
});
```

**理由：**
- 元数据（标题、描述、标签等）可能会被更新
- 1 小时的缓存提供了性能和新鲜度的平衡

## 🌐 CDN 配置

### 1. 域名配置

在 `wrangler.toml` 中配置 R2 CDN 域名：

```toml
# wrangler.toml

[[routes]]
pattern = "r2.myzhangyujie.com/*"
zone_name = "myzhangyujie.com"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "video-subtitle-bucket"
preview_bucket_name = "video-subtitle-bucket-preview"
```

### 2. Cloudflare DNS 配置

在 Cloudflare 仪表板中配置 CNAME：

```
记录类型: CNAME
名称: r2
内容: video-subtitle-bucket.YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
代理状态: 已代理 (橙色)
```

### 3. R2 自定义域名

**使用 R2 自定义域名连接 Cloudflare CDN：**

1. 在 Cloudflare 仪表板中打开 R2
2. 选择 `video-subtitle-bucket`
3. 点击 `Domain` 选项卡
4. 选择 `Connect a custom domain`
5. 输入 `r2.myzhangyujie.com`

## 📊 URL 结构

### 视频 URL 格式

```
https://r2.myzhangyujie.com/users/{userId}/videos/{videoId}/original.{ext}

示例:
https://r2.myzhangyujie.com/users/user-123/videos/video-456/original.mp4
```

### 字幕 URL 格式

```
https://r2.myzhangyujie.com/videos/{videoId}/subtitles/{language}.vtt

示例:
https://r2.myzhangyujie.com/videos/video-456/subtitles/zh.vtt
https://r2.myzhangyujie.com/videos/video-456/subtitles/en.vtt
```

### 元数据 URL 格式

```
https://r2.myzhangyujie.com/users/{userId}/videos/{videoId}/metadata.json

示例:
https://r2.myzhangyujie.com/users/user-123/videos/video-456/metadata.json
```

## ⚙️ 性能优化

### 1. 压缩

Cloudflare CDN 自动进行以下压缩：
- HTML/CSS/JS: Gzip 或 Brotli
- 文本文件（VTT）: Gzip 或 Brotli
- 视频: 不压缩（已压缩格式）

### 2. 缓存键自定义

如果需要基于查询参数缓存不同版本：

```typescript
// 在返回 R2 URL 时添加版本参数
const videoUrl = `${this.baseUrl}/${key}?v=${timestamp}`;
```

### 3. 地理位置优化

Cloudflare 会自动将内容缓存在全球 200+ 个数据中心，无需额外配置。

## 🔒 安全和访问控制

### 1. 公开文件

视频和字幕文件应该是公开可访问的：

```typescript
// R2 自动允许公开读取
// 通过 https://r2.myzhangyujie.com/ 访问即可
```

### 2. 限制访问

如果需要限制访问，可以使用 Cloudflare Workers 添加身份验证：

```typescript
// src/index.ts
if (url.pathname.startsWith('/r2/')) {
  // 验证用户权限
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // 从 R2 获取文件
  const bucket = env.R2_BUCKET;
  const object = await bucket.get(key);
  return new Response(object.body);
}
```

### 3. CORS 配置

如果需要在第三方网站上嵌入视频，配置 CORS：

```typescript
// 返回 CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

## 📈 成本分析

### R2 存储成本

基于 Cloudflare R2 定价（2024年）：

| 项目 | 价格 | 月均成本（10TB） |
|------|------|------------------|
| 存储 | $0.015/GB | $150 |
| API 请求 | $0.36/百万 | $36（100M请求）|
| 下载带宽 | 免费（CDN） | $0 |
| **总计** | | **$186/月** |

### 成本优化建议

1. **启用智能分层存储** - 自动将不常访问的文件移至更便宜的存储层
2. **压缩视频** - 使用 H.265 或 VP9 编码减小文件大小
3. **删除过期文件** - 定期清理不需要的视频
4. **使用 CDN 缓存** - 长期缓存可减少 API 调用

## 🧪 测试缓存配置

### 1. 检查缓存头

```bash
curl -I https://r2.myzhangyujie.com/users/user-123/videos/video-456/original.mp4

# 查看响应头
# Cache-Control: public, max-age=31536000
# CF-Cache-Status: HIT
```

### 2. 查看缓存统计

在 Cloudflare 仪表板：
1. 进入 Analytics 选项卡
2. 查看 Cache 部分
3. 监控 Hit Rate 和 Bandwidth Saved

### 3. 测试字幕缓存

```bash
curl -I https://r2.myzhangyujie.com/videos/video-456/subtitles/zh.vtt

# 查看缓存状态
# CF-Cache-Status: HIT（缓存命中）
# CF-Cache-Status: MISS（缓存未命中，首次访问）
```

## 🔄 缓存失效策略

### 1. 自动失效（推荐）

使用不同的 URL 或版本号：

```typescript
// 方式 1: 时间戳版本
const videoUrl = `${this.baseUrl}/${key}?v=${Date.now()}`;

// 方式 2: 内容哈希版本
const videoUrl = `${this.baseUrl}/${key}?v=${contentHash}`;

// 方式 3: 语义版本
const videoUrl = `${this.baseUrl}/${key}?v=1.2.3`;
```

### 2. 手动失效

使用 Cloudflare API 清除缓存：

```bash
# 清除特定 URL 的缓存
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://r2.myzhangyujie.com/videos/video-456/subtitles/zh.vtt"]}'

# 清除所有缓存
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## 📊 监控和分析

### 1. Cloudflare Analytics

在 Cloudflare 仪表板查看：
- 缓存命中率
- 带宽节省
- 地理位置流量分布
- 请求速率

### 2. 自定义日志

使用 Cloudflare Logpush 导出详细日志：

```typescript
// 记录 R2 访问
console.log(`[R2] ${videoId} accessed from ${country}, cache: ${cacheStatus}`);
```

## 🚀 部署步骤

### 1. 配置 wrangler.toml

```toml
[[routes]]
pattern = "r2.myzhangyujie.com/*"
zone_name = "myzhangyujie.com"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "video-subtitle-bucket"
```

### 2. 创建 R2 存储桶

```bash
wrangler r2 bucket create video-subtitle-bucket
```

### 3. 配置 DNS

在 Cloudflare 仪表板添加 CNAME：
```
r2  CNAME  video-subtitle-bucket.YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

### 4. 连接自定义域名

在 R2 设置中选择 `r2.myzhangyujie.com`

### 5. 部署代码

```bash
wrangler deploy
```

## 🔍 故障排查

### 问题 1: 404 Not Found

**原因：** 文件不存在或路径错误

**解决：**
```bash
# 检查文件是否存在
wrangler r2 bucket list video-subtitle-bucket

# 检查路径格式
# 应该是: users/{userId}/videos/{videoId}/original.mp4
# 不应该有双斜杠或特殊字符
```

### 问题 2: 缓存问题

**现象：** 文件已更新但旧版本仍被提供

**解决：**
```bash
# 方案 1: 清除缓存
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://r2.myzhangyujie.com/path/to/file"]}'

# 方案 2: 使用版本参数
https://r2.myzhangyujie.com/path/to/file?v=2
```

### 问题 3: CORS 错误

**现象：** 在网页上嵌入视频时出现 CORS 错误

**解决：**
```typescript
// 在 Worker 中添加 CORS 头
const response = new Response(body);
response.headers.set('Access-Control-Allow-Origin', '*');
return response;
```

## 📚 参考资源

- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [R2 API 文档](https://developers.cloudflare.com/r2/api/s3/api/)
- [CDN 缓存规则](https://developers.cloudflare.com/cache/concepts/cache-control/)
- [Cache-Control 头说明](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)

## ✅ 完成清单

- [ ] 配置 wrangler.toml R2 bucket
- [ ] 创建 R2 存储桶
- [ ] 配置 DNS CNAME
- [ ] 连接自定义域名
- [ ] 部署 R2StorageService
- [ ] 测试视频上传和访问
- [ ] 验证缓存工作正常
- [ ] 监控成本和性能
- [ ] 配置缓存失效策略
- [ ] 设置日志和分析
