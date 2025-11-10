// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Starting ContentGroup migration...');

    // Step 1: Check current schema
    const beforeColumns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ContentGroup'
      ORDER BY ordinal_position;
    `;
    console.log('📊 Columns before migration:', beforeColumns);

    // Step 2: Drop old columns if they exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE "ContentGroup" 
        DROP COLUMN IF EXISTS "color",
        DROP COLUMN IF EXISTS "includeConditions",
        DROP COLUMN IF EXISTS "excludeConditions";
      `;
      console.log('✅ Dropped old columns');
    } catch (e: any) {
      console.log('⚠️ Could not drop old columns (may not exist):', e.message);
    }

    // Step 3: Add new columns
    try {
      await prisma.$executeRaw`
        ALTER TABLE "ContentGroup" 
        ADD COLUMN IF NOT EXISTS "conditions" JSONB NOT NULL DEFAULT '[]';
      `;
      console.log('✅ Added conditions column');
    } catch (e: any) {
      console.log('⚠️ conditions column:', e.message);
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "ContentGroup" 
        ADD COLUMN IF NOT EXISTS "urlCount" INTEGER NOT NULL DEFAULT 0;
      `;
      console.log('✅ Added urlCount column');
    } catch (e: any) {
      console.log('⚠️ urlCount column:', e.message);
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "ContentGroup" 
        ADD COLUMN IF NOT EXISTS "matchedUrls" JSONB;
      `;
      console.log('✅ Added matchedUrls column');
    } catch (e: any) {
      console.log('⚠️ matchedUrls column:', e.message);
    }

    // Step 4: Add indexes
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ContentGroup_siteId_name_idx" 
        ON "ContentGroup"("siteId", "name");
      `;
      console.log('✅ Added indexes');
    } catch (e: any) {
      console.log('⚠️ Index creation:', e.message);
    }

    // Step 5: Verify the changes
    const afterColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ContentGroup'
      ORDER BY ordinal_position;
    `;

    console.log('📊 Columns after migration:', afterColumns);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      before: beforeColumns,
      after: afterColumns,
    });
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

