import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteStats } from '@/lib/geoStorageDb';

// ✅ Increase timeout to prevent connection pool issues
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET - Get GEO statistics for a site
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');

    if (!siteUrl) {
      return Response.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    const stats = await getSiteStats(siteUrl);

    return Response.json({ stats });
  } catch (error: any) {
    console.error('[GEO Stats] Error:', error);
    return Response.json(
      { error: 'Failed to fetch stats', details: error.message },
      { status: 500 }
    );
  }
}


