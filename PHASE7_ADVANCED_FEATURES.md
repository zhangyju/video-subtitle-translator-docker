# Phase 7: 高级功能 - 仪表板、分析、配额管理

## 📊 概述

实现用户仪表板、详细分析和高级配额管理功能。

## 🏗️ 功能模块

### 1. 用户仪表板

**端点:** `/api/dashboard`

```typescript
interface DashboardData {
  user: {
    id: string;
    email: string;
    fullName: string;
    joinedDate: string;
  };
  statistics: {
    totalVideos: number;
    totalStorageUsed: number;
    totalTranscriptions: number;
    averageProcessingTime: number;
  };
  quotas: {
    storage: { used: number; limit: number; percentage: number };
    transcriptions: { used: number; limit: number; percentage: number };
    dailyProcessing: { used: number; limit: number; percentage: number };
  };
  recentActivity: Array<{
    id: string;
    type: 'upload' | 'transcription' | 'download';
    description: string;
    timestamp: string;
    status: 'success' | 'failed' | 'in_progress';
  }>;
}
```

**实现:**

```typescript
app.get('/api/dashboard', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    // 获取用户信息
    const user = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId]
    });

    // 获取统计数据
    const videos = await db.execute({
      sql: 'SELECT COUNT(*) as count, SUM(file_size) as totalSize FROM videos WHERE user_id = ?',
      args: [userId]
    });

    const subtitles = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM subtitles WHERE video_id IN (SELECT id FROM videos WHERE user_id = ?)',
      args: [userId]
    });

    // 获取最近活动
    const activities = await db.execute({
      sql: `
        SELECT id, 'upload' as type, title as description, created_at as timestamp, status
        FROM videos WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `,
      args: [userId]
    });

    res.json({
      success: true,
      data: {
        user: user.rows[0],
        statistics: {
          totalVideos: videos.rows[0].count,
          totalStorageUsed: videos.rows[0].totalSize,
          totalTranscriptions: subtitles.rows[0].count,
          averageProcessingTime: 45 // 秒
        },
        quotas: {
          storage: {
            used: user.rows[0].storage_used_gb,
            limit: user.rows[0].quota_storage_gb,
            percentage: (user.rows[0].storage_used_gb / user.rows[0].quota_storage_gb) * 100
          },
          // ... 其他配额
        },
        recentActivity: activities.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 2. 分析和报告

**端点:** `/api/analytics`

```typescript
interface AnalyticsData {
  dateRange: { start: string; end: string };
  uploads: {
    total: number;
    successful: number;
    failed: number;
    byDay: Array<{ date: string; count: number }>;
    byLanguage: Record<string, number>;
  };
  transcriptions: {
    total: number;
    averageDuration: number;
    byLanguage: Record<string, number>;
    costEstimate: number;
  };
  storage: {
    used: number;
    limit: number;
    utilizationTrend: Array<{ date: string; usage: number }>;
  };
}
```

**实现:**

```typescript
app.get('/api/analytics', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 上传统计
    const uploads = await db.execute({
      sql: `
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM videos
        WHERE user_id = ? AND created_at >= ?
      `,
      args: [userId, startDate.toISOString()]
    });

    // 语言分布
    const languages = await db.execute({
      sql: `
        SELECT languages, COUNT(*) as count
        FROM videos
        WHERE user_id = ?
        GROUP BY languages
      `,
      args: [userId]
    });

    res.json({
      success: true,
      data: {
        dateRange: { start: startDate.toISOString(), end: new Date().toISOString() },
        uploads: uploads.rows[0],
        transcriptions: {
          total: 0,
          averageDuration: 45,
          costEstimate: 0
        },
        storage: {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 3. 配额管理和升级

**端点:** `/api/quotas/upgrade`

```typescript
interface QuotaUpgrade {
  from: QuotaLevel;
  to: QuotaLevel;
  price: number;
  benefits: string[];
}

enum QuotaLevel {
  FREE = 'free',        // 10GB, 100 transcriptions/month
  STARTER = 'starter',  // 100GB, 1000 transcriptions/month
  PROFESSIONAL = 'pro', // 1TB, 10000 transcriptions/month
  ENTERPRISE = 'enterprise' // 自定义
}
```

**实现:**

```typescript
const quotaPlans = {
  free: {
    storage_gb: 10,
    transcriptions: 100,
    daily_processing_gb: 1,
    price: 0
  },
  starter: {
    storage_gb: 100,
    transcriptions: 1000,
    daily_processing_gb: 10,
    price: 9.99
  },
  professional: {
    storage_gb: 1000,
    transcriptions: 10000,
    daily_processing_gb: 100,
    price: 49.99
  },
  enterprise: {
    storage_gb: 10000,
    transcriptions: 100000,
    daily_processing_gb: 1000,
    price: 'custom'
  }
};

app.post('/api/quotas/upgrade', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { toLevel } = req.body;

    const plan = quotaPlans[toLevel];
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    // 更新用户配额
    await db.execute({
      sql: `
        UPDATE users SET
          quota_storage_gb = ?,
          quota_transcriptions = ?,
          quota_daily_processing_gb = ?,
          billing_plan = ?
        WHERE id = ?
      `,
      args: [
        plan.storage_gb,
        plan.transcriptions,
        plan.daily_processing_gb,
        toLevel,
        userId
      ]
    });

    // 记录升级
    await db.execute({
      sql: `
        INSERT INTO audit_logs (id, user_id, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        userId,
        'upgrade_plan',
        JSON.stringify({ from: 'free', to: toLevel }),
        new Date().toISOString()
      ]
    });

    res.json({ success: true, message: 'Quota upgraded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 4. 配额重置和管理

```typescript
// D1 迁移：添加新表
CREATE TABLE quota_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reset_type TEXT NOT NULL,  -- 'daily', 'monthly', 'yearly'
  next_reset_date TEXT,
  created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

// 定期任务：重置配额
async function resetDailyQuotas() {
  const today = new Date().toISOString().split('T')[0];
  
  const users = await db.execute({
    sql: 'SELECT id FROM users WHERE processing_date_reset < ?',
    args: [today]
  });

  for (const user of users.rows) {
    await db.execute({
      sql: `
        UPDATE users SET
          processing_today_gb = 0,
          processing_date_reset = ?
        WHERE id = ?
      `,
      args: [today, user.id]
    });
  }
}

async function resetMonthlyQuotas() {
  const today = new Date();
  if (today.getDate() === 1) {
    await db.execute({
      sql: 'UPDATE users SET transcriptions_this_month = 0'
    });
  }
}
```

### 5. 审计日志

```typescript
// 添加表
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

// 记录所有重要操作
async function logAudit(userId: string, action: string, details: any) {
  await db.execute({
    sql: 'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES (?, ?, ?, ?, ?)',
    args: [crypto.randomUUID(), userId, action, JSON.stringify(details), new Date().toISOString()]
  });
}
```

## 🎨 前端仪表板 UI

```html
<!-- /dashboard -->
<div class="dashboard">
  <header>
    <h1>仪表板</h1>
    <div class="user-info">
      <span id="userName"></span>
      <span id="memberSince"></span>
    </div>
  </header>

  <!-- 配额卡片 -->
  <section class="quotas">
    <div class="quota-card">
      <h3>存储空间</h3>
      <div class="progress-bar" id="storageProgress"></div>
      <p id="storageText"></p>
    </div>
    <div class="quota-card">
      <h3>月度转录</h3>
      <div class="progress-bar" id="transcriptionProgress"></div>
      <p id="transcriptionText"></p>
    </div>
    <div class="quota-card">
      <h3>日常处理</h3>
      <div class="progress-bar" id="dailyProgress"></div>
      <p id="dailyText"></p>
    </div>
  </section>

  <!-- 升级按钮 -->
  <section class="upgrade">
    <button onclick="showUpgradeModal()">升级配额</button>
  </section>

  <!-- 统计 -->
  <section class="statistics">
    <div class="stat-card">
      <h4>总视频</h4>
      <p id="totalVideos">0</p>
    </div>
    <div class="stat-card">
      <h4>总转录</h4>
      <p id="totalTranscriptions">0</p>
    </div>
    <div class="stat-card">
      <h4>平均处理时间</h4>
      <p id="avgProcessing">45秒</p>
    </div>
  </section>

  <!-- 最近活动 -->
  <section class="activity">
    <h3>最近活动</h3>
    <div id="activityList"></div>
  </section>
</div>
```

## 📋 数据库迁移

```sql
-- 添加新列到 users 表
ALTER TABLE users ADD COLUMN billing_plan TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN processing_date_reset TEXT DEFAULT CURRENT_DATE;

-- 新建审计日志表
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 新建配额重置表
CREATE TABLE quota_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reset_type TEXT NOT NULL,
  next_reset_date TEXT,
  created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 📱 移动应用计划

**框架:** React Native / Flutter

**功能:**
- 视频上传和转录
- 字幕下载
- 离线播放
- 通知推送
- 暗黑模式

## 🔔 通知系统

```typescript
// 推送通知
async function sendNotification(userId: string, notification: {
  type: 'transcription_complete' | 'quota_warning' | 'system';
  title: string;
  message: string;
  data?: any;
}) {
  // 保存到数据库
  await db.execute({
    sql: 'INSERT INTO notifications (...) VALUES (...)',
    args: [...]
  });

  // 发送 push（如果用户授权）
  // TODO: 实现 Web Push API
}
```

## 📋 检查清单

- [ ] 实现 /api/dashboard 端点
- [ ] 实现 /api/analytics 端点
- [ ] 实现 /api/quotas/upgrade 端点
- [ ] 创建前端仪表板 UI
- [ ] 实现配额重置逻辑
- [ ] 添加审计日志
- [ ] 创建计费系统
- [ ] 实现支付集成（Stripe）
- [ ] 添加通知系统
- [ ] 优化移动端体验

## 🚀 部署

```bash
# 运行数据库迁移
wrangler d1 execute video-subtitle-db --file=migrations/0002_advanced.sql

# 部署更新
wrangler deploy
npm run build && docker push lvxiaoyu/video-subtitle-translator:v1.3.0
```

