import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkMultipleKeywords } from '@/lib/dataforseo';

/**
 * Cron job endpoint to check all tracked keywords via DataForSEO
 * Called weekly by Vercel Cron
 */
export async function GET(request: NextRequest) {
  console.log('🔄 [Cron Check Ranks] Starting weekly DataForSEO checks...');

  // Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ [Cron Check Ranks] Unauthorized - invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all sites with active keywords
    const sites = await prisma.site.findMany({
      include: {
        rankKeywords: {
          where: { active: true },
        },
      },
    });

    if (sites.length === 0) {
      console.log('⚠️ [Cron Check Ranks] No sites found');
      return NextResponse.json({
        success: true,
        message: 'No sites to check',
        sitesProcessed: 0,
      });
    }

    console.log(`📋 [Cron Check Ranks] Found ${sites.length} sites`);

    let totalChecked = 0;
    let totalCost = 0;
    const results = [];

    for (const site of sites) {
      if (site.rankKeywords.length === 0) {
        console.log(`⚠️ [Cron Check Ranks] Skipping ${site.siteUrl} - no keywords`);
        continue;
      }

      console.log(`\n🔄 [Cron Check Ranks] Processing: ${site.siteUrl} (${site.rankKeywords.length} keywords)`);

      try {
        const targetDomain = site.siteUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
        const keywords = site.rankKeywords.map((k) => k.keyword);

        // Check positions via DataForSEO
        const checkResults = await checkMultipleKeywords(keywords, targetDomain);

        // Save results to database
        const today = new Date().toISOString().split('T')[0];
        let savedCount = 0;

        for (const kw of site.rankKeywords) {
          const result = checkResults.get(kw.keyword);
          
          if (!result) continue;

          totalCost += result.cost || 0;

          try {
            await prisma.rankHistory.upsert({
              where: {
                keywordId_date: {
                  keywordId: kw.id,
                  date: new Date(today),
                },
              },
              create: {
                siteId: site.id,
                keywordId: kw.id,
                date: new Date(today),
                position: 999, // Default if no GSC data
                clicks: 0,
                impressions: 0,
                ctr: 0,
                dfPosition: result.position,
                dfUrl: result.url,
                dfTitle: result.title,
                dfSerpFeatures: result.serpFeatures,
                dfLastChecked: new Date(),
              },
              update: {
                dfPosition: result.position,
                dfUrl: result.url,
                dfTitle: result.title,
                dfSerpFeatures: result.serpFeatures,
                dfLastChecked: new Date(),
              },
            });

            savedCount++;
          } catch (error: any) {
            console.error(`Error saving result for "${kw.keyword}":`, error.message);
          }
        }

        totalChecked += savedCount;

        results.push({
          siteUrl: site.siteUrl,
          success: true,
          checked: savedCount,
          total: site.rankKeywords.length,
        });

        console.log(`✅ [Cron Check Ranks] ${site.siteUrl}: ${savedCount} keywords checked`);
      } catch (error: any) {
        console.error(`❌ [Cron Check Ranks] Error processing ${site.siteUrl}:`, error.message);
        results.push({
          siteUrl: site.siteUrl,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`\n✅ [Cron Check Ranks] Completed: ${totalChecked} keywords checked | Cost: $${totalCost.toFixed(4)}`);

    return NextResponse.json({
      success: true,
      sitesProcessed: sites.length,
      totalChecked,
      totalCost: totalCost.toFixed(4),
      results,
    });
  } catch (error: any) {
    console.error('❌ [Cron Check Ranks] Fatal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check ranks' },
      { status: 500 }
    );
  }
}

// Allow both GET and POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}

