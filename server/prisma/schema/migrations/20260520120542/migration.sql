-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "voterParticipantId" TEXT NOT NULL,
    "targetParticipantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vote_roomId_idx" ON "Vote"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_roomId_voterParticipantId_key" ON "Vote"("roomId", "voterParticipantId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterParticipantId_fkey" FOREIGN KEY ("voterParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_targetParticipantId_fkey" FOREIGN KEY ("targetParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
