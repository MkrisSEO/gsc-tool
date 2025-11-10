import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

/**
 * Debug endpoint to see exactly what GSC returns for a keyword
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');
    const keyword = searchParams.get('keyword');

    if (!siteUrl || !keyword) {
      return NextResponse.json({ error: 'Missing siteUrl or keyword' }, { status: 400 });
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    // Calculate date range (last 90 days)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`[GSC Debug] Searching for keyword: "${keyword}"`);

    let exactRows: any[] = [];
    let exactError: string | null = null;

    // Try 1: EXACT match with filter
    try {
      console.log('[GSC Debug] Attempt 1: Exact match with dimensionFilterGroups...');
      const exactResponse = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['date', 'query'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  operator: 'equals',
                  expression: keyword,
                },
              ],
            },
          ],
          rowLimit: 100,
        },
      });

      exactRows = exactResponse.data?.rows || [];
      console.log(`[GSC Debug] Exact match: ${exactRows.length} rows`);
    } catch (error: any) {
      exactError = error.message;
      console.error(`[GSC Debug] Exact match failed:`, error.message);
    }

    let containsRows: any[] = [];
    let containsError: string | null = null;

    // Try 2: CONTAINS match
    try {
      console.log('[GSC Debug] Attempt 2: Contains match...');
      const containsResponse = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['query'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  operator: 'contains',
                  expression: keyword,
                },
              ],
            },
          ],
          rowLimit: 20,
        },
      });

      containsRows = containsResponse.data?.rows || [];
      console.log(`[GSC Debug] Contains match: ${containsRows.length} rows`);
    } catch (error: any) {
      containsError = error.message;
      console.error(`[GSC Debug] Contains match failed:`, error.message);
    }

    let topQueries: any[] = [];
    let matchingQueries: any[] = [];
    let topQueriesError: string | null = null;

    // Try 3: Get top queries and search manually
    try {
      console.log('[GSC Debug] Attempt 3: Fetching top 100 queries...');
      const topQueriesResponse = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['query'],
          rowLimit: 100,
        },
      });

      topQueries = topQueriesResponse.data?.rows || [];
      matchingQueries = topQueries.filter((row: any) =>
        row.keys[0].toLowerCase().includes(keyword.toLowerCase())
      );
      console.log(`[GSC Debug] Top queries matching "${keyword}": ${matchingQueries.length}`);
    } catch (error: any) {
      topQueriesError = error.message;
      console.error(`[GSC Debug] Top queries failed:`, error.message);
    }

    return NextResponse.json({
      keyword,
      dateRange: { startDate: startDateStr, endDate: endDateStr },
      results: {
        exactMatch: {
          found: exactRows.length > 0,
          rowCount: exactRows.length,
          error: exactError,
          sample: exactRows.slice(0, 5).map((r: any) => ({
            date: r.keys[0],
            query: r.keys[1],
            clicks: r.clicks,
            impressions: r.impressions,
            position: r.position,
          })),
        },
        containsMatch: {
          found: containsRows.length > 0,
          rowCount: containsRows.length,
          error: containsError,
          sample: containsRows.slice(0, 5).map((r: any) => ({
            query: r.keys[0],
            clicks: r.clicks,
            impressions: r.impressions,
            position: r.position,
          })),
        },
        topQueriesSearch: {
          totalTopQueries: topQueries.length,
          matchingQueries: matchingQueries.length,
          error: topQueriesError,
          matches: matchingQueries.slice(0, 10).map((r: any) => ({
            query: r.keys[0],
            clicks: r.clicks,
            impressions: r.impressions,
            position: r.position,
          })),
        },
      },
    });
  } catch (error: any) {
    console.error('[GSC Debug] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

