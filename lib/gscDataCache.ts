/**
 * GSC Data Caching Service
 * Caches Google Search Console data in PostgreSQL to reduce API calls
 * and enable historical tracking
 */

import prisma from './prisma';

interface GSCDataPoint {
  date: string;
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface CacheOptions {
  forceRefresh?: boolean;
  maxAgeHours?: number; // Default 168 hours (7 days) - rely on cron jobs for freshness
}

/**
 * Get cached GSC data or return null if not cached/stale
 * With cron jobs syncing data regularly, we read from DB and rarely need API calls
 */
export async function getCachedGSCData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  options: CacheOptions = {}
): Promise<GSCDataPoint[] | null> {
  const { forceRefresh = false, maxAgeHours = 168 } = options; // 7 days default

  if (forceRefresh) {
    return null; // Skip cache
  }

  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) return null;

    // Build where clause based on dimensions
    const where: any = {
      siteId: site.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    // Check if we need to filter by dimension presence
    const needsQuery = dimensions.includes('query');
    const needsPage = dimensions.includes('page');
    const needsCountry = dimensions.includes('country');
    const needsDevice = dimensions.includes('device');

    // Match rows based on which dimensions are populated
    // Time series: ['date', 'page'] → query='', page!=''
    // Queries: ['query', 'page'] → query!='', page!=''
    // Query detail: ['date', 'query'] → query!='', page=''
    // URL detail: ['date', 'query', 'page'] → query!='', page!=''
    
    if (dimensions.includes('date') && needsPage && !needsQuery) {
      // Time series data: ['date', 'page']
      where.query = '';
      where.page = { not: '' };
    } else if (dimensions.includes('date') && needsQuery && !needsPage) {
      // Query detail page: ['date', 'query']
      where.query = { not: '' };
      where.page = '';
    } else if (dimensions.includes('date') && needsQuery && needsPage) {
      // URL detail page or full data: ['date', 'query', 'page']
      where.query = { not: '' };
      where.page = { not: '' };
    } else if (needsQuery && needsPage && !dimensions.includes('date')) {
      // Queries aggregate data: ['query', 'page']
      where.query = { not: '' };
      where.page = { not: '' };
    } else if (needsPage && !needsQuery && !dimensions.includes('date')) {
      // URLs aggregate data: ['page'] only
      where.query = '';
      where.page = { not: '' };
    } else {
      // Fallback for other combinations
      if (!needsQuery) where.query = '';
      if (!needsPage) where.page = '';
    }
    
    if (!needsCountry) where.country = '';
    if (!needsDevice) where.device = '';

    console.log('[GSC Cache] Query params:', {
      siteUrl,
      dateRange: { startDate, endDate },
      dimensions,
      whereClause: { ...where, siteId: site.id },
    });

    // Check cache freshness - find most recent data point
    const mostRecent = await prisma.gSCDataPoint.findFirst({
      where,
      orderBy: { fetchedAt: 'desc' },
    });

    console.log('[GSC Cache] Most recent data point:', mostRecent ? {
      date: mostRecent.date,
      fetchedAt: mostRecent.fetchedAt,
      ageHours: (Date.now() - mostRecent.fetchedAt.getTime()) / (1000 * 60 * 60),
    } : 'null (no data found)');

    if (!mostRecent) return null;

    // Check if data is fresh enough
    const ageInHours = (Date.now() - mostRecent.fetchedAt.getTime()) / (1000 * 60 * 60);
    if (ageInHours > maxAgeHours) {
      console.log(`[GSC Cache] Data is stale (${ageInHours.toFixed(1)} hours old), needs refresh`);
      return null;
    }

    // Fetch all cached data
    const cachedData = await prisma.gSCDataPoint.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (cachedData.length === 0) return null;

    console.log(`[GSC Cache] ✓ Cache hit: ${cachedData.length} rows (${ageInHours.toFixed(1)} hours old)`);

    // If requesting ONLY ['page'] dimension (URLs aggregate), aggregate from time series data
    if (dimensions.length === 1 && dimensions[0] === 'page') {
      console.log('[GSC Cache] Aggregating URLs from time series data...');
      
      const pageMap = new Map<string, {
        clicks: number;
        impressions: number;
        position: number;
        count: number;
      }>();
      
      cachedData.forEach((row) => {
        const page = row.page;
        if (!page) return;
        
        if (!pageMap.has(page)) {
          pageMap.set(page, { clicks: 0, impressions: 0, position: 0, count: 0 });
        }
        
        const entry = pageMap.get(page)!;
        entry.clicks += row.clicks;
        entry.impressions += row.impressions;
        entry.position += row.position;
        entry.count += 1;
      });
      
      return Array.from(pageMap.entries()).map(([page, data]) => ({
        page,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
        position: data.count > 0 ? data.position / data.count : 0,
      }));
    }

    // Transform to match GSC API format
    return cachedData.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      query: row.query !== '' ? row.query : undefined,
      page: row.page !== '' ? row.page : undefined,
      country: row.country !== '' ? row.country : undefined,
      device: row.device !== '' ? row.device : undefined,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  } catch (error) {
    console.error('[GSC Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Save GSC data to cache
 */
export async function saveGSCDataToCache(
  siteUrl: string,
  data: GSCDataPoint[]
): Promise<{ success: boolean; errors: string[] }> {
  if (data.length === 0) return { success: true, errors: [] };

  const errors: string[] = [];

  try {
    // Get or create site
    let site = await prisma.site.findUnique({ where: { siteUrl } });

    if (!site) {
      const user = await prisma.user.findFirst();
      if (!user) {
        console.error('[GSC Cache] No user found, cannot create site');
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

    // Update last synced timestamp
    await prisma.site.update({
      where: { id: site.id },
      data: { lastSyncedAt: new Date() },
    });

    // Batch insert with upsert (update if exists, insert if not)
    const insertPromises = data.map((row) =>
      prisma.gSCDataPoint.upsert({
        where: {
          siteId_date_query_page_country_device: {
            siteId: site.id,
            date: new Date(row.date),
            query: row.query || '',
            page: row.page || '',
            country: row.country || '',
            device: row.device || '',
          },
        },
        create: {
          siteId: site.id,
          date: new Date(row.date),
          query: row.query || '',
          page: row.page || '',
          country: row.country || '',
          device: row.device || '',
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

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < insertPromises.length; i += BATCH_SIZE) {
      const batch = insertPromises.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch);
      
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
          const errorMsg = result.reason?.message || String(result.reason);
          if (errorCount <= 5) { // Collect first 5 errors
            errors.push(`Row ${i + idx}: ${errorMsg}`);
          }
          console.error(`[GSC Cache] Insert error for row ${i + idx}:`, errorMsg);
        }
      });
    }

    console.log(`[GSC Cache] Saved ${successCount}/${data.length} rows to cache for ${siteUrl}`, {
      errors: errorCount,
      sampleRow: data[0],
      dimensions: Object.keys(data[0]).filter(k => data[0][k] !== undefined),
    });

    return { success: successCount > 0, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GSC Cache] Error saving to cache:', errorMsg);
    errors.push(`General error: ${errorMsg}`);
    return { success: false, errors };
  }
}

/**
 * Get cache statistics for a site
 */
export async function getCacheStats(siteUrl: string): Promise<{
  totalDataPoints: number;
  dateRange: { start: string; end: string } | null;
  lastUpdated: string | null;
  sizeEstimate: string;
} | null> {
  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
      include: {
        gscData: {
          orderBy: { date: 'asc' },
          select: {
            date: true,
            fetchedAt: true,
          },
        },
      },
    });

    if (!site || site.gscData.length === 0) return null;

    const dates = site.gscData.map((d) => d.date);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    const mostRecent = site.gscData.reduce((latest, current) =>
      current.fetchedAt > latest.fetchedAt ? current : latest
    );

    // Estimate size (rough calculation)
    const avgBytesPerRow = 200; // Approximate
    const totalBytes = site.gscData.length * avgBytesPerRow;
    const sizeEstimate =
      totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(totalBytes / 1024).toFixed(2)} KB`;

    return {
      totalDataPoints: site.gscData.length,
      dateRange: {
        start: firstDate.toISOString().split('T')[0],
        end: lastDate.toISOString().split('T')[0],
      },
      lastUpdated: mostRecent.fetchedAt.toISOString(),
      sizeEstimate,
    };
  } catch (error) {
    console.error('[GSC Cache] Error getting cache stats:', error);
    return null;
  }
}

/**
 * Clear cache for a site (optionally by date range)
 */
export async function clearGSCCache(
  siteUrl: string,
  startDate?: string,
  endDate?: string
): Promise<number> {
  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) return 0;

    const where: any = { siteId: site.id };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const result = await prisma.gSCDataPoint.deleteMany({ where });

    console.log(`[GSC Cache] Cleared ${result.count} rows for ${siteUrl}`);
    return result.count;
  } catch (error) {
    console.error('[GSC Cache] Error clearing cache:', error);
    return 0;
  }
}

/**
 * Clean up old data (beyond Google's 16 month retention)
 */
export async function cleanupOldData(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 16);

    const result = await prisma.gSCDataPoint.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    });

    console.log(`[GSC Cache] Cleaned up ${result.count} old data points (>16 months)`);
    return result.count;
  } catch (error) {
    console.error('[GSC Cache] Error cleaning up old data:', error);
    return 0;
  }
}

