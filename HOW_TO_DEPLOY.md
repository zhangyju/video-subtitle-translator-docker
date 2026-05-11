# 🚀 如何部署 Phase 7

## 最快的方式 - 一行命令部署

```bash
cd /tmp/clean-repo
./deploy.sh
```

这个脚本会自动执行所有部署步骤！

---

## 脚本做了什么？

`deploy.sh` 自动化了以下步骤：

✅ 检查先决条件（Node.js、npm、Wrangler）
✅ 验证 Cloudflare 认证
✅ 安装项目依赖
✅ 编译 TypeScript
✅ 应用数据库迁移
✅ 部署到 Cloudflare Workers
✅ 验证部署
✅ 显示后续步骤

**总时间**: 10-20 分钟

---

## 前置条件

在运行 `./deploy.sh` 之前，请确保有：

1. **Node.js 和 npm**
   ```bash
   # 检查是否已安装
   node --version
   npm --version
   
   # 如果未安装，访问: https://nodejs.org
   ```

2. **Cloudflare 账户**
   - 需要访问 video-subtitle-db D1 数据库
   - 需要 Cloudflare Workers 部署权限

3. **Wrangler CLI**（脚本会自动安装）
   ```bash
   # 或手动安装
   npm install -g wrangler
   ```

---

## 手动部署步骤（如果脚本失败）

如果 `./deploy.sh` 失败，可以手动执行以下步骤：

### Step 1: 安装依赖
```bash
cd /tmp/clean-repo
npm install
```

### Step 2: 编译 TypeScript
```bash
npm run build
```

### Step 3: 应用数据库迁移
```bash
wrangler d1 migrations apply video-subtitle-db
```

验证迁移成功：
```bash
wrangler d1 execute video-subtitle-db --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

应该看到新表：
- audit_logs
- analytics_summary
- language_statistics
- quota_resets
- transcription_progress

### Step 4: 部署到 Cloudflare Workers
```bash
wrangler deploy
```

### Step 5: 验证部署
```bash
# 测试仪表板页面
curl https://subtitle.myzhangyujie.com/dashboard

# 测试 API
curl -H "x-user-id: test-user" \
  https://subtitle.myzhangyujie.com/api/dashboard

# 测试分析端点
curl -H "x-user-id: test-user" \
  https://subtitle.myzhangyujie.com/api/analytics
```

---

## 故障排除

### 错误: "Wrangler not found"
```bash
npm install -g wrangler
wrangler login
```

### 错误: "Not authenticated with Cloudflare"
```bash
wrangler login
# 按照提示进行身份验证
```

### 错误: "Database migration failed"
```bash
# 检查迁移状态
wrangler d1 migrations list video-subtitle-db

# 查看详细错误
wrangler d1 execute video-subtitle-db --command \
  "SELECT * FROM sqlite_master LIMIT 1;"
```

### 错误: "Deployment failed"
```bash
# 检查 wrangler.toml 配置
cat wrangler.toml

# 尝试重新部署
wrangler deploy
```

---

## 部署后验证

### 1. 检查仪表板是否可访问
```bash
curl -s https://subtitle.myzhangyujie.com/dashboard | \
  grep -o "<title>.*</title>"

# 应该输出: <title>用户仪表板 - 视频字幕翻译器</title>
```

### 2. 测试 API 端点
```bash
curl -H "x-user-id: test-user" \
  https://subtitle.myzhangyujie.com/api/dashboard | jq '.data.quota'
```

### 3. 检查数据库表
```bash
wrangler d1 execute video-subtitle-db --command \
  "SELECT COUNT(*) as count FROM audit_logs;"

# 应该返回: count = 0 (初始状态)
```

### 4. 监控错误日志
```bash
# 在 Cloudflare 仪表板中查看
# 或使用 wrangler tail
wrangler tail --format pretty
```

---

## 回滚（如果需要）

如果部署出现问题，可以快速回滚：

```bash
# 回滚代码
git revert HEAD
wrangler deploy

# 删除新的数据库表（可选）
wrangler d1 execute video-subtitle-db --command \
  "DROP TABLE IF EXISTS audit_logs, transcription_progress, quota_resets, analytics_summary, language_statistics;"
```

---

## 监控和日志

### 查看实时日志
```bash
wrangler tail --format pretty
```

### 查看特定错误
```bash
wrangler tail --format json --search "error"
```

### 检查审计日志
```bash
wrangler d1 execute video-subtitle-db --command \
  "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
```

### 监控性能
```bash
# 检查最慢的查询
wrangler d1 execute video-subtitle-db --command \
  "SELECT COUNT(*) FROM analytics_summary;"
```

---

## 常见问题

**Q: 部署需要多长时间？**
A: 通常 10-20 分钟，取决于网络速度和 npm 包大小。

**Q: 可以在不关闭服务的情况下部署吗？**
A: 是的，Cloudflare Workers 支持零停机部署。旧版本会立即切换到新版本。

**Q: 数据库迁移会丢失现有数据吗？**
A: 不会，迁移只添加新表。现有的 users、videos 等表保持不变。

**Q: 如何验证配额系统是否工作？**
A: 检查 audit_logs 表，应该记录所有上传和转录操作。

**Q: 可以回滚吗？**
A: 可以，使用 `git revert HEAD` 和 `wrangler deploy` 回滚代码。数据库表需要手动删除。

---

## 部署完成！

部署后，请执行以下检查：

- [ ] 仪表板页面可访问
- [ ] API 端点返回正确数据
- [ ] 配额检查正常工作
- [ ] 审计日志记录操作
- [ ] 没有错误日志
- [ ] 监控 24 小时后确认稳定

---

## 获取帮助

| 问题 | 文件 |
|------|------|
| 部署步骤 | DEPLOYMENT_EXECUTION_PLAN.md |
| 测试场景 | PHASE7_TESTING.md |
| 故障排除 | PHASE7_DEPLOYMENT_GUIDE.md |
| 回滚计划 | DEPLOYMENT_EXECUTION_PLAN.md |
| 技术详情 | PHASE7_COMPLETION_SUMMARY.md |

---

**现在运行**: `./deploy.sh`

祝部署顺利！🚀

