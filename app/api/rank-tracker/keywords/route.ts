import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import {
  getKeywords,
  addKeywords,
  updateKeyword,
  deleteKeyword,
  getKeywordWithHistory,
} from '@/lib/rankTrackerStorage';

/**
 * GET - Get all keywords for a site
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get('siteUrl');
    const keyword = searchParams.get('keyword');
    const days = searchParams.get('days');

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: siteUrl' },
        { status: 400 }
      );
    }

    // Get specific keyword with history
    if (keyword) {
      const keywordData = await getKeywordWithHistory(
        siteUrl,
        keyword,
        days ? parseInt(days) : 90
      );

      if (!keywordData) {
        return NextResponse.json(
          { error: 'Keyword not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ keyword: keywordData });
    }

    // Get all keywords
    const keywords = await getKeywords(siteUrl);
    return NextResponse.json({ keywords });
  } catch (error: any) {
    console.error('[Rank Tracker API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}

/**
 * POST - Add new keywords
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, keywords } = body;

    if (!siteUrl || !keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: 'Missing required parameters: siteUrl, keywords (array)' },
        { status: 400 }
      );
    }

    console.log(`[Rank Tracker API] Adding ${keywords.length} keywords for ${siteUrl}`);

    const results = await addKeywords(siteUrl, keywords);

    return NextResponse.json({
      success: true,
      added: results.length,
      keywords: results,
    });
  } catch (error: any) {
    console.error('[Rank Tracker API] Error adding keywords:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add keywords' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update a keyword
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, keyword, updates } = body;

    if (!siteUrl || !keyword || !updates) {
      return NextResponse.json(
        { error: 'Missing required parameters: siteUrl, keyword, updates' },
        { status: 400 }
      );
    }

    const updated = await updateKeyword(siteUrl, keyword, updates);

    return NextResponse.json({
      success: true,
      keyword: updated,
    });
  } catch (error: any) {
    console.error('[Rank Tracker API] Error updating keyword:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update keyword' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a keyword (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get('siteUrl');
    const keyword = searchParams.get('keyword');

    if (!siteUrl || !keyword) {
      return NextResponse.json(
        { error: 'Missing required parameters: siteUrl, keyword' },
        { status: 400 }
      );
    }

    await deleteKeyword(siteUrl, keyword);

    return NextResponse.json({
      success: true,
      message: 'Keyword deleted',
    });
  } catch (error: any) {
    console.error('[Rank Tracker API] Error deleting keyword:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete keyword' },
      { status: 500 }
    );
  }
}

