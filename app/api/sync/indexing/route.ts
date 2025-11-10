import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { saveIndexingSnapshot } from '@/lib/indexingStorageDb';
import prisma from '@/lib/prisma';

type IndexingStatus = 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown';

function classifyStatus(coverageState?: string | null, verdict?: string | null): IndexingStatus {
  if (!coverageState) return 'unknown';
  
  const normalized = coverageState.toLowerCase();
  const verdictNormalized = (verdict || '').toLowerCase();
  
  // INDEXED - Pages that are successfully indexed
  if (normalized.includes('submitted_and_indexed') || 
      normalized.includes('indexed_not_submitted') ||
      (normalized.includes('indexed') && !normalized.includes('not indexed'))) {
    return 'submitted_indexed';
  }
  
  // CRAWLED BUT NOT INDEXED - Pages that were crawled but excluded for various reasons
  if (normalized.includes('crawled') ||
      normalized.includes('excluded_by_noindex') ||
      normalized.includes('page_with_redirect') ||
      normalized.includes('not_found') ||
      normalized.includes('duplicate') ||
      normalized.includes('blocked_by_robots') ||
      normalized.includes('soft_404') ||
      normalized.includes('blocked') ||
      normalized.includes('alternate_page_with_proper_canonical') ||
      verdictNormalized.includes('fail') ||
      verdictNormalized.includes('excluded')) {
    return 'crawled_not_indexed';
  }
  
  // DISCOVERED BUT NOT INDEXED - Pages Google knows about but hasn't crawled yet
  if (normalized.includes('discovered') ||
      normalized.includes('found_but_not_crawled') ||
      normalized.includes('registered')) {
    return 'discovered_not_indexed';
  }
  
  return 'unknown';
}

function formatInspectionFrequency(lastCrawl: string | null): string {
  if (!lastCrawl) return 'unknown';
  const lastCrawlDate = new Date(lastCrawl);
  if (Number.isNaN(lastCrawlDate.getTime())) return 'unknown';
  const diffDays = Math.max(1, Math.round((Date.now() - lastCrawlDate.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays <= 1) return 'daily';
  if (diffDays <= 7) return `~every ${diffDays} days`;
  return `>${diffDays} days`;
}

async function inspectUrlBatch(
  searchconsole: any,
  siteUrl: string,
  urls: string[]
): Promise<Array<{ url: string; result: any | null }>> {
  const MINI_BATCH_SIZE = 10;
  const results: Array<{ url: string; result: any | null }> = [];
  
  for (let i = 0; i < urls.length; i += MINI_BATCH_SIZE) {
    const miniBatch = urls.slice(i, i + MINI_BATCH_SIZE);
    
    const miniBatchResults = await Promise.all(
      miniBatch.map(async (url) => {
        try {
          const response = await searchconsole.urlInspection.index.inspect({
            requestBody: {
              inspectionUrl: url,
              siteUrl,
            },
          });
          return { url, result: response.data };
        } catch (error: any) {
          console.error(`Failed to inspect ${url}:`, error.message || error);
          return { url, result: null };
        }
      })
    );
    
    results.push(...miniBatchResults);
    
    if (i + MINI_BATCH_SIZE < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return results;
}

export async function POST(request: NextRequest) {
  console.log('🔄 [Sync Indexing] Starting sync...');

  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl } = body;

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: siteUrl' },
        { status: 400 }
      );
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2 });

    // Use last 30 days for indexing check
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // Account for GSC lag
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📈 [Sync Indexing] Fetching pages from ${startDateStr} to ${endDateStr}`);

    // Fetch pages from Search Analytics (URLs with traffic)
    const analyticsRes = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ['page'],
        rowLimit: 1000, // Limit to top 1000 URLs for sync
      },
    });

    const analyticsPages = (analyticsRes.data.rows || []).map((row: any) => ({
      url: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));

    console.log(`✅ [Sync Indexing] Found ${analyticsPages.length} pages from Search Analytics`);

    if (analyticsPages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No URLs found to sync',
        urlsInspected: 0,
      });
    }

    // Initialize summary
    const summary: Record<IndexingStatus, number> = {
      submitted_indexed: 0,
      crawled_not_indexed: 0,
      discovered_not_indexed: 0,
      unknown: 0,
    };

    const inspectedPages: any[] = [];

    // Process in batches
    const BATCH_SIZE = 20;
    const batches = [];
    for (let i = 0; i < analyticsPages.length; i += BATCH_SIZE) {
      batches.push(analyticsPages.slice(i, i + BATCH_SIZE));
    }

    console.log(`🚀 [Sync Indexing] Inspecting ${analyticsPages.length} URLs in ${batches.length} batches`);

    for (const batch of batches) {
      const batchUrls = batch.map((p) => p.url);
      const batchResults = await inspectUrlBatch(searchconsole, siteUrl, batchUrls);

      batchResults.forEach((inspectionResult, idx) => {
        const analyticsData = batch[idx];
        const result = inspectionResult.result?.inspectionResult;
        const indexStatus = result?.indexStatusResult;
        const coverageState = indexStatus?.coverageState || null;
        const verdict = indexStatus?.verdict || null;
        const status = classifyStatus(coverageState, verdict);
        const lastCrawl = indexStatus?.lastCrawlTime || null;
        const richResultsVerdict = result?.richResultsResult?.verdict || null;

        summary[status] += 1;

        inspectedPages.push({
          url: analyticsData.url,
          status,
          coverageState,
          verdict,
          clicks: analyticsData.clicks,
          impressions: analyticsData.impressions,
          ctr: analyticsData.ctr,
          position: analyticsData.position,
          lastCrawl,
          inspectionFrequency: formatInspectionFrequency(lastCrawl),
          richResults: richResultsVerdict === 'VERDICT_PASS',
          inspected: true,
        });
      });

      console.log(`  ✓ Batch completed: ${batch.length} URLs inspected`);
    }

    console.log(`✅ [Sync Indexing] Completed inspection of ${inspectedPages.length} URLs`);
    console.log(`📊 [Sync Indexing] Summary:`, summary);

    // Save to database
    const today = new Date().toISOString().split('T')[0];
    await saveIndexingSnapshot(siteUrl, {
      snapshotDate: today,
      summary,
      totalUrls: inspectedPages.length,
      inspectedUrls: inspectedPages.length,
      urls: inspectedPages,
    });

    console.log(`💾 [Sync Indexing] Saved snapshot to database`);

    return NextResponse.json({
      success: true,
      urlsInspected: inspectedPages.length,
      summary,
      snapshotDate: today,
    });
  } catch (error: any) {
    console.error('❌ [Sync Indexing] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync indexing data' },
      { status: 500 }
    );
  }
}

