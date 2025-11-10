-- ============================================
-- CONTENT GROUPS MIGRATION
-- ============================================
-- This updates the ContentGroup table to match the new schema
-- Run this in Supabase SQL Editor

-- Step 1: Drop old columns if they exist
ALTER TABLE "ContentGroup" 
  DROP COLUMN IF EXISTS "color",
  DROP COLUMN IF EXISTS "includeConditions",
  DROP COLUMN IF EXISTS "excludeConditions";

-- Step 2: Add new columns
ALTER TABLE "ContentGroup" 
  ADD COLUMN IF NOT EXISTS "conditions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "urlCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "matchedUrls" JSONB;

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS "ContentGroup_siteId_name_idx" ON "ContentGroup"("siteId", "name");

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ContentGroup'
ORDER BY ordinal_position;

