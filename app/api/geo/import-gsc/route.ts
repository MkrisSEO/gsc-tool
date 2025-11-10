import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { isInformationalQuery, detectQueryType } from '@/lib/geoTracking';

interface ImportGSCRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
  minImpressions?: number;
  limit?: number;
}

/**
 * Import informational queries from Google Search Console
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ImportGSCRequest = await request.json();
    const {
      siteUrl,
      startDate,
      endDate,
      minImpressions = 50,
      limit = 100,
    } = body;

    if (!siteUrl || !startDate || !endDate) {
      return Response.json(
        { error: 'siteUrl, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`[GEO Import] Importing queries from GSC for ${siteUrl}`);

    // Set up Google Search Console API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2Client });

    // Fetch queries from GSC
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 1000, // Get top 1000 queries
      },
    });

    const allQueries = response.data.rows || [];
    
    console.log(`[GEO Import] Found ${allQueries.length} total queries from GSC`);

    // Filter for informational queries with minimum impressions
    const informationalQueries = allQueries
      .filter((row: any) => {
        const query = row.keys[0];
        const impressions = row.impressions || 0;
        
        return impressions >= minImpressions && isInformationalQuery(query);
      })
      .map((row: any) => ({
        query: row.keys[0],
        impressions: row.impressions,
        clicks: row.clicks,
        type: detectQueryType(row.keys[0]),
      }))
      .sort((a, b) => b.impressions - a.impressions) // Sort by impressions
      .slice(0, limit); // Limit results

    console.log(`[GEO Import] Filtered to ${informationalQueries.length} informational queries`);

    return Response.json({
      success: true,
      queries: informationalQueries,
      total: informationalQueries.length,
    });
  } catch (error: any) {
    console.error('[GEO Import] Error:', error);
    return Response.json(
      { error: 'Failed to import queries', details: error.message },
      { status: 500 }
    );
  }
}


