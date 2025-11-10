import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

type ImpactLevel = 'high' | 'medium' | 'low';

interface CompetingUrl {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  positionHistory: number[];
  clickShare: number;
}

interface CannibalizationIssue {
  query: string;
  urls: CompetingUrl[];
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  impact: ImpactLevel;
  positionVolatility: number;
  urlCount: number;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

function determineImpact(urlCount: number, totalClicks: number): ImpactLevel {
  if (urlCount >= 3 && totalClicks > 100) return 'high';
  if (urlCount >= 2 && totalClicks >= 20 && totalClicks <= 100) return 'medium';
  return 'low';
}

export async function POST(request: NextRequest) {
  console.log('🔍 [Keyword Cannibalization] Starting analysis...');

  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteUrl, startDate, endDate } = body || {};

  if (!siteUrl || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required parameters: siteUrl, startDate, endDate' },
      { status: 400 }
    );
  }

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    console.log('📊 [Keyword Cannibalization] Fetching query-page data...');

    // Fetch query + page dimension data
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 25000,
      },
    });

    const rows = response.data.rows || [];
    console.log(`✅ [Keyword Cannibalization] Found ${rows.length} query-page combinations`);

    // Also fetch daily data for position history
    const dailyResponse = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date', 'query', 'page'],
        rowLimit: 25000,
      },
    });

    const dailyRows = dailyResponse.data.rows || [];
    console.log(`✅ [Keyword Cannibalization] Found ${dailyRows.length} daily query-page records`);

    // Group by query to find cannibalization
    const queryMap = new Map<string, Array<{ url: string; clicks: number; impressions: number; ctr: number; position: number }>>();

    rows.forEach((row: any) => {
      const query = row.keys[0];
      const url = row.keys[1];
      
      if (!queryMap.has(query)) {
        queryMap.set(query, []);
      }

      queryMap.get(query)!.push({
        url,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      });
    });

    // Build position history for each query-url pair
    const positionHistoryMap = new Map<string, number[]>();
    dailyRows.forEach((row: any) => {
      const query = row.keys[1];
      const url = row.keys[2];
      const key = `${query}|||${url}`;
      
      if (!positionHistoryMap.has(key)) {
        positionHistoryMap.set(key, []);
      }
      
      positionHistoryMap.get(key)!.push(row.position || 0);
    });

    // Identify cannibalization issues (2+ URLs per query)
    const issues: CannibalizationIssue[] = [];

    queryMap.forEach((urls, query) => {
      if (urls.length < 2) return; // Not cannibalization if only 1 URL

      const totalClicks = urls.reduce((sum, u) => sum + u.clicks, 0);
      const totalImpressions = urls.reduce((sum, u) => sum + u.impressions, 0);
      const weightedPositionSum = urls.reduce((sum, u) => sum + u.position * u.impressions, 0);
      const avgPosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

      // Calculate position volatility
      const allPositions = urls.flatMap((u) => {
        const key = `${query}|||${u.url}`;
        return positionHistoryMap.get(key) || [u.position];
      });
      const positionVolatility = calculateStdDev(allPositions);

      const impact = determineImpact(urls.length, totalClicks);

      const competingUrls: CompetingUrl[] = urls.map((u) => {
        const key = `${query}|||${u.url}`;
        const positionHistory = positionHistoryMap.get(key) || [u.position];
        const clickShare = totalClicks > 0 ? (u.clicks / totalClicks) * 100 : 0;

        return {
          url: u.url,
          clicks: u.clicks,
          impressions: u.impressions,
          ctr: u.ctr,
          position: u.position,
          positionHistory,
          clickShare,
        };
      });

      // Sort URLs by clicks (descending)
      competingUrls.sort((a, b) => b.clicks - a.clicks);

      issues.push({
        query,
        urls: competingUrls,
        totalClicks,
        totalImpressions,
        avgPosition,
        impact,
        positionVolatility,
        urlCount: urls.length,
      });
    });

    // Sort by impact (high > medium > low) then by total clicks
    const impactOrder = { high: 3, medium: 2, low: 1 };
    issues.sort((a, b) => {
      if (a.impact !== b.impact) {
        return impactOrder[b.impact] - impactOrder[a.impact];
      }
      return b.totalClicks - a.totalClicks;
    });

    console.log(`📊 [Keyword Cannibalization] Found ${issues.length} cannibalization issues`);
    console.log(`   - High impact: ${issues.filter((i) => i.impact === 'high').length}`);
    console.log(`   - Medium impact: ${issues.filter((i) => i.impact === 'medium').length}`);
    console.log(`   - Low impact: ${issues.filter((i) => i.impact === 'low').length}`);

    return NextResponse.json({ issues });
  } catch (error: any) {
    console.error('❌ [Keyword Cannibalization] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze keyword cannibalization' },
      { status: 500 }
    );
  }
}

