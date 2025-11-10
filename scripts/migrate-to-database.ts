import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Migration {
  name: string;
  run: () => Promise<void>;
}

// ============================================
// Migration 1: GEO Tracking Data
// ============================================
async function migrateGEOData() {
  console.log('📦 Migrating GEO tracking data...');
  
  const geoFilePath = path.join(process.cwd(), 'data', 'geo-tracking.json');
  
  if (!fs.existsSync(geoFilePath)) {
    console.log('  ⊘ No GEO data file found, skipping');
    return;
  }
  
  const geoData = JSON.parse(fs.readFileSync(geoFilePath, 'utf-8'));
  
  // Get or create default user
  const user = await prisma.user.upsert({
    where: { email: 'default@gsc-tool.local' },
    create: {
      email: 'default@gsc-tool.local',
      name: 'Default User',
    },
    update: {},
  });
  
  console.log(`  ✓ User: ${user.email}`);
  
  // Migrate queries
  let queriesCreated = 0;
  let resultsCreated = 0;
  
  const queries = geoData.queries || [];
  console.log(`  → Processing ${queries.length} queries...`);
  
  for (const query of queries) {
    // Get or create site
    const site = await prisma.site.upsert({
      where: { siteUrl: query.siteUrl },
      create: {
        siteUrl: query.siteUrl,
        userId: user.id,
        displayName: query.siteUrl,
      },
      update: {},
    });
    
    // Create query
    const dbQuery = await prisma.gEOQuery.upsert({
      where: {
        siteId_query: {
          siteId: site.id,
          query: query.query,
        },
      },
      create: {
        siteId: site.id,
        query: query.query,
        active: query.active ?? true,
        priority: query.priority ?? 1,
        createdAt: new Date(query.createdAt),
      },
      update: {
        active: query.active ?? true,
        priority: query.priority ?? 1,
      },
    });
    
    queriesCreated++;
    
    // Migrate test results for this query
    const queryResults = (geoData.results || []).filter(
      (r: any) => r.queryId === query.id
    );
    
    for (const result of queryResults) {
      await prisma.gEOTestResult.create({
        data: {
          queryId: dbQuery.id,
          engine: result.engine || 'gemini',
          cited: result.cited ?? false,
          usedAsSource: result.usedAsSource ?? false,
          citationCount: result.citationCount || 0,
          visibilityScore: result.visibilityScore || 0,
          sourcesFound: result.sourcesFound ?? 0,
          responseText: result.responseText || '',
          competitors: result.competitors || [],
          searchQueries: result.searchQueries || null,
          groundingMetadata: null,
          testedAt: new Date(result.testedAt),
        },
      });
      resultsCreated++;
    }
  }
  
  console.log(`  ✅ Migrated ${queriesCreated} queries and ${resultsCreated} test results`);
}

// ============================================
// Migration 2: Annotations
// ============================================
async function migrateAnnotations() {
  console.log('📝 Migrating annotations...');
  
  const annotationsPath = path.join(process.cwd(), 'data', 'annotations.json');
  
  if (!fs.existsSync(annotationsPath)) {
    console.log('  ⊘ No annotations file found, skipping');
    return;
  }
  
  const annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf-8'));
  let created = 0;
  
  console.log(`  → Processing ${annotations.length} annotations...`);
  
  for (const ann of annotations) {
    // Get or create site
    const site = await prisma.site.upsert({
      where: { siteUrl: ann.siteUrl },
      create: {
        siteUrl: ann.siteUrl,
        userId: (await prisma.user.findFirst())!.id,
        displayName: ann.siteUrl,
      },
      update: {},
    });
    
    await prisma.annotation.create({
      data: {
        siteId: site.id,
        date: new Date(ann.date),
        title: ann.title,
        description: ann.description,
        scope: ann.scope,
        urls: ann.urls || null,
        contentGroupId: ann.contentGroupId || null,
        createdAt: new Date(ann.createdAt),
        createdBy: ann.createdBy,
      },
    });
    created++;
  }
  
  console.log(`  ✅ Migrated ${created} annotations`);
}

// ============================================
// Migration 3: Content Groups
// ============================================
async function migrateContentGroups() {
  console.log('🗂️  Migrating content groups...');
  
  const groupsPath = path.join(process.cwd(), 'data', 'content-groups.json');
  
  if (!fs.existsSync(groupsPath)) {
    console.log('  ⊘ No content groups file found, skipping');
    return;
  }
  
  const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
  let created = 0;
  
  console.log(`  → Processing ${groups.length} content groups...`);
  
  for (const group of groups) {
    // Get or create site
    const site = await prisma.site.upsert({
      where: { siteUrl: group.siteUrl },
      create: {
        siteUrl: group.siteUrl,
        userId: (await prisma.user.findFirst())!.id,
        displayName: group.siteUrl,
      },
      update: {},
    });
    
    await prisma.contentGroup.create({
      data: {
        siteId: site.id,
        name: group.name,
        color: group.color || null,
        includeConditions: group.includeConditions || [],
        excludeConditions: group.excludeConditions || null,
        createdAt: group.createdAt ? new Date(group.createdAt) : new Date(),
      },
    });
    created++;
  }
  
  console.log(`  ✅ Migrated ${created} content groups`);
}

// ============================================
// Run all migrations
// ============================================
const migrations: Migration[] = [
  { name: 'GEO Tracking', run: migrateGEOData },
  { name: 'Annotations', run: migrateAnnotations },
  { name: 'Content Groups', run: migrateContentGroups },
];

async function runMigrations() {
  console.log('🚀 Starting data migration to PostgreSQL...\n');
  
  try {
    for (const migration of migrations) {
      await migration.run();
      console.log('');
    }
    
    console.log('✅ All migrations completed successfully!');
    console.log('\n📊 Database summary:');
    
    const stats = {
      users: await prisma.user.count(),
      sites: await prisma.site.count(),
      geoQueries: await prisma.gEOQuery.count(),
      geoResults: await prisma.gEOTestResult.count(),
      annotations: await prisma.annotation.count(),
      contentGroups: await prisma.contentGroup.count(),
    };
    
    console.log(stats);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };

