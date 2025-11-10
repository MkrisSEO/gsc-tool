import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

/**
 * POST - Import top keywords from GSC
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, limit = 50, days = 28 } = body;

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: siteUrl' },
        { status: 400 }
      );
    }

    console.log(`[Import GSC] Fetching top ${limit} keywords for ${siteUrl}`);

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    // Calculate date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // Account for GSC lag
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch top queries from GSC
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ['query', 'page'],
        rowLimit: limit,
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'query',
                operator: 'notContains',
                expression: 'site:',
              },
            ],
          },
        ],
      },
    });

    const rows = response.data.rows || [];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        keywords: [],
        message: 'No keywords found in GSC data',
      });
    }

    // Group by query and get the best performing page
    const keywordMap = new Map<string, any>();

    rows.forEach((row: any) => {
      const query = row.keys[0];
      const page = row.keys[1];
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;
      const position = row.position || 0;

      if (!keywordMap.has(query) || clicks > keywordMap.get(query).clicks) {
        keywordMap.set(query, {
          keyword: query,
          targetUrl: page,
          clicks,
          impressions,
          position: Math.round(position * 10) / 10,
          ctr: row.ctr || 0,
        });
      }
    });

    const keywords = Array.from(keywordMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit);

    console.log(`[Import GSC] Found ${keywords.length} keywords`);

    return NextResponse.json({
      success: true,
      keywords,
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
      },
    });
  } catch (error: any) {
    console.error('[Import GSC] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import keywords from GSC' },
      { status: 500 }
    );
  }
}

