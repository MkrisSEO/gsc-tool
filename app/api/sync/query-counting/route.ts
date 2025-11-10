/**
 * Manual/Cron endpoint to sync Query Counting data with chunking
 * Fetches ALL data from Google API and pre-aggregates
 * 
 * For scalability: Handles millions of queries by chunking into weekly segments
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';

// ✅ Increase timeout for sync operations  
export const maxDuration = 300; // 5 minutes for large syncs

const CHUNK_SIZE_DAYS = 7; // Weekly chunks to avoid 25k row limit
const MAX_DAYS = 90; // Sync last 90 days

interface DateChunk {
  startDate: string;
  endDate: string;
}

function splitDateRangeIntoChunks(startDate: string, endDate: string): DateChunk[] {
  const chunks: DateChunk[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let currentStart = new Date(start);
  
  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + CHUNK_SIZE_DAYS - 1);
    
    const chunkEnd = currentEnd > end ? end : currentEnd;
    
    chunks.push({
      startDate: currentStart.toISOString().split('T')[0],
      endDate: chunkEnd.toISOString().split('T')[0]
    });
    
    currentStart = new Date(chunkEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized - Login required' }, { status: 401 });
    }

    const { siteUrl } = await request.json();
    
    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl required' }, { status: 400 });
    }

    console.log(`[Sync] Starting sync for ${siteUrl}`);

    // Setup Google API
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - MAX_DAYS);

    const chunks = splitDateRangeIntoChunks(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    console.log(`[Sync] Fetching ${chunks.length} chunks...`);

    let allRows: any[] = [];

    // Fetch all chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[Sync] Chunk ${i + 1}/${chunks.length}: ${chunk.startDate} to ${chunk.endDate}`);

      const res = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: chunk.startDate,
          endDate: chunk.endDate,
          dimensions: ['date', 'query'],
          rowLimit: 25000,
        },
      });

      const rows = res.data.rows || [];
      allRows = allRows.concat(rows);
      
      console.log(`[Sync]   → Fetched ${rows.length} rows (total: ${allRows.length})`);

      // Small delay to be nice to Google API
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[Sync] ✓ Fetched total ${allRows.length} rows across ${chunks.length} chunks`);

    // Get or create site
    let site = await prisma.site.findUnique({ where: { siteUrl } });
    
    if (!site) {
      const user = await prisma.user.findFirst();
      if (!user) {
        return NextResponse.json({ error: 'No user found' }, { status: 500 });
      }
      
      site = await prisma.site.create({
        data: { siteUrl, userId: user.id, displayName: siteUrl },
      });
    }

    // Clear old query counting data
    await prisma.gSCDataPoint.deleteMany({
      where: {
        siteId: site.id,
        query: { not: '' },
        page: '',
      },
    });

    console.log('[Sync] Cleared old query counting data');

    // Bulk insert new data
    const dataToInsert = allRows.map(row => ({
      siteId: site.id,
      date: new Date(row.keys[0]),
      query: row.keys[1],
      page: '',
      country: '',
      device: '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    await prisma.gSCDataPoint.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    console.log(`[Sync] ✓ Saved ${dataToInsert.length} rows to database`);

    // Aggregate
    console.log('[Sync] Aggregating by date...');

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

    // Clear old aggregates
    await prisma.queryCountingAggregate.deleteMany({
      where: { siteId: site.id },
    });

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

    console.log(`[Sync] ✓ Created ${aggregates.length} aggregates`);

    return NextResponse.json({
      success: true,
      siteUrl,
      chunks: chunks.length,
      totalRows: allRows.length,
      aggregatedDays: aggregates.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

