-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bookmark_profileId_createdAt_idx" ON "Bookmark"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Bookmark_storyId_createdAt_idx" ON "Bookmark"("storyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_profileId_storyId_key" ON "Bookmark"("profileId", "storyId");

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
