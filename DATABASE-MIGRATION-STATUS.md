# Database Migration Status

## ✅ Fuldt Migreret til PostgreSQL

### 1. **Main Dashboard** (`/dashboard`)
- ✅ GSC Data Caching (GSCDataPoint table)
- ✅ Query Counting Aggregates (QueryCountingAggregate table)
- ✅ Content Groups (ContentGroup table)
- ✅ Time Series data
- ✅ Queries & URLs aggregates
- **Performance:** Fast loads from database cache

### 2. **GEO Tracking** (`/dashboard/geo`)
- ✅ GEO Queries (GEOQuery table)
- ✅ Test Results (GEOTestResult table)
- ✅ Citation tracking
- ✅ Competitor analysis
- **Migration:** Completed with `scripts/migrate-to-database.ts`

### 3. **Content Groups** (`/dashboard` - sidebar)
- ✅ Group definitions (ContentGroup table)
- ✅ URL matching patterns
- ✅ Metrics calculation
- **Storage:** Fully database-backed

### 4. **Indexing** (`/dashboard/indexing`)
- ✅ Indexing Snapshots (IndexingSnapshot table)
- ✅ URL History (IndexingUrlHistory table)
- ✅ Historical trends & status tracking
- ✅ Smart caching (1-day TTL)
- ✅ Force refresh button
- **Performance:** Instant loads from cache, tracks status over tid
- **Documentation:** See `INDEXING-DATABASE.md`

## ⚠️ Delvist Migreret

### 5. **Annotations** (`/dashboard/annotations`)
- ✅ Database model exists (Annotation table)
- ❌ **Still using file-based storage** (`lib/annotationsStorage.ts`)
- ❌ API routes use `annotationsStorage` instead of Prisma
- **Action needed:** Switch API to use database

## ❓ Needs Review

### 6. **Optimize** (`/dashboard/optimize`)
- Keyword cannibalization detection
- Uses GSC API data directly
- No persistent storage
- **Status:** ✅ No migration needed

### 7. **Query Detail** (`/dashboard/query`)
- Shows detail for a single query
- Uses GSC API data directly
- Could benefit from caching
- **Status:** ⚠️ Could use database cache

### 8. **URL Detail** (`/dashboard/url`)
- Shows detail for a single URL
- Uses GSC API data directly
- Could benefit from caching
- **Status:** ⚠️ Could use database cache

### 9. **Settings** (`/dashboard/settings`)
- User preferences
- No persistent storage currently
- **Status:** ✅ No migration needed (or could add if needed)

## Migration Priority

### High Priority
1. **Annotations** - Schema exists, just need to switch API routes

### Medium Priority  
2. **Query Detail Page** - Use cached GSCDataPoint data
3. **URL Detail Page** - Use cached GSCDataPoint data

### Low Priority / Optional
4. Settings (if we want to persist user preferences)

## Database Schema Summary

```prisma
✅ User
✅ Site
✅ GSCDataPoint (caches all GSC data)
✅ QueryCountingAggregate (pre-aggregated)
✅ GEOQuery (GEO tracking queries)
✅ GEOTestResult (GEO test results)
✅ Annotation (annotations - schema ready, not yet used)
✅ ContentGroup (content groups)
✅ ContentGeneration (future: AI content)
✅ IndexingSnapshot (indexing overview per date)
✅ IndexingUrlHistory (per-URL indexing status over time)
```

## Next Steps

1. Migrate Annotations API to use Prisma
2. Update Query/URL detail pages to use cache
3. Test all tabs work with database
4. Remove old file-based storage code

