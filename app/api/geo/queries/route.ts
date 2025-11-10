import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getQueries,
  addQuery,
  deleteQuery,
  getLatestTestResults,
  saveTestResult,
} from '@/lib/geoStorageDb';

// ✅ Increase timeout to prevent connection pool issues
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET - Get all queries for a site
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

    const queries = await getQueries(siteUrl);
    
    // Get latest test results for each query
    const queriesWithResults = await Promise.all(
      queries.map(async (query) => {
        const latestResults = await getLatestTestResults(query.id);
        return {
          ...query,
          latestResults,
        };
      })
    );

    return Response.json({ queries: queriesWithResults });
  } catch (error: any) {
    console.error('[GEO Queries] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch queries', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a new query
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, query, priority, testResult } = body;

    if (!siteUrl || !query) {
      return Response.json(
        { error: 'siteUrl and query are required' },
        { status: 400 }
      );
    }

    const newQuery = await addQuery(siteUrl, query, priority || 1);
    
    // If test result is provided, save it
    if (testResult && testResult.results) {
      for (const result of testResult.results) {
        await saveTestResult({
          queryId: newQuery.id,
          engine: result.engine,
          responseText: result.fullResponse || result.responseExcerpt,
          cited: result.cited,
          usedAsSource: result.usedAsSource,
          citationCount: result.citationCount,
          visibilityScore: result.visibilityScore,
          competitors: result.competitors,
          sourcesFound: result.sourcesFound,
        });
      }
    }

    return Response.json({ query: newQuery });
  } catch (error: any) {
    console.error('[GEO Queries] POST error:', error);
    return Response.json(
      { error: 'Failed to add query', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a query
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    if (!queryId) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const deleted = await deleteQuery(queryId);

    if (!deleted) {
      return Response.json({ error: 'Query not found' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('[GEO Queries] DELETE error:', error);
    return Response.json(
      { error: 'Failed to delete query', details: error.message },
      { status: 500 }
    );
  }
}

