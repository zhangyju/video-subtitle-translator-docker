# Phase 5 R2 存储迁移指南

## 📋 概述

本指南说明如何从本地存储迁移到 Cloudflare R2，包括数据迁移、配置更新和验证步骤。

## 🔄 迁移流程

```
本地存储 (/tmp/uploads)
    ↓
R2 存储 (video-subtitle-bucket)
    ↓
验证和测试
    ↓
生产部署
```

## 📊 迁移前检查

### 1. 备份现有数据

```bash
# 备份本地视频文件
tar -czf videos-backup-$(date +%Y%m%d).tar.gz /tmp/uploads/

# 备份数据库
cp .wrangler/state/v3/d1/video-subtitle-db.sqlite ./db-backup-$(date +%Y%m%d).sqlite

# 备份配置
cp wrangler.toml wrangler.toml.backup
cp src/server.ts src/server.ts.backup
```

### 2. 检查现有数据

```bash
# 统计现有视频
sqlite3 db/db.sqlite3 "SELECT COUNT(*), SUM(file_size) / 1024 / 1024 / 1024 FROM videos;"

# 列出所有视频
sqlite3 db/db.sqlite3 "SELECT id, title, file_size, created_at FROM videos;"
```

## 🛠️ 迁移步骤

### 步骤 1: 更新 wrangler.toml

确保 R2 bucket 已配置：

```toml
# wrangler.toml

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "video-subtitle-bucket"
preview_bucket_name = "video-subtitle-bucket-preview"

[[routes]]
pattern = "r2.myzhangyujie.com/*"
zone_name = "myzhangyujie.com"
```

### 步骤 2: 创建 R2 Bucket

```bash
# 创建生产 R2 存储桶
wrangler r2 bucket create video-subtitle-bucket

# 验证创建成功
wrangler r2 bucket list
```

### 步骤 3: 更新 D1 数据库 Schema

添加 R2 相关字段（如果还未添加）：

```sql
-- 添加 R2 URL 和密钥字段
ALTER TABLE videos ADD COLUMN r2_url TEXT;
ALTER TABLE videos ADD COLUMN r2_key TEXT;

-- 验证字段添加成功
PRAGMA table_info(videos);
```

### 步骤 4: 部署更新的代码

```bash
# 确保代码包含 R2StorageService
git add src/index.ts src/server.ts src/r2-service.ts

# 部署到 Cloudflare Workers
wrangler deploy
```

### 步骤 5: 迁移现有视频（可选）

如果有大量现有视频需要迁移到 R2，可以运行迁移脚本。

**创建迁移脚本：**

```typescript
// migrate-to-r2.ts
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';

const db = createClient({ url: 'file:./.wrangler/state/v3/d1/video-subtitle-db.sqlite' });

async function migrateVideosToR2() {
  try {
    // 1. 获取所有视频
    const result = await db.execute({
      sql: 'SELECT id, user_id, file_size FROM videos WHERE r2_url IS NULL'
    });

    console.log(`找到 ${result.rows.length} 个需要迁移的视频`);

    // 2. 对每个视频调用 R2 上传
    for (const video of result.rows) {
      const videoId = video.id as string;
      const userId = video.user_id as string;

      console.log(`迁移视频: ${videoId}`);

      // 在这里实现实际的迁移逻辑
      // 例如：从本地读取文件，上传到 R2，更新数据库
    }

    console.log('迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
  }
}

migrateVideosToR2();
```

**运行迁移脚本：**

```bash
npx ts-node migrate-to-r2.ts
```

### 步骤 6: 验证迁移

```bash
# 检查 R2 存储桶中的文件
wrangler r2 bucket list video-subtitle-bucket

# 验证数据库中的 R2 URL
sqlite3 db/db.sqlite3 "SELECT COUNT(*), COUNT(r2_url) FROM videos;"

# 两个 COUNT 值应该相等（如果所有视频都已迁移）
```

## 🧪 测试迁移

### 1. 本地测试

```bash
# 启动开发服务器
npm run dev

# 测试新上传
curl -F "file=@test-video.mp4" \
  -H "x-user-id: test-user" \
  http://localhost:3000/api/upload

# 验证文件在 R2 中
ls /tmp/r2-storage/users/test-user/videos/
```

### 2. 访问已迁移的视频

```bash
# 获取视频详情
curl http://localhost:3000/api/watch/VIDEO_ID

# 验证返回的 r2Url
# 应该类似: https://r2.myzhangyujie.com/users/.../original.mp4
```

### 3. 字幕验证

```bash
# 转录一个测试视频
# 观察日志中的字幕上传到 R2

# 验证字幕文件
curl http://localhost:3000/api/subtitles/VIDEO_ID/zh
```

## 📋 迁移检查清单

### 准备阶段

- [ ] 备份所有现有数据（视频、数据库、配置）
- [ ] 检查磁盘空间（R2 需要足够的临时空间）
- [ ] 验证 API 配额（Cloudflare R2 配额）
- [ ] 准备回滚计划

### 配置阶段

- [ ] 更新 wrangler.toml
- [ ] 创建 R2 Bucket
- [ ] 配置 DNS CNAME
- [ ] 连接自定义域名

### 代码更新

- [ ] 更新 R2StorageService
- [ ] 更新上传端点
- [ ] 更新播放端点
- [ ] 更新字幕端点
- [ ] 添加错误处理

### 测试阶段

- [ ] 本地测试新上传
- [ ] 测试视频播放
- [ ] 测试字幕生成
- [ ] 测试缓存
- [ ] 压力测试

### 部署阶段

- [ ] 在 staging 环境测试
- [ ] 监控错误日志
- [ ] 验证性能指标
- [ ] 切换生产流量

### 迁移后

- [ ] 验证所有视频可访问
- [ ] 监控 R2 成本
- [ ] 清理本地存储
- [ ] 更新文档

## 🔄 回滚计划

如果迁移出现问题，可以快速回滚到本地存储：

### 回滚步骤

```bash
# 1. 停止使用 R2
# 编辑 src/server.ts，禁用 R2 上传

# 2. 恢复备份
cp db-backup-*.sqlite .wrangler/state/v3/d1/video-subtitle-db.sqlite
cp wrangler.toml.backup wrangler.toml

# 3. 重新部署
wrangler deploy

# 4. 验证本地存储工作正常
npm run dev
```

### 回滚验证

```bash
# 测试本地上传
curl -F "file=@test.mp4" http://localhost:3000/api/upload

# 验证文件存在于本地
ls /tmp/uploads/
```

## 📈 迁移性能优化

### 1. 分批迁移

如果有大量视频，分批迁移可以避免超时：

```typescript
const BATCH_SIZE = 10;

for (let i = 0; i < videos.length; i += BATCH_SIZE) {
  const batch = videos.slice(i, i + BATCH_SIZE);
  
  await Promise.all(
    batch.map(video => migrateVideo(video))
  );

  console.log(`已迁移 ${i + BATCH_SIZE} / ${videos.length}`);
  
  // 等待一下，避免速率限制
  await sleep(1000);
}
```

### 2. 并发上传

使用并发上传加速迁移：

```typescript
const concurrency = 5;
const pLimit = require('p-limit');
const limit = pLimit(concurrency);

const uploads = videos.map(video =>
  limit(() => migrateVideo(video))
);

await Promise.all(uploads);
```

### 3. 重试机制

实现重试机制处理临时失败：

```typescript
async function uploadWithRetry(
  videoId: string,
  fileData: Buffer,
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await r2Service.uploadVideo(videoId, fileData);
      return true;
    } catch (error) {
      console.error(`尝试 ${attempt + 1} 失败: ${error}`);
      
      if (attempt < maxRetries - 1) {
        // 指数退避
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  
  return false;
}
```

## 🔒 安全考虑

### 1. 访问控制

```typescript
// 确保 R2 文件公开可读，但上传需要认证
if (url.pathname.startsWith('/r2/')) {
  // 公开读取
  return serveFromR2(key);
} else if (url.pathname === '/api/upload') {
  // 上传需要认证
  if (!authenticateUser(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

### 2. 数据加密

Cloudflare R2 支持 SSE 加密：

```toml
# wrangler.toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "video-subtitle-bucket"
# SSE 配置（可选，默认启用）
```

### 3. 访问日志

启用 R2 访问日志用于审计：

```typescript
// 在 Cloudflare 仪表板启用日志
// 然后可以导出到 Logpush
```

## 📊 成本分析

### 迁移前成本

- 本地存储：免费（使用服务器磁盘）
- 但需要考虑：
  - 服务器维护成本
  - 备份成本
  - 带宽成本

### 迁移后成本

- R2 存储：$0.015/GB/月
- API 请求：$0.36 每百万请求
- 下载带宽：免费（通过 CDN）

### 成本比较示例

```
假设：10TB 存储，月均 100M API 请求

R2 月成本：
  存储: 10000 GB × $0.015 = $150
  API: 100M × $0.36/M = $36
  总计：$186

本地服务器月成本（估计）：
  服务器租赁：$200-500
  带宽：可能很高（如果有大量下载）
  维护：$100+
  总计：$300+

结论：R2 通常更便宜，特别是考虑到免费的 CDN 下载
```

## 🚀 生产部署

### 1. 预部署检查

```bash
# 运行所有测试
npm test

# 编译检查
npx tsc --noUnusedLocals false

# 代码审查
git diff wrangler.toml src/
```

### 2. 部署到 staging

```bash
# 在 staging 环境测试
wrangler deploy --env staging

# 运行集成测试
npm run test:integration
```

### 3. 生产部署

```bash
# 生产部署
wrangler deploy --env production

# 验证部署
curl https://subtitle.myzhangyujie.com/api/health
```

### 4. 部署后验证

```bash
# 监控日志
wrangler tail

# 检查错误率
# 在 Cloudflare 仪表板查看

# 验证性能
# 检查 R2 API 请求数和成本
```

## 📞 故障排查

### 问题：迁移速度慢

**原因：** API 速率限制或网络延迟

**解决：**
- 减少并发数
- 增加重试延迟
- 分批处理

### 问题：上传失败

**原因：** 文件太大或网络中断

**解决：**
- 使用分片上传
- 实现重试机制
- 增加超时时间

### 问题：成本高于预期

**原因：** 频繁的 API 调用

**解决：**
- 启用缓存
- 减少不必要的请求
- 使用 API 聚合

## ✅ 迁移完成标志

- ✅ R2 Bucket 已创建
- ✅ DNS 已配置
- ✅ 代码已更新并部署
- ✅ 新上传到 R2 正常工作
- ✅ 字幕上传到 R2 正常工作
- ✅ 所有视频可从 R2 访问
- ✅ CDN 缓存工作正常
- ✅ 成本在预期范围内
- ✅ 监控和告警已配置

## 📚 参考资源

- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [R2 数据迁移指南](https://developers.cloudflare.com/r2/migration/)
- [成本优化指南](https://developers.cloudflare.com/r2/cost-optimization/)
