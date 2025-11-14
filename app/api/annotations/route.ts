import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createAnnotation,
  deleteAnnotation,
  generateAnnotationId,
  getAnnotationById,
  getAnnotationsBySite,
  updateAnnotation,
} from '@/lib/annotationsDb';
import type { AnnotationCreateInput } from '@/lib/annotationsDb';

// GET /api/annotations - List all annotations for a site
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const siteUrl = searchParams.get('siteUrl');
    const id = searchParams.get('id');

    if (id) {
      const annotation = await getAnnotationById(id);
      if (!annotation) {
        return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
      }
      return NextResponse.json({ annotation });
    }

    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing siteUrl parameter' }, { status: 400 });
    }

    const siteAnnotations = await getAnnotationsBySite(siteUrl);
    return NextResponse.json({ annotations: siteAnnotations });
  } catch (error: any) {
    console.error('❌ [Annotations GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load annotations' },
      { status: 500 }
    );
  }
}

// POST /api/annotations - Create new annotation
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const annotation: AnnotationCreateInput = {
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

    const created = await createAnnotation(annotation);
    return NextResponse.json({ annotation: created });
  } catch (error: any) {
    console.error('❌ [Annotations POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create annotation' },
      { status: 500 }
    );
  }
}

// PUT /api/annotations/:id - Update annotation (handled via query param)
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing annotation ID' }, { status: 400 });
    }

    const body = await request.json();
    const updated = await updateAnnotation(id, body);

    if (!updated) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    return NextResponse.json({ annotation: updated });
  } catch (error: any) {
    console.error('❌ [Annotations PUT] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update annotation' },
      { status: 500 }
    );
  }
}

// DELETE /api/annotations - Delete annotation
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing annotation ID' }, { status: 400 });
    }

    const deleted = await deleteAnnotation(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [Annotations DELETE] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}

