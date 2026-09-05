-- CreateTable
CREATE TABLE "AgentCostConfig" (
    "id" TEXT NOT NULL,
    "firstProductFee" DECIMAL(10,2) NOT NULL DEFAULT 7.99,
    "secondProductFee" DECIMAL(10,2) NOT NULL DEFAULT 6.99,
    "thirdProductFee" DECIMAL(10,2) NOT NULL DEFAULT 4.99,
    "fourthProductFee" DECIMAL(10,2) NOT NULL DEFAULT 3.99,
    "fifthProductFee" DECIMAL(10,2) NOT NULL DEFAULT 3.99,
    "sixthProductFee" DECIMAL(10,2) NOT NULL DEFAULT 3.99,
    "additionalProductFee" DECIMAL(10,2) NOT NULL DEFAULT 3.99,
    "threshold" INTEGER NOT NULL DEFAULT 6,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCostConfig_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN "agentCostAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "agentCostAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
