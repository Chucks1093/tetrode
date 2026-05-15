-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "trendId" TEXT NOT NULL,
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

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- Backfill existing researched sources into Source
INSERT INTO "Source" (
    "id",
    "trendId",
    "rank",
    "url",
    "title",
    "publisher",
    "publishedAt",
    "snippet",
    "sourceType",
    "reliability",
    "createdAt",
    "updatedAt"
)
SELECT
    rs."id",
    tr."trendId",
    rs."rank",
    rs."url",
    rs."title",
    rs."publisher",
    rs."publishedAt",
    rs."snippet",
    rs."sourceType",
    rs."reliability",
    rs."createdAt",
    rs."updatedAt"
FROM "ResearchSource" rs
JOIN "TrendResearch" tr ON tr."id" = rs."trendResearchId";

-- CreateIndex
CREATE INDEX "Source_trendId_rank_idx" ON "Source"("trendId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Source_trendId_url_key" ON "Source"("trendId", "url");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "Trend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old relation FKs and tables we no longer use
ALTER TABLE "ResearchSource" DROP CONSTRAINT "ResearchSource_trendResearchId_fkey";
ALTER TABLE "StoryCitation" DROP CONSTRAINT "StoryCitation_storyId_fkey";
ALTER TABLE "TrendResearch" DROP CONSTRAINT "TrendResearch_trendId_fkey";

DROP TABLE "ResearchSource";
DROP TABLE "StoryCitation";
DROP TABLE "TrendResearch";
