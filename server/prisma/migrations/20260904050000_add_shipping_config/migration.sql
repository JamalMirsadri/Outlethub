-- CreateTable
CREATE TABLE "ShippingConfig" (
    "id" TEXT NOT NULL,
    "firstProductFee" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "secondProductFee" DECIMAL(10,2) NOT NULL DEFAULT 8,
    "thirdProductFee" DECIMAL(10,2) NOT NULL DEFAULT 6,
    "fourthProductFee" DECIMAL(10,2) NOT NULL DEFAULT 4,
    "fifthProductFee" DECIMAL(10,2) NOT NULL DEFAULT 4,
    "additionalProductFee" DECIMAL(10,2) NOT NULL DEFAULT 4,
    "threshold" INTEGER NOT NULL DEFAULT 5,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingConfig_pkey" PRIMARY KEY ("id")
);
