CREATE TABLE IF NOT EXISTS "PasswordResetCode" (
  "id" TEXT PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetCode_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PasswordResetCode_profileId_createdAt_idx" ON "PasswordResetCode"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetCode_expiresAt_idx" ON "PasswordResetCode"("expiresAt");
