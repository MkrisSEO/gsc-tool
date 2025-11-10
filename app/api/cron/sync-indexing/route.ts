import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Cron job endpoint to sync indexing data for all sites
 * Called daily at 3 AM by Vercel Cron
 */
export async function GET(request: NextRequest) {
  console.log('🔄 [Cron Sync Indexing] Starting daily sync for all sites...');

  // Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ [Cron Sync Indexing] Unauthorized - invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all sites from database
    const sites = await prisma.site.findMany({
      select: {
        siteUrl: true,
        id: true,
        displayName: true,
      },
    });

    if (sites.length === 0) {
      console.log('⚠️ [Cron Sync Indexing] No sites found to sync');
      return NextResponse.json({
        success: true,
        message: 'No sites to sync',
        sitesProcessed: 0,
      });
    }

    console.log(`📋 [Cron Sync Indexing] Found ${sites.length} sites to sync`);

    const results = [];

    for (const site of sites) {
      console.log(`\n🔄 [Cron Sync Indexing] Processing: ${site.siteUrl}`);

      try {
        // Call the sync endpoint for this site
        // Note: This needs to be called with a valid session
        // For cron jobs, we'll need to handle auth differently
        
        // For now, we'll skip the actual sync and just log
        // The sync will happen when users manually refresh or via the sync endpoint
        console.log(`⚠️ [Cron Sync Indexing] Skipping ${site.siteUrl} - requires user session`);
        
        results.push({
          siteUrl: site.siteUrl,
          success: false,
          message: 'Requires user session (OAuth token)',
        });
      } catch (error: any) {
        console.error(`❌ [Cron Sync Indexing] Error processing ${site.siteUrl}:`, error.message);
        results.push({
          siteUrl: site.siteUrl,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`\n✅ [Cron Sync Indexing] Completed processing ${sites.length} sites`);

    return NextResponse.json({
      success: true,
      sitesProcessed: sites.length,
      results,
      note: 'Indexing sync requires OAuth tokens - currently triggered by user refreshes',
    });
  } catch (error: any) {
    console.error('❌ [Cron Sync Indexing] Fatal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync indexing data' },
      { status: 500 }
    );
  }
}

// Allow both GET and POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}

