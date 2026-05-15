-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "trendId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryCitation" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "snippet" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "reliability" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryCitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_trendId_key" ON "Story"("trendId");

-- CreateIndex
CREATE INDEX "StoryCitation_storyId_rank_idx" ON "StoryCitation"("storyId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "StoryCitation_storyId_url_key" ON "StoryCitation"("storyId", "url");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "Trend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryCitation" ADD CONSTRAINT "StoryCitation_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
