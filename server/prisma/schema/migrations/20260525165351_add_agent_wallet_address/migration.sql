/*
  Warnings:

  - You are about to drop the column `selfVerified` on the `Profile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[walletAddress]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "walletAddress" TEXT;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "selfVerified";

-- CreateIndex
CREATE UNIQUE INDEX "Agent_walletAddress_key" ON "Agent"("walletAddress");
