# Phase 4: 真实 Email 发送 - Cloudflare Email Service

## 📧 概述

使用 Cloudflare Email Service 实现真实邮件发送，替代占位符实现。

## 🔧 实现方案

### 1. Cloudflare Email Service API

根据官方文档: https://developers.cloudflare.com/email-service/local-development/sending/

**API 端点：**
```
POST https://api.mailchannels.net/tx/v1/send
```

**请求格式：**
```json
{
  "personalizations": [
    {
      "to": [
        {
          "email": "recipient@example.com",
          "name": "Recipient Name"
        }
      ]
    }
  ],
  "from": {
    "email": "noreply@subtitle.myzhangyujie.com",
    "name": "Video Subtitle Translator"
  },
  "subject": "Verify your email",
  "content": [
    {
      "type": "text/html",
      "value": "<html>HTML content here</html>"
    }
  ]
}
```

### 2. 认证配置

在 `wrangler.toml` 中添加 Email 绑定：

```toml
# Email service binding
[env.production]
routes = [
  { pattern = "subtitle.myzhangyujie.com/*", zone_name = "myzhangyujie.com" }
]
services = [
  { binding = "DKIM_DOMAIN", service = "email" }
]
```

### 3. 实现步骤

#### Step 1: 更新 Env 接口
```typescript
interface Env {
  CONTAINER: any;
  AI: any;
  DB: any;
  R2_BUCKET?: R2Bucket;
  SENDGRID_API_KEY?: string;  // 如果使用 SendGrid 作为备选
}
```

#### Step 2: 创建 Email 服务类
```typescript
class EmailService {
  constructor(env: Env) {
    this.env = env;
  }

  async sendVerificationEmail(
    email: string,
    fullName: string,
    token: string
  ): Promise<boolean> {
    const verificationLink = `https://subtitle.myzhangyujie.com/api/auth/verify?token=${token}`;
    
    const html = buildVerificationEmailHtml(fullName, verificationLink);
    
    return await this.sendEmail({
      to: email,
      subject: 'Verify your email - Video Subtitle Translator',
      html,
      text: `Please verify your email: ${verificationLink}`
    });
  }

  async sendWelcomeEmail(
    email: string,
    fullName: string
  ): Promise<boolean> {
    const html = buildWelcomeEmailHtml(fullName);
    
    return await this.sendEmail({
      to: email,
      subject: 'Welcome to Video Subtitle Translator',
      html,
      text: 'Your account is activated and ready to use!'
    });
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    try {
      const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: options.to }],
              dkim_domain: 'subtitle.myzhangyujie.com'
            }
          ],
          from: {
            email: 'noreply@subtitle.myzhangyujie.com',
            name: '视频字幕翻译器'
          },
          subject: options.subject,
          content: [
            { type: 'text/html', value: options.html },
            { type: 'text/plain', value: options.text }
          ]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('[Email Error]', error);
      return false;
    }
  }
}
```

#### Step 3: 在认证流程中使用

```typescript
// 在 handleRegister 中
const emailService = new EmailService(env);
const emailSent = await emailService.sendVerificationEmail(
  email,
  fullName,
  verificationToken
);

// 在 handleVerifyEmail 中
const welcomeSent = await emailService.sendWelcomeEmail(
  user.email,
  user.full_name
);
```

### 4. DNS 配置（生产环境）

在域名提供商配置 DKIM 和 SPF：

```dns
# SPF 记录
v=spf1 include:mailchannels.net ~all

# DKIM 记录（由 Cloudflare 生成）
selector._domainkey TXT "v=DKIM1; p=<public_key>"
```

### 5. 本地测试

```bash
# 设置环境变量
export SENDGRID_API_KEY="your_api_key"

# 运行本地测试
npm run dev

# 测试端点
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","fullName":"Test"}'
```

### 6. 监控和日志

```typescript
// 添加到 email_logs 表
const emailLog = {
  id: crypto.randomUUID(),
  user_id: userId,
  recipient_email: email,
  email_type: 'verification',
  status: emailSent ? 'sent' : 'failed',
  error_message: error?.message || null,
  created_at: new Date().toISOString()
};

await env.DB.prepare(
  'INSERT INTO email_logs (...) VALUES (...)'
).run();
```

## 📋 检查清单

- [ ] 添加 EmailService 类
- [ ] 实现 sendVerificationEmail()
- [ ] 实现 sendWelcomeEmail()
- [ ] 集成到注册流程
- [ ] 集成到验证流程
- [ ] 配置 DKIM/SPF（生产环境）
- [ ] 编写测试
- [ ] 验证邮件交付

## 🚀 部署

```bash
# 更新环境变量
wrangler secret put SENDGRID_API_KEY

# 部署
wrangler deploy

# 测试邮件发送
curl https://subtitle.myzhangyujie.com/api/auth/register \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","fullName":"Test User"}'
```

## 📞 故障排除

### 邮件未送达
1. 检查 DKIM/SPF 配置
2. 验证发件人地址配置正确
3. 查看 email_logs 表中的错误信息
4. 检查 Cloudflare 日志

### 速率限制
- Cloudflare Email Service 有速率限制
- 实现邮件队列以处理大量发送
- 使用指数退避重试

## 参考资源

- [Cloudflare Email Service Docs](https://developers.cloudflare.com/email-service/local-development/sending/)
- [MailChannels API](https://api.mailchannels.net/)
- [Email Deliverability Guide](https://developers.cloudflare.com/email-service/)

