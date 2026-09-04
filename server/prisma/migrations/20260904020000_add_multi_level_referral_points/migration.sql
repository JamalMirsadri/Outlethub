-- AlterEnum
ALTER TYPE "LoyaltyTransactionType" ADD VALUE 'MULTI_LEVEL_REFERRAL_REWARD';
ALTER TYPE "LoyaltyTransactionType" ADD VALUE 'MULTI_LEVEL_REFERRAL_REVERSAL';

-- CreateEnum
CREATE TYPE "MultiLevelReferralPointStatus" AS ENUM ('AWARDED', 'REVERSED');

-- AlterTable
ALTER TABLE "LoyaltyPointTransaction" ADD COLUMN "multiLevelReferralPointRewardId" TEXT;

-- CreateTable
CREATE TABLE "MultiLevelReferralPointReward" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "purchaserUserId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "referralLevel" INTEGER NOT NULL,
    "rewardType" TEXT NOT NULL DEFAULT 'MULTI_LEVEL_REFERRAL_POINTS',
    "eligibleProductAmount" DECIMAL(18,2) NOT NULL,
    "pointsPer10EUR" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "status" "MultiLevelReferralPointStatus" NOT NULL DEFAULT 'AWARDED',
    "metadata" JSONB,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MultiLevelReferralPointReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MultiLevelReferralPointReward_eventKey_key" ON "MultiLevelReferralPointReward"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointTransaction_multiLevelReferralPointRewardId_key" ON "LoyaltyPointTransaction"("multiLevelReferralPointRewardId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_multiLevelReferralPointRewardId_idx" ON "LoyaltyPointTransaction"("multiLevelReferralPointRewardId");

-- CreateIndex
CREATE INDEX "MultiLevelReferralPointReward_orderId_idx" ON "MultiLevelReferralPointReward"("orderId");

-- CreateIndex
CREATE INDEX "MultiLevelReferralPointReward_purchaserUserId_idx" ON "MultiLevelReferralPointReward"("purchaserUserId");

-- CreateIndex
CREATE INDEX "MultiLevelReferralPointReward_beneficiaryUserId_status_idx" ON "MultiLevelReferralPointReward"("beneficiaryUserId", "status");

-- CreateIndex
CREATE INDEX "MultiLevelReferralPointReward_referralLevel_idx" ON "MultiLevelReferralPointReward"("referralLevel");

-- CreateIndex
CREATE INDEX "MultiLevelReferralPointReward_status_createdAt_idx" ON "MultiLevelReferralPointReward"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MultiLevelReferralPointReward" ADD CONSTRAINT "MultiLevelReferralPointReward_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiLevelReferralPointReward" ADD CONSTRAINT "MultiLevelReferralPointReward_purchaserUserId_fkey" FOREIGN KEY ("purchaserUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiLevelReferralPointReward" ADD CONSTRAINT "MultiLevelReferralPointReward_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_multiLevelReferralPointRewardId_fkey" FOREIGN KEY ("multiLevelReferralPointRewardId") REFERENCES "MultiLevelReferralPointReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
