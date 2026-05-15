-- CreateTable
CREATE TABLE "TrendResearch" (
    "id" TEXT NOT NULL,
    "trendId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL,
    "trendResearchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "snippet" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "reliability" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrendResearch_trendId_key" ON "TrendResearch"("trendId");

-- CreateIndex
CREATE INDEX "ResearchSource_trendResearchId_rank_idx" ON "ResearchSource"("trendResearchId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSource_trendResearchId_url_key" ON "ResearchSource"("trendResearchId", "url");

-- AddForeignKey
ALTER TABLE "TrendResearch" ADD CONSTRAINT "TrendResearch_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "Trend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_trendResearchId_fkey" FOREIGN KEY ("trendResearchId") REFERENCES "TrendResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
