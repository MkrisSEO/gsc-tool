// @ts-nocheck
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { 
  saveIndexingSnapshot, 
  getLatestIndexingSnapshot, 
  hasRecentIndexingData,
  getIndexingHistory 
} from '@/lib/indexingStorageDb';

type IndexingStatus = 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown';

interface IndexingOverviewResponse {
  summary: Record<IndexingStatus, number>;
  daily: Array<{
    date: string;
    submitted_indexed: number;
    crawled_not_indexed: number;
    discovered_not_indexed: number;
    unknown: number;
  }>;
  pages: Array<{
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    status: IndexingStatus | null;
    lastCrawl: string | null;
    inspected: boolean;
    richResults: boolean;
    inspectionFrequency: string;
  }>;
  totalUrls: number;
  inspectedUrls: number;
}

interface ProgressUpdate {
  progress: number;
  total: number;
  currentUrl?: string;
}

interface FinalResponse extends IndexingOverviewResponse {
  done: true;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const BATCH_SIZE = 20;

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
  // This includes: noindex, redirects, 404s, duplicates, blocked by robots.txt, soft 404, etc.
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
  
  // UNKNOWN - Truly unknown or error states
  return 'unknown';
}

function formatInspectionFrequency(lastCrawl: string | null): string {
  if (!lastCrawl) return 'unknown';
  const lastCrawlDate = new Date(lastCrawl);
  if (Number.isNaN(lastCrawlDate.getTime())) return 'unknown';
  const diffDays = Math.max(1, Math.round((Date.now() - lastCrawlDate.getTime()) / DAY_IN_MS));
  if (diffDays <= 1) return 'daily';
  if (diffDays <= 7) return `~every ${diffDays} days`;
  return `>${diffDays} days`;
}

function generateDailyTrend(
  startDate: string,
  endDate: string,
  summary: Record<IndexingStatus, number>
): IndexingOverviewResponse['daily'] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1);
  const totalUrls = Object.values(summary).reduce((acc, val) => acc + val, 0);

  if (totalUrls === 0) {
    return [];
  }

  const ratios = {
    submitted_indexed: summary.submitted_indexed / totalUrls,
    crawled_not_indexed: summary.crawled_not_indexed / totalUrls,
    discovered_not_indexed: summary.discovered_not_indexed / totalUrls,
    unknown: summary.unknown / totalUrls,
  };

  const daily: IndexingOverviewResponse['daily'] = [];
  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start.getTime() + i * DAY_IN_MS);
    daily.push({
      date: current.toISOString().split('T')[0],
      ...ratios,
    });
  }

  return daily;
}

// Helper to delay execution
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function inspectUrlBatch(
  searchconsole: any,
  siteUrl: string,
  urls: string[]
): Promise<Array<{ url: string; result: any | null }>> {
  // Process in mini-batches of 10 URLs at a time to balance speed and avoid rate limits
  const MINI_BATCH_SIZE = 10;
  const results: Array<{ url: string; result: any | null }> = [];
  
  for (let i = 0; i < urls.length; i += MINI_BATCH_SIZE) {
    const miniBatch = urls.slice(i, i + MINI_BATCH_SIZE);
    
    // Process this mini-batch in parallel
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
          // Log only the error message, not full stack trace
          console.error(`Failed to inspect ${url}:`, error.message || error);
          return { url, result: null };
        }
      })
    );
    
    results.push(...miniBatchResults);
    
    // Small delay between mini-batches (50ms) to avoid overwhelming the API
    if (i + MINI_BATCH_SIZE < urls.length) {
      await delay(50);
    }
  }
  
  return results;
}

export async function POST(request: NextRequest) {
  console.log('🌐 [Indexing Overview] Received streaming request');

  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteUrl, startDate, endDate, forceRefresh = false } = body || {};

  if (!siteUrl || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required parameters: siteUrl, startDate, endDate' },
      { status: 400 }
    );
  }

  // Check if we have recent cached data (unless force refresh is requested)
  if (!forceRefresh) {
    const hasRecent = await hasRecentIndexingData(siteUrl, 1); // 1 day cache
    
    if (hasRecent) {
      console.log('⚡ [Indexing Overview] Using cached data');
      
      const cachedSnapshot = await getLatestIndexingSnapshot(siteUrl);
      const historicalData = await getIndexingHistory(siteUrl, startDate, endDate);
      
      if (cachedSnapshot) {
        // Return cached data with historical trends
        const finalResponse: FinalResponse = {
          done: true,
          summary: cachedSnapshot.summary,
          daily: historicalData.length > 0 
            ? historicalData 
            : generateDailyTrend(startDate, endDate, cachedSnapshot.summary),
          pages: cachedSnapshot.urls,
          totalUrls: cachedSnapshot.totalUrls,
          inspectedUrls: cachedSnapshot.inspectedUrls,
        };

        return NextResponse.json(finalResponse);
      }
    }
  }

  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: (session as any).accessToken });
  const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });
  const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isControllerClosed = false;
      
      // Helper to safely send data
      const safeSend = (data: any) => {
        if (isControllerClosed) return false;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch (error) {
          isControllerClosed = true;
          console.log('⚠️ Stream closed by client');
          return false;
        }
      };
      
      try {
        console.log('📈 [Indexing Overview] Fetching pages from Search Analytics...');

        // Fetch pages from Search Analytics (URLs with traffic)
        const analyticsRes = await webmasters.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ['page'],
            rowLimit: 25000, // Max allowed by API
          },
        });

        const analyticsPages = (analyticsRes.data.rows || []).map((row: any) => ({
          url: row.keys?.[0] || '',
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        }));

        console.log(`✅ [Indexing Overview] Found ${analyticsPages.length} pages from Search Analytics`);

        // Fetch sitemaps to get ALL submitted URLs (including non-indexed)
        console.log('🗺️ [Indexing Overview] Fetching sitemaps...');
        let sitemapUrls: string[] = [];
        
        try {
          const sitemapsRes = await webmasters.sitemaps.list({ siteUrl });
          const sitemaps = sitemapsRes.data.sitemap || [];
          
          console.log(`📋 [Indexing Overview] Found ${sitemaps.length} sitemaps`);
          
          for (const sitemap of sitemaps) {
            // Parse sitemap contents to get individual URLs
            const contents = sitemap.contents || [];
            for (const content of contents) {
              const submitted = parseInt(content.submitted || '0', 10);
              console.log(`  - ${sitemap.path}: ${submitted} URLs submitted`);
              
              // We can't get individual URLs from the API, but we know they exist
              // So we'll need to fetch the actual sitemap XML
              if (sitemap.path && submitted > 0) {
                try {
                  const sitemapResponse = await fetch(sitemap.path);
                  if (sitemapResponse.ok) {
                    const sitemapText = await sitemapResponse.text();
                    // Parse XML to extract URLs
                    const urlMatches = sitemapText.matchAll(/<loc>(.*?)<\/loc>/g);
                    for (const match of urlMatches) {
                      const url = match[1].trim();
                      if (url && url.startsWith('http')) {
                        sitemapUrls.push(url);
                      }
                    }
                  }
                } catch (fetchError) {
                  console.warn(`⚠️ Could not fetch sitemap ${sitemap.path}:`, fetchError);
                }
              }
            }
          }
          
          console.log(`✅ [Indexing Overview] Extracted ${sitemapUrls.length} URLs from sitemaps`);
        } catch (error: any) {
          console.warn('⚠️ [Indexing Overview] Could not fetch sitemaps:', error.message);
        }

        // Combine URLs from both sources (deduplicate)
        const analyticsUrlSet = new Set(analyticsPages.map(p => p.url));
        const allUrlsSet = new Set([...analyticsUrlSet, ...sitemapUrls]);
        
        // Create map of analytics data
        const analyticsMap = new Map(analyticsPages.map(p => [p.url, p]));
        
        // Merge: prioritize analytics data, add sitemap-only URLs with 0 metrics
        const allPages = Array.from(allUrlsSet).map(url => {
          const analyticsData = analyticsMap.get(url);
          return analyticsData || {
            url,
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0,
          };
        });

        const totalUrls = allPages.length;
        console.log(`🎯 [Indexing Overview] Combined total: ${totalUrls} unique URLs (${analyticsPages.length} from analytics, ${sitemapUrls.length} from sitemaps)`);

        if (totalUrls === 0) {
          safeSend({ error: 'No URLs found in Search Analytics or Sitemaps' });
          if (!isControllerClosed) controller.close();
          return;
        }

        // Initialize summary
        const summary: Record<IndexingStatus, number> = {
          submitted_indexed: 0,
          crawled_not_indexed: 0,
          discovered_not_indexed: 0,
          unknown: 0,
        };

        const inspectedPages: IndexingOverviewResponse['pages'] = [];

        // Process in batches
        const batches = [];
        for (let i = 0; i < totalUrls; i += BATCH_SIZE) {
          batches.push(allPages.slice(i, i + BATCH_SIZE));
        }

        console.log(`🚀 [Indexing Overview] Starting inspection of ${totalUrls} URLs in ${batches.length} batches`);

        let inspectedCount = 0;

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
              clicks: analyticsData.clicks,
              impressions: analyticsData.impressions,
              ctr: analyticsData.ctr,
              position: analyticsData.position,
              status,
              lastCrawl,
              inspected: true,
              richResults: richResultsVerdict === 'VERDICT_PASS',
              inspectionFrequency: formatInspectionFrequency(lastCrawl),
            });
          });

          inspectedCount += batch.length;

          // Send progress update
          const progressData: ProgressUpdate = {
            progress: inspectedCount,
            total: totalUrls,
            currentUrl: batch[0]?.url,
          };
          if (!safeSend(progressData)) {
            console.log('⚠️ Client disconnected, stopping inspection');
            return;
          }
        }

        console.log(`✅ [Indexing Overview] Completed inspection of ${inspectedCount} URLs`);
        console.log(`📊 [Indexing Overview] Summary:`, summary);
        console.log(`   - Submitted and Indexed: ${summary.submitted_indexed}`);
        console.log(`   - Crawled but Not Indexed: ${summary.crawled_not_indexed}`);
        console.log(`   - Discovered but Not Indexed: ${summary.discovered_not_indexed}`);
        console.log(`   - Unknown: ${summary.unknown}`);

        // Save to database (async, don't block response)
        const today = new Date().toISOString().split('T')[0];
        saveIndexingSnapshot(siteUrl, {
          snapshotDate: today,
          summary,
          totalUrls,
          inspectedUrls: inspectedCount,
          urls: inspectedPages.map(page => ({
            url: page.url,
            status: page.status as any,
            coverageState: null,
            verdict: null,
            clicks: page.clicks,
            impressions: page.impressions,
            ctr: page.ctr,
            position: page.position,
            lastCrawl: page.lastCrawl,
            inspectionFrequency: page.inspectionFrequency,
            richResults: page.richResults,
            inspected: page.inspected,
          })),
        }).catch((err) => {
          console.error('❌ [Indexing Overview] Failed to save to database:', err);
        });

        // Send final response
        const finalResponse: FinalResponse = {
          done: true,
          summary,
          daily: generateDailyTrend(startDate, endDate, summary),
          pages: inspectedPages,
          totalUrls,
          inspectedUrls: inspectedCount,
        };

        safeSend(finalResponse);
        if (!isControllerClosed) {
          controller.close();
        }
      } catch (error: any) {
        console.error('❌ [Indexing Overview] Stream error:', error);
        safeSend({ error: error.message || 'Failed to fetch indexing overview' });
        if (!isControllerClosed) {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

