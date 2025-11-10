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

// ✅ RAW SQL - Bypasses Prisma Client cache issues
export async function getAllContentGroups(): Promise<ContentGroup[]> {
  try {
    const groups = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      siteId: string;
      conditions: any;
      urlCount: number;
      matchedUrls: any;
      createdAt: Date;
      updatedAt: Date;
      siteUrl: string;
    }>>`
      SELECT cg.*, s."siteUrl"
      FROM "ContentGroup" cg
      INNER JOIN "Site" s ON cg."siteId" = s.id
      ORDER BY cg."createdAt" DESC
    `;

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      siteUrl: g.siteUrl,
      conditions: g.conditions as Condition[],
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      urlCount: g.urlCount,
      matchedUrls: g.matchedUrls || [],
    }));
  } catch (error) {
    console.error('Failed to read content groups from database:', error);
    return [];
  }
}

// ✅ RAW SQL
export async function getContentGroupsBySite(siteUrl: string): Promise<ContentGroup[]> {
  try {
    const groups = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      siteId: string;
      conditions: any;
      urlCount: number;
      matchedUrls: any;
      createdAt: Date;
      updatedAt: Date;
      siteUrl: string;
    }>>`
      SELECT cg.*, s."siteUrl"
      FROM "ContentGroup" cg
      INNER JOIN "Site" s ON cg."siteId" = s.id
      WHERE s."siteUrl" = ${siteUrl}
      ORDER BY cg."createdAt" DESC
    `;

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      siteUrl: g.siteUrl,
      conditions: g.conditions as Condition[],
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      urlCount: g.urlCount,
      matchedUrls: g.matchedUrls || [],
    }));
  } catch (error) {
    console.error('Failed to read content groups from database:', error);
    return [];
  }
}

// ✅ RAW SQL
export async function getContentGroupById(id: string): Promise<ContentGroup | null> {
  try {
    const groups = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      siteId: string;
      conditions: any;
      urlCount: number;
      matchedUrls: any;
      createdAt: Date;
      updatedAt: Date;
      siteUrl: string;
    }>>`
      SELECT cg.*, s."siteUrl"
      FROM "ContentGroup" cg
      INNER JOIN "Site" s ON cg."siteId" = s.id
      WHERE cg.id = ${id}
      LIMIT 1
    `;

    if (groups.length === 0) {
      return null;
    }

    const g = groups[0];
    return {
      id: g.id,
      name: g.name,
      siteUrl: g.siteUrl,
      conditions: g.conditions as Condition[],
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      urlCount: g.urlCount,
      matchedUrls: g.matchedUrls || [],
    };
  } catch (error) {
    console.error('Failed to read content group from database:', error);
    return null;
  }
}

// ✅ RAW SQL - Bypasses Prisma Client completely
export async function createContentGroup(group: ContentGroup): Promise<ContentGroup> {
  try {
    console.log('💾 [createContentGroup RAW SQL] Starting...', {
      groupId: group.id,
      name: group.name,
      siteUrl: group.siteUrl,
      urlCount: group.urlCount,
      conditionCount: group.conditions.length,
    });

    // Get or create site using raw SQL
    const existingSites = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Site" WHERE "siteUrl" = ${group.siteUrl} LIMIT 1
    `;

    let siteId: string;
    if (existingSites.length === 0) {
      console.log('💾 [createContentGroup] Creating new site:', group.siteUrl);
      const newSites = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "Site" ("siteUrl", "createdAt", "updatedAt")
        VALUES (${group.siteUrl}, NOW(), NOW())
        RETURNING id
      `;
      siteId = newSites[0].id;
      console.log('✅ [createContentGroup] Site created:', siteId);
    } else {
      siteId = existingSites[0].id;
      console.log('✅ [createContentGroup] Site exists:', siteId);
    }

    // Insert content group using raw SQL
    const conditionsJson = JSON.stringify(group.conditions);
    const matchedUrlsJson = JSON.stringify(group.matchedUrls);

    console.log('💾 [createContentGroup] Inserting content group...');

    await prisma.$executeRaw`
      INSERT INTO "ContentGroup" (
        id, "siteId", name, conditions, "urlCount", "matchedUrls", "createdAt", "updatedAt"
      ) VALUES (
        ${group.id},
        ${siteId},
        ${group.name},
        ${conditionsJson}::jsonb,
        ${group.urlCount},
        ${matchedUrlsJson}::jsonb,
        NOW(),
        NOW()
      )
    `;

    console.log('✅ [createContentGroup] Success!');

    return group;
  } catch (error: any) {
    console.error('❌ [createContentGroup RAW SQL] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw error;
  }
}

// ✅ RAW SQL
export async function updateContentGroup(
  id: string,
  updates: Partial<ContentGroup>
): Promise<ContentGroup | null> {
  try {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name) {
      setParts.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.conditions) {
      setParts.push(`conditions = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(updates.conditions));
    }
    if (updates.urlCount !== undefined) {
      setParts.push(`"urlCount" = $${paramCount++}`);
      values.push(updates.urlCount);
    }
    if (updates.matchedUrls) {
      setParts.push(`"matchedUrls" = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(updates.matchedUrls));
    }
    
    setParts.push(`"updatedAt" = NOW()`);
    values.push(id);

    await prisma.$executeRawUnsafe(
      `UPDATE "ContentGroup" SET ${setParts.join(', ')} WHERE id = $${paramCount}`,
      ...values
    );

    return await getContentGroupById(id);
  } catch (error) {
    console.error('Failed to update content group in database:', error);
    return null;
  }
}

// ✅ RAW SQL
export async function deleteContentGroup(id: string): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "ContentGroup" WHERE id = ${id}
    `;
    return true;
  } catch (error) {
    console.error('Failed to delete content group from database:', error);
    return false;
  }
}

