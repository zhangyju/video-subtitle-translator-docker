# Phase 7 - Deployment & Release Guide

## 🚀 Quick Start Deployment

### Prerequisites
- Docker installed and running
- Docker Hub account (lvxiaoyu)
- Cloudflare Workers CLI (wrangler) installed
- Access to Cloudflare account
- Database access

### Step 1: Build Docker Image

```bash
# Navigate to project directory
cd /tmp/clean-repo

# Run the build script
./build-and-push.sh

# Or manually build
docker build -t lvxiaoyu/video-subtitle-translator:1.4.0 \
              -t lvxiaoyu/video-subtitle-translator:latest .
```

### Step 2: Push to Docker Hub

```bash
docker login -u lvxiaoyu

docker push lvxiaoyu/video-subtitle-translator:1.4.0
docker push lvxiaoyu/video-subtitle-translator:latest
```

### Step 3: Apply Database Migration

```bash
# Apply migration to D1
wrangler d1 migrations apply video-subtitle-db

# Verify migration
wrangler d1 execute video-subtitle-db --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Expected output should include new tables:
# - audit_logs
# - analytics_summary
# - language_statistics
# - quota_resets
# - transcription_progress
```

### Step 4: Deploy Workers Code

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Verify deployment
curl https://subtitle.myzhangyujie.com/api/progress/test
```

### Step 5: Smoke Tests

```bash
# Test dashboard endpoint
curl -X GET https://subtitle.myzhangyujie.com/api/dashboard \
     -H "x-user-id: test-user"

# Test analytics endpoint
curl -X GET https://subtitle.myzhangyujie.com/api/analytics \
     -H "x-user-id: test-user"

# Test dashboard page
curl https://subtitle.myzhangyujie.com/dashboard
```

## 📋 Detailed Deployment Steps

### 1. Code Review & Validation

```bash
# Check code changes
git log --oneline -5

# Verify file changes
git diff HEAD~1 HEAD --stat

# Check TypeScript compilation
npx tsc --noEmit
```

### 2. Database Backup (IMPORTANT!)

```bash
# Backup current database
wrangler d1 export video-subtitle-db > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup size
ls -lh backup_*.sql

# Keep backup for 30 days minimum
```

### 3. Apply Migration

```bash
# Check pending migrations
wrangler d1 migrations list video-subtitle-db

# Apply all pending migrations
wrangler d1 migrations apply video-subtitle-db

# Verify each new table
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM audit_logs;"
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM transcription_progress;"
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM quota_resets;"
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM analytics_summary;"
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM language_statistics;"
```

### 4. Deploy Code

```bash
# Update Workers code
wrangler deploy

# Verify deployment successful
curl -v https://subtitle.myzhangyujie.com/api/health
```

### 5. Verify Features

#### Dashboard Page
```bash
# Load dashboard page
curl -s https://subtitle.myzhangyujie.com/dashboard | grep -o "<title>.*</title>"

# Expected output: <title>用户仪表板 - 视频字幕翻译器</title>
```

#### API Endpoints
```bash
# Test /api/dashboard
curl -X GET https://subtitle.myzhangyujie.com/api/dashboard \
     -H "x-user-id: user123" \
     -H "Content-Type: application/json" | jq .data.quota

# Test /api/analytics
curl -X GET https://subtitle.myzhangyujie.com/api/analytics \
     -H "x-user-id: user123" | jq .data.summary

# Test quota on upload
curl -X POST https://subtitle.myzhangyujie.com/api/upload \
     -H "x-user-id: user123" \
     -F "file=@test.mp4" \
     -F "title=Test Video" | jq .
```

### 6. Monitor

```bash
# Check error logs
tail -f /var/log/cloudflare-workers.log

# Monitor database queries
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM audit_logs WHERE created_at > datetime('now', '-1 hour');"

# Check recent audit logs
wrangler d1 execute video-subtitle-db --command "SELECT action, COUNT(*) as count FROM audit_logs WHERE created_at > datetime('now', '-1 hour') GROUP BY action;"
```

## ✅ Post-Deployment Verification

### Automated Tests

```bash
#!/bin/bash
# test-phase7.sh

BASE_URL="https://subtitle.myzhangyujie.com"
USER_ID="test-user-$(date +%s)"

echo "Testing Phase 7 Features..."

# Test 1: Dashboard page loads
echo "✓ Testing /dashboard page..."
if curl -s $BASE_URL/dashboard | grep -q "User Dashboard"; then
  echo "  ✅ Dashboard page loads successfully"
else
  echo "  ❌ Dashboard page failed to load"
  exit 1
fi

# Test 2: Dashboard API
echo "✓ Testing /api/dashboard..."
if curl -s -X GET $BASE_URL/api/dashboard -H "x-user-id: $USER_ID" | jq -e '.success' > /dev/null; then
  echo "  ✅ Dashboard API works"
else
  echo "  ❌ Dashboard API failed"
  exit 1
fi

# Test 3: Analytics API
echo "✓ Testing /api/analytics..."
if curl -s -X GET $BASE_URL/api/analytics -H "x-user-id: $USER_ID" | jq -e '.data.summary' > /dev/null; then
  echo "  ✅ Analytics API works"
else
  echo "  ❌ Analytics API failed"
  exit 1
fi

# Test 4: Database tables exist
echo "✓ Checking database tables..."
TABLES=("audit_logs" "transcription_progress" "quota_resets" "analytics_summary" "language_statistics")
for table in "${TABLES[@]}"; do
  if wrangler d1 execute video-subtitle-db --command "SELECT 1 FROM $table LIMIT 1;" 2>/dev/null; then
    echo "  ✅ Table '$table' exists"
  else
    echo "  ❌ Table '$table' missing"
    exit 1
  fi
done

echo ""
echo "✅ All Phase 7 tests passed!"
```

### Manual Verification Checklist

- [ ] Can navigate to /dashboard
- [ ] Dashboard requires authentication (redirects if no token)
- [ ] Dashboard shows quota cards with progress bars
- [ ] Video list displays with proper formatting
- [ ] Language statistics show top languages
- [ ] Logout button works
- [ ] /api/dashboard returns correct JSON structure
- [ ] /api/analytics returns all metrics
- [ ] Quota enforcement works on upload
- [ ] Audit logs record user actions
- [ ] No errors in browser console
- [ ] Mobile responsive layout works

## 🔄 Rollback Procedure

If critical issues occur:

### Quick Rollback (if not yet committed to main)

```bash
# Revert to previous version
git revert HEAD
git push
wrangler deploy
```

### Full Rollback (if committed)

```bash
# Create rollback commit
git revert HEAD -m 1
git push

# Redeploy
wrangler deploy

# If database issues, drop new tables
wrangler d1 execute video-subtitle-db --command "DROP TABLE IF EXISTS audit_logs, transcription_progress, quota_resets, analytics_summary, language_statistics;"
```

### Database Recovery

```bash
# Restore from backup
wrangler d1 restore video-subtitle-db < backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM videos;"
```

## 📊 Post-Deployment Monitoring

### Daily Tasks

```bash
# Check for errors
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM audit_logs WHERE created_at > datetime('now', '-24 hours') AND action = 'error';"

# Monitor slow queries
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM analytics_summary WHERE created_at > datetime('now', '-24 hours');"

# Check quota resets
wrangler d1 execute video-subtitle-db --command "SELECT COUNT(*) FROM quota_resets WHERE reset_at > datetime('now', '-24 hours');"
```

### Weekly Tasks

```bash
# Review analytics summary
wrangler d1 execute video-subtitle-db --command "SELECT DATE(created_at) as date, COUNT(*) as count FROM audit_logs GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 7;"

# Check database size
wrangler d1 execute video-subtitle-db --command "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"

# Review failed operations
wrangler d1 execute video-subtitle-db --command "SELECT action, COUNT(*) FROM audit_logs WHERE details LIKE '%error%' GROUP BY action;"
```

## 🆘 Troubleshooting

### Dashboard Not Loading

```bash
# Check if endpoint is accessible
curl -v https://subtitle.myzhangyujie.com/dashboard

# Check browser console for errors
# Open DevTools (F12) → Console tab
# Check for 401 errors (authentication required)
# Check for 500 errors (server error)
```

### Quota Not Being Enforced

```bash
# Check if QuotaService is working
# Test quota check:
curl -X POST https://subtitle.myzhangyujie.com/api/upload \
     -H "x-user-id: quota-test-user" \
     -F "file=@large-file.mp4" \
     -v

# Should return 400 if quota exceeded
```

### Database Migration Failed

```bash
# Check migration status
wrangler d1 migrations list video-subtitle-db

# If migration failed, check error
# Manually retry migration
wrangler d1 migrations apply video-subtitle-db --yes

# If still failing, check migration SQL syntax
cat migrations/0002_phase7_advanced_features.sql | head -20
```

### Analytics Endpoint Slow

```bash
# Check database performance
# This query might be slow for users with many videos:
wrangler d1 execute video-subtitle-db --command "SELECT video_id, GROUP_CONCAT(language_code) FROM video_languages WHERE user_id = 'test' GROUP BY video_id;"

# Solution: Add index if not exists
wrangler d1 execute video-subtitle-db --command "CREATE INDEX IF NOT EXISTS idx_video_languages_user_video ON video_languages(user_id, video_id);"
```

## 📞 Support & Contact

For issues or questions:
- Check PHASE7_TESTING.md for known issues
- Review error logs in CloudFlare dashboard
- Check D1 query logs for SQL errors
- Contact: [your-contact-info]

---

**Deployment Date**: May 11, 2024
**Version**: v1.4.0
**Status**: Ready for Production

