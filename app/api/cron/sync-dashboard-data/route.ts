/**
 * Cron endpoint to sync Dashboard data (Time Series, Queries, URLs)
 * Called by Vercel Cron 3x per day
 * 
 * Note: This is a template. Full implementation requires refresh token storage.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Authenticate cron requests
function verifyCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron Dashboard] Starting dashboard data sync...');

  try {
    // Get all sites
    const sites = await prisma.site.findMany({
      include: {
        user: true,
      },
    });

    console.log(`[Cron Dashboard] Found ${sites.length} sites to sync`);

    const results = [];

    for (const site of sites) {
      console.log(`[Cron Dashboard] Syncing: ${site.siteUrl}`);
      
      try {
        // TODO: Implement with stored refresh tokens
        // For now, this is a placeholder that shows the structure
        
        results.push({
          siteUrl: site.siteUrl,
          status: 'skipped',
          reason: 'Requires stored refresh token implementation',
        });

      } catch (error: any) {
        console.error(`[Cron Dashboard] Error syncing ${site.siteUrl}:`, error.message);
        results.push({
          siteUrl: site.siteUrl,
          status: 'error',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });

  } catch (error: any) {
    console.error('[Cron Dashboard] Sync failed:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

