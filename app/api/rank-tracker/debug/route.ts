import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Debug endpoint to check if RankKeyword and RankHistory tables exist
 */
export async function GET(request: NextRequest) {
  try {
    // Try to count rows in both tables
    const [keywordCount, historyCount] = await Promise.all([
      prisma.rankKeyword.count().catch(() => -1),
      prisma.rankHistory.count().catch(() => -1),
    ]);

    const tablesExist = keywordCount >= 0 && historyCount >= 0;

    return NextResponse.json({
      tablesExist,
      rankKeywordCount: keywordCount,
      rankHistoryCount: historyCount,
      message: tablesExist
        ? '✅ Tables exist and are accessible'
        : '❌ Tables do not exist. Run the SQL in Supabase SQL Editor.',
    });
  } catch (error: any) {
    return NextResponse.json({
      tablesExist: false,
      error: error.message,
      message: '❌ Error accessing tables. Make sure to run SQL in Supabase.',
    });
  }
}

