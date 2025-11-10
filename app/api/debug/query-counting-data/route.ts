import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');

    if (!siteUrl) {
      return Response.json({ error: 'siteUrl required' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({ where: { siteUrl } });

    if (!site) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    // Count different types of data
    const counts = {
      totalGSCData: await prisma.gSCDataPoint.count({
        where: { siteId: site.id },
      }),
      queryCountingRows: await prisma.gSCDataPoint.count({
        where: {
          siteId: site.id,
          query: { not: '' },
          page: '',
        },
      }),
      timeSeriesRows: await prisma.gSCDataPoint.count({
        where: {
          siteId: site.id,
          query: '',
          page: { not: '' },
        },
      }),
      aggregates: await prisma.queryCountingAggregate.count({
        where: { siteId: site.id },
      }),
    };

    // Get date range of data
    const firstRow = await prisma.gSCDataPoint.findFirst({
      where: { siteId: site.id, query: { not: '' }, page: '' },
      orderBy: { date: 'asc' },
    });

    const lastRow = await prisma.gSCDataPoint.findFirst({
      where: { siteId: site.id, query: { not: '' }, page: '' },
      orderBy: { date: 'desc' },
    });

    return Response.json({
      siteUrl: site.siteUrl,
      counts,
      dateRange: {
        first: firstRow?.date,
        last: lastRow?.date,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

