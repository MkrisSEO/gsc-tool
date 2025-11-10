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

    // Count total GSC data points
    const totalCount = await prisma.gSCDataPoint.count();

    // Get sample data points
    const sampleData = await prisma.gSCDataPoint.findMany({
      take: 5,
      orderBy: { fetchedAt: 'desc' },
      include: {
        site: true,
      },
    });

    // If siteUrl provided, get stats for that site
    let siteStats = null;
    if (siteUrl) {
      const site = await prisma.site.findUnique({
        where: { siteUrl },
        include: {
          gscData: {
            take: 5,
            orderBy: { fetchedAt: 'desc' },
          },
        },
      });

      if (site) {
        const siteDataCount = await prisma.gSCDataPoint.count({
          where: { siteId: site.id },
        });

        siteStats = {
          siteId: site.id,
          siteUrl: site.siteUrl,
          totalDataPoints: siteDataCount,
          lastSynced: site.lastSyncedAt,
          sampleData: site.gscData.map(d => ({
            date: d.date,
            query: d.query,
            page: d.page,
            clicks: d.clicks,
            impressions: d.impressions,
            fetchedAt: d.fetchedAt,
          })),
        };
      }
    }

    return Response.json({
      totalGSCDataPoints: totalCount,
      sampleData: sampleData.map(d => ({
        id: d.id,
        siteUrl: d.site.siteUrl,
        date: d.date,
        query: d.query,
        page: d.page,
        clicks: d.clicks,
        impressions: d.impressions,
        fetchedAt: d.fetchedAt,
      })),
      siteStats,
    });
  } catch (error: any) {
    console.error('[Debug Cache] Error:', error);
    return Response.json(
      { error: 'Failed to fetch debug info', details: error.message },
      { status: 500 }
    );
  }
}

