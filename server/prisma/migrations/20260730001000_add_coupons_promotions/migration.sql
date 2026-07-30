-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "percentage" DECIMAL(5,2),
    "fixedAmount" DECIMAL(10,2),
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "minimumOrderAmount" DECIMAL(10,2),
    "maximumDiscountAmount" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usagePerUser" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "allowedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedBrandIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedBrandIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedMembershipLevelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CouponStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponCartApplication" (
    "id" TEXT NOT NULL,
    "couponId" TEXT,
    "cartId" TEXT NOT NULL,
    "userId" TEXT,
    "codeSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponCartApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponOrderApplication" (
    "id" TEXT NOT NULL,
    "couponId" TEXT,
    "orderId" TEXT NOT NULL,
    "cartApplicationId" TEXT,
    "userId" TEXT NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "percentageSnapshot" DECIMAL(5,2),
    "fixedAmountSnapshot" DECIMAL(10,2),
    "freeShippingSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalSavingsAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "qualifiedSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponOrderApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_status_idx" ON "Coupon"("status");

-- CreateIndex
CREATE INDEX "Coupon_startsAt_idx" ON "Coupon"("startsAt");

-- CreateIndex
CREATE INDEX "Coupon_endsAt_idx" ON "Coupon"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponCartApplication_cartId_key" ON "CouponCartApplication"("cartId");

-- CreateIndex
CREATE INDEX "CouponCartApplication_couponId_idx" ON "CouponCartApplication"("couponId");

-- CreateIndex
CREATE INDEX "CouponCartApplication_userId_idx" ON "CouponCartApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponOrderApplication_orderId_key" ON "CouponOrderApplication"("orderId");

-- CreateIndex
CREATE INDEX "CouponOrderApplication_couponId_idx" ON "CouponOrderApplication"("couponId");

-- CreateIndex
CREATE INDEX "CouponOrderApplication_userId_idx" ON "CouponOrderApplication"("userId");

-- CreateIndex
CREATE INDEX "CouponOrderApplication_cartApplicationId_idx" ON "CouponOrderApplication"("cartApplicationId");

-- CreateIndex
CREATE INDEX "CouponOrderApplication_createdAt_idx" ON "CouponOrderApplication"("createdAt");

-- AddForeignKey
ALTER TABLE "CouponCartApplication" ADD CONSTRAINT "CouponCartApplication_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCartApplication" ADD CONSTRAINT "CouponCartApplication_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCartApplication" ADD CONSTRAINT "CouponCartApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponOrderApplication" ADD CONSTRAINT "CouponOrderApplication_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponOrderApplication" ADD CONSTRAINT "CouponOrderApplication_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponOrderApplication" ADD CONSTRAINT "CouponOrderApplication_cartApplicationId_fkey" FOREIGN KEY ("cartApplicationId") REFERENCES "CouponCartApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponOrderApplication" ADD CONSTRAINT "CouponOrderApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
