import { Prisma } from '@prisma/client';
import prisma from './prisma';

export interface AnnotationRecord {
  id: string;
  date: string;
  title: string;
  description: string;
  scope: 'all' | 'specific' | 'content_group';
  urls?: string[];
  contentGroupId?: string;
  createdAt: string;
  createdBy: string;
  siteUrl: string;
}

export interface AnnotationCreateInput {
  id: string;
  date: string;
  title: string;
  description?: string;
  scope: 'all' | 'specific' | 'content_group';
  urls?: string[];
  contentGroupId?: string;
  createdAt: string;
  createdBy: string;
  siteUrl: string;
}

type AnnotationUpdateInput = Partial<
  Pick<
    AnnotationRecord,
    'date' | 'title' | 'description' | 'scope' | 'urls' | 'contentGroupId'
  >
>;

const annotationSelect = {
  id: true,
  date: true,
  title: true,
  description: true,
  scope: true,
  urls: true,
  contentGroupId: true,
  createdAt: true,
  createdBy: true,
  site: {
    select: {
      siteUrl: true,
    },
  },
} satisfies Prisma.AnnotationSelect;

const mapAnnotation = (record: Prisma.AnnotationGetPayload<{ select: typeof annotationSelect }>): AnnotationRecord => ({
  id: record.id,
  date: record.date.toISOString().split('T')[0],
  title: record.title,
  description: record.description ?? '',
  scope: record.scope as AnnotationRecord['scope'],
  urls: Array.isArray(record.urls) ? (record.urls as string[]) : undefined,
  contentGroupId: record.contentGroupId ?? undefined,
  createdAt: record.createdAt.toISOString(),
  createdBy: record.createdBy,
  siteUrl: record.site.siteUrl,
});

async function getSiteIdForUrl(siteUrl: string, userEmail?: string): Promise<string> {
  let site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (site) {
    return site.id;
  }

  if (!userEmail) {
    throw new Error(`Site not found for URL ${siteUrl}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new Error(`User not found for email ${userEmail}`);
  }

  site = await prisma.site.create({
    data: {
      siteUrl,
      userId: user.id,
      displayName: siteUrl,
    },
  });

  return site.id;
}

export async function getAllAnnotations(): Promise<AnnotationRecord[]> {
  const annotations = await prisma.annotation.findMany({
    select: annotationSelect,
    orderBy: { date: 'desc' },
  });

  return annotations.map(mapAnnotation);
}

export async function getAnnotationsBySite(siteUrl: string): Promise<AnnotationRecord[]> {
  const annotations = await prisma.annotation.findMany({
    where: {
      site: { siteUrl },
    },
    select: annotationSelect,
    orderBy: { date: 'desc' },
  });

  return annotations.map(mapAnnotation);
}

export async function getAnnotationById(id: string): Promise<AnnotationRecord | null> {
  const annotation = await prisma.annotation.findUnique({
    where: { id },
    select: annotationSelect,
  });

  return annotation ? mapAnnotation(annotation) : null;
}

export async function createAnnotation(input: AnnotationCreateInput): Promise<AnnotationRecord> {
  const siteId = await getSiteIdForUrl(input.siteUrl, input.createdBy);

  const created = await prisma.annotation.create({
    data: {
      id: input.id,
      siteId,
      date: new Date(input.date),
      title: input.title,
      description: input.description ?? '',
      scope: input.scope,
      urls: input.urls && input.urls.length > 0 ? input.urls : null,
      contentGroupId: input.contentGroupId || null,
      createdAt: new Date(input.createdAt),
      createdBy: input.createdBy,
    },
    select: annotationSelect,
  });

  return mapAnnotation(created);
}

export async function updateAnnotation(id: string, updates: AnnotationUpdateInput): Promise<AnnotationRecord | null> {
  const data: Prisma.AnnotationUpdateInput = {};

  if (updates.date) data.date = new Date(updates.date);
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.scope) data.scope = updates.scope;
  if (updates.urls) data.urls = updates.urls.length > 0 ? updates.urls : null;
  if (updates.contentGroupId !== undefined) data.contentGroupId = updates.contentGroupId || null;

  try {
    const updated = await prisma.annotation.update({
      where: { id },
      data,
      select: annotationSelect,
    });

    return mapAnnotation(updated);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

export async function deleteAnnotation(id: string): Promise<boolean> {
  try {
    await prisma.annotation.delete({
      where: { id },
    });
    return true;
  } catch (error: any) {
    if (error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

export function generateAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

