-- CreateEnum
CREATE TYPE "LoyaltyRewardType" AS ENUM ('PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'FREE_SHIPPING', 'COUPON_TEMPLATE');

-- AlterTable
ALTER TABLE "LoyaltyReward"
ADD COLUMN "rewardType" "LoyaltyRewardType" NOT NULL DEFAULT 'PERCENTAGE_DISCOUNT',
ADD COLUMN "startsAt" TIMESTAMP(3),
ADD COLUMN "endsAt" TIMESTAMP(3),
ADD COLUMN "couponTemplateId" TEXT,
ADD COLUMN "couponPercentage" DECIMAL(5,2),
ADD COLUMN "couponFixedAmount" DECIMAL(10,2),
ADD COLUMN "couponMinimumOrderAmount" DECIMAL(10,2),
ADD COLUMN "couponMaximumDiscountAmount" DECIMAL(10,2),
ADD COLUMN "couponDurationDays" INTEGER,
ADD COLUMN "couponCodePrefix" TEXT;

-- AlterTable
ALTER TABLE "Coupon"
ADD COLUMN "issuedToUserId" TEXT,
ADD COLUMN "sourceRewardId" TEXT,
ADD COLUMN "sourceRedemptionId" TEXT,
ADD COLUMN "isGeneratedRewardCoupon" BOOLEAN NOT NULL DEFAULT false;

-- Data migration for existing rewards
UPDATE "LoyaltyReward"
SET "rewardType" = 'FREE_SHIPPING'
WHERE LOWER(COALESCE("title", '') || ' ' || COALESCE("description", '')) LIKE '%free shipping%';

UPDATE "LoyaltyReward"
SET
  "rewardType" = 'PERCENTAGE_DISCOUNT',
  "couponPercentage" = COALESCE(
    "couponPercentage",
    ((regexp_match(COALESCE("title", '') || ' ' || COALESCE("description", ''), '([0-9]+(?:\.[0-9]+)?)\s*%'))[1])::DECIMAL
  )
WHERE (COALESCE("title", '') || ' ' || COALESCE("description", '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*%';

UPDATE "LoyaltyReward"
SET
  "rewardType" = 'FIXED_AMOUNT_DISCOUNT',
  "couponFixedAmount" = COALESCE(
    "couponFixedAmount",
    ((regexp_match(COALESCE("title", '') || ' ' || COALESCE("description", ''), '([0-9]+(?:\.[0-9]+)?)\s*(?:€|eur)'))[1])::DECIMAL
  )
WHERE (COALESCE("title", '') || ' ' || COALESCE("description", '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*(?:€|eur)';

-- CreateIndex
CREATE INDEX "LoyaltyReward_couponTemplateId_idx" ON "LoyaltyReward"("couponTemplateId");

-- CreateIndex
CREATE INDEX "Coupon_issuedToUserId_idx" ON "Coupon"("issuedToUserId");

-- CreateIndex
CREATE INDEX "Coupon_sourceRewardId_idx" ON "Coupon"("sourceRewardId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_sourceRedemptionId_key" ON "Coupon"("sourceRedemptionId");

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_couponTemplateId_fkey" FOREIGN KEY ("couponTemplateId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_issuedToUserId_fkey" FOREIGN KEY ("issuedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_sourceRewardId_fkey" FOREIGN KEY ("sourceRewardId") REFERENCES "LoyaltyReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_sourceRedemptionId_fkey" FOREIGN KEY ("sourceRedemptionId") REFERENCES "LoyaltyRewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
