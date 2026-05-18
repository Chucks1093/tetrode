/*
  Warnings:

  - You are about to drop the column `interests` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the `Bookmark` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FollowSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Report` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Source` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Story` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Trend` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[publicId]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletAddress]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - Made the column `imageUrl` on table `Game` required. This step will fail if there are existing NULL values in that column.
  - The required column `publicId` was added to the `Profile` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_profileId_fkey";

-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_parentCommentId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_storyId_fkey";

-- DropForeignKey
ALTER TABLE "FollowSource" DROP CONSTRAINT "FollowSource_profileId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterProfileId_fkey";

-- DropForeignKey
ALTER TABLE "Source" DROP CONSTRAINT "Source_trendId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_trendId_fkey";

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "imageUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "interests",
DROP COLUMN "lastLoginAt",
ADD COLUMN     "publicId" TEXT NOT NULL,
ADD COLUMN     "walletAddress" TEXT;

-- DropTable
DROP TABLE "Bookmark";

-- DropTable
DROP TABLE "Comment";

-- DropTable
DROP TABLE "FollowSource";

-- DropTable
DROP TABLE "Report";

-- DropTable
DROP TABLE "Source";

-- DropTable
DROP TABLE "Story";

-- DropTable
DROP TABLE "Trend";

-- DropEnum
DROP TYPE "CommentActorType";

-- DropEnum
DROP TYPE "CommentAuthorType";

-- DropEnum
DROP TYPE "CommentStance";

-- DropEnum
DROP TYPE "ReportReason";

-- DropEnum
DROP TYPE "ReportStatus";

-- DropEnum
DROP TYPE "ReportTargetType";

-- CreateIndex
CREATE UNIQUE INDEX "Profile_publicId_key" ON "Profile"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_walletAddress_key" ON "Profile"("walletAddress");
