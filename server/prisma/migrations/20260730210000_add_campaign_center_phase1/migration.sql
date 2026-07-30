CREATE TYPE "CampaignDisplayType" AS ENUM ('POPUP', 'BANNER', 'HERO', 'INLINE');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "displayType" "CampaignDisplayType" NOT NULL,
    "link" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_displayType_idx" ON "Campaign"("displayType");
CREATE INDEX "Campaign_startsAt_idx" ON "Campaign"("startsAt");
CREATE INDEX "Campaign_endsAt_idx" ON "Campaign"("endsAt");
