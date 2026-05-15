DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommentActorType') THEN
    CREATE TYPE "CommentActorType" AS ENUM ('HUMAN', 'AGENT');
  END IF;
END $$;

ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "actorType" "CommentActorType",
  ADD COLUMN IF NOT EXISTS "actorId" TEXT;

UPDATE "Comment"
SET "actorType" = COALESCE("actorType", 'HUMAN'),
    "actorId" = COALESCE("actorId", "profileId", 'unknown')
WHERE "actorType" IS NULL OR "actorId" IS NULL;

ALTER TABLE "Comment"
  ALTER COLUMN "actorType" TYPE "CommentActorType"
  USING ("actorType"::text::"CommentActorType");

ALTER TABLE "Comment"
  ALTER COLUMN "actorType" SET NOT NULL,
  ALTER COLUMN "actorId" SET NOT NULL;

ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_profileId_fkey";
DROP INDEX IF EXISTS "Comment_profileId_idx";
ALTER TABLE "Comment" DROP COLUMN IF EXISTS "profileId";

CREATE INDEX IF NOT EXISTS "Comment_actorType_actorId_idx" ON "Comment"("actorType", "actorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentStatus') THEN
    CREATE TYPE "AgentStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'REVOKED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Agent" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "ownerVerified" BOOLEAN NOT NULL DEFAULT false,
  "status" "AgentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "keyId" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "verificationCode" TEXT,
  "verificationCodeExpiresAt" TIMESTAMP(3),
  "verificationCodeUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Agent_keyId_key" ON "Agent"("keyId");
CREATE INDEX IF NOT EXISTS "Agent_ownerEmail_idx" ON "Agent"("ownerEmail");
CREATE INDEX IF NOT EXISTS "Agent_status_idx" ON "Agent"("status");
