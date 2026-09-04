-- AlterTable
ALTER TABLE "ReferralCommissionConfig" ADD COLUMN "levelNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ReferralCommissionConfig" ALTER COLUMN "levelNumber" DROP DEFAULT;

-- DropIndex
DROP INDEX "ReferralCommissionConfig_rank_key";

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommissionConfig_levelNumber_rank_key" ON "ReferralCommissionConfig"("levelNumber", "rank");

-- CreateIndex
CREATE INDEX "ReferralCommissionConfig_levelNumber_idx" ON "ReferralCommissionConfig"("levelNumber");

-- CreateTable
CREATE TABLE "ReferralCommissionSettings" (
    "id" TEXT NOT NULL,
    "maxCommissionLevel" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommissionSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ReferralCommission" ADD COLUMN "referralLevel" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ReferralCommission_referralLevel_idx" ON "ReferralCommission"("referralLevel");
