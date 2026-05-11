# Phase 5 R2 存储测试指南

## 🎯 测试范围

验证以下功能是否正常工作：
1. ✅ 视频文件上传到 R2
2. ✅ 字幕文件上传到 R2
3. ✅ R2 URL 生成正确
4. ✅ 视频播放时从 R2 获取文件
5. ✅ CDN 缓存工作正常
6. ✅ 存储空间使用追踪

## 🧪 本地测试步骤

### 前置条件

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 查看 wrangler.toml 配置
cat wrangler.toml | grep -A 5 r2_buckets
```

### 步骤 1: 启动本地开发环境

```bash
# 启动本地 D1 数据库和 Worker
npm run dev

# 输出示例：
# ⛅️  wrangler 3.x.x
# ▲ [wrangler:dev] Starting local server...
# ✓ Ready on http://localhost:8787
```

### 步骤 2: 测试上传端点

在另一个终端中执行上传测试：

```bash
# 使用本地测试视频文件
curl -F "file=@sample-video.mp4" \
  -F "title=Test Video" \
  -F "languages=[\"zh\",\"en\"]" \
  -H "x-user-id: test-user-123" \
  http://localhost:3000/api/upload

# 预期响应：
# {
#   "success": true,
#   "data": {
#     "id": "video-uuid",
#     "title": "Test Video",
#     "fileSize": 12345678,
#     "status": "processing",
#     "languages": ["zh", "en"]
#   }
# }
```

### 步骤 3: 验证 R2 文件上传

在 /tmp/r2-storage 中检查文件是否被创建（MockR2StorageService）：

```bash
# 检查视频文件
ls -la /tmp/r2-storage/users/test-user-123/videos/

# 预期输出：
# -rw-r--r--  1 user  staff  12345678 May 11 21:00 original.mp4

# 检查元数据
ls -la /tmp/r2-storage/users/test-user-123/videos/VIDEO_ID/
```

### 步骤 4: 验证 R2 URL 生成

检查返回的 R2 URL 格式：

```bash
# 从数据库查询视频记录
sqlite3 db/db.sqlite3 "SELECT id, r2_url FROM videos LIMIT 1;"

# 预期输出：
# video-uuid|http://localhost:3000/r2/users/test-user-123/videos/video-uuid/original.mp4
```

### 步骤 5: 测试视频播放端点

```bash
# 获取视频详情和 R2 URL
curl -H "x-user-id: test-user-123" \
  http://localhost:3000/api/watch/VIDEO_ID

# 预期响应：
# {
#   "success": true,
#   "data": {
#     "id": "video-uuid",
#     "title": "Test Video",
#     "status": "processing",
#     "r2Url": "http://localhost:3000/r2/users/test-user-123/videos/VIDEO_ID/original.mp4",
#     "availableSubtitles": ["zh", "en"],
#     "currentLanguage": "zh"
#   }
# }
```

### 步骤 6: 测试 R2 文件服务端点

```bash
# 通过 /r2/* 端点访问文件
curl -I http://localhost:3000/r2/users/test-user-123/videos/VIDEO_ID/original.mp4

# 预期响应头：
# HTTP/1.1 200 OK
# Content-Type: video/mp4
# Content-Length: 12345678
# Cache-Control: public, max-age=31536000
```

### 步骤 7: 测试字幕上传到 R2

监听 Worker 的转录过程。编辑 src/index.ts 中的 triggerTranscription 函数，确保字幕上传到 R2：

```bash
# 观察日志输出
npm run dev 2>&1 | grep -i "r2\|subtitle"

# 预期日志：
# [Worker] Uploading 2 subtitles to R2
# [Worker] Subtitle uploaded to R2: zh
# [Worker] Subtitle uploaded to R2: en
```

### 步骤 8: 验证字幕文件

```bash
# 检查字幕是否存在于 R2 存储
ls -la /tmp/r2-storage/videos/VIDEO_ID/subtitles/

# 预期输出：
# -rw-r--r--  1 user  staff  1234 May 11 21:05 zh.vtt
# -rw-r--r--  1 user  staff  1567 May 11 21:05 en.vtt
```

## 📊 完整流程测试

### 场景 1: 成功的上传 → 转录 → 字幕生成流程

```bash
# 1. 创建测试用户（如果需要）
sqlite3 db/db.sqlite3 "INSERT INTO users (id, email, password_hash, full_name, verified) 
  VALUES ('test-user-123', 'test@example.com', 'hash', 'Test User', 1);"

# 2. 上传视频文件
UPLOAD_RESPONSE=$(curl -s -F "file=@test-video.mp4" \
  -F "title=Test" \
  -F "languages=[\"zh\",\"en\"]" \
  -H "x-user-id: test-user-123" \
  http://localhost:3000/api/upload)

VIDEO_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.id')
echo "Video ID: $VIDEO_ID"

# 3. 检查上传进度
curl -s http://localhost:3000/api/progress/$VIDEO_ID | jq '.data'

# 4. 等待转录完成（约 10-30 秒）
sleep 20

# 5. 获取转录结果
curl -s -H "x-user-id: test-user-123" \
  http://localhost:3000/api/watch/$VIDEO_ID | jq '.data'

# 6. 验证 R2 字幕文件
ls -la /tmp/r2-storage/videos/$VIDEO_ID/subtitles/

# 7. 测试下载字幕
curl -s http://localhost:3000/api/subtitles/$VIDEO_ID/zh > test-zh.vtt
file test-zh.vtt
```

### 场景 2: R2 文件访问和缓存

```bash
# 1. 首次访问视频（缓存未命中）
curl -I http://localhost:3000/r2/users/test-user-123/videos/$VIDEO_ID/original.mp4

# 2. 再次访问（缓存命中）
curl -I http://localhost:3000/r2/users/test-user-123/videos/$VIDEO_ID/original.mp4

# 3. 验证缓存响应（开发环境可能看不到缓存头，但在生产环境会看到）
```

### 场景 3: 存储配额检查

```bash
# 1. 查看用户配额
sqlite3 db/db.sqlite3 "SELECT storage_used_gb, quota_storage_gb FROM users WHERE id = 'test-user-123';"

# 2. 上传多个文件并检查配额更新
for i in {1..3}; do
  curl -F "file=@test-video.mp4" \
    -F "title=Test $i" \
    -F "languages=[\"zh\"]" \
    -H "x-user-id: test-user-123" \
    http://localhost:3000/api/upload
done

# 3. 验证存储使用量增加
sqlite3 db/db.sqlite3 "SELECT COUNT(*), SUM(file_size) FROM videos WHERE user_id = 'test-user-123';"
```

## 🔄 数据库验证

### 检查 R2 相关字段

```sql
-- 查看视频记录
SELECT id, title, r2_url, r2_key, status FROM videos LIMIT 5;

-- 查看存储使用情况
SELECT user_id, COUNT(*) as video_count, 
       SUM(file_size) / 1024 / 1024 / 1024 as storage_gb
FROM videos GROUP BY user_id;

-- 查看转录进度
SELECT id, status, languages FROM videos WHERE status = 'processing';
```

## 🧹 清理测试数据

```bash
# 删除测试用户和视频
sqlite3 db/db.sqlite3 "DELETE FROM videos WHERE user_id = 'test-user-123';"
sqlite3 db/db.sqlite3 "DELETE FROM users WHERE id = 'test-user-123';"

# 删除 R2 本地存储
rm -rf /tmp/r2-storage
```

## 📈 性能测试

### 1. 上传速度测试

```bash
# 创建不同大小的测试文件
dd if=/dev/zero of=test-10mb.mp4 bs=1M count=10
dd if=/dev/zero of=test-100mb.mp4 bs=1M count=100
dd if=/dev/zero of=test-500mb.mp4 bs=1M count=500

# 测试上传时间
time curl -F "file=@test-100mb.mp4" \
  -H "x-user-id: test-user-123" \
  http://localhost:3000/api/upload

# 记录上传时间和速度
```

### 2. 下载速度测试

```bash
# 下载视频文件
time curl -o downloaded-video.mp4 \
  http://localhost:3000/r2/users/test-user-123/videos/$VIDEO_ID/original.mp4

# 验证文件完整性
md5 original.mp4
md5 downloaded-video.mp4
```

### 3. 并发上传测试

```bash
# 使用 GNU Parallel 进行并发上传
parallel -j 5 curl -F "file=@test-video.mp4" \
  -F "title=Concurrent Test {}" \
  -H "x-user-id: test-user-123" \
  http://localhost:3000/api/upload \
  ::: {1..10}

# 检查并发上传是否成功
sqlite3 db/db.sqlite3 "SELECT COUNT(*) FROM videos WHERE title LIKE 'Concurrent%';"
```

## 🐛 常见问题和调试

### 问题 1: R2 文件未上传

**调试步骤：**
```bash
# 1. 检查 MockR2StorageService 是否被初始化
grep -n "r2Service" src/server.ts

# 2. 查看上传日志
npm run dev 2>&1 | grep -i "upload\|r2"

# 3. 验证目录权限
ls -la /tmp/r2-storage

# 4. 检查是否有磁盘空间
df -h /tmp
```

### 问题 2: R2 URL 返回 404

**检查清单：**
```bash
# 1. 验证文件存在
test -f /tmp/r2-storage/users/test-user-123/videos/$VIDEO_ID/original.mp4 && echo "文件存在" || echo "文件不存在"

# 2. 检查 R2 URL 格式
sqlite3 db/db.sqlite3 "SELECT r2_url FROM videos WHERE id = '$VIDEO_ID';"

# 3. 测试 URL 访问
curl -v http://localhost:3000/r2/users/test-user-123/videos/$VIDEO_ID/original.mp4
```

### 问题 3: 字幕未生成

**调试步骤：**
```bash
# 1. 检查转录状态
sqlite3 db/db.sqlite3 "SELECT status FROM videos WHERE id = '$VIDEO_ID';"

# 2. 查看 Worker 日志
npm run dev 2>&1 | grep -i "worker\|transcription\|subtitle"

# 3. 检查 AI 可用性
# 确保 Cloudflare AI 绑定正确配置

# 4. 手动触发转录（可选）
curl -X POST http://localhost:8787/api/transcribe-video \
  -H "Content-Type: application/json" \
  -d '{"videoId":"'$VIDEO_ID'","filePath":"/tmp/uploads/...","languages":["zh","en"],"title":"Test"}'
```

## 📝 测试报告模板

```markdown
## Phase 5 R2 存储集成测试报告

**测试日期：** 2024-XX-XX
**测试环境：** 本地开发 / 生产环境
**测试人员：** [Your Name]

### 测试结果

- [ ] 视频上传到 R2 - ✅ Pass / ❌ Fail
- [ ] R2 URL 生成正确 - ✅ Pass / ❌ Fail
- [ ] 视频播放从 R2 获取 - ✅ Pass / ❌ Fail
- [ ] 字幕上传到 R2 - ✅ Pass / ❌ Fail
- [ ] 字幕 URL 正确 - ✅ Pass / ❌ Fail
- [ ] CDN 缓存工作 - ✅ Pass / ❌ Fail
- [ ] 存储配额追踪 - ✅ Pass / ❌ Fail
- [ ] 文件删除功能 - ✅ Pass / ❌ Fail

### 发现的问题

1. 问题 #1：[描述问题]
   - 复现步骤：[步骤]
   - 解决方案：[方案]

### 性能指标

- 上传速度：[MB/s]
- 下载速度：[MB/s]
- CDN 缓存命中率：[%]

### 建议

[任何改进建议]

### 签署

测试人员签名：_________
日期：_________
```

## ✅ 完成标志

所有以下条件都满足时，Phase 5 测试完成：

- ✅ 视频文件成功上传到 R2
- ✅ R2 URL 格式正确且可访问
- ✅ 字幕文件成功上传到 R2
- ✅ 视频播放端点返回 R2 URL
- ✅ R2 文件可通过 HTTP 访问
- ✅ CDN 缓存策略正确应用
- ✅ 存储配额正确追踪
- ✅ 本地和生产环境都能正常工作
- ✅ 没有 TypeScript 编译错误
- ✅ 日志记录完整

## 🔗 相关文件

- `src/index.ts` - R2StorageService 和 triggerTranscription 实现
- `src/server.ts` - 上传和播放端点
- `src/r2-service.ts` - MockR2StorageService 实现
- `wrangler.toml` - R2 bucket 配置
- `PHASE5_R2_STORAGE.md` - R2 存储详细说明
- `PHASE5_R2_CDN_CONFIG.md` - CDN 缓存配置
