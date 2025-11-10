/**
 * Manual sync script to aggregate existing Query Counting data
 * Run this once to populate QueryCountingAggregate table from existing GSCDataPoint rows
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncQueryCounting() {
  console.log('🔄 Starting Query Counting aggregation...\n');

  try {
    // Get all sites
    const sites = await prisma.site.findMany();
    
    console.log(`Found ${sites.length} sites to process\n`);

    for (const site of sites) {
      console.log(`📊 Processing: ${site.siteUrl}`);
      
      // Count existing raw data
      const rawCount = await prisma.gSCDataPoint.count({
        where: {
          siteId: site.id,
          query: { not: '' },
          page: '',
        },
      });

      console.log(`  → Found ${rawCount} raw query counting rows`);
      
      // Show date range
      const firstRow = await prisma.gSCDataPoint.findFirst({
        where: { siteId: site.id, query: { not: '' }, page: '' },
        orderBy: { date: 'asc' },
      });
      const lastRow = await prisma.gSCDataPoint.findFirst({
        where: { siteId: site.id, query: { not: '' }, page: '' },
        orderBy: { date: 'desc' },
      });
      
      if (firstRow && lastRow) {
        console.log(`  → Date range: ${firstRow.date.toISOString().split('T')[0]} to ${lastRow.date.toISOString().split('T')[0]}`);
      }

      if (rawCount === 0) {
        console.log(`  ⊘ No data to aggregate, skipping\n`);
        continue;
      }

      // Aggregate using SQL for performance
      const aggregates = await prisma.$queryRaw<any[]>`
        SELECT 
          DATE(date) as date,
          COUNT(*) FILTER (WHERE position >= 1 AND position <= 3) as "position1to3",
          COUNT(*) FILTER (WHERE position >= 4 AND position <= 10) as "position4to10",
          COUNT(*) FILTER (WHERE position >= 11 AND position <= 20) as "position11to20",
          COUNT(*) FILTER (WHERE position >= 21) as "position21plus"
        FROM "GSCDataPoint"
        WHERE "siteId" = ${site.id}
          AND query != ''
          AND page = ''
        GROUP BY DATE(date)
        ORDER BY DATE(date) ASC
      `;

      console.log(`  → Generated ${aggregates.length} daily aggregates`);

      // Save aggregates
      let saved = 0;
      for (const agg of aggregates) {
        await prisma.queryCountingAggregate.upsert({
          where: {
            siteId_date: {
              siteId: site.id,
              date: new Date(agg.date),
            },
          },
          create: {
            siteId: site.id,
            date: new Date(agg.date),
            position1to3: Number(agg.position1to3),
            position4to10: Number(agg.position4to10),
            position11to20: Number(agg.position11to20),
            position21plus: Number(agg.position21plus),
          },
          update: {
            position1to3: Number(agg.position1to3),
            position4to10: Number(agg.position4to10),
            position11to20: Number(agg.position11to20),
            position21plus: Number(agg.position21plus),
            updatedAt: new Date(),
          },
        });
        saved++;
      }

      console.log(`  ✅ Saved ${saved} aggregates\n`);
    }

    console.log('✅ Query Counting aggregation complete!\n');
    
    // Show summary
    const totalAggregates = await prisma.queryCountingAggregate.count();
    console.log('📊 Summary:');
    console.log(`   Total aggregates in database: ${totalAggregates}`);

  } catch (error) {
    console.error('❌ Aggregation failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  syncQueryCounting();
}

export { syncQueryCounting };

