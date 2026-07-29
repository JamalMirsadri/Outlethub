-- CreateEnum
CREATE TYPE "LoyaltyOrderAwardStatus" AS ENUM ('PENDING', 'AWARDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('ORDER_EARN', 'ORDER_REVERSAL', 'REWARD_REDEMPTION', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LoyaltyRedemptionStatus" AS ENUM ('REDEEMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipLevelId" TEXT,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,
    "totalEarnedPoints" INTEGER NOT NULL DEFAULT 0,
    "totalSpentPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spendAmount" DECIMAL(10,2) NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyPointRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyMembershipLevel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#B08D57',
    "icon" TEXT,
    "benefits" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyMembershipLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "minMembershipLevelId" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "benefits" JSONB,
    "stockLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRewardRedemption" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "LoyaltyRedemptionStatus" NOT NULL DEFAULT 'REDEEMED',
    "notes" TEXT,
    "metadata" JSONB,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyRewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "rewardId" TEXT,
    "redemptionId" TEXT,
    "actorUserId" TEXT,
    "type" "LoyaltyTransactionType" NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyOrderPointAward" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointRuleId" TEXT,
    "awardedPoints" INTEGER NOT NULL,
    "spendAmount" DECIMAL(10,2) NOT NULL,
    "status" "LoyaltyOrderAwardStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "awardedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyOrderPointAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_userId_key" ON "LoyaltyAccount"("userId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_membershipLevelId_idx" ON "LoyaltyAccount"("membershipLevelId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_currentPoints_idx" ON "LoyaltyAccount"("currentPoints");

-- CreateIndex
CREATE INDEX "LoyaltyPointRule_isActive_isDefault_idx" ON "LoyaltyPointRule"("isActive", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyMembershipLevel_title_key" ON "LoyaltyMembershipLevel"("title");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyMembershipLevel_slug_key" ON "LoyaltyMembershipLevel"("slug");

-- CreateIndex
CREATE INDEX "LoyaltyMembershipLevel_minPoints_isActive_idx" ON "LoyaltyMembershipLevel"("minPoints", "isActive");

-- CreateIndex
CREATE INDEX "LoyaltyMembershipLevel_sortOrder_idx" ON "LoyaltyMembershipLevel"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyReward_slug_key" ON "LoyaltyReward"("slug");

-- CreateIndex
CREATE INDEX "LoyaltyReward_minMembershipLevelId_idx" ON "LoyaltyReward"("minMembershipLevelId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_isActive_sortOrder_idx" ON "LoyaltyReward"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "LoyaltyRewardRedemption_accountId_redeemedAt_idx" ON "LoyaltyRewardRedemption"("accountId", "redeemedAt");

-- CreateIndex
CREATE INDEX "LoyaltyRewardRedemption_userId_redeemedAt_idx" ON "LoyaltyRewardRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE INDEX "LoyaltyRewardRedemption_rewardId_idx" ON "LoyaltyRewardRedemption"("rewardId");

-- CreateIndex
CREATE INDEX "LoyaltyRewardRedemption_status_idx" ON "LoyaltyRewardRedemption"("status");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_accountId_createdAt_idx" ON "LoyaltyPointTransaction"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_userId_createdAt_idx" ON "LoyaltyPointTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_orderId_idx" ON "LoyaltyPointTransaction"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_rewardId_idx" ON "LoyaltyPointTransaction"("rewardId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_redemptionId_idx" ON "LoyaltyPointTransaction"("redemptionId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_actorUserId_idx" ON "LoyaltyPointTransaction"("actorUserId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_type_createdAt_idx" ON "LoyaltyPointTransaction"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyOrderPointAward_orderId_key" ON "LoyaltyOrderPointAward"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyOrderPointAward_accountId_idx" ON "LoyaltyOrderPointAward"("accountId");

-- CreateIndex
CREATE INDEX "LoyaltyOrderPointAward_userId_idx" ON "LoyaltyOrderPointAward"("userId");

-- CreateIndex
CREATE INDEX "LoyaltyOrderPointAward_pointRuleId_idx" ON "LoyaltyOrderPointAward"("pointRuleId");

-- CreateIndex
CREATE INDEX "LoyaltyOrderPointAward_status_idx" ON "LoyaltyOrderPointAward"("status");

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_membershipLevelId_fkey" FOREIGN KEY ("membershipLevelId") REFERENCES "LoyaltyMembershipLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_minMembershipLevelId_fkey" FOREIGN KEY ("minMembershipLevelId") REFERENCES "LoyaltyMembershipLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "LoyaltyReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "LoyaltyReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "LoyaltyRewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyOrderPointAward" ADD CONSTRAINT "LoyaltyOrderPointAward_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyOrderPointAward" ADD CONSTRAINT "LoyaltyOrderPointAward_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyOrderPointAward" ADD CONSTRAINT "LoyaltyOrderPointAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyOrderPointAward" ADD CONSTRAINT "LoyaltyOrderPointAward_pointRuleId_fkey" FOREIGN KEY ("pointRuleId") REFERENCES "LoyaltyPointRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
