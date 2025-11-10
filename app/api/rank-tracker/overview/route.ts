import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getRankOverview, getRankHistory } from '@/lib/rankTrackerStorage';

/**
 * GET - Get rank tracking overview statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get('siteUrl');
    const days = searchParams.get('days');

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: siteUrl' },
        { status: 400 }
      );
    }

    const overview = await getRankOverview(siteUrl, days ? parseInt(days) : 30);

    return NextResponse.json({ overview });
  } catch (error: any) {
    console.error('[Rank Tracker Overview] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch overview' },
      { status: 500 }
    );
  }
}

/**
 * POST - Get detailed rank history for charting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, startDate, endDate } = body;

    if (!siteUrl || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: siteUrl, startDate, endDate' },
        { status: 400 }
      );
    }

    const history = await getRankHistory(siteUrl, startDate, endDate);

    // Calculate daily averages
    const dateMap = new Map<string, { positions: number[]; clicks: number; impressions: number }>();

    history.forEach((record) => {
      const date = record.date.toISOString().split('T')[0];

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          positions: [],
          clicks: 0,
          impressions: 0,
        });
      }

      const entry = dateMap.get(date)!;
      entry.positions.push(record.position);
      entry.clicks += record.clicks;
      entry.impressions += record.impressions;
    });

    const chartData = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        avgPosition: Math.round((data.positions.reduce((sum, p) => sum + p, 0) / data.positions.length) * 10) / 10,
        clicks: data.clicks,
        impressions: data.impressions,
        keywordCount: data.positions.length,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      chartData,
      totalRecords: history.length,
    });
  } catch (error: any) {
    console.error('[Rank Tracker History] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}

