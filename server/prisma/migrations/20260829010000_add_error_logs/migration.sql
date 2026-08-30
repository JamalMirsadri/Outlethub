-- CreateEnum
CREATE TYPE "ErrorLogType" AS ENUM ('FRONTEND', 'API', 'BACKEND');

-- CreateEnum
CREATE TYPE "ErrorLogSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "type" "ErrorLogType" NOT NULL,
    "severity" "ErrorLogSeverity" NOT NULL DEFAULT 'LOW',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "source" TEXT,
    "page" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "ip" TEXT,
    "requestId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorLog_fingerprint_key" ON "ErrorLog"("fingerprint");

-- CreateIndex
CREATE INDEX "ErrorLog_type_createdAt_idx" ON "ErrorLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_severity_createdAt_idx" ON "ErrorLog"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_resolved_createdAt_idx" ON "ErrorLog"("resolved", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_userId_createdAt_idx" ON "ErrorLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_page_idx" ON "ErrorLog"("page");

-- CreateIndex
CREATE INDEX "ErrorLog_endpoint_idx" ON "ErrorLog"("endpoint");

-- CreateIndex
CREATE INDEX "ErrorLog_lastSeenAt_idx" ON "ErrorLog"("lastSeenAt");
