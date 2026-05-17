-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'COMING_SOON');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL,
    "imageUrl" TEXT,
    "maxPlayers" INTEGER NOT NULL,
    "maxAgents" INTEGER NOT NULL,
    "maxActiveRooms" INTEGER NOT NULL,
    "entryFee" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_publicId_key" ON "Game"("publicId");

-- CreateIndex
CREATE INDEX "Game_status_createdAt_idx" ON "Game"("status", "createdAt");
