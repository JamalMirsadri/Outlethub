ALTER TYPE "SyncFrequency" ADD VALUE IF NOT EXISTS 'EVERY_6_HOURS';

CREATE TYPE "DealLevel" AS ENUM ('NONE', 'GOOD', 'HOT', 'FEATURED');
CREATE TYPE "ImportLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

ALTER TABLE "Product"
ADD COLUMN "contentHash" TEXT,
ADD COLUMN "dealLevel" "DealLevel" NOT NULL DEFAULT 'NONE';

CREATE INDEX "Product_dealLevel_idx" ON "Product"("dealLevel");
CREATE INDEX "Product_contentHash_idx" ON "Product"("contentHash");

ALTER TABLE "ImportSource"
ADD COLUMN "configuration" JSONB;

UPDATE "ImportSource"
SET "configuration" = jsonb_strip_nulls(
  jsonb_build_object(
    'feedUrl', "feedUrl",
    'notes', "notes"
  )
);

ALTER TABLE "ImportSource"
DROP COLUMN "feedUrl",
DROP COLUMN "notes";

ALTER TABLE "ImportSource"
ALTER COLUMN "sourceType" TYPE TEXT;

UPDATE "ImportSource"
SET "sourceType" = 'SCRAPER'
WHERE "sourceType" = 'PLAYWRIGHT';

DROP TYPE "ImportSourceType";
CREATE TYPE "ImportSourceType" AS ENUM ('MANUAL', 'JSON_FEED', 'XML_FEED', 'SCRAPER', 'AWIN', 'CJ');

ALTER TABLE "ImportSource"
ALTER COLUMN "sourceType" TYPE "ImportSourceType"
USING ("sourceType"::"ImportSourceType");

ALTER TABLE "ImportJob"
ADD COLUMN "processedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ImportJob"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ImportJob"
ALTER COLUMN "status" TYPE TEXT;

UPDATE "ImportJob"
SET "status" = 'PENDING'
WHERE "status" = 'QUEUED';

UPDATE "ImportJob"
SET "status" = 'FAILED'
WHERE "status" = 'PARTIAL';

DROP TYPE "ImportJobStatus";
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "ImportJob"
ALTER COLUMN "status" TYPE "ImportJobStatus"
USING ("status"::"ImportJobStatus");

ALTER TABLE "ImportJob"
ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE TABLE "ImportLog" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "level" "ImportLogLevel" NOT NULL DEFAULT 'INFO',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportSnapshot" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "productCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minDiscount" INTEGER NOT NULL DEFAULT 0,
  "allowedBrands" TEXT[] NOT NULL,
  "allowedCategories" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportLog_jobId_idx" ON "ImportLog"("jobId");
CREATE INDEX "ImportLog_level_idx" ON "ImportLog"("level");
CREATE INDEX "ImportLog_createdAt_idx" ON "ImportLog"("createdAt");
CREATE INDEX "ImportSnapshot_jobId_idx" ON "ImportSnapshot"("jobId");
CREATE INDEX "ImportSnapshot_createdAt_idx" ON "ImportSnapshot"("createdAt");
CREATE INDEX "ImportRule_isActive_idx" ON "ImportRule"("isActive");

ALTER TABLE "ImportLog"
ADD CONSTRAINT "ImportLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportSnapshot"
ADD CONSTRAINT "ImportSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
