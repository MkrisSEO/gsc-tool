# Dashboard Requirements & Functionality

## Data Sources
- **Primary:** PostgreSQL database (via Supabase)
- **Sync:** 3x daily via cron jobs + manual refresh button
- **Cache TTL:** 7 days (relies on cron for freshness)

## Dashboard Elements

### 1. Top Metrics Cards (4 cards)
**Displays:**
- Total Clicks (28-day period)
- Total Impressions (28-day period)
- CTR (28-day average)
- Position 1-3 (Latest day from Query Counting)
- Position 4-10 (Latest day from Query Counting)
- Position 20-30 (Latest day from Query Counting)

**Behavior:**
- When date comparison enabled → Show % change for each metric
- When content group filter active → Calculate from filtered URLs
- When URL filter active → Calculate from that URL's data only
- When query filter active → Calculate from that query's data only

**Data Source:** 
- Clicks/Impressions/CTR: Aggregated from URLs data
- Position metrics: From Query Counting aggregates (latest day)

### 2. Performance Over Time Chart
**Displays:**
- Time series of clicks, impressions, CTR, position
- X-axis: Dates in selected range
- Y-axis: Selected metrics
- Comparison overlay when date comparison enabled

**Behavior:**
- NO FILTERS → Show all site data aggregated by date
- Content group filter → Show only URLs in that group, aggregated by date
- URL filter → Show only that URL's performance over time
- Query filter → Show only that query's performance over time

**Data Source:** 
- Fetch: `['date', 'page']` dimensions from cache
- Aggregate by date (sum clicks/impressions, avg position)

### 3. Query Counting Chart
**Displays:**
- Stacked bar chart showing query position distribution over time
- Categories: 1-3, 4-10, 11-20, 21+
- X-axis: Dates
- Y-axis: Number of queries in each position range

**Behavior:**
- NO FILTERS → Show pre-aggregated data from database (fast!)
- Content group filter → Calculate from queries in that group
- URL filter → Show queries ranking for that URL
- Query filter → Hide (doesn't make sense for single query)

**Data Source:**
- No filter: Pre-aggregated `QueryCountingAggregate` table
- With filter: Calculate from filtered `['query', 'page']` data

### 4. Top Queries Table
**Displays:**
- Top 100 queries by clicks
- Columns: Query, Clicks, Impressions, CTR, Position
- When comparison enabled → Show % changes

**Behavior:**
- NO FILTERS → Show all queries
- Content group filter → Show only queries ranking for URLs in that group
- URL filter → Show only queries ranking for that URL
- Query filter → N/A (query already selected)

**Clicking a query:**
- Sets `selectedQuery` state
- Filters all dashboard data to that query
- Top URLs table shows "Pages" (URLs ranking for that query)

**Data Source:**
- Fetch: `['query', 'page']` dimensions from cache
- Aggregate by query (sum clicks/impressions, avg position)
- Sort by clicks descending

### 5. Top URLs Table
**Displays:**
- All URLs (or top 100 if too many)
- Columns: URL, Clicks, Impressions, CTR, Position
- When comparison enabled → Show % changes

**Behavior:**
- NO FILTERS → Show all URLs
- Content group filter → Show only URLs in that group
- URL filter → Highlight the selected URL (keep table visible)
- Query filter → Show "Pages" (URLs ranking for that query)

**Clicking a URL:**
- Toggle: If same URL clicked → Deselect, else select
- Clears query filter (URL and query filters are mutually exclusive)
- Sets `selectedUrl` state
- Filters all dashboard data to that URL
- Top Queries shows queries ranking for that URL

**Data Source:**
- Fetch: `['page']` dimension from cache
- Aggregate from time series data (server-side in cache)
- Sort by clicks descending

### 6. Content Groups Table
**Displays:**
- All content groups with aggregated metrics
- Columns: Group Name, Clicks, Impressions, CTR, Position
- When comparison enabled → Show % changes

**Behavior:**
- Clicking a group → Toggle filter
- When selected → Highlighted with green background (matching badge color)
- Sets `selectedContentGroupId` state
- Filters all dashboard data to URLs in that group

**Data Source:**
- Uses `rawTopUrls` (unfiltered) to calculate metrics per group
- Stored in database: `ContentGroup` table

## Filter Behavior

### Filter Priority (Most to Least Specific)
1. **Query Filter** - Most specific (single query)
2. **URL Filter** - Single URL
3. **Content Group Filter** - Multiple URLs

### Filter Rules
- Query + URL → Mutually exclusive (selecting one clears the other)
- Query + Content Group → Compatible (can combine)
- URL + Content Group → Compatible (URL must be in group)

### Filter Badges Displayed
When any filter is active, show badges at top:
- **Blue badge:** `Query: {query}` with [×] button
- **Purple badge:** `URL: {url}` with [×] button  
- **Green badge:** `Group: {name}` with [×] button

### Filter State Management
```typescript
const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
const [selectedContentGroupId, setSelectedContentGroupId] = useState<string | null>(null);
```

## Date Range & Comparison

### Date Range
- Default: Last 28 days (minus 2 days for GSC lag)
- User selectable via `AdvancedDateRangeSelector`
- All data fetched for this range

### Date Comparison
- Optional comparison period
- Shows % change for all metrics
- Performance chart shows overlay
- Query Counting chart shows comparison bars

## Data Fetching Strategy

### Without Filters
```javascript
Time Series: GET /api/search-console/searchanalytics
  - dimensions: ['date', 'page']
  - Returns: Date-aggregated data
  - Cache: ✅ From database
  
Queries: GET /api/search-console/searchanalytics
  - dimensions: ['query', 'page']
  - Returns: Query-page combinations
  - Cache: ✅ From database
  
URLs: GET /api/search-console/searchanalytics
  - dimensions: ['page']
  - Returns: URL aggregates
  - Cache: ✅ Aggregated from time series
  
Query Counting: GET /api/query-counting
  - Returns: Pre-aggregated position data
  - Cache: ✅ From QueryCountingAggregate table
```

### With Content Group Filter
```javascript
1. Fetch all data as above (no filters in API call)
2. Frontend filter by contentGroupUrls:
   - Time series: Filter rows where keys[1] (page) is in group
   - Queries: Filter rows where keys[1] (page) is in group, then aggregate by query
   - URLs: Filter where keys[0] (page) is in group
3. Query Counting: Calculate from filtered queries
```

### With URL Filter
```javascript
1. Fetch all data as above
2. Frontend filter by selectedUrl:
   - Time series: Filter rows where keys[1] (page) === selectedUrl
   - Queries: Filter rows where keys[1] (page) === selectedUrl, then aggregate
   - URLs: Highlight selected URL in table
3. Query Counting: Calculate from filtered queries
```

### With Query Filter
```javascript
1. Fetch time series with query dimension: ['date', 'query', 'page']
2. Fetch query-page data for drill-down
3. Frontend filter:
   - Time series: Filter where keys[1] (query) === selectedQuery
   - URLs: Show from query-page data
4. Query Counting: Calculate from query's position over time
```

## Critical Rules

### Metrics Consistency
- **Position metrics (1-3, 4-10, 20-30):** MUST match Query Counting chart
- Both use same data source and calculation method
- User expects these numbers to be identical

### Performance Requirements
- Initial load: < 2 seconds (from cache)
- Filter application: Instant (client-side)
- Refresh sync: 30-60 seconds acceptable

### Cache Matching
For cache hits, dimensions requested must match what's stored:
- Request `['date', 'page']` → Must find rows with query='' and page!=''
- Request `['query', 'page']` → Must find rows with query!='' and page!=''
- Request `['page']` → Aggregate from time series or find rows with query='' and page!=''

## Current Issues to Fix

1. ❌ Performance chart doesn't update with filters
2. ❌ Top metrics don't update with filters
3. ❌ Query Counting doesn't show with filters
4. ❌ Cache dimension matching is broken

## Optimal Solution

### Database Schema
```
GSCDataPoint table stores:
1. Time Series: date + page (query='', page!='')
2. Queries Aggregate: query + page (query!='', page!='', date=endDate)
3. Query Counting: Pre-aggregated by date (QueryCountingAggregate table)
```

### Dashboard Fetch Logic
```typescript
// Always fetch these 3 calls:
1. Time Series: ['date', 'page']
2. Queries: ['query', 'page']  
3. URLs: ['page'] (aggregated from #1)
4. Query Counting: Pre-aggregated (separate endpoint)

// If query selected, add 4th call:
4. Query-Page Details: ['query', 'page'] filtered by query
```

### Filter Application
```typescript
// All filtering happens CLIENT-SIDE after fetching:
1. Filter time series rows by selected filter
2. Aggregate filtered rows by date → Performance chart
3. Aggregate filtered rows by query → Top Queries
4. Aggregate filtered rows by page → Top URLs
5. Calculate Query Counting from filtered queries
6. Calculate metrics from filtered data
```

This ensures:
- ✅ Fast initial load (cache)
- ✅ Instant filter switching (no re-fetch)
- ✅ Consistent metrics
- ✅ All features work together

