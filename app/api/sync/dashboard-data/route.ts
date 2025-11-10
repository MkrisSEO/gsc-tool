/**
 * Cron endpoint to sync Time Series, Queries, and URLs data
 * Fetches data from Google Search Console API and stores in database
 * 
 * This ensures dashboard always has fresh data from DB
 */

// @ts-nocheck
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';

// ✅ Increase timeout for sync operations
export const maxDuration = 300; // 5 minutes for large syncs

const MAX_DAYS = 90; // Sync last 90 days
const CHUNK_SIZE_DAYS = 7; // Weekly chunks

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

    console.log(`[Sync Dashboard] Starting sync for ${siteUrl}`);

    // Setup Google API
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    // Calculate date range (account for 2-day GSC lag)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - MAX_DAYS);

    const chunks = splitDateRangeIntoChunks(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

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

    let stats = {
      timeSeriesRows: 0,
      queriesRows: 0,
      chunks: chunks.length,
    };

    // ==============================
    // 1. Sync Time Series Data (date + page for performance chart)
    // ==============================
    console.log('[Sync Dashboard] 1/2 Fetching Time Series data with page dimension...');
    
    let allTimeSeriesRows: any[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const res = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: chunk.startDate,
          endDate: chunk.endDate,
          dimensions: ['date', 'page'], // ✅ Simple dimensions for performance chart
          rowLimit: 25000,
        },
      });

      const rows = res.data.rows || [];
      allTimeSeriesRows = allTimeSeriesRows.concat(rows);
      
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[Sync Dashboard]   → Time Series: ${allTimeSeriesRows.length} rows`);

    // Clear old time series data for this date range
    try {
      const deleteResult = await prisma.gSCDataPoint.deleteMany({
        where: {
          siteId: site.id,
          query: '', // Time series has NO query data
          page: { not: '' },
          country: '',
          device: '',
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
      console.log(`[Sync Dashboard]   Cleared ${deleteResult.count} old time series rows`);
    } catch (delError) {
      console.error('[Sync Dashboard]   Delete error (continuing anyway):', delError);
    }

    // Insert time series data (skip duplicates)
    const timeSeriesData = allTimeSeriesRows.map(row => ({
      siteId: site.id,
      date: new Date(row.keys[0]),
      query: '', // ✅ No query dimension in time series
      page: row.keys[1] || '', // ✅ Page is keys[1]
      country: '',
      device: '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    const timeSeriesResult = await prisma.gSCDataPoint.createMany({
      data: timeSeriesData,
      skipDuplicates: true,
    });

    stats.timeSeriesRows = timeSeriesResult.count;
    console.log(`[Sync Dashboard]   ✓ Saved ${stats.timeSeriesRows} new date-page rows`);

    // ==============================
    // 2. Sync Queries Data (query + page, last 28 days)
    // ==============================
    console.log('[Sync Dashboard] 2/2 Fetching Queries data with page dimension...');
    
    const last28Days = new Date();
    last28Days.setDate(last28Days.getDate() - 30);
    
    const res = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: last28Days.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query', 'page'], // ✅ Include 'page' for content group filtering
        rowLimit: 25000,
      },
    });

    const queriesRows = res.data.rows || [];
    console.log(`[Sync Dashboard]   → Queries: ${queriesRows.length} rows`);

    // Clear old queries data for endDate (we're refreshing today's snapshot)
    try {
      const deleteResult = await prisma.gSCDataPoint.deleteMany({
        where: {
          siteId: site.id,
          query: { not: '' },
          page: { not: '' },
          country: '',
          device: '',
          date: endDate,
        },
      });
      console.log(`[Sync Dashboard]   Cleared ${deleteResult.count} old queries rows`);
    } catch (delError) {
      console.error('[Sync Dashboard]   Delete error (continuing anyway):', delError);
    }

    // Insert queries data (top 1000 most important)
    const queriesData = queriesRows.slice(0, 1000).map(row => ({
      siteId: site.id,
      date: endDate,
      query: row.keys[0] || '',
      page: row.keys[1] || '',
      country: '',
      device: '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    const queriesResult = await prisma.gSCDataPoint.createMany({
      data: queriesData,
      skipDuplicates: true,
    });

    stats.queriesRows = queriesResult.count;
    console.log(`[Sync Dashboard]   ✓ Saved ${stats.queriesRows} query-page rows (top ${queriesData.length} of ${queriesRows.length})`);

    console.log(`[Sync Dashboard] ✅ Complete!`);
    console.log(`[Sync Dashboard] Stats:`, {
      timeSeriesRows: stats.timeSeriesRows,
      queriesRows: stats.queriesRows,
      note: 'URLs data will be aggregated from time series when requested',
    });

    return NextResponse.json({
      success: true,
      siteUrl,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Sync Dashboard] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

