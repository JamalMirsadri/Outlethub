-- CreateEnum
CREATE TYPE "ScraperType" AS ENUM ('PLAYWRIGHT', 'PUPPETEER');

-- CreateEnum
CREATE TYPE "ScraperStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ScraperRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScraperArtifactType" AS ENUM ('SCREENSHOT', 'HTML_DUMP', 'JSON_DUMP');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "scraperRunId" TEXT;

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN     "scraperRunId" TEXT;

-- CreateTable
CREATE TABLE "ScraperSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "status" "ScraperStatus" NOT NULL DEFAULT 'ACTIVE',
    "scraperType" "ScraperType" NOT NULL,
    "connectorKey" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "configuration" JSONB,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ScraperRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "productsImported" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperArtifact" (
    "id" TEXT NOT NULL,
    "scraperRunId" TEXT NOT NULL,
    "type" "ScraperArtifactType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScraperSource_status_idx" ON "ScraperSource"("status");

-- CreateIndex
CREATE INDEX "ScraperSource_scraperType_idx" ON "ScraperSource"("scraperType");

-- CreateIndex
CREATE INDEX "ScraperSource_connectorKey_idx" ON "ScraperSource"("connectorKey");

-- CreateIndex
CREATE INDEX "ScraperRun_sourceId_idx" ON "ScraperRun"("sourceId");

-- CreateIndex
CREATE INDEX "ScraperRun_status_idx" ON "ScraperRun"("status");

-- CreateIndex
CREATE INDEX "ScraperRun_createdAt_idx" ON "ScraperRun"("createdAt");

-- CreateIndex
CREATE INDEX "ScraperArtifact_scraperRunId_idx" ON "ScraperArtifact"("scraperRunId");

-- CreateIndex
CREATE INDEX "ScraperArtifact_type_idx" ON "ScraperArtifact"("type");

-- CreateIndex
CREATE INDEX "ScraperArtifact_createdAt_idx" ON "ScraperArtifact"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_scraperRunId_idx" ON "AuditLog"("scraperRunId");

-- CreateIndex
CREATE INDEX "ImportJob_scraperRunId_idx" ON "ImportJob"("scraperRunId");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperRun" ADD CONSTRAINT "ScraperRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScraperSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperArtifact" ADD CONSTRAINT "ScraperArtifact_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_scraperRunId_fkey" FOREIGN KEY ("scraperRunId") REFERENCES "ScraperRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
