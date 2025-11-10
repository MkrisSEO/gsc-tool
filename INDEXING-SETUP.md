# Indexing Database Setup

## Quick Start

### 1. Run Migration
Start din dev server og kør migration:

```bash
npm run dev
```

I en ny terminal:
```bash
npx prisma db push
```

Dette opretter `IndexingSnapshot` og `IndexingUrlHistory` tabellerne.

### 2. Test Functionality

1. **Gå til Indexing page:**
   ```
   http://localhost:3000/dashboard/indexing?site=https://omregne.dk/
   ```

2. **Første gang (tom cache):**
   - Vælg en date range
   - Data vil blive hentet fra Google API (30-60 sekunder)
   - Progress bar viser hvor langt du er
   - Data gemmes automatisk i database

3. **Anden gang (cached data):**
   - Page loader øjeblikkeligt (<2 sekunder)
   - Grøn banner viser "⚡ Loaded from cache"
   - Historiske trends vises hvis tilgængelige

4. **Force Refresh:**
   - Klik "🔄 Refresh All Data" knappen
   - Henter fresh data fra Google API
   - Opdaterer database cache

## What You'll See

### Cache Indicator
- **Green Banner (⚡):** Data from cache (fast)
- **Blue Banner (✅):** Fresh from Google API (just synced)

### Features
- ✅ Instant page loads (after first sync)
- ✅ Historical trend charts
- ✅ Per-URL status tracking
- ✅ Smart caching (24-hour TTL)
- ✅ Manual refresh option

## How It Works

```
First Visit:
User → API → Check cache (empty) → Fetch Google API → Save to DB → Display

Subsequent Visits:
User → API → Check cache (found) → Return cached data → Display (instant!)

Force Refresh:
User → Click Refresh → Fetch Google API → Update DB → Display
```

## Database Tables

### IndexingSnapshot
Stores one snapshot per site per day:
- Summary counts (indexed, not indexed, etc.)
- Total URLs inspected
- Timestamp

### IndexingUrlHistory
Stores details for each URL:
- URL
- Status (indexed, crawled_not_indexed, etc.)
- Metrics (clicks, impressions, CTR, position)
- Crawl info (last crawl, frequency, rich results)

## Verify Database

Check if tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('IndexingSnapshot', 'IndexingUrlHistory');
```

Check data:
```sql
-- Count snapshots
SELECT COUNT(*) FROM "IndexingSnapshot";

-- View latest snapshot
SELECT 
  "snapshotDate",
  "totalUrls",
  "submittedIndexed",
  "crawledNotIndexed",
  "fetchedAt"
FROM "IndexingSnapshot"
ORDER BY "snapshotDate" DESC
LIMIT 5;

-- Count URL histories
SELECT 
  COUNT(*) as total_urls,
  status,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM "IndexingUrlHistory"
GROUP BY status;
```

## Troubleshooting

### "Can't reach database server"
- Make sure dev server is running
- Check `.env.local` has `DATABASE_URL` and `DIRECT_URL`
- Try restarting dev server

### "No cached data"
- Expected on first visit
- Click "Refresh All Data" to populate cache
- Subsequent visits will be fast

### "Slow refresh"
- First refresh can take 30-60s for large sites
- This is normal (inspecting 100+ URLs with Google API)
- Future visits use cache (fast!)

### Migration errors
If you see Prisma errors, try:
```bash
npx prisma generate
npx prisma db push --force-reset
```

⚠️ **Warning:** `--force-reset` will delete all data. Only use in development.

## Performance Comparison

### Before (No Database)
- Every page visit: 30-60 seconds
- No historical data
- Heavy API usage

### After (With Database)
- First visit: 30-60 seconds (one-time)
- Subsequent visits: <2 seconds
- Historical trends included
- Minimal API usage

## Next Steps

1. ✅ Test basic functionality
2. ✅ Verify caching works
3. ✅ Check historical data accumulates
4. 🔄 Optional: Set up daily auto-sync cron job
5. 🔄 Optional: Add URL-level alerts for status changes

## Files Modified

- ✅ `prisma/schema.prisma` - Added IndexingSnapshot & IndexingUrlHistory models
- ✅ `lib/indexingStorageDb.ts` - New storage functions
- ✅ `app/api/indexing/overview/route.ts` - Added caching logic
- ✅ `app/dashboard/indexing/page.tsx` - Added refresh button & cache indicator
- ✅ `INDEXING-DATABASE.md` - Full documentation
- ✅ `DATABASE-MIGRATION-STATUS.md` - Updated status

## Support

For mere info, se:
- `INDEXING-DATABASE.md` - Detaljeret dokumentation
- `DATABASE-MIGRATION-STATUS.md` - Migration oversigt

