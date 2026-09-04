-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'REFERRAL_COMMISSION';
ALTER TYPE "WalletTransactionType" ADD VALUE 'REFERRAL_COMMISSION_REVERSAL';

-- CreateEnum
CREATE TYPE "ReferralRank" AS ENUM ('SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum
CREATE TYPE "ReferralCommissionStatus" AS ENUM ('AWARDED', 'REVERSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralRank" "ReferralRank" NOT NULL DEFAULT 'SILVER';

-- CreateTable
CREATE TABLE "ReferralCommissionConfig" (
    "id" TEXT NOT NULL,
    "rank" "ReferralRank" NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "purchaserUserId" TEXT NOT NULL,
    "rank" "ReferralRank" NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "eligibleProductAmount" DECIMAL(18,2) NOT NULL,
    "commissionAmount" DECIMAL(18,2) NOT NULL,
    "walletTransactionId" TEXT NOT NULL,
    "status" "ReferralCommissionStatus" NOT NULL DEFAULT 'AWARDED',
    "reversedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommissionConfig_rank_key" ON "ReferralCommissionConfig"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_eventKey_key" ON "ReferralCommission"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_walletTransactionId_key" ON "ReferralCommission"("walletTransactionId");

-- CreateIndex
CREATE INDEX "ReferralCommission_orderId_idx" ON "ReferralCommission"("orderId");

-- CreateIndex
CREATE INDEX "ReferralCommission_referrerUserId_idx" ON "ReferralCommission"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralCommission_purchaserUserId_idx" ON "ReferralCommission"("purchaserUserId");

-- CreateIndex
CREATE INDEX "ReferralCommission_status_idx" ON "ReferralCommission"("status");

-- CreateIndex
CREATE INDEX "ReferralCommission_createdAt_idx" ON "ReferralCommission"("createdAt");

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_purchaserUserId_fkey" FOREIGN KEY ("purchaserUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
