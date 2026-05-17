/*
  Warnings:

  - You are about to drop the column `maxPlayers` on the `Room` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[publicId]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicId]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - The required column `publicId` was added to the `Participant` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `publicId` was added to the `Room` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "maxPlayers",
ADD COLUMN     "publicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Participant_publicId_key" ON "Participant"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_publicId_key" ON "Room"("publicId");
