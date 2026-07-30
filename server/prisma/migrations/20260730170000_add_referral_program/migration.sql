-- CreateEnum
CREATE TYPE "ReferralRelationshipStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReferralTriggerType" AS ENUM ('SIGNUP', 'FIRST_ORDER', 'REPEAT_ORDER');

-- CreateEnum
CREATE TYPE "ReferralRuleRewardType" AS ENUM ('FIXED_POINTS', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'AWARDED', 'REVERSED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'REFERRAL_REWARD';
ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'REFERRAL_REVERSAL';
ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'REFERRAL_MANUAL_ADJUSTMENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;

-- Backfill referral codes for existing users.
UPDATE "User"
SET "referralCode" = UPPER(REPLACE("id", '-', ''))
WHERE "referralCode" IS NULL;

ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "LoyaltyPointTransaction" ADD COLUMN "referralRewardId" TEXT;

-- CreateTable
CREATE TABLE "ReferralRelationship" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referralCodeUsed" TEXT,
    "sourceChannel" TEXT,
    "status" "ReferralRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralClosure" (
    "ancestorUserId" TEXT NOT NULL,
    "descendantUserId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralClosure_pkey" PRIMARY KEY ("ancestorUserId","descendantUserId")
);

-- CreateTable
CREATE TABLE "ReferralRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "ReferralTriggerType" NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "rewardType" "ReferralRuleRewardType" NOT NULL,
    "rewardValue" DECIMAL(10,2) NOT NULL,
    "minOrderAmount" DECIMAL(10,2),
    "maxRewardPoints" INTEGER,
    "maxReferralCount" INTEGER,
    "expiresInDays" INTEGER,
    "conditions" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT,
    "ruleId" TEXT,
    "beneficiaryUserId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "orderId" TEXT,
    "eventKey" TEXT NOT NULL,
    "trigger" "ReferralTriggerType" NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "rewardType" "ReferralRuleRewardType" NOT NULL,
    "rewardValue" DECIMAL(10,2) NOT NULL,
    "basePoints" INTEGER,
    "pointsAwarded" INTEGER NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "pendingAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- Seed self closure rows for all existing users.
INSERT INTO "ReferralClosure" ("ancestorUserId", "descendantUserId", "depth")
SELECT "id", "id", 0
FROM "User"
ON CONFLICT ("ancestorUserId", "descendantUserId") DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointTransaction_referralRewardId_key" ON "LoyaltyPointTransaction"("referralRewardId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRelationship_referredUserId_key" ON "ReferralRelationship"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralRelationship_referrerUserId_status_createdAt_idx" ON "ReferralRelationship"("referrerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralRelationship_referredUserId_status_idx" ON "ReferralRelationship"("referredUserId", "status");

-- CreateIndex
CREATE INDEX "ReferralRelationship_createdByUserId_idx" ON "ReferralRelationship"("createdByUserId");

-- CreateIndex
CREATE INDEX "ReferralClosure_ancestorUserId_depth_idx" ON "ReferralClosure"("ancestorUserId", "depth");

-- CreateIndex
CREATE INDEX "ReferralClosure_descendantUserId_depth_idx" ON "ReferralClosure"("descendantUserId", "depth");

-- CreateIndex
CREATE INDEX "ReferralRule_trigger_levelNumber_isActive_idx" ON "ReferralRule"("trigger", "levelNumber", "isActive");

-- CreateIndex
CREATE INDEX "ReferralRule_startsAt_endsAt_idx" ON "ReferralRule"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ReferralRule_sortOrder_idx" ON "ReferralRule"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_eventKey_key" ON "ReferralReward"("eventKey");

-- CreateIndex
CREATE INDEX "ReferralReward_beneficiaryUserId_status_createdAt_idx" ON "ReferralReward"("beneficiaryUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_sourceUserId_createdAt_idx" ON "ReferralReward"("sourceUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_orderId_idx" ON "ReferralReward"("orderId");

-- CreateIndex
CREATE INDEX "ReferralReward_ruleId_idx" ON "ReferralReward"("ruleId");

-- CreateIndex
CREATE INDEX "ReferralReward_relationshipId_idx" ON "ReferralReward"("relationshipId");

-- CreateIndex
CREATE INDEX "ReferralReward_trigger_levelNumber_idx" ON "ReferralReward"("trigger", "levelNumber");

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_referralRewardId_fkey" FOREIGN KEY ("referralRewardId") REFERENCES "ReferralReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRelationship" ADD CONSTRAINT "ReferralRelationship_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRelationship" ADD CONSTRAINT "ReferralRelationship_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRelationship" ADD CONSTRAINT "ReferralRelationship_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralClosure" ADD CONSTRAINT "ReferralClosure_ancestorUserId_fkey" FOREIGN KEY ("ancestorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralClosure" ADD CONSTRAINT "ReferralClosure_descendantUserId_fkey" FOREIGN KEY ("descendantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "ReferralRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReferralRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
