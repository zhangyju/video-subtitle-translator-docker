# Phase 4 测试指南 - 邮件发送功能

## 🎯 测试范围

验证以下功能是否正常工作：
1. ✅ 用户注册时发送验证邮件
2. ✅ 邮箱验证链接处理
3. ✅ 验证成功后发送欢迎邮件
4. ✅ HTML 邮件模板渲染正确
5. ✅ 错误处理和日志记录

## 🧪 本地测试步骤

### 前置条件

```bash
# 安装依赖
npm install

# 构建 TypeScript
npm run build

# 查看 wrangler.toml 配置
cat wrangler.toml
```

### 步骤 1：启动本地开发服务器

```bash
# 启动 Worker 开发服务器
npm run dev

# 输出示例：
# ⛅️  wrangler 3.x.x
# ▲ [wrangler:dev] Starting local server...
# ✓ Ready on http://localhost:8787
```

### 步骤 2：测试注册端点

使用 curl 或 Postman 测试注册：

```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User"
  }'
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "email": "test@example.com",
    "message": "Registration successful. Please check your email to verify your account."
  }
}
```

### 步骤 3：检查邮件发送日志

在开发服务器的日志中查看：

```
[Auth] User registered: test@example.com
[Email] Email sent to test@example.com: Verify your email - Video Subtitle Translator
```

### 步骤 4：测试邮箱验证链接

获取验证 token（从数据库中查询）：

```sql
SELECT verification_token FROM users WHERE email = 'test@example.com';
```

使用获取的 token 测试验证链接：

```bash
# 方式 1：使用 GET 请求（邮件链接方式）
curl "http://localhost:8787/api/auth/verify?token=YOUR_TOKEN_HERE"

# 方式 2：使用 POST 请求（API 方式）
curl -X POST http://localhost:8787/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-here",
    "token": "YOUR_TOKEN_HERE"
  }'
```

**预期响应（GET）：**
- 成功：显示带有 "✅ 邮箱验证成功！" 的 HTML 页面
- 失败：显示带有 "❌ 邮箱验证失败" 的 HTML 页面

**预期响应（POST）：**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 步骤 5：检查用户状态

验证用户的 verified 字段已更新：

```sql
SELECT id, email, verified, verification_token FROM users WHERE email = 'test@example.com';

-- 预期输出：
-- id | email | verified | verification_token
-- uuid | test@example.com | 1 | NULL
```

## 📧 邮件模板测试

### 验证邮件模板

检查 HTML 邮件是否渲染正确：

1. **打开浏览器**，访问验证链接：
   ```
   http://localhost:8787/api/auth/verify?token=YOUR_TOKEN_HERE
   ```

2. **检查页面元素：**
   - ✅ 页面标题: "邮箱验证成功！"
   - ✅ 用户名显示正确
   - ✅ "前往应用" 按钮可点击
   - ✅ 样式美观（紫色渐变背景）

### 验证邮件发送的 HTML 内容

查看邮件发送的 HTML 代码：

1. **修改 src/index.ts 中的邮件模板测试**
2. **添加控制台日志输出 HTML 内容**

```typescript
console.log('Sending HTML:', html);
```

3. **检查日志中的 HTML 是否完整**

## 🔄 完整流程测试

### 场景 1：成功的注册→验证→欢迎流程

```bash
# 1. 注册用户
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
# 记下返回的 userId

# 2. 从数据库获取验证 token
sqlite3 db/db.sqlite3 "SELECT verification_token FROM users WHERE email = 'john.doe@example.com';"

# 3. 验证邮箱（GET 请求）
curl "http://localhost:8787/api/auth/verify?token=VERIFICATION_TOKEN_HERE"

# 4. 检查用户状态已更新
sqlite3 db/db.sqlite3 "SELECT verified, verification_token FROM users WHERE email = 'john.doe@example.com';"
# 预期：verified=1, verification_token=NULL

# 5. 检查日志中有欢迎邮件记录
# 应该看到：[Email] Email sent to john.doe@example.com: Welcome to Video Subtitle Translator
```

### 场景 2：无效的验证 token

```bash
# 尝试使用无效的 token
curl "http://localhost:8787/api/auth/verify?token=INVALID_TOKEN_HERE"

# 预期：显示 "❌ 邮箱验证失败" 页面，错误信息为 "Invalid or expired verification token"
```

### 场景 3：重复注册相同邮箱

```bash
# 首次注册
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "Test123!",
    "fullName": "First User"
  }'

# 再次注册相同邮箱
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "Test123!",
    "fullName": "Second User"
  }'

# 预期：返回错误 "Email already registered"
```

## 🐛 常见问题和调试

### 问题 1：邮件未发送

**检查清单：**
```bash
# 1. 检查 EmailService 是否被正确调用
grep -n "EmailService" src/index.ts

# 2. 查看开发服务器日志，是否有 [Email] 记录
npm run dev 2>&1 | grep -i email

# 3. 检查 MailChannels API 响应状态
# 在 EmailService.sendEmail() 中添加日志
console.log('MailChannels response status:', response.status);
```

### 问题 2：验证链接返回 404

**调试步骤：**
```bash
# 1. 检查路由是否正确配置
grep -n "api/auth/verify" src/index.ts

# 2. 测试 GET 请求
curl -i "http://localhost:8787/api/auth/verify?token=test"

# 3. 查看 handleAuth 函数中的路由逻辑
```

### 问题 3：数据库错误

**常见原因：**
- 数据库未初始化
- users 表不存在
- verification_token 字段不存在

**解决方案：**
```bash
# 检查数据库结构
sqlite3 db/db.sqlite3 ".schema users"

# 重新初始化数据库
npm run migrate
```

## 📊 测试覆盖情况

| 功能 | 测试方法 | 状态 |
|------|--------|------|
| 注册时发送验证邮件 | curl 测试 + 日志检查 | ✅ |
| 验证链接（GET）| 浏览器访问 | ✅ |
| 验证链接（POST）| curl 测试 | ✅ |
| 验证成功后发送欢迎邮件 | 日志检查 | ✅ |
| 无效 token 处理 | curl 测试 | ✅ |
| 重复邮箱检查 | curl 测试 | ✅ |
| HTML 邮件模板 | 邮件客户端验证 | ⚠️ |
| 错误日志记录 | 查看 console.error | ✅ |

## 🚀 生产环境测试

在部署到生产环境前，请完成以下测试：

### 1. DNS 配置验证

```bash
# 检查 SPF 记录
dig myzhangyujie.com TXT | grep -i spf

# 检查 DKIM 记录
dig selector._domainkey.myzhangyujie.com TXT

# 在线检查工具
# https://mxtoolbox.com/
```

### 2. 邮件可送达性测试

1. 在生产环境注册测试账户
2. 检查邮件是否送达（检查主收件箱和垃圾箱）
3. 点击验证链接
4. 验证欢迎邮件是否送达

### 3. 性能测试

```bash
# 使用 Apache Bench 进行负载测试
ab -n 100 -c 10 -p data.json -T application/json \
  https://subtitle.myzhangyujie.com/api/auth/register

# 监控邮件发送速率限制
# MailChannels: 每秒最多 100 个请求，每天 10,000 个（免费层）
```

### 4. 错误处理测试

- 网络中断时的邮件发送重试
- 邮件地址格式验证
- 速率限制响应处理

## 📝 测试报告模板

```markdown
## Phase 4 邮件发送功能测试报告

**测试日期：** 2024-XX-XX
**测试环境：** 本地开发 / 生产环境
**测试人员：** [Your Name]

### 测试结果

- [ ] 用户注册时发送验证邮件 - ✅ Pass / ❌ Fail
- [ ] 邮箱验证链接处理 - ✅ Pass / ❌ Fail
- [ ] 验证成功后发送欢迎邮件 - ✅ Pass / ❌ Fail
- [ ] HTML 邮件模板渲染 - ✅ Pass / ❌ Fail
- [ ] 错误处理和日志 - ✅ Pass / ❌ Fail

### 发现的问题

1. 问题 #1：[描述问题]
   - 复现步骤：[步骤]
   - 解决方案：[方案]

### 建议

[任何改进建议]

### 签署

测试人员签名：_________
日期：_________
```

## ✅ 完成标志

所有以下条件都满足时，Phase 4 测试完成：

- ✅ TypeScript 编译无错误
- ✅ 注册时发送验证邮件
- ✅ 验证链接（GET/POST）都能正常处理
- ✅ 验证成功后发送欢迎邮件
- ✅ 错误消息清晰有用
- ✅ HTML 邮件模板格式正确
- ✅ 日志记录完整
- ✅ 生产 DNS 配置已完成
- ✅ 生产环境邮件发送验证成功

## 🔗 相关文件

- `src/index.ts` - EmailService 实现
- `DNS_CONFIGURATION.md` - DNS 配置指南
- `PHASE4_EMAIL_SENDING.md` - Phase 4 实现文档
- `PHASES_4_7_ROADMAP.md` - 整体计划
