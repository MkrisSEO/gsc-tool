import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { checkKeywordPosition, checkMultipleKeywords } from '@/lib/dataforseo';
import prisma from '@/lib/prisma';

/**
 * POST - Check keyword positions using DataForSEO
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, keywords: keywordsToCheck } = body;

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: siteUrl' },
        { status: 400 }
      );
    }

    // Extract domain from siteUrl
    const targetDomain = siteUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');

    console.log(`[DataForSEO Check] Checking positions for ${targetDomain}`);

    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // If specific keywords provided, check those
    // Otherwise check all active keywords
    let keywords: any[];
    
    if (keywordsToCheck && Array.isArray(keywordsToCheck)) {
      // Get specific keywords from database
      keywords = await prisma.rankKeyword.findMany({
        where: {
          siteId: site.id,
          keyword: {
            in: keywordsToCheck,
          },
          active: true,
        },
      });
    } else {
      // Get all active keywords
      keywords = await prisma.rankKeyword.findMany({
        where: {
          siteId: site.id,
          active: true,
        },
      });
    }

    if (keywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No keywords to check',
        checked: 0,
      });
    }

    console.log(`[DataForSEO Check] Checking ${keywords.length} keywords...`);

    const results = await checkMultipleKeywords(
      keywords.map((k) => k.keyword),
      targetDomain
    );

    // Save results to database
    const today = new Date().toISOString().split('T')[0];
    let savedCount = 0;
    let totalCost = 0;

    for (const kw of keywords) {
      const result = results.get(kw.keyword);
      
      if (!result) {
        console.log(`[DataForSEO Check] No result for "${kw.keyword}"`);
        continue;
      }

      totalCost += result.cost || 0;

      console.log(`[DataForSEO Check] "${kw.keyword}": Position ${result.position || 'not found'}, URL: ${result.url || 'none'}`);
      console.log(`[DataForSEO Check] Result object:`, JSON.stringify(result, null, 2));

      // Only save if position was actually found (position can be 0, so check for null/undefined)
      if (result.position === null || result.position === undefined) {
        console.log(`[DataForSEO Check] ⚠️ Skipping save for "${kw.keyword}" - position not found`);
        continue;
      }

      console.log(`[DataForSEO Check] ✓ Position found: ${result.position}, proceeding to save...`);

      try {
        console.log(`[DataForSEO Check] Attempting to save "${kw.keyword}" - KeywordID: ${kw.id}, Date: ${today}`);
        
        // Check if history record already exists
        const existingRecord = await prisma.rankHistory.findUnique({
          where: {
            keywordId_date: {
              keywordId: kw.id,
              date: new Date(today),
            },
          },
        });

        console.log(`[DataForSEO Check] Existing record found: ${!!existingRecord}`);

        if (existingRecord) {
          // Update existing record with DataForSEO data
          await prisma.rankHistory.update({
            where: {
              keywordId_date: {
                keywordId: kw.id,
                date: new Date(today),
              },
            },
            data: {
              dfPosition: result.position,
              dfUrl: result.url,
              dfTitle: result.title,
              dfSerpFeatures: result.serpFeatures || {},
              dfLastChecked: new Date(),
            },
          });
          console.log(`[DataForSEO Check] ✓ Updated existing record for "${kw.keyword}"`);
        } else {
          // Create new record with DataForSEO data (and default GSC values)
          await prisma.rankHistory.create({
            data: {
              siteId: site.id,
              keywordId: kw.id,
              date: new Date(today),
              position: 999, // Default if no GSC data yet
              clicks: 0,
              impressions: 0,
              ctr: 0,
              dfPosition: result.position,
              dfUrl: result.url,
              dfTitle: result.title,
              dfSerpFeatures: result.serpFeatures || {},
              dfLastChecked: new Date(),
            },
          });
          console.log(`[DataForSEO Check] ✓ Created new record for "${kw.keyword}"`);
        }

        savedCount++;
        console.log(`[DataForSEO Check] SavedCount now: ${savedCount}`);
      } catch (error: any) {
        console.error(`[DataForSEO Check] ❌ Error saving result for "${kw.keyword}":`, error);
        console.error(`  Error details:`, error.message);
        console.error(`  KeywordID:`, kw.id);
        console.error(`  Date:`, today);
        console.error(`  Position:`, result.position);
        console.error(`  Stack:`, error.stack);
      }
    }

    console.log(`[DataForSEO Check] ✓ Saved ${savedCount} results, Cost: $${totalCost.toFixed(4)}`);

    return NextResponse.json({
      success: true,
      checked: savedCount,
      totalKeywords: keywords.length,
      totalCost: totalCost.toFixed(4),
      results: Array.from(results.entries()).map(([keyword, result]) => ({
        keyword,
        position: result?.position,
        url: result?.url,
        found: !!result?.position,
      })),
      debug: {
        targetDomain: targetDomain,
        keywordsRequested: keywords.map(k => k.keyword),
        resultsReceived: results.size,
      },
    });
  } catch (error: any) {
    console.error('[DataForSEO Check] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check positions' },
      { status: 500 }
    );
  }
}

