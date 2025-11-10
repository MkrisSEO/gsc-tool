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
    console.log('🔄 Running ContentGroup migration...');

    // Drop old columns
    await prisma.$executeRaw`
      ALTER TABLE "ContentGroup" DROP COLUMN IF EXISTS "color"
    `;
    console.log('✅ Dropped color column');

    await prisma.$executeRaw`
      ALTER TABLE "ContentGroup" DROP COLUMN IF EXISTS "includeConditions"
    `;
    console.log('✅ Dropped includeConditions column');

    await prisma.$executeRaw`
      ALTER TABLE "ContentGroup" DROP COLUMN IF EXISTS "excludeConditions"
    `;
    console.log('✅ Dropped excludeConditions column');

    // Add new columns (with conditional logic)
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'ContentGroup' AND column_name = 'conditions') THEN
              ALTER TABLE "ContentGroup" ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]'::jsonb;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'ContentGroup' AND column_name = 'urlCount') THEN
              ALTER TABLE "ContentGroup" ADD COLUMN "urlCount" INTEGER NOT NULL DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'ContentGroup' AND column_name = 'matchedUrls') THEN
              ALTER TABLE "ContentGroup" ADD COLUMN "matchedUrls" JSONB;
          END IF;
      END $$;
    `;
    console.log('✅ Added new columns');

    // Create index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ContentGroup_siteId_name_idx" ON "ContentGroup"("siteId", "name")
    `;
    console.log('✅ Created index');

    // Verify
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ContentGroup'
      ORDER BY ordinal_position
    `;

    console.log('✅ Migration complete!', columns);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      columns,
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

