/**
 * Re-aggregate Query Counting data from existing GSCDataPoint data
 * Fast: No API calls, only database operations
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteUrl } = await request.json();
    
    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl required' }, { status: 400 });
    }

    console.log(`[Re-aggregate] Starting for ${siteUrl}`);

    // Find site
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });
    
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Aggregate from existing data
    console.log('[Re-aggregate] Querying database...');
    const aggregates = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(date) as date,
        COUNT(*) FILTER (WHERE position >= 1 AND position <= 3) as "position1to3",
        COUNT(*) FILTER (WHERE position >= 4 AND position <= 10) as "position4to10",
        COUNT(*) FILTER (WHERE position >= 11 AND position <= 20) as "position11to20",
        COUNT(*) FILTER (WHERE position >= 21) as "position21plus"
      FROM "GSCDataPoint"
      WHERE "siteId" = ${site.id}
        AND query != ''
        AND page = ''
      GROUP BY DATE(date)
      ORDER BY DATE(date) ASC
    `;

    console.log(`[Re-aggregate] Found ${aggregates.length} days of data`);

    if (aggregates.length === 0) {
      return NextResponse.json({
        error: 'No data found. Run full sync first.',
        details: 'No GSCDataPoint rows with query dimension found.'
      }, { status: 404 });
    }

    // Clear old aggregates
    await prisma.queryCountingAggregate.deleteMany({
      where: { siteId: site.id },
    });

    console.log('[Re-aggregate] Saving new aggregates...');

    // Save new aggregates
    for (const agg of aggregates) {
      await prisma.queryCountingAggregate.create({
        data: {
          siteId: site.id,
          date: new Date(agg.date),
          position1to3: Number(agg.position1to3),
          position4to10: Number(agg.position4to10),
          position11to20: Number(agg.position11to20),
          position21plus: Number(agg.position21plus),
        },
      });
    }

    console.log(`[Re-aggregate] ✅ Created ${aggregates.length} aggregates`);

    return NextResponse.json({
      success: true,
      siteUrl,
      aggregatedDays: aggregates.length,
      dateRange: aggregates.length > 0 ? {
        start: aggregates[0].date,
        end: aggregates[aggregates.length - 1].date,
      } : null,
      sampleAggregate: aggregates[0],
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Re-aggregate] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

