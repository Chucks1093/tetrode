-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('STORY', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('MISINFORMATION', 'HARASSMENT', 'SPAM', 'HATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterProfileId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_createdAt_idx" ON "Report"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterProfileId_createdAt_idx" ON "Report"("reporterProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterProfileId_targetType_targetId_key" ON "Report"("reporterProfileId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterProfileId_fkey" FOREIGN KEY ("reporterProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
