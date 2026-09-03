-- CreateEnum
CREATE TYPE "SecurityBlockStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'AUTO_EXTENDED');

-- CreateEnum
CREATE TYPE "SecurityBlockSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SecurityMitigationAction" AS ENUM ('DETECTED', 'RATE_LIMITED', 'BLOCK_TRIGGERED', 'BLOCK_ENFORCED', 'BLOCK_EXPIRED', 'BLOCK_RELEASED', 'BLOCK_MANUAL', 'BLOCK_ESCALATED');

-- AlterTable
ALTER TABLE "ErrorLog" ADD COLUMN "securityAction" "SecurityMitigationAction";
ALTER TABLE "ErrorLog" ADD COLUMN "blockId" TEXT;

-- CreateTable
CREATE TABLE "SecurityBlock" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ipVersion" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attackType" TEXT,
    "severity" TEXT,
    "confidence" TEXT,
    "riskScore" INTEGER NOT NULL,
    "triggerCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "SecurityBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "SecurityBlockSource" NOT NULL DEFAULT 'AUTO',
    "matchedRule" TEXT,
    "samplePath" TEXT,
    "sampleMethod" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "releaseReason" TEXT,
    "triggerEventIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_securityAction_idx" ON "ErrorLog"("securityAction");

-- CreateIndex
CREATE INDEX "ErrorLog_blockId_idx" ON "ErrorLog"("blockId");

-- CreateIndex
CREATE INDEX "SecurityBlock_ip_status_idx" ON "SecurityBlock"("ip", "status");

-- CreateIndex
CREATE INDEX "SecurityBlock_status_expiresAt_idx" ON "SecurityBlock"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SecurityBlock_expiresAt_idx" ON "SecurityBlock"("expiresAt");

-- CreateIndex
CREATE INDEX "SecurityBlock_createdAt_idx" ON "SecurityBlock"("createdAt");
