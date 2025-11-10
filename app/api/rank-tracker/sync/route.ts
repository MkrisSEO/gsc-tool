import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { getKeywords, saveRankHistory } from '@/lib/rankTrackerStorage';

/**
 * POST - Sync GSC historical data for tracked keywords
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, days = 90 } = body;

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: siteUrl' },
        { status: 400 }
      );
    }

    console.log(`[Rank Sync] Syncing ${days} days of data for ${siteUrl}`);

    // Get all active keywords
    const keywords = await getKeywords(siteUrl, true);

    if (keywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No keywords to sync',
        synced: 0,
      });
    }

    console.log(`[Rank Sync] Found ${keywords.length} keywords to sync`);

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

    let syncedCount = 0;
    const errors: string[] = [];

    // Process keywords in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (keywordData) => {
          try {
            // Fetch historical data for this keyword
            const response = await webmasters.searchanalytics.query({
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
                        expression: keywordData.keyword,
                      },
                    ],
                  },
                ],
                rowLimit: 1000,
              },
            });

            const rows = response.data.rows || [];

            if (rows.length === 0) {
              console.log(`[Rank Sync] No data for "${keywordData.keyword}"`);
              return;
            }

            // Group by date and calculate average position
            const dateMap = new Map<string, any>();

            rows.forEach((row: any) => {
              const date = row.keys[0];
              const clicks = row.clicks || 0;
              const impressions = row.impressions || 0;
              const position = row.position || 0;
              const ctr = row.ctr || 0;

              if (!dateMap.has(date)) {
                dateMap.set(date, {
                  date,
                  position,
                  clicks,
                  impressions,
                  ctr,
                });
              } else {
                // If multiple rows for same date, take the one with more impressions
                const existing = dateMap.get(date);
                if (impressions > existing.impressions) {
                  dateMap.set(date, {
                    date,
                    position,
                    clicks,
                    impressions,
                    ctr,
                  });
                }
              }
            });

            const historyData = Array.from(dateMap.values());

            // Save to database
            await saveRankHistory(siteUrl, keywordData.keyword, historyData);

            syncedCount++;
            console.log(`[Rank Sync] ✓ Synced "${keywordData.keyword}": ${historyData.length} days`);
          } catch (error: any) {
            console.error(`[Rank Sync] Error syncing "${keywordData.keyword}":`, error.message);
            errors.push(`${keywordData.keyword}: ${error.message}`);
          }
        })
      );

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < keywords.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`[Rank Sync] Completed: ${syncedCount}/${keywords.length} keywords synced`);

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: keywords.length,
      errors: errors.length > 0 ? errors : undefined,
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
      },
    });
  } catch (error: any) {
    console.error('[Rank Sync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync rank data' },
      { status: 500 }
    );
  }
}

