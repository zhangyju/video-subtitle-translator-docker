# DNS 配置指南 - Cloudflare Email Service

## 📧 概述

为了在生产环境中使用 Cloudflare Email Service (MailChannels API) 发送邮件，需要配置 SPF 和 DKIM 记录。

## 🔧 必需配置

### 1. SPF 记录 (Sender Policy Framework)

SPF 记录告诉邮件服务器哪些 IP 地址可以代表你的域名发送邮件。

**在 DNS 提供商添加以下 TXT 记录：**

```
主机名: myzhangyujie.com
记录类型: TXT
值: v=spf1 include:mailchannels.net ~all
```

**说明：**
- `v=spf1` - SPF 版本
- `include:mailchannels.net` - 允许 MailChannels (Cloudflare Email Service) 代表你发送邮件
- `~all` - 软失败（允许其他服务器发送，但标记为可疑）

**完整示例（如果有其他邮件服务）：**
```
v=spf1 include:mailchannels.net include:sendgrid.net ~all
```

### 2. DKIM 记录 (DomainKeys Identified Mail)

DKIM 使用加密签名验证邮件的真实性。

**步骤：**

1. **在 Cloudflare 仪表板获取 DKIM 公钥：**
   - 登录 Cloudflare
   - 进入 Domain Settings
   - 找到 Email Service 部分
   - 获取 DKIM 公钥

2. **在 DNS 中添加 DKIM 记录：**

   对于 Cloudflare Email Service，通常需要添加：

   ```
   主机名: selector._domainkey.myzhangyujie.com
   记录类型: TXT
   值: v=DKIM1; p=YOUR_PUBLIC_KEY_HERE
   ```

   **说明：**
   - `selector` - DKIM 选择器（通常由 Cloudflare 提供）
   - `v=DKIM1` - DKIM 版本
   - `p=` - 公钥内容

3. **验证 DKIM 配置：**
   ```bash
   # 使用 dig 命令检查
   dig selector._domainkey.myzhangyujie.com TXT
   
   # 或使用 nslookup
   nslookup -type=TXT selector._domainkey.myzhangyujie.com
   ```

### 3. DMARC 记录 (Domain-based Message Authentication)（可选但推荐）

DMARC 定义如何处理 SPF/DKIM 验证失败的邮件。

```
主机名: _dmarc.myzhangyujie.com
记录类型: TXT
值: v=DMARC1; p=quarantine; rua=mailto:admin@myzhangyujie.com
```

**说明：**
- `p=quarantine` - 失败的邮件会被隔离
- `rua=mailto:...` - DMARC 报告地址

## 📋 配置检查清单

- [ ] **SPF 记录已添加**
  ```
  myzhangyujie.com TXT v=spf1 include:mailchannels.net ~all
  ```

- [ ] **DKIM 记录已添加**
  ```
  selector._domainkey.myzhangyujie.com TXT v=DKIM1; p=...
  ```

- [ ] **DMARC 记录已添加**（可选）
  ```
  _dmarc.myzhangyujie.com TXT v=DMARC1; p=quarantine; ...
  ```

- [ ] **DNS 生效验证**
  ```bash
  dig myzhangyujie.com TXT
  dig selector._domainkey.myzhangyujie.com TXT
  ```

- [ ] **测试邮件发送成功**

## 🧪 本地测试

### 开发环境

在本地开发环境中，MailChannels API 可能需要特殊配置。推荐使用 SendGrid 或其他 API 进行本地测试：

```bash
# 1. 设置 SendGrid API 密钥
export SENDGRID_API_KEY="your_sendgrid_api_key"

# 2. 运行开发服务器
npm run dev

# 3. 测试注册端点
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User"
  }'
```

### 生产环境测试

```bash
# 使用生产域名测试
curl -X POST https://subtitle.myzhangyujie.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@gmail.com",
    "password": "Test123!",
    "fullName": "Test User"
  }'
```

## 🔍 故障排查

### 问题 1：邮件未送达

**检查项：**
1. SPF 记录是否正确：
   ```bash
   dig myzhangyujie.com TXT | grep spf1
   ```

2. DKIM 记录是否存在：
   ```bash
   dig selector._domainkey.myzhangyujie.com TXT
   ```

3. 检查 Cloudflare 日志中的邮件发送状态

4. 查看收件箱的垃圾邮件文件夹

### 问题 2：邮件被标记为垃圾邮件

**解决方案：**
1. 配置完整的 DKIM 和 DMARC 记录
2. 从 noreply@subtitle.myzhangyujie.com 发送（已配置的域名）
3. 确保邮件内容质量（避免垃圾邮件关键词）

### 问题 3：MailChannels API 返回错误

**常见错误：**
- 429: 速率限制 - 等待后重试
- 401: 认证失败 - 检查 DKIM 域名配置
- 400: 请求格式错误 - 检查邮件地址格式

## 📊 监控和日志

### 检查邮件发送日志

在 Worker 日志中查看邮件发送状态：

```bash
wrangler tail
```

会看到如下日志：
```
[Email] Email sent to user@example.com: Verify your email - Video Subtitle Translator
```

### 分析邮件送达率

1. 检查数据库中的 email_logs 表
2. 统计成功发送率
3. 分析失败原因

```sql
SELECT 
  email_type,
  status,
  COUNT(*) as count
FROM email_logs
GROUP BY email_type, status;
```

## 🚀 部署步骤

### 1. 配置 DNS 记录

在域名提供商（如 Namecheap、GoDaddy、Route 53 等）添加：
- SPF 记录
- DKIM 记录
- DMARC 记录（可选）

### 2. 等待 DNS 生效

DNS 记录通常在 15 分钟到 24 小时内生效。使用以下命令检查：

```bash
# 检查 SPF
dig myzhangyujie.com TXT +short | grep spf1

# 检查 DKIM
dig selector._domainkey.myzhangyujie.com TXT +short

# 在线工具
# https://mxtoolbox.com/spf.aspx
# https://mxtoolbox.com/dkim.aspx
```

### 3. 部署 Worker

```bash
wrangler deploy
```

### 4. 测试邮件发送

1. 在应用中注册新账户
2. 查看邮件是否送达
3. 点击验证链接
4. 检查欢迎邮件是否送达

## 📞 Cloudflare Email Service 限制

- **免费层：** 每天 10,000 封邮件
- **付费层：** 取决于套餐
- **速率限制：** 每秒最多 100 个请求
- **邮件大小：** 最多 35MB

## 参考资源

- [Cloudflare Email Service 文档](https://developers.cloudflare.com/email-service/)
- [SPF 记录说明](https://support.google.com/a/answer/33786)
- [DKIM 记录说明](https://support.google.com/a/answer/174124)
- [DMARC 记录说明](https://support.google.com/a/answer/2466563)
- [MailChannels API 文档](https://mailchannels.zendesk.com/hc/en-us/articles/16918954360845-Sending-Email-from-Cloudflare-Workers)

## 🎯 最佳实践

1. **使用一致的发件人地址**
   - 始终从 `noreply@subtitle.myzhangyujie.com` 发送

2. **添加 Unsubscribe 链接**
   - 虽然不是强制要求，但能提高可送达性

3. **监控邮件反弹**
   - 定期检查失败的邮件发送
   - 从列表中删除弹回的邮件地址

4. **定期测试**
   - 使用测试账户进行周期性验证
   - 检查邮件格式和内容

5. **保持域名声誉**
   - 不发送垃圾邮件
   - 实施垃圾邮件投诉处理流程
   - 监控邮件投诉率
