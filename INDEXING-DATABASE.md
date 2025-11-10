# Indexing Database Storage

## Overview
Indexing data er nu gemt i PostgreSQL database via Supabase, hvilket giver:
- **Historisk data**: Track URL indexing status over tid
- **Hurtigere loads**: Cached data eliminerer ventetid på Google API calls
- **Trend analyse**: Visualiser hvordan indexing status ændrer sig dagligt
- **URL historik**: Se individuelle URL'ers status-ændringer over tid

## Database Schema

### IndexingSnapshot
Gemmer et snapshot af hele sidens indexing status på en specifik dato.

```prisma
model IndexingSnapshot {
  id              String   @id @default(cuid())
  siteId          String
  snapshotDate    DateTime @db.Date
  
  // Summary counts
  submittedIndexed       Int
  crawledNotIndexed      Int
  discoveredNotIndexed   Int
  unknown                Int
  totalUrls              Int
  inspectedUrls          Int
  
  fetchedAt       DateTime @default(now())
  urlHistories    IndexingUrlHistory[]
}
```

### IndexingUrlHistory
Gemmer detaljer for hver URL's indexing status på en specifik dato.

```prisma
model IndexingUrlHistory {
  id          String   @id @default(cuid())
  siteId      String
  snapshotId  String
  date        DateTime @db.Date
  url         String
  
  // Status classification
  status      String   // 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown'
  coverageState String?
  verdict       String?
  
  // Google Search Console metrics
  clicks      Int
  impressions Int
  ctr         Float
  position    Float
  
  // Crawl information
  lastCrawl           String?
  inspectionFrequency String
  richResults         Boolean
  inspected           Boolean
}
```

## API Flow

### 1. Initial Load (Cached Data)
```
User opens Indexing page
  ↓
API checks: hasRecentIndexingData(siteUrl, 1 day)
  ↓
IF cached data exists:
  → Return cached data immediately (fast!)
  → Load historical trends from IndexingSnapshot table
  → Display with ⚡ "Loaded from cache" indicator
```

### 2. Force Refresh (Fresh Data)
```
User clicks "Refresh All Data"
  ↓
API with forceRefresh=true
  ↓
Fetch from Google Search Console API
  ↓
Stream progress to user (showing inspection status)
  ↓
Save to database:
  → Create/update IndexingSnapshot
  → Bulk insert IndexingUrlHistory records
  ↓
Display with ✅ "Fresh from Google" indicator
```

## Storage Functions

### `saveIndexingSnapshot(siteUrl, data)`
Gemmer et komplet indexing snapshot inkl. alle URL'er.

**Parameters:**
- `siteUrl`: Website URL
- `data`: Object med `snapshotDate`, `summary`, `totalUrls`, `inspectedUrls`, `urls[]`

**Process:**
1. Find/create Site record
2. Upsert IndexingSnapshot (summary counts)
3. Delete old URL histories for same date
4. Bulk insert new URL histories

### `getLatestIndexingSnapshot(siteUrl)`
Henter det seneste snapshot for en site.

**Returns:**
- Complete snapshot with all URLs
- Used for initial page load (cached data)

### `getIndexingHistory(siteUrl, startDate, endDate)`
Henter historiske snapshots for trend charts.

**Returns:**
- Array of daily summaries (date + status counts)
- Used for IndexingStatusChart component

### `getUrlHistory(siteUrl, url, startDate, endDate)`
Henter historik for en specifik URL over tid.

**Returns:**
- Array of URL status changes over time
- Future feature: Per-URL trend analysis

### `hasRecentIndexingData(siteUrl, maxAgeDays)`
Tjekker om vi har recent cached data.

**Returns:**
- `true` if latest snapshot is within `maxAgeDays`
- Used to decide between cache vs. fresh fetch

## Frontend Integration

### Indexing Page (`app/dashboard/indexing/page.tsx`)
1. **Initial Load**: Automatically loads cached data if available
2. **Refresh Button**: Force refresh with `forceRefresh=true`
3. **Cache Indicator**: Shows green banner for cached data, blue for fresh
4. **Status**: `isCachedData` state tracks data source

### Response Handling
The API can return either:
- **JSON response** (cached): Direct object with data
- **SSE stream** (fresh): Server-sent events with progress updates

The frontend automatically detects response type via `content-type` header.

## Performance Benefits

### Before (No Database)
- Every load: 30-60 seconds waiting
- Inspect 100+ URLs every time
- No historical data

### After (With Database)
- First load: 1-2 seconds (cached)
- Historical trends: Instant
- Force refresh: Still 30-60s, but optional
- Daily auto-sync: Via cron jobs (future)

## Future Enhancements

### 1. Automatic Daily Sync
Create a cron job to auto-refresh indexing data daily:
```typescript
// app/api/cron/sync-indexing/route.ts
export async function GET(request: NextRequest) {
  // Sync all sites' indexing data
  // Run at 3 AM daily
}
```

### 2. URL-Level Alerts
Track when URLs change status (e.g., indexed → not indexed):
```typescript
// Compare snapshots
// Alert user of status changes
```

### 3. Historical Charts
Per-URL status history visualization:
- Line chart showing position changes
- Status timeline (indexed vs. not indexed)
- Click trends over time

### 4. Error Categorization
Break down "crawled_not_indexed" into sub-categories:
- Noindex pages
- 404 errors
- Duplicate content
- Blocked by robots.txt
- etc.

## Migration

If you have existing indexing data, no migration is needed. The system will:
1. Start fresh with empty database
2. Build historical data on first refresh
3. Accumulate data over time

## Maintenance

### Clear Old Data
To free up space, periodically delete old snapshots:
```sql
DELETE FROM "IndexingUrlHistory" 
WHERE "date" < NOW() - INTERVAL '90 days';

DELETE FROM "IndexingSnapshot" 
WHERE "snapshotDate" < NOW() - INTERVAL '90 days';
```

### Check Storage Usage
```sql
SELECT 
  COUNT(*) as snapshot_count,
  (SELECT COUNT(*) FROM "IndexingUrlHistory") as url_history_count
FROM "IndexingSnapshot";
```

## Troubleshooting

### "No cached data available"
- First-time users need to run a manual refresh
- Click "Refresh All Data" to populate cache

### "Slow initial load"
- First refresh can take 30-60s for large sites
- Subsequent loads will be instant (cached)

### "Stale data"
- Cache TTL is 24 hours
- Click "Refresh All Data" for latest from Google
- Consider reducing TTL to 12 hours if needed

## Tech Stack
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Storage**: `lib/indexingStorageDb.ts`
- **API**: `app/api/indexing/overview/route.ts`
- **Frontend**: `app/dashboard/indexing/page.tsx`

