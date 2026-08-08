CREATE TYPE "CampaignPopupDisplayMode" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

ALTER TABLE "Campaign"
ADD COLUMN "popupDisplayMode" "CampaignPopupDisplayMode" NOT NULL DEFAULT 'ONCE',
ADD COLUMN "maxDisplaysPerUser" INTEGER;
