# Docker & Cloudflare Containers Migration

## 概述

该项目已从纯 Cloudflare Workers 迁移到 **Cloudflare Containers**，以支持处理大文件上传（>100MB）。

## 架构

```
┌─────────────────────────────────────────────────────┐
│           Cloudflare Edge (Worker)                  │
│  (src/container-worker.ts)                          │
│  - 路由请求                                         │
│  - 管理容器生命周期                                 │
│  - 请求验证和日志                                  │
└──────────────┬──────────────────────────────────────┘
               │
               │ fetch() via Region:Earth
               │
┌──────────────▼──────────────────────────────────────┐
│      Cloudflare Container (Region:Earth)            │
│  Express Server (src/server.ts)                     │
│  - 文件上传处理 (无大小限制)                        │
│  - 视频处理                                         │
│  - API 端点                                         │
│  - 数据持久化                                       │
└──────────────┬──────────────────────────────────────┘
               │
               ├─────────────────┐
               │                 │
┌──────────────▼─┐    ┌─────────▼──────────┐
│  本地存储      │    │  Cloudflare API    │
│  /data/uploads │    │  - R2 (可选)       │
│  /data/db      │    │  - D1 (可选)       │
│  (Volume)      │    │  - AI              │
└────────────────┘    └────────────────────┘
```

## 文件结构

```
.
├── Dockerfile                 # Container 镜像定义
├── docker-compose.yml         # 本地开发配置
├── .dockerignore              # Docker 构建忽略文件
├── src/
│   ├── server.ts              # Express 服务器 (NEW)
│   ├── container-worker.ts    # Cloudflare Worker 网关 (NEW)
│   └── index.ts               # 原始 Workers 代码 (保留作为参考)
├── wrangler.toml              # Cloudflare 配置 (更新)
└── package.json               # 依赖项 (更新)
```

## 本地开发

### 使用 Docker Compose

```bash
# 构建镜像
npm run docker:build

# 运行容器
docker-compose up

# 或一条命令
npm run docker:run
```

访问 `http://localhost:3000`

### 使用 Express 直接运行

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npm run server:dev

# 生产模式
npm run build && npm start
```

## 部署到 Cloudflare

### 前置条件

- **Cloudflare Workers Paid Plan**（必需 Containers 功能）
- 已配置 R2 桶和 D1 数据库（可选）
- Docker 已安装

### 构建和推送容器

```bash
# 1. 登录 Cloudflare Registry
wrangler login

# 2. 构建容器镜像
npm run docker:build

# 3. 推送到 Cloudflare Container Registry
wrangler deploy

# 或者直接
npm run deploy
```

## 配置详解

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s
CMD ["npm", "start"]
```

**特点：**
- Alpine Linux（轻量级）
- Node.js 20 LTS
- 仅安装生产依赖
- 健康检查（自动重启失败的容器）

### wrangler.toml

关键配置：

```toml
[[containers]]
class_name = "VideoSubtitleContainer"
image = "./Dockerfile"
instance_type = "standard-2"  # 1 vCPU, 6GB memory, 12GB disk
max_instances = 2
```

**实例类型选择：**
- `lite`: 256MB 内存 - 不够
- `basic`: 1GB 内存 - 勉强
- `standard-1`: 4GB 内存 - 好
- `standard-2`: 6GB 内存 - **推荐** ✓
- `standard-3`: 8GB 内存 - 如果处理非常大的文件
- `standard-4`: 12GB 内存 - 最大性能

## 性能对比

| 指标 | Workers | Containers |
|------|---------|-----------|
| 最大请求体 | ~128MB | 无硬限制 |
| 内存 | 128MB | 最高 12GB |
| CPU | 有限 | 最多 4 核 |
| 执行时间 | 30-50s | 不限制 |
| 磁盘 | 512MB | 最高 20GB |
| 成本 | 按请求 | 按实例小时 |
| 启动时间 | <100ms | ~1-2s (冷启动) |

## 环境变量

在 Cloudflare Dashboard 或 wrangler.toml 中设置：

```env
# Express 服务器
NODE_ENV=production
PORT=3000
UPLOAD_DIR=/data/uploads

# 可选：连接 Cloudflare API
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
R2_BUCKET_NAME=video-subtitle-bucket
D1_DATABASE_ID=<database-id>
```

## 存储策略

### 本地存储（推荐用于开发）
```bash
docker-compose up
# 文件保存在 docker volume: `uploads`
```

### R2 存储（推荐用于生产）
```typescript
// 在 Express 服务器中集成 R2
const r2 = new S3Client({ /* ... */ });
await r2.PutObject({
  Bucket: env.R2_BUCKET_NAME,
  Key: `videos/${videoId}/original.mp4`,
  Body: fileBuffer
});
```

### 混合存储
- **本地**: 临时处理、缓存
- **R2**: 长期存储、下载

## 故障排查

### 容器无法启动

```bash
# 查看日志
wrangler tail

# 检查容器健康状态
curl https://subtitle.myzhangyujie.com/api/health
```

### 文件上传失败

1. 检查磁盘空间：`df -h /data/uploads`
2. 检查权限：容器内应该有写权限
3. 检查文件大小：即使无限制，也可能由于网络超时而失败

### 内存不足

```toml
# 升级实例类型
instance_type = "standard-3"  # 8GB
```

## 成本估算

**Cloudflare Containers 定价**（按使用量）：

- 内存：$0.15 per GB-hour
- CPU：$0.10 per vCPU-hour
- 磁盘：包含在实例中

**示例**：运行 `standard-2` (1 vCPU, 6GB) 1 小时
```
6GB × $0.15 = $0.90
1 vCPU × $0.10 = $0.10
总计：$1.00/小时
```

**与 Workers 对比**：
- Workers: $0.50 per 百万请求
- Containers: 按运行时间计费

如果处理长视频或频繁处理，**Containers 更划算**。

## 后续步骤

1. ✅ 完成 Express 服务器配置
2. ⏳ 集成 Cloudflare AI (Whisper, M2M-100)
3. ⏳ 集成 R2 文件存储
4. ⏳ 集成 D1 数据库
5. ⏳ 数据库迁移脚本
6. ⏳ 部署到 Cloudflare Containers
7. ⏳ 监控和日志配置

## 参考资源

- [Cloudflare Containers 文档](https://developers.cloudflare.com/containers/)
- [Cloudflare Containers 限制](https://developers.cloudflare.com/containers/platform-details/limits/)
- [Wrangler Containers 命令](https://developers.cloudflare.com/workers/wrangler/commands/containers/)
