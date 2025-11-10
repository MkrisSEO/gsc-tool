import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { clearGSCCache } from '@/lib/gscDataCache';

/**
 * POST - Clear GSC cache for a site
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, startDate, endDate } = body;

    if (!siteUrl) {
      return Response.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    const rowsDeleted = await clearGSCCache(siteUrl, startDate, endDate);

    return Response.json({
      success: true,
      rowsDeleted,
      message: `Cleared ${rowsDeleted} cached data points`,
    });
  } catch (error: any) {
    console.error('[GSC Cache Clear] Error:', error);
    return Response.json(
      { error: 'Failed to clear cache', details: error.message },
      { status: 500 }
    );
  }
}

