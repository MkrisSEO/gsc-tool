import { prisma } from '@/lib/prisma';

export type ConditionOperator = 'contains' | 'equals' | 'regex' | 'batch';
export type ConditionType = 'inclusion' | 'exclusion';

export interface Condition {
  type: ConditionType;
  operator: ConditionOperator;
  value: string | string[];
}

export interface ContentGroup {
  id: string;
  name: string;
  siteUrl: string;
  conditions: Condition[];
  createdAt: string;
  updatedAt: string;
  urlCount: number;
  matchedUrls: string[];
}

export function generateContentGroupId(): string {
  return `cg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function getAllContentGroups(): Promise<ContentGroup[]> {
  try {
    const groups = await prisma.contentGroup.findMany({
      include: {
        site: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      siteUrl: g.site.siteUrl,
      conditions: g.conditions as Condition[],
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      urlCount: g.urlCount,
      matchedUrls: (g.matchedUrls as string[]) || [],
    }));
  } catch (error) {
    console.error('Failed to read content groups from database:', error);
    return [];
  }
}

export async function getContentGroupsBySite(siteUrl: string): Promise<ContentGroup[]> {
  try {
    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      return [];
    }

    const groups = await prisma.contentGroup.findMany({
      where: {
        siteId: site.id,
      },
      include: {
        site: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      siteUrl: g.site.siteUrl,
      conditions: g.conditions as Condition[],
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      urlCount: g.urlCount,
      matchedUrls: (g.matchedUrls as string[]) || [],
    }));
  } catch (error) {
    console.error('Failed to read content groups from database:', error);
    return [];
  }
}

export async function getContentGroupById(id: string): Promise<ContentGroup | null> {
  try {
    const group = await prisma.contentGroup.findUnique({
      where: { id },
      include: {
        site: true,
      },
    });

    if (!group) {
      return null;
    }

    return {
      id: group.id,
      name: group.name,
      siteUrl: group.site.siteUrl,
      conditions: group.conditions as Condition[],
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      urlCount: group.urlCount,
      matchedUrls: (group.matchedUrls as string[]) || [],
    };
  } catch (error) {
    console.error('Failed to read content group from database:', error);
    return null;
  }
}

export async function createContentGroup(group: ContentGroup): Promise<ContentGroup> {
  try {
    // Get or create site
    let site = await prisma.site.findUnique({
      where: { siteUrl: group.siteUrl },
    });

    if (!site) {
      site = await prisma.site.create({
        data: {
          siteUrl: group.siteUrl,
        },
      });
    }

    const created = await prisma.contentGroup.create({
      data: {
        id: group.id,
        siteId: site.id,
        name: group.name,
        conditions: group.conditions as any,
        urlCount: group.urlCount,
        matchedUrls: group.matchedUrls as any,
      },
      include: {
        site: true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      siteUrl: created.site.siteUrl,
      conditions: created.conditions as Condition[],
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      urlCount: created.urlCount,
      matchedUrls: (created.matchedUrls as string[]) || [],
    };
  } catch (error) {
    console.error('Failed to create content group in database:', error);
    throw error;
  }
}

export async function updateContentGroup(
  id: string,
  updates: Partial<ContentGroup>
): Promise<ContentGroup | null> {
  try {
    const updated = await prisma.contentGroup.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.conditions && { conditions: updates.conditions as any }),
        ...(updates.urlCount !== undefined && { urlCount: updates.urlCount }),
        ...(updates.matchedUrls && { matchedUrls: updates.matchedUrls as any }),
      },
      include: {
        site: true,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      siteUrl: updated.site.siteUrl,
      conditions: updated.conditions as Condition[],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      urlCount: updated.urlCount,
      matchedUrls: (updated.matchedUrls as string[]) || [],
    };
  } catch (error) {
    console.error('Failed to update content group in database:', error);
    return null;
  }
}

export async function deleteContentGroup(id: string): Promise<boolean> {
  try {
    await prisma.contentGroup.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error('Failed to delete content group from database:', error);
    return false;
  }
}

