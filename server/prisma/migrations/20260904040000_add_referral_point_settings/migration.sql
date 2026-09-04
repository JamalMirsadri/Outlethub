-- CreateTable
CREATE TABLE "ReferralPointSettings" (
    "id" TEXT NOT NULL,
    "purchaserPointsPer10EUR" INTEGER NOT NULL DEFAULT 5,
    "level1PointsPer10EUR" INTEGER NOT NULL DEFAULT 5,
    "level2PointsPer10EUR" INTEGER NOT NULL DEFAULT 4,
    "level3PointsPer10EUR" INTEGER NOT NULL DEFAULT 3,
    "maxReferralLevel" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPointSettings_pkey" PRIMARY KEY ("id")
);
