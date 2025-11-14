import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

interface ImpactMetrics {
  before: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  after: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  changes: {
    clicks: { absolute: number; percent: number };
    impressions: { absolute: number; percent: number };
    ctr: { absolute: number; percent: number };
    position: { absolute: number; percent: number };
  };
  chartData: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const siteUrl = searchParams.get('siteUrl');
  const annotationDate = searchParams.get('date');
  const scope = searchParams.get('scope');
  const urls = searchParams.get('urls'); // comma-separated
  const startDate = searchParams.get('startDate'); // Custom period start
  const endDate = searchParams.get('endDate'); // Custom period end
  const compareStartDate = searchParams.get('compareStartDate'); // Compare period start
  const compareEndDate = searchParams.get('compareEndDate'); // Compare period end

  if (!siteUrl || !annotationDate) {
    return NextResponse.json(
      { error: 'Missing required parameters: siteUrl, date' },
      { status: 400 }
    );
  }

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    const annotationDateObj = new Date(annotationDate);
    
    // Use custom date ranges if provided, otherwise default to 14 days before/after
    let beforeStart: Date | null;
    let beforeEnd: Date | null;
    let afterStart: Date | null;
    let afterEnd: Date | null;
    let chartStart: Date;
    let chartEnd: Date;

    if (startDate && endDate) {
      chartStart = new Date(startDate);
      chartEnd = new Date(endDate);

      if (compareStartDate && compareEndDate) {
        beforeStart = new Date(compareStartDate);
        beforeEnd = new Date(compareEndDate);
        afterStart = chartStart;
        afterEnd = chartEnd;
      } else {
        const annotationTime = annotationDateObj.getTime();
        const rangeStart = chartStart.getTime();
        const rangeEnd = chartEnd.getTime();

        const beforeEndCandidate = new Date(Math.min(annotationTime - DAY_IN_MS, rangeEnd));
        beforeStart = chartStart;
        beforeEnd = beforeEndCandidate.getTime() >= rangeStart ? beforeEndCandidate : null;

        const afterStartCandidate = new Date(Math.max(annotationTime, rangeStart));
        afterStart = afterStartCandidate.getTime() <= rangeEnd ? afterStartCandidate : null;
        afterEnd = afterStart ? chartEnd : null;
      }
    } else {
      // Default: 14 days before/after annotation
      beforeStart = new Date(annotationDateObj.getTime() - 14 * DAY_IN_MS);
      beforeEnd = new Date(annotationDateObj.getTime() - DAY_IN_MS);
      afterStart = new Date(annotationDateObj.getTime() + DAY_IN_MS);
      afterEnd = new Date(annotationDateObj.getTime() + 14 * DAY_IN_MS);
      chartStart = beforeStart;
      chartEnd = afterEnd;
    }

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Build request body with filters if needed
    const buildRequestBody = (startDate: string, endDate: string, dimensions: string[]) => {
      const requestBody: any = {
        startDate,
        endDate,
        dimensions,
        rowLimit: 25000,
      };

      // Add filters for specific URLs if provided
      if (scope === 'specific' && urls) {
        const urlList = urls.split(',').filter(Boolean);
        if (urlList.length > 0) {
          requestBody.dimensionFilterGroups = [
            {
              filters: urlList.map((url) => ({
                dimension: 'page',
                operator: 'equals',
                expression: url.trim(),
              })),
            },
          ];
        }
      }

      return requestBody;
    };

    const queryRange = async (start: Date | null, end: Date | null, dimensions: string[]) => {
      if (!start || !end || end.getTime() < start.getTime()) {
        return { data: { rows: [] } };
      }
      return webmasters.searchanalytics.query({
        siteUrl,
        requestBody: buildRequestBody(formatDate(start), formatDate(end), dimensions),
      });
    };

    // Fetch data for all three periods
    const [beforeRes, afterRes, chartRes] = await Promise.all([
      queryRange(beforeStart, beforeEnd, ['date']),
      queryRange(afterStart, afterEnd, ['date']),
      queryRange(chartStart, chartEnd, ['date']),
    ]);

    // Aggregate before period
    const beforeRows = beforeRes.data.rows || [];
    const beforeMetrics = beforeRows.reduce(
      (acc: any, row: any) => ({
        clicks: acc.clicks + (row.clicks || 0),
        impressions: acc.impressions + (row.impressions || 0),
        ctr: acc.ctr + (row.ctr || 0),
        position: acc.position + (row.position || 0),
        count: acc.count + 1,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
    );

    // Aggregate after period
    const afterRows = afterRes.data.rows || [];
    const afterMetrics = afterRows.reduce(
      (acc: any, row: any) => ({
        clicks: acc.clicks + (row.clicks || 0),
        impressions: acc.impressions + (row.impressions || 0),
        ctr: acc.ctr + (row.ctr || 0),
        position: acc.position + (row.position || 0),
        count: acc.count + 1,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
    );

    // Calculate averages
    const before = {
      clicks: beforeMetrics.clicks,
      impressions: beforeMetrics.impressions,
      ctr: beforeMetrics.count > 0 ? beforeMetrics.ctr / beforeMetrics.count : 0,
      position: beforeMetrics.count > 0 ? beforeMetrics.position / beforeMetrics.count : 0,
    };

    const after = {
      clicks: afterMetrics.clicks,
      impressions: afterMetrics.impressions,
      ctr: afterMetrics.count > 0 ? afterMetrics.ctr / afterMetrics.count : 0,
      position: afterMetrics.count > 0 ? afterMetrics.position / afterMetrics.count : 0,
    };

    // Calculate changes
    const calculateChange = (afterVal: number, beforeVal: number) => {
      if (beforeVal === 0) {
        return { absolute: afterVal, percent: afterVal > 0 ? 100 : 0 };
      }
      const absolute = afterVal - beforeVal;
      const percent = (absolute / beforeVal) * 100;
      return { absolute, percent };
    };

    const changes = {
      clicks: calculateChange(after.clicks, before.clicks),
      impressions: calculateChange(after.impressions, before.impressions),
      ctr: calculateChange(after.ctr, before.ctr),
      position: calculateChange(after.position, before.position),
    };

    // Process chart data
    const chartData = (chartRes.data.rows || []).map((row: any) => ({
      date: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const impact: ImpactMetrics = {
      before,
      after,
      changes,
      chartData,
    };

    return NextResponse.json(impact);
  } catch (error: any) {
    console.error('❌ [Annotations Impact] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate impact' },
      { status: 500 }
    );
  }
}

