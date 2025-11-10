import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQueries, getAllTestResults } from '@/lib/geoStorageDb';

/**
 * GET - Get competitor analysis data for a site
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

    // Get all queries and their results
    const queries = await getQueries(siteUrl);
    const allResults = await getAllTestResults(siteUrl);

    const response = {
      queries: queries.map(q => ({
        id: q.id,
        query: q.query,
      })),
      allResults: allResults.map(r => ({
        queryId: r.queryId,
        competitors: r.competitors || [],
        cited: r.cited,
        visibilityScore: r.visibilityScore,
        sourcesFound: r.sourcesFound,
        usedAsSource: r.usedAsSource,
      })),
    };

    return Response.json(response);
  } catch (error: any) {
    console.error('[GEO Competitor Analysis] Error:', error);
    return Response.json(
      { error: 'Failed to fetch competitor analysis', details: error.message },
      { status: 500 }
    );
  }
}

