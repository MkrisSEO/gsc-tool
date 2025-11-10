import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAllAnnotations,
  getAnnotationsBySite,
  getAnnotationById,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  generateAnnotationId,
  type Annotation,
} from '@/lib/annotationsStorage';

// GET /api/annotations - List all annotations for a site
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const siteUrl = searchParams.get('siteUrl');
  const id = searchParams.get('id');

  // Get specific annotation
  if (id) {
    const annotation = getAnnotationById(id);
    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }
    return NextResponse.json({ annotation });
  }

  // Get all annotations for site
  if (!siteUrl) {
    return NextResponse.json({ error: 'Missing siteUrl parameter' }, { status: 400 });
  }

  const siteAnnotations = getAnnotationsBySite(siteUrl);
  
  return NextResponse.json({ annotations: siteAnnotations });
}

// POST /api/annotations - Create new annotation
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { date, title, description, scope, urls, contentGroupId, siteUrl } = body;

  if (!date || !title || !scope || !siteUrl) {
    return NextResponse.json(
      { error: 'Missing required fields: date, title, scope, siteUrl' },
      { status: 400 }
    );
  }

  if (scope === 'specific' && (!urls || urls.length === 0)) {
    return NextResponse.json(
      { error: 'URLs required when scope is specific' },
      { status: 400 }
    );
  }

  if (scope === 'content_group' && !contentGroupId) {
    return NextResponse.json(
      { error: 'Content group ID required when scope is content_group' },
      { status: 400 }
    );
  }

  const annotation: Annotation = {
    id: generateAnnotationId(),
    date,
    title,
    description: description || '',
    scope,
    urls: scope === 'specific' ? urls : undefined,
    contentGroupId: scope === 'content_group' ? contentGroupId : undefined,
    createdAt: new Date().toISOString(),
    createdBy: session.user.email,
    siteUrl,
  };

  const created = createAnnotation(annotation);

  return NextResponse.json({ annotation: created });
}

// PUT /api/annotations/:id - Update annotation (handled via query param)
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing annotation ID' }, { status: 400 });
  }

  const body = await request.json();
  const updated = updateAnnotation(id, body);

  if (!updated) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }

  return NextResponse.json({ annotation: updated });
}

// DELETE /api/annotations - Delete annotation
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing annotation ID' }, { status: 400 });
  }

  const deleted = deleteAnnotation(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

