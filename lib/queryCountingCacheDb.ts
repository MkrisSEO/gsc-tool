/**
 * Query Counting Cache - PostgreSQL version
 * Replaces localStorage chunking with fast database queries
 */

import prisma from './prisma';

interface QueryCountingRow {
  keys: string[]; // [date, query]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Get Query Counting data from cache or return null if not cached
 */
export async function getQueryCountingData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  forceRefresh: boolean = false
): Promise<QueryCountingRow[] | null> {
  console.log(`📊 Query Counting: Checking cache for ${siteUrl}`);

  // Try cache first
  if (!forceRefresh) {
    const cached = await getCachedQueryCountingData(siteUrl, startDate, endDate);
    if (cached) {
      console.log(`✓ Query Counting cache hit: ${cached.length} rows`);
      return cached;
    }
  }

  console.log(`✗ Query Counting cache miss - will be fetched from API`);
  return null;
}

/**
 * Get cached Query Counting data
 */
async function getCachedQueryCountingData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<QueryCountingRow[] | null> {
  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) return null;

    // Query for data with date and query dimensions
    const cachedData = await prisma.gSCDataPoint.findMany({
      where: {
        siteId: site.id,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        query: { not: '' }, // Must have a query
        page: '', // No page dimension
        country: '',
        device: '',
      },
      orderBy: [{ date: 'asc' }, { query: 'asc' }],
    });

    if (cachedData.length === 0) return null;

    // Check freshness
    const mostRecent = cachedData.reduce((latest, current) =>
      current.fetchedAt > latest.fetchedAt ? current : latest
    );

    const ageInHours = (Date.now() - mostRecent.fetchedAt.getTime()) / (1000 * 60 * 60);
    if (ageInHours > 24) {
      console.log(`[Query Counting Cache] Data is stale (${ageInHours.toFixed(1)} hours old)`);
      return null;
    }

    // Transform to QueryCountingRow format
    return cachedData.map((row) => ({
      keys: [row.date.toISOString().split('T')[0], row.query],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  } catch (error) {
    console.error('[Query Counting Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Save Query Counting data to cache
 */
async function saveQueryCountingToCache(
  siteUrl: string,
  rows: QueryCountingRow[]
): Promise<void> {
  if (rows.length === 0) return;

  try {
    // Get or create site
    let site = await prisma.site.findUnique({ where: { siteUrl } });

    if (!site) {
      const user = await prisma.user.findFirst();
      if (!user) {
        console.error('[Query Counting Cache] No user found');
        return;
      }

      site = await prisma.site.create({
        data: {
          siteUrl,
          userId: user.id,
          displayName: siteUrl,
        },
      });
    }

    // Batch insert
    const insertPromises = rows.map((row) =>
      prisma.gSCDataPoint.upsert({
        where: {
          siteId_date_query_page_country_device: {
            siteId: site.id,
            date: new Date(row.keys[0]),
            query: row.keys[1],
            page: '',
            country: '',
            device: '',
          },
        },
        create: {
          siteId: site.id,
          date: new Date(row.keys[0]),
          query: row.keys[1],
          page: '',
          country: '',
          device: '',
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        },
        update: {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          fetchedAt: new Date(),
        },
      })
    );

    // Process in batches
    const BATCH_SIZE = 100;
    let successCount = 0;
    
    for (let i = 0; i < insertPromises.length; i += BATCH_SIZE) {
      const batch = insertPromises.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch);
      
      successCount += results.filter(r => r.status === 'fulfilled').length;
    }

    console.log(`[Query Counting Cache] ✓ Saved ${successCount}/${rows.length} rows`);
  } catch (error) {
    console.error('[Query Counting Cache] Error saving:', error);
  }
}

/**
 * Clear Query Counting cache
 */
export async function clearQueryCountingCache(siteUrl: string): Promise<number> {
  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) return 0;

    const result = await prisma.gSCDataPoint.deleteMany({
      where: {
        siteId: site.id,
        query: { not: '' },
        page: '',
      },
    });

    console.log(`[Query Counting Cache] Cleared ${result.count} rows`);
    return result.count;
  } catch (error) {
    console.error('[Query Counting Cache] Error clearing cache:', error);
    return 0;
  }
}

