import prisma from './prisma';

export interface IndexingStatus {
  submitted_indexed: number;
  crawled_not_indexed: number;
  discovered_not_indexed: number;
  unknown: number;
}

export interface IndexingUrlData {
  url: string;
  status: 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown';
  coverageState?: string | null;
  verdict?: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  lastCrawl?: string | null;
  inspectionFrequency: string;
  richResults: boolean;
  inspected: boolean;
}

export interface IndexingSnapshotData {
  snapshotDate: string; // YYYY-MM-DD
  summary: IndexingStatus;
  totalUrls: number;
  inspectedUrls: number;
  urls: IndexingUrlData[];
}

/**
 * Save indexing snapshot to database
 */
export async function saveIndexingSnapshot(
  siteUrl: string,
  data: IndexingSnapshotData
): Promise<void> {
  console.log(`📦 [IndexingStorageDb] Saving snapshot for ${siteUrl} on ${data.snapshotDate}`);
  
  try {
    // Find or create site
    const site = await prisma.site.upsert({
      where: { siteUrl },
      create: {
        siteUrl,
        userId: 'system', // Will be overridden by actual user in production
      },
      update: {
        lastSyncedAt: new Date(),
      },
    });

    const snapshotDate = new Date(data.snapshotDate);

    // Create or update snapshot
    const snapshot = await prisma.indexingSnapshot.upsert({
      where: {
        siteId_snapshotDate: {
          siteId: site.id,
          snapshotDate,
        },
      },
      create: {
        siteId: site.id,
        snapshotDate,
        submittedIndexed: data.summary.submitted_indexed,
        crawledNotIndexed: data.summary.crawled_not_indexed,
        discoveredNotIndexed: data.summary.discovered_not_indexed,
        unknown: data.summary.unknown,
        totalUrls: data.totalUrls,
        inspectedUrls: data.inspectedUrls,
      },
      update: {
        submittedIndexed: data.summary.submitted_indexed,
        crawledNotIndexed: data.summary.crawled_not_indexed,
        discoveredNotIndexed: data.summary.discovered_not_indexed,
        unknown: data.summary.unknown,
        totalUrls: data.totalUrls,
        inspectedUrls: data.inspectedUrls,
        fetchedAt: new Date(),
      },
    });

    console.log(`✅ [IndexingStorageDb] Snapshot saved: ${snapshot.id}`);

    // Save URL histories in bulk
    if (data.urls.length > 0) {
      console.log(`📝 [IndexingStorageDb] Saving ${data.urls.length} URL histories...`);

      // Use createMany with skipDuplicates for efficient bulk insert
      const urlHistories = data.urls.map((urlData) => ({
        siteId: site.id,
        snapshotId: snapshot.id,
        date: snapshotDate,
        url: urlData.url,
        status: urlData.status,
        coverageState: urlData.coverageState || null,
        verdict: urlData.verdict || null,
        clicks: urlData.clicks,
        impressions: urlData.impressions,
        ctr: urlData.ctr,
        position: urlData.position,
        lastCrawl: urlData.lastCrawl || null,
        inspectionFrequency: urlData.inspectionFrequency,
        richResults: urlData.richResults,
        inspected: urlData.inspected,
      }));

      // Delete existing URL histories for this snapshot date
      await prisma.indexingUrlHistory.deleteMany({
        where: {
          siteId: site.id,
          date: snapshotDate,
        },
      });

      // Insert new URL histories
      await prisma.indexingUrlHistory.createMany({
        data: urlHistories,
        skipDuplicates: true,
      });

      console.log(`✅ [IndexingStorageDb] ${data.urls.length} URL histories saved`);
    }

    console.log(`✅ [IndexingStorageDb] Snapshot saved successfully`);
  } catch (error) {
    console.error('❌ [IndexingStorageDb] Error saving snapshot:', error);
    throw error;
  }
}

/**
 * Get the latest indexing snapshot for a site
 */
export async function getLatestIndexingSnapshot(
  siteUrl: string
): Promise<IndexingSnapshotData | null> {
  console.log(`🔍 [IndexingStorageDb] Getting latest snapshot for ${siteUrl}`);

  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      console.log(`⚠️ [IndexingStorageDb] Site not found: ${siteUrl}`);
      return null;
    }

    const snapshot = await prisma.indexingSnapshot.findFirst({
      where: { siteId: site.id },
      orderBy: { snapshotDate: 'desc' },
      include: {
        urlHistories: true,
      },
    });

    if (!snapshot) {
      console.log(`⚠️ [IndexingStorageDb] No snapshots found for ${siteUrl}`);
      return null;
    }

    console.log(`✅ [IndexingStorageDb] Found snapshot: ${snapshot.snapshotDate.toISOString().split('T')[0]}`);

    return {
      snapshotDate: snapshot.snapshotDate.toISOString().split('T')[0],
      summary: {
        submitted_indexed: snapshot.submittedIndexed,
        crawled_not_indexed: snapshot.crawledNotIndexed,
        discovered_not_indexed: snapshot.discoveredNotIndexed,
        unknown: snapshot.unknown,
      },
      totalUrls: snapshot.totalUrls,
      inspectedUrls: snapshot.inspectedUrls,
      urls: snapshot.urlHistories.map((history) => ({
        url: history.url,
        status: history.status as any,
        coverageState: history.coverageState,
        verdict: history.verdict,
        clicks: history.clicks,
        impressions: history.impressions,
        ctr: history.ctr,
        position: history.position,
        lastCrawl: history.lastCrawl,
        inspectionFrequency: history.inspectionFrequency,
        richResults: history.richResults,
        inspected: history.inspected,
      })),
    };
  } catch (error) {
    console.error('❌ [IndexingStorageDb] Error getting latest snapshot:', error);
    throw error;
  }
}

/**
 * Get indexing snapshot for a specific date
 */
export async function getIndexingSnapshotByDate(
  siteUrl: string,
  date: string
): Promise<IndexingSnapshotData | null> {
  console.log(`🔍 [IndexingStorageDb] Getting snapshot for ${siteUrl} on ${date}`);

  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      console.log(`⚠️ [IndexingStorageDb] Site not found: ${siteUrl}`);
      return null;
    }

    const snapshotDate = new Date(date);
    const snapshot = await prisma.indexingSnapshot.findUnique({
      where: {
        siteId_snapshotDate: {
          siteId: site.id,
          snapshotDate,
        },
      },
      include: {
        urlHistories: true,
      },
    });

    if (!snapshot) {
      console.log(`⚠️ [IndexingStorageDb] No snapshot found for ${siteUrl} on ${date}`);
      return null;
    }

    console.log(`✅ [IndexingStorageDb] Found snapshot with ${snapshot.urlHistories.length} URLs`);

    return {
      snapshotDate: snapshot.snapshotDate.toISOString().split('T')[0],
      summary: {
        submitted_indexed: snapshot.submittedIndexed,
        crawled_not_indexed: snapshot.crawledNotIndexed,
        discovered_not_indexed: snapshot.discoveredNotIndexed,
        unknown: snapshot.unknown,
      },
      totalUrls: snapshot.totalUrls,
      inspectedUrls: snapshot.inspectedUrls,
      urls: snapshot.urlHistories.map((history) => ({
        url: history.url,
        status: history.status as any,
        coverageState: history.coverageState,
        verdict: history.verdict,
        clicks: history.clicks,
        impressions: history.impressions,
        ctr: history.ctr,
        position: history.position,
        lastCrawl: history.lastCrawl,
        inspectionFrequency: history.inspectionFrequency,
        richResults: history.richResults,
        inspected: history.inspected,
      })),
    };
  } catch (error) {
    console.error('❌ [IndexingStorageDb] Error getting snapshot by date:', error);
    throw error;
  }
}

/**
 * Get indexing history for a date range (for trend charts)
 */
export async function getIndexingHistory(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{
  date: string;
  submitted_indexed: number;
  crawled_not_indexed: number;
  discovered_not_indexed: number;
  unknown: number;
}[]> {
  console.log(`🔍 [IndexingStorageDb] Getting history for ${siteUrl} from ${startDate} to ${endDate}`);

  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      console.log(`⚠️ [IndexingStorageDb] Site not found: ${siteUrl}`);
      return [];
    }

    const snapshots = await prisma.indexingSnapshot.findMany({
      where: {
        siteId: site.id,
        snapshotDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    console.log(`✅ [IndexingStorageDb] Found ${snapshots.length} snapshots`);

    return snapshots.map((snapshot) => ({
      date: snapshot.snapshotDate.toISOString().split('T')[0],
      submitted_indexed: snapshot.submittedIndexed,
      crawled_not_indexed: snapshot.crawledNotIndexed,
      discovered_not_indexed: snapshot.discoveredNotIndexed,
      unknown: snapshot.unknown,
    }));
  } catch (error) {
    console.error('❌ [IndexingStorageDb] Error getting history:', error);
    throw error;
  }
}

/**
 * Get URL history for tracking status changes over time
 */
export async function getUrlHistory(
  siteUrl: string,
  url: string,
  startDate: string,
  endDate: string
): Promise<{
  date: string;
  status: string;
  clicks: number;
  impressions: number;
  position: number;
  lastCrawl: string | null;
}[]> {
  console.log(`🔍 [IndexingStorageDb] Getting history for URL: ${url}`);

  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      console.log(`⚠️ [IndexingStorageDb] Site not found: ${siteUrl}`);
      return [];
    }

    const histories = await prisma.indexingUrlHistory.findMany({
      where: {
        siteId: site.id,
        url,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });

    console.log(`✅ [IndexingStorageDb] Found ${histories.length} history records for URL`);

    return histories.map((history) => ({
      date: history.date.toISOString().split('T')[0],
      status: history.status,
      clicks: history.clicks,
      impressions: history.impressions,
      position: history.position,
      lastCrawl: history.lastCrawl,
    }));
  } catch (error) {
    console.error('❌ [IndexingStorageDb] Error getting URL history:', error);
    throw error;
  }
}

/**
 * Check if we have recent indexing data (to determine if we need to refresh)
 */
export async function hasRecentIndexingData(
  siteUrl: string,
  maxAgeDays: number = 1
): Promise<boolean> {
  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      return false;
    }

    const latestSnapshot = await prisma.indexingSnapshot.findFirst({
      where: { siteId: site.id },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!latestSnapshot) {
      return false;
    }

    const ageInMs = Date.now() - latestSnapshot.fetchedAt.getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    const hasRecent = ageInDays <= maxAgeDays;
    console.log(`🔍 [IndexingStorageDb] Latest snapshot age: ${ageInDays.toFixed(2)} days (recent: ${hasRecent})`);

    return hasRecent;
  } catch (error) {
    console.error('❌ [IndexingStorageDb] Error checking recent data:', error);
    return false;
  }
}

