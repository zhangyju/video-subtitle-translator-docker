# Video Subtitle Translator - Quick Start

## 概述

这是一个使用 Cloudflare Containers 处理大文件上传的视频字幕翻译平台。支持：
- ✅ 无限文件大小上传（通过 Containers）
- ✅ 自动语音转录（Whisper）
- ✅ 多语言翻译（M2M-100）
- ✅ VTT 字幕生成

## 快速开始

### 本地开发

```bash
npm install
npm run server:dev
# 访问 http://localhost:3000
```

### Docker 本地测试

```bash
docker-compose up
# 访问 http://localhost:3000
```

### 部署到 Cloudflare

```bash
npm run deploy
```

## 部署流程

### 使用 Railway 构建 Docker 镜像

1. 访问 https://railway.app
2. 注册账号（免费）
3. 点击 **New Project**
4. 选择 **Deploy from GitHub repo**
5. 连接你的 GitHub 账号
6. 选择 **video-subtitle-translator-docker**
7. Railway 会自动检测到 Dockerfile 并构建镜像
8. 构建完成后，镜像会推送到 Docker Hub

### 连接 Docker Hub

1. 在 Railway 项目设置中，配置 Docker Hub 凭证
2. Railway 自动推送镜像到：`lvxiaoyu/video-subtitle-translator:latest`

### Cloudflare Deployment

1. 配置 `wrangler.toml` 中的容器镜像
2. 运行 `npm run deploy`
3. Cloudflare 会从 Docker Hub 拉取镜像并启动容器

## 配置

### wrangler.toml

```toml
[[containers]]
class_name = "VideoSubtitleContainer"
image = "lvxiaoyu/video-subtitle-translator:latest"  # Docker Hub 镜像
instance_type = "standard-2"  # 1 vCPU, 6GB memory
max_instances = 2
```

### 环境变量

在 `.env` 中设置（仅开发用）：

```env
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
NODE_ENV=development
UPLOAD_DIR=/tmp/uploads
PORT=3000
```

## 架构

```
用户浏览器
    ↓
Cloudflare Edge (Worker)
    ↓
Cloudflare Container (Region:Earth)
    ├─ Express Server
    ├─ File Upload Handler
    └─ Video Processing
    ↓
    ├─ Local Storage / R2
    └─ Cloudflare AI / Database
```

## 功能

- **上传**: 支持 MP4, WebM, MP3, WAV, OGG
- **转录**: Whisper AI 自动语音识别
- **翻译**: M2M-100 多语言翻译
- **字幕**: VTT 格式生成和下载
- **进度**: 实时进度报告

## 故障排查

### 容器无法启动

```bash
wrangler tail
# 查看实时日志
```

### 文件上传失败

检查：
- 网络连接
- 文件大小（应该没有限制，但网络可能超时）
- 服务器日志：`wrangler tail`

### 构建失败

检查 Railway 构建日志：
https://railway.app → Projects → video-subtitle-translator-docker → Builds

## 更多资源

- [DOCKER_MIGRATION.md](./DOCKER_MIGRATION.md) - 完整迁移指南
- [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) - 部署清单
- [Cloudflare Containers 文档](https://developers.cloudflare.com/containers/)
- [Railway 文档](https://docs.railway.app/)

## 支持

如有问题，检查：
1. GitHub Issues
2. Cloudflare Logs (`wrangler tail`)
3. Railway Build Logs

---

**现在就开始吧！** 🚀
