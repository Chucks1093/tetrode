-- AlterTable
ALTER TABLE "Agent" RENAME CONSTRAINT "GameAgent_pkey" TO "Agent_pkey";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "selfVerified" BOOLEAN NOT NULL DEFAULT false;
