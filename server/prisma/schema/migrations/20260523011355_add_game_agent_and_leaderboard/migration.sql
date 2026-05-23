-- CreateTable
CREATE TABLE "GameAgent" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "erc8004TokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "type" "ParticipantType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameAgent_publicId_key" ON "GameAgent"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAgent_name_key" ON "GameAgent"("name");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_type_idx" ON "LeaderboardEntry"("type");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_points_idx" ON "LeaderboardEntry"("points" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_type_entityId_key" ON "LeaderboardEntry"("type", "entityId");
