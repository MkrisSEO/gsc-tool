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

    const site = await prisma.site.findUnique({
      where: { siteUrl },
      include: {
        queryCountingAggregates: {
          take: 10,
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!site) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    const totalAggregates = await prisma.queryCountingAggregate.count({
      where: { siteId: site.id },
    });

    const totalQueryCountingRows = await prisma.gSCDataPoint.count({
      where: {
        siteId: site.id,
        query: { not: '' },
        page: '',
      },
    });

    return Response.json({
      siteId: site.id,
      siteUrl: site.siteUrl,
      totalAggregates,
      totalQueryCountingRows,
      sampleAggregates: site.queryCountingAggregates.map(a => ({
        date: a.date,
        position1to3: a.position1to3,
        position4to10: a.position4to10,
        position11to20: a.position11to20,
        position21plus: a.position21plus,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

