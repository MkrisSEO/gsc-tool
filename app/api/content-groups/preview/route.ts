import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { urlMatchesCondition, type Condition } from '@/lib/contentGroupsStorage';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteUrl, conditions, startDate, endDate } = body;

  if (!siteUrl || !conditions || !Array.isArray(conditions)) {
    return NextResponse.json(
      { error: 'Missing required parameters: siteUrl, conditions' },
      { status: 400 }
    );
  }

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    // Use provided date range or default to last 28 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Fetch all URLs from Search Analytics
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(start),
        endDate: formatDate(end),
        dimensions: ['page'],
        rowLimit: 25000,
      },
    });

    const allUrls = (response.data.rows || []).map((row: any) => row.keys[0]);

    // Filter URLs by conditions
    const inclusionConditions = conditions.filter((c: Condition) => c.type === 'inclusion');
    const exclusionConditions = conditions.filter((c: Condition) => c.type === 'exclusion');

    let matchedUrls = allUrls;

    // Apply inclusion filters (must match at least one)
    if (inclusionConditions.length > 0) {
      matchedUrls = matchedUrls.filter((url: string) =>
        inclusionConditions.some((c: Condition) => urlMatchesCondition(url, c))
      );
    }

    // Apply exclusion filters (must not match any)
    if (exclusionConditions.length > 0) {
      matchedUrls = matchedUrls.filter((url: string) =>
        !exclusionConditions.some((c: Condition) => urlMatchesCondition(url, c))
      );
    }

    // Return preview with count and sample URLs
    const preview = {
      count: matchedUrls.length,
      sampleUrls: matchedUrls.slice(0, 10),
      totalUrls: allUrls.length,
    };

    return NextResponse.json(preview);
  } catch (error: any) {
    console.error('❌ [Content Groups Preview] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview content group' },
      { status: 500 }
    );
  }
}

