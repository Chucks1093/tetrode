ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "actorType" TEXT,
  ADD COLUMN IF NOT EXISTS "actorId" TEXT;

UPDATE "Comment"
SET "actorType" = CASE
      WHEN "authorType"::text = 'AI' THEN 'AGENT'
      ELSE 'HUMAN'
   END,
    "actorId" = COALESCE("profileId", "actorId", 'system_agent')
WHERE "actorType" IS NULL OR "actorId" IS NULL;

ALTER TABLE "Comment"
  ALTER COLUMN "actorType" SET NOT NULL,
  ALTER COLUMN "actorId" SET NOT NULL;

DROP INDEX IF EXISTS "Comment_profileId_idx";
CREATE INDEX IF NOT EXISTS "Comment_actorType_actorId_idx" ON "Comment"("actorType", "actorId");
