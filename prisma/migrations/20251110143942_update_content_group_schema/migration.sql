-- DropIndex (if exists)
DROP INDEX IF EXISTS "ContentGroup_siteId_name_idx";

-- AlterTable: Drop old columns if they exist
ALTER TABLE "ContentGroup" DROP COLUMN IF EXISTS "color";
ALTER TABLE "ContentGroup" DROP COLUMN IF EXISTS "includeConditions";
ALTER TABLE "ContentGroup" DROP COLUMN IF EXISTS "excludeConditions";

-- AlterTable: Add new columns if they don't exist
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentGroup_siteId_name_idx" ON "ContentGroup"("siteId", "name");

