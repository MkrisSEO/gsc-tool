/**
 * Sync Query Counting aggregates from existing raw GSCDataPoint data
 * Used when raw data exists but aggregates are missing
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { siteUrl } = await request.json();
    
    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl required' }, { status: 400 });
    }
    
    console.log(`[QC Sync] Starting for ${siteUrl}`);
    
    // Find site
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });
    
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    
    // Fetch raw data with ['date', 'query'] dimensions
    const rawData = await prisma.gSCDataPoint.findMany({
      where: {
        siteId: site.id,
        query: { not: '' },  // Has query
        page: '',             // No page dimension
        country: '',
        device: '',
      },
      select: {
        date: true,
        query: true,
        position: true,
      },
      orderBy: { date: 'asc' },
    });
    
    console.log(`[QC Sync] Found ${rawData.length} raw data points`);
    
    if (rawData.length === 0) {
      return NextResponse.json({ 
        error: 'No raw data found. Run dashboard sync first.' 
      }, { status: 404 });
    }
    
    // Group by date and aggregate
    const dateMap = new Map<string, {
      position1to3: number;
      position4to10: number;
      position11to20: number;
      position21plus: number;
    }>();
    
    rawData.forEach((row) => {
      const dateStr = row.date.toISOString().split('T')[0];
      const position = row.position || 0;
      
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          position1to3: 0,
          position4to10: 0,
          position11to20: 0,
          position21plus: 0,
        });
      }
      
      const entry = dateMap.get(dateStr)!;
      
      if (position >= 1 && position <= 3) {
        entry.position1to3++;
      } else if (position >= 4 && position <= 10) {
        entry.position4to10++;
      } else if (position >= 11 && position <= 20) {
        entry.position11to20++;
      } else if (position >= 21) {
        entry.position21plus++;
      }
    });
    
    console.log(`[QC Sync] Aggregated into ${dateMap.size} days`);
    
    // Save to database
    let savedCount = 0;
    
    for (const [dateStr, data] of dateMap.entries()) {
      await prisma.queryCountingAggregate.upsert({
        where: {
          siteId_date: {
            siteId: site.id,
            date: new Date(dateStr),
          },
        },
        update: {
          position1to3: data.position1to3,
          position4to10: data.position4to10,
          position11to20: data.position11to20,
          position21plus: data.position21plus,
          updatedAt: new Date(),
        },
        create: {
          siteId: site.id,
          date: new Date(dateStr),
          position1to3: data.position1to3,
          position4to10: data.position4to10,
          position11to20: data.position11to20,
          position21plus: data.position21plus,
        },
      });
      savedCount++;
    }
    
    console.log(`[QC Sync] ✅ Saved ${savedCount} aggregates`);
    
    return NextResponse.json({
      success: true,
      siteUrl,
      aggregatedDays: dateMap.size,
      savedCount,
      sampleDay: Array.from(dateMap.entries())[0],
    });
  } catch (error: any) {
    console.error('[QC Sync] Error:', error);
    return NextResponse.json({ 
      error: 'Sync failed', 
      details: error.message 
    }, { status: 500 });
  }
}

