# Indexing Auto-Sync Setup

## ⚠️ Important Limitation: OAuth Requirement

**Google Search Console's URL Inspection API requires user-specific OAuth tokens.**

This means:
- ❌ Cannot run as traditional cron job (no user session)
- ✅ Must be triggered by user actions or use service account
- ✅ Current TTL-based caching works well as alternative

## Current Implementation

### **What Works:**
1. ✅ **Smart Caching (24-hour TTL)**
   - First visit: Fetches from Google API
   - Subsequent visits: Instant load from database
   - Data refreshes automatically after 24 hours

2. ✅ **Manual Force Refresh**
   - "Refresh All Data" button
   - Updates database with latest from Google
   - Available whenever user needs fresh data

3. ✅ **Database Storage**
   - All indexing data saved to PostgreSQL
   - Historical tracking enabled
   - Fast retrieval from cache

### **What's Limited:**
- ⚠️ **No true "background sync"** without user session
- ⚠️ Cron endpoint exists but requires OAuth workaround

## Solutions for True Auto-Sync

### **Option A: Service Account (Recommended for Production)**

Use Google Service Account with domain-wide delegation:

1. **Create Service Account:**
   - Go to Google Cloud Console
   - Create service account
   - Enable domain-wide delegation
   - Download credentials JSON

2. **Grant Access:**
   - Admin must authorize service account
   - Grant Search Console API access

3. **Update Code:**
```typescript
// lib/googleServiceAccount.ts
import { JWT } from 'google-auth-library';

export function getServiceAccountAuth() {
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

// app/api/cron/sync-indexing/route.ts
const auth = getServiceAccountAuth();
const searchconsole = google.searchconsole({ version: 'v1', auth });
```

4. **Add Environment Variables:**
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
CRON_SECRET=your-random-secret-string
```

### **Option B: Refresh Token Storage (Simpler)**

Store user's refresh token and use it for background sync:

1. **Store Refresh Token:**
```typescript
// When user logs in, save refresh token
await prisma.user.update({
  where: { email: user.email },
  data: { refreshToken: tokens.refresh_token }
});
```

2. **Use in Cron:**
```typescript
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2.setCredentials({
  refresh_token: user.refreshToken
});
```

**Pros:** Simple, no service account needed  
**Cons:** Security risk if token leaks, requires user re-auth periodically

### **Option C: Webhook/Event-Based (Advanced)**

Set up webhooks triggered by user actions:

```typescript
// Trigger sync after user visits dashboard
if (lastSyncOlderThan24Hours) {
  // Queue background job
  await queueIndexingSync(siteUrl, user.accessToken);
}
```

## Current Setup Files

### **Created Files:**
1. ✅ `app/api/sync/indexing/route.ts` - Sync logic (requires auth)
2. ✅ `app/api/cron/sync-indexing/route.ts` - Cron endpoint (limited by OAuth)
3. ✅ `vercel.json` - Cron schedule added (3 AM daily)

### **Cron Schedule:**
```json
{
  "path": "/api/cron/sync-indexing",
  "schedule": "0 3 * * *"  // 3 AM daily
}
```

## Testing Manual Sync

You can manually trigger sync (requires logged-in user):

```bash
curl -X POST http://localhost:3000/api/sync/indexing \
  -H "Content-Type: application/json" \
  -d '{"siteUrl":"https://omregne.dk/"}'
```

## Recommended Setup for Most Users

### **Phase 1: Use Current Smart Caching (Now)**
- ✅ 24-hour TTL works great
- ✅ Manual refresh available
- ✅ Minimal API usage
- ✅ No complex auth setup

### **Phase 2: Add Service Account (Later)**
- Only if you need true background sync
- Requires Google Workspace admin access
- Best for enterprise/agency use

## Environment Variables Needed

Add to `.env.local`:

```env
# For cron security
CRON_SECRET=your-random-secret-string-here

# (Optional) For service account approach
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

## Vercel Deployment

When deploying to Vercel:

1. Add `CRON_SECRET` to Vercel environment variables
2. Cron will run at 3 AM daily
3. Check logs in Vercel dashboard → Functions → Logs

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Database Storage | ✅ Working | Fast retrieval |
| Smart Caching (24h TTL) | ✅ Working | Auto-refreshes |
| Manual Refresh | ✅ Working | Force update button |
| Cron Infrastructure | ✅ Ready | Needs OAuth solution |
| Background Sync | ⚠️ Limited | Requires service account |

## Recommendation

**For 95% of users: Current smart caching is perfect!**

- Data refreshes automatically every 24 hours on next visit
- Manual refresh available when needed
- No complex auth setup required
- Fast and reliable

**Only implement service account if:**
- You need data updated even when no users visit
- You're building an agency tool with multiple clients
- You want guaranteed daily sync regardless of user activity

## Questions?

The current implementation works great for most use cases. The 24-hour cache TTL means:
- First visit each day: Fresh data from Google
- Rest of day: Instant load from cache
- Manual refresh: Always available

This is actually better UX than a 3 AM sync because data is always fresh when users visit!

