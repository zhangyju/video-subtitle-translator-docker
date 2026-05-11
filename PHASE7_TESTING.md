# Phase 7 - Advanced Features Testing Guide

## Overview
Phase 7 adds:
- Database schema for transcription progress, audit logs, and quota tracking
- QuotaService for managing user quotas
- Quota checks on upload and transcription endpoints
- /api/analytics endpoint for comprehensive metrics
- /api/dashboard endpoint for dashboard data
- /dashboard page with HTML UI showing quota usage, video list, and language statistics

## Database Changes
### New Tables
- `transcription_progress`: Tracks transcription status and progress
- `audit_logs`: Tracks all user actions (upload, transcribe, etc.)
- `quota_resets`: Tracks quota usage and resets
- `analytics_summary`: Pre-aggregated analytics data
- `language_statistics`: Language usage tracking

### Migration File
- `/migrations/0002_phase7_advanced_features.sql`: Contains all new table schemas

## Testing Checklist

### 1. Database Migration
- [ ] Apply migration: `wrangler d1 migrations apply video-subtitle-db`
- [ ] Verify tables created: Check if all new tables exist in D1

### 2. Quota Management
- [ ] Test storage quota check:
  - Upload a file near quota limit
  - Verify error when exceeding limit
  - Check storage_used_gb updated in users table

- [ ] Test transcription quota check:
  - Start transcription (should check monthly quota)
  - Verify transcriptions_this_month incremented
  - Try transcribing more than monthly limit (should fail)

- [ ] Test daily processing quota:
  - Upload large file (should check daily quota)
  - Upload multiple files in same day
  - Verify processing_today_gb updated

- [ ] Test daily quota reset:
  - Verify processing_date_reset resets at midnight
  - Check processing_today_gb resets to 0

### 3. Audit Logging
- [ ] Upload video: Check audit_logs has "upload" action
- [ ] Start transcription: Check audit_logs has "transcribe" action
- [ ] Verify action details include title, fileSize, languages

### 4. API Endpoints

#### /api/dashboard
- [ ] Requires authentication (x-user-id header)
- [ ] Returns user info, videos, quota, languages
- [ ] Video list includes:
  - id, title, status, fileSize, languages, languageCount, createdAt, r2Url
- [ ] Quota shows percentage breakdown
- [ ] Top languages sorted by usage count

#### /api/analytics  
- [ ] Requires authentication
- [ ] Returns summary metrics:
  - totalVideos, completedVideos, failedVideos, successRate
  - totalStorageGb, avgProcessingSeconds
- [ ] Returns languageDistribution array
- [ ] Returns actionDistribution array
- [ ] Returns quota usage percentages

### 5. Dashboard UI (/dashboard)
- [ ] Authenticate and navigate to /dashboard
- [ ] Dashboard shows:
  - [ ] Storage quota progress bar and percentage
  - [ ] Transcription quota progress bar and percentage
  - [ ] Daily processing quota progress bar and percentage
  - [ ] Video counts (total, completed, processing, failed)
  - [ ] Video list with title, size, status, languages
  - [ ] Top languages with usage counts
- [ ] All data loads correctly
- [ ] Layout is responsive
- [ ] Logout button works

### 6. End-to-End Flow
- [ ] Register new user
- [ ] Navigate to /dashboard
- [ ] Dashboard should show 0 videos, empty lists
- [ ] Upload video → quota should decrease
- [ ] Check /api/dashboard to verify quota consumed
- [ ] Start transcription → transcription quota should decrease
- [ ] Check audit_logs in database for actions

### 7. Error Handling
- [ ] Upload when storage quota full → shows error message
- [ ] Transcribe when monthly quota full → shows error message  
- [ ] Daily processing quota exceeded → shows error message
- [ ] Invalid user ID → 401 error
- [ ] Database errors → graceful error messages

## Example Test Commands

### Check Database
\`\`\`bash
# Check new tables exist
wrangler d1 execute video-subtitle-db --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check audit logs
wrangler d1 execute video-subtitle-db --command "SELECT * FROM audit_logs LIMIT 5;"

# Check quota resets
wrangler d1 execute video-subtitle-db --command "SELECT * FROM quota_resets;"
\`\`\`

### Test API Endpoints
\`\`\`bash
# Test /api/dashboard
curl -X GET http://localhost:3000/api/dashboard \
  -H "x-user-id: user123"

# Test /api/analytics
curl -X GET http://localhost:3000/api/analytics \
  -H "x-user-id: user123"

# Test upload with quota check
curl -X POST http://localhost:3000/api/upload \
  -H "x-user-id: user123" \
  -F "file=@video.mp4" \
  -F "title=Test Video" \
  -F "languages=[\"en\",\"zh\"]"
\`\`\`

## Performance Considerations
- Dashboard analytics query uses GROUP_CONCAT and multiple JOINs
- For users with 1000+ videos, query may be slow
- Consider adding pagination for video list in future
- analytics_summary table can be pre-generated via background job

## Known Limitations
- Daily quota reset assumes server timezone (should use user's timezone)
- No real-time quota updates (requires page refresh)
- Audit logs grow unbounded (consider archival strategy)
- No quota rollover for monthly limits

## Next Steps After Testing
- [ ] Deploy to production
- [ ] Set up database backups
- [ ] Configure quota limits per user tier
- [ ] Add quota upgrade flow
- [ ] Monitor quota_resets for anomalies
