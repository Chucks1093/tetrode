/*
  Warnings:

  - You are about to drop the column `hiddenHumanId` on the `Room` table. All the data in the column will be lost.
  - Added the required column `actorId` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "actorId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "hiddenHumanId";

-- CreateIndex
CREATE INDEX "Participant_actorId_idx" ON "Participant"("actorId");
