# Docker & Cloudflare Containers 迁移清单

## ✅ 已完成

### 项目结构
- [x] 创建 `Dockerfile` - Alpine + Node.js 20
- [x] 创建 `docker-compose.yml` - 本地开发配置
- [x] 创建 `.dockerignore` - Docker 构建优化
- [x] 创建 `src/server.ts` - Express 服务器
- [x] 创建 `src/container-worker.ts` - Cloudflare Worker 网关
- [x] 更新 `wrangler.toml` - Containers 配置
- [x] 更新 `package.json` - 新依赖和脚本
- [x] 创建 `DOCKER_MIGRATION.md` - 完整文档

### 代码和配置
- [x] TypeScript 编译通过 (no errors)
- [x] Express 服务器实现基本路由
- [x] Multer 文件上传配置 (500MB 限制)
- [x] CORS 中间件配置
- [x] 健康检查端点 `/api/health`

### 文档
- [x] Docker 迁移指南
- [x] 本地开发说明
- [x] 性能对比表
- [x] 故障排查指南

## ⏳ 待完成

### 部署前准备
- [ ] **验证 Cloudflare Paid Plan** - 需要 Containers 功能
- [ ] **Docker 本地测试** - 运行 `npm run docker:run`
- [ ] **Express 服务器测试** - 运行 `npm run server:dev`

### 功能集成
- [ ] 集成 Cloudflare AI Binding（Whisper）
- [ ] 集成 R2 文件存储
- [ ] 集成 D1 数据库
- [ ] 实现视频处理管道
  - [ ] 上传进度报告
  - [ ] Whisper 转录
  - [ ] M2M-100 翻译
  - [ ] VTT 字幕生成

### 前端
- [ ] 验证前端在 Express 上运行
- [ ] 测试文件上传功能
- [ ] 测试进度轮询
- [ ] 确保 CORS 正确配置

### 部署
- [ ] 建立 Cloudflare Container Registry 账号
- [ ] 推送镜像到 Cloudflare Registry
- [ ] 配置 D1 和 R2 绑定
- [ ] 部署到 Cloudflare
- [ ] 测试生产环境
- [ ] 配置日志和监控

### 数据迁移
- [ ] 迁移现有 D1 数据（如有）
- [ ] 迁移 R2 文件（如有）
- [ ] 配置新的环境变量

## 快速开始指南

### 方式 A: 本地 Express 开发（推荐）

```bash
cd /tmp/video-subtitle-translator

# 安装依赖
npm install

# 开发模式（自动重载）
npm run server:dev

# 访问
open http://localhost:3000
```

### 方式 B: Docker 本地测试

```bash
# 构建镜像
npm run docker:build

# 运行容器
docker-compose up

# 或直接运行
npm run docker:run

# 访问
open http://localhost:3000
```

### 方式 C: 部署到 Cloudflare

```bash
# 1. 确保有 Paid Plan
# 2. 登录 Cloudflare
wrangler login

# 3. 部署（自动构建并推送容器）
npm run deploy

# 4. 监控日志
wrangler tail
```

## 关键文件变更

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/server.ts` | 新增 | Express 服务器 |
| `src/container-worker.ts` | 新增 | Cloudflare Worker 网关 |
| `Dockerfile` | 新增 | 容器镜像定义 |
| `docker-compose.yml` | 新增 | 本地开发配置 |
| `wrangler.toml` | 更新 | 添加 Containers 配置 |
| `package.json` | 更新 | 新依赖和脚本 |
| `src/index.ts` | 保留 | 作为参考（不再使用） |

## 性能对比

| 指标 | 旧 (Workers) | 新 (Containers) |
|------|-------------|-----------------|
| 最大文件大小 | ~128MB | 无限制 |
| 内存 | 128MB | 最高 12GB |
| 启动时间 | <100ms | ~1-2s |
| 运行成本 | 按请求 | 按实例-小时 |

## 故障排查

### 问题：Docker 构建失败
```bash
# 清理缓存
docker system prune -a

# 重新构建
npm run docker:build
```

### 问题：容器无法连接数据库
```bash
# 检查 D1 绑定在 wrangler.toml 中
# 确保数据库 ID 正确
```

### 问题：文件上传超时
```bash
# 增加 timeout
# 在 Express 中添加
app.use(express.json({ limit: '500mb' }));
```

## 参考资源

- [Cloudflare Containers 文档](https://developers.cloudflare.com/containers/)
- [Express.js 文档](https://expressjs.com/)
- [Multer 文件上传](https://github.com/expressjs/multer)
- [Docker 最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

## 时间估算

| 任务 | 时间 |
|------|------|
| 本地测试 | 5-10 分钟 |
| 功能集成 (AI/R2/D1) | 30-45 分钟 |
| 部署到 Cloudflare | 5 分钟 |
| 全面测试 | 20-30 分钟 |
| **总计** | **60-90 分钟** |

---

**下一步**: 选择开发方式（A/B/C），开始测试！
