-- CreateTable
CREATE TABLE "FollowSource" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "publisherKey" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowSource_profileId_createdAt_idx" ON "FollowSource"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "FollowSource_publisherKey_idx" ON "FollowSource"("publisherKey");

-- CreateIndex
CREATE UNIQUE INDEX "FollowSource_profileId_publisherKey_key" ON "FollowSource"("profileId", "publisherKey");

-- AddForeignKey
ALTER TABLE "FollowSource" ADD CONSTRAINT "FollowSource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
