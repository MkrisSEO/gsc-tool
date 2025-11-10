import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

interface OrganicTrafficData {
  total: {
    sessions: number;
    users: number;
    bounceRate: number;
    avgDuration: number;
  };
  bySource: Array<{
    source: string;
    sessions: number;
    users: number;
    bounceRate: number;
    avgDuration: number;
    percentage: number;
  }>;
  comparison?: {
    total: {
      sessions: number;
      users: number;
      sessionsDelta: number;
      sessionsPercentChange: number;
      usersDelta: number;
      usersPercentChange: number;
    };
  };
}

/**
 * Normalizes source names for consistency
 */
function normalizeSource(source: string): string {
  const normalized = source.toLowerCase().trim();
  
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('bing')) return 'bing';
  if (normalized.includes('chatgpt') || normalized.includes('chat.openai')) return 'chatgpt';
  if (normalized.includes('perplexity')) return 'perplexity';
  if (normalized.includes('duckduckgo') || normalized.includes('ddg')) return 'duckduckgo';
  if (normalized.includes('yahoo')) return 'yahoo';
  if (normalized === '(not set)' || normalized === '' || normalized === 'not set') return 'unknown';
  
  return normalized;
}

/**
 * Fetches organic traffic data from GA4
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propertyId, startDate, endDate, compareStartDate, compareEndDate } = await request.json();
    
    if (!propertyId || !startDate || !endDate) {
      return Response.json({ 
        error: 'propertyId, startDate, and endDate are required' 
      }, { status: 400 });
    }

    console.log(`[GA4 Organic Traffic] Fetching data for property ${propertyId} from ${startDate} to ${endDate}`);

    // Set up OAuth2 client with the user's access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: (session as any).accessToken });

    // Use googleapis analyticsdata API instead of @google-analytics/data
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: oauth2Client });

    // Fetch current period data
    const response = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: startDate,
            endDate: endDate,
          },
        ],
        dimensions: [
          {
            name: 'sessionSource',
          },
          {
            name: 'sessionMedium',
          },
        ],
        metrics: [
          {
            name: 'sessions',
          },
          {
            name: 'activeUsers',
          },
          {
            name: 'bounceRate',
          },
          {
            name: 'averageSessionDuration',
          },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionMedium',
            stringFilter: {
              matchType: 'EXACT',
              value: 'organic',
            },
          },
        },
        orderBys: [
          {
            metric: {
              metricName: 'sessions',
            },
            desc: true,
          },
        ],
      },
    });

    // Process the response
    const organicData: OrganicTrafficData = {
      total: {
        sessions: 0,
        users: 0,
        bounceRate: 0,
        avgDuration: 0,
      },
      bySource: [],
    };

    // Get response data
    const responseData = response.data;

    // Aggregate by normalized source
    const sourceMap = new Map<string, {
      sessions: number;
      users: number;
      bounceRate: number;
      avgDuration: number;
      count: number;
    }>();

    responseData.rows?.forEach((row: any) => {
      const rawSource = row.dimensionValues?.[0]?.value || 'unknown';
      const source = normalizeSource(rawSource);
      const sessions = parseInt(row.metricValues?.[0]?.value || '0');
      const users = parseInt(row.metricValues?.[1]?.value || '0');
      const bounceRate = parseFloat(row.metricValues?.[2]?.value || '0');
      const avgDuration = parseFloat(row.metricValues?.[3]?.value || '0');

      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          sessions: 0,
          users: 0,
          bounceRate: 0,
          avgDuration: 0,
          count: 0,
        });
      }

      const entry = sourceMap.get(source)!;
      entry.sessions += sessions;
      entry.users += users;
      entry.bounceRate += bounceRate * sessions; // Weight by sessions
      entry.avgDuration += avgDuration * sessions; // Weight by sessions
      entry.count += sessions;
    });

    // Calculate totals from aggregated data
    let totalSessions = 0;
    let totalUsers = 0;
    let totalBounceRateWeighted = 0;
    let totalDurationWeighted = 0;
    let totalCount = 0;

    sourceMap.forEach((data) => {
      totalSessions += data.sessions;
      totalUsers += data.users;
      totalBounceRateWeighted += data.bounceRate;
      totalDurationWeighted += data.avgDuration;
      totalCount += data.count;
    });

    organicData.total.sessions = totalSessions;
    organicData.total.users = totalUsers;
    organicData.total.bounceRate = totalCount > 0 ? totalBounceRateWeighted / totalCount : 0;
    organicData.total.avgDuration = totalCount > 0 ? totalDurationWeighted / totalCount : 0;

    // Convert to array and calculate percentages
    organicData.bySource = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      sessions: data.sessions,
      users: data.users,
      bounceRate: data.count > 0 ? data.bounceRate / data.count : 0,
      avgDuration: data.count > 0 ? data.avgDuration / data.count : 0,
      percentage: organicData.total.sessions > 0 
        ? (data.sessions / organicData.total.sessions) * 100 
        : 0,
    })).sort((a, b) => b.sessions - a.sessions);

    console.log(`[GA4 Organic Traffic] Found ${organicData.bySource.length} sources with ${organicData.total.sessions} total sessions`);

    // Fetch comparison period data if provided
    if (compareStartDate && compareEndDate) {
      try {
        const compareResponse = await analyticsData.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [
              {
                startDate: compareStartDate,
                endDate: compareEndDate,
              },
            ],
            dimensions: [
              {
                name: 'sessionSource',
              },
              {
                name: 'sessionMedium',
              },
            ],
            metrics: [
              {
                name: 'sessions',
              },
              {
                name: 'activeUsers',
              },
            ],
            dimensionFilter: {
              filter: {
                fieldName: 'sessionMedium',
                stringFilter: {
                  matchType: 'EXACT',
                  value: 'organic',
                },
              },
            },
          },
        });

        const compareData = compareResponse.data;
        const compareSessions = parseInt(compareData.totals?.[0]?.metricValues?.[0]?.value || '0');
        const compareUsers = parseInt(compareData.totals?.[0]?.metricValues?.[1]?.value || '0');

        const sessionsDelta = organicData.total.sessions - compareSessions;
        const usersDelta = organicData.total.users - compareUsers;

        organicData.comparison = {
          total: {
            sessions: compareSessions,
            users: compareUsers,
            sessionsDelta,
            sessionsPercentChange: compareSessions > 0 ? (sessionsDelta / compareSessions) * 100 : 0,
            usersDelta,
            usersPercentChange: compareUsers > 0 ? (usersDelta / compareUsers) * 100 : 0,
          },
        };
      } catch (compareError) {
        console.warn('[GA4 Organic Traffic] Failed to fetch comparison data:', compareError);
      }
    }

    return Response.json({ 
      success: true,
      data: organicData,
    });
    
  } catch (error: any) {
    console.error('[GA4 Organic Traffic] Error:', error);
    return Response.json({ 
      error: 'Failed to fetch organic traffic data',
      details: error.message,
    }, { status: 500 });
  }
}

