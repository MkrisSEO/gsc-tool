import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import {
  getAllContentGroups,
  getContentGroupsBySite,
  getContentGroupById,
  createContentGroup,
  updateContentGroup,
  deleteContentGroup,
  generateContentGroupId,
  type ContentGroup,
  type Condition,
} from '@/lib/contentGroupsStorage';

// GET /api/content-groups - List all content groups for a site
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const siteUrl = searchParams.get('siteUrl');
  const id = searchParams.get('id');

  // Get specific content group
  if (id) {
    const group = getContentGroupById(id);
    if (!group) {
      return NextResponse.json({ error: 'Content group not found' }, { status: 404 });
    }
    
    console.log('📋 [GET content-group by ID]', {
      id,
      name: group.name,
      urlCount: group.urlCount,
      matchedUrls: group.matchedUrls,
    });
    
    return NextResponse.json({ group }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  // Get all content groups for site
  if (!siteUrl) {
    return NextResponse.json({ error: 'Missing siteUrl parameter' }, { status: 400 });
  }

  const groups = getContentGroupsBySite(siteUrl);
  
  console.log('📋 [GET content-groups]', {
    siteUrl,
    groupCount: groups.length,
    sampleGroup: groups[0] ? {
      name: groups[0].name,
      urlCount: groups[0].urlCount,
      sampleUrls: groups[0].matchedUrls?.slice(0, 2),
    } : null,
  });
  
  return NextResponse.json({ groups }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

// Helper function to fetch and match URLs
async function fetchMatchingUrls(
  siteUrl: string,
  conditions: Condition[],
  accessToken: string
): Promise<string[]> {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

  // Fetch all pages from Search Analytics
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 180); // Last 180 days (6 months) to capture all URLs

  const response = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dimensions: ['page'],
      rowLimit: 25000,
    },
  });

  const allPages = (response.data.rows || []).map((row) => row.keys?.[0] || '');
  
  console.log('📋 [fetchMatchingUrls] Fetched pages:', {
    totalPages: allPages.length,
    samplePages: allPages.slice(0, 5),
  });

  // Normalize URL for comparison (remove trailing slash and convert to lowercase)
  const normalizeUrl = (url: string): string => {
    return url.toLowerCase().replace(/\/$/, '');
  };

  // Match URLs against conditions
  function matchUrl(url: string, condition: Condition): boolean {
    const value = condition.value;

    if (condition.operator === 'contains') {
      return normalizeUrl(url).includes(normalizeUrl(value as string));
    } else if (condition.operator === 'equals') {
      return normalizeUrl(url) === normalizeUrl(value as string);
    } else if (condition.operator === 'regex') {
      try {
        const regex = new RegExp(value as string, 'i'); // Case insensitive
        return regex.test(url);
      } catch {
        return false;
      }
    } else if (condition.operator === 'batch') {
      const urls = Array.isArray(value) ? value : [];
      const normalizedUrl = normalizeUrl(url);
      // Check if the URL from Search Console matches any of the batch URLs
      return urls.some(batchUrl => normalizeUrl(batchUrl) === normalizedUrl);
    }

    return false;
  }

  const matchedUrls = allPages.filter((url) => {
    const result = conditions.every((condition) => {
      const matches = matchUrl(url, condition);
      return condition.type === 'inclusion' ? matches : !matches;
    });
    return result;
  });

  console.log('🔍 [fetchMatchingUrls] Matching complete:', {
    totalPages: allPages.length,
    matchedCount: matchedUrls.length,
    sampleMatched: matchedUrls.slice(0, 5),
    conditions: conditions.map(c => ({
      type: c.type,
      operator: c.operator,
      valueCount: Array.isArray(c.value) ? c.value.length : 1,
      sampleValues: Array.isArray(c.value) ? c.value.slice(0, 3) : [c.value],
    })),
  });

  return matchedUrls;
}

// POST /api/content-groups - Create new content group
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, siteUrl, conditions } = body;

  if (!name || !siteUrl || !conditions || !Array.isArray(conditions)) {
    return NextResponse.json(
      { error: 'Missing required fields: name, siteUrl, conditions' },
      { status: 400 }
    );
  }

  try {
    // Fetch all matching URLs from Search Console
    const matchedUrls = await fetchMatchingUrls(siteUrl, conditions, (session as any).accessToken);

    const group: ContentGroup = {
      id: generateContentGroupId(),
      name,
      siteUrl,
      conditions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      urlCount: matchedUrls.length,
      matchedUrls,
    };

    const created = createContentGroup(group);

    return NextResponse.json({ group: created });
  } catch (error) {
    console.error('Error creating content group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matching URLs' },
      { status: 500 }
    );
  }
}

// PUT /api/content-groups - Update content group
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing content group ID' }, { status: 400 });
  }

  const body = await request.json();
  const { name, siteUrl, conditions } = body;

  try {
    // Fetch all matching URLs from Search Console
    const matchedUrls = await fetchMatchingUrls(siteUrl, conditions, (session as any).accessToken);

    const updates = {
      name,
      conditions,
      matchedUrls,
      urlCount: matchedUrls.length,
      updatedAt: new Date().toISOString(),
    };

    const updated = updateContentGroup(id, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Content group not found' }, { status: 404 });
    }

    return NextResponse.json({ group: updated });
  } catch (error) {
    console.error('Error updating content group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matching URLs' },
      { status: 500 }
    );
  }
}

// DELETE /api/content-groups - Delete content group
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing content group ID' }, { status: 400 });
  }

  const deleted = deleteContentGroup(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Content group not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

