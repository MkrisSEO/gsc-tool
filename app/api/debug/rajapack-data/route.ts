import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const siteUrl = 'https://www.rajapack.dk/';
    
    // Find site
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });
    
    if (!site) {
      return NextResponse.json({ error: 'Site not found' });
    }
    
    // Check QueryCountingAggregate data
    const qcAggregates = await prisma.queryCountingAggregate.findMany({
      where: { siteId: site.id },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        position1to3: true,
        position4to10: true,
        position11to20: true,
        position21plus: true,
        updatedAt: true,
      },
    });
    
    // Check raw GSCDataPoint data
    const rawDataCount = await prisma.gSCDataPoint.count({
      where: { siteId: site.id },
    });
    
    const rawDataDateRange = await prisma.gSCDataPoint.aggregate({
      where: { siteId: site.id },
      _min: { date: true },
      _max: { date: true },
    });
    
    // Count by dimension
    const timeSeriesCount = await prisma.gSCDataPoint.count({
      where: {
        siteId: site.id,
        query: '',
        page: { not: '' },
        country: '',
        device: '',
      },
    });
    
    const queriesCount = await prisma.gSCDataPoint.count({
      where: {
        siteId: site.id,
        query: { not: '' },
        page: { not: '' },
        country: '',
        device: '',
      },
    });
    
    return NextResponse.json({
      siteUrl,
      siteId: site.id,
      queryCountingAggregates: {
        count: qcAggregates.length,
        dateRange: qcAggregates.length > 0 ? {
          start: qcAggregates[0].date,
          end: qcAggregates[qcAggregates.length - 1].date,
        } : null,
        lastUpdated: qcAggregates.length > 0 ? qcAggregates[qcAggregates.length - 1].updatedAt : null,
        sampleDays: qcAggregates.slice(0, 5),
      },
      rawGSCData: {
        totalCount: rawDataCount,
        dateRange: rawDataDateRange,
        timeSeriesCount: timeSeriesCount,
        queriesCount: queriesCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Database query failed', 
      details: error.message 
    }, { status: 500 });
  }
}

