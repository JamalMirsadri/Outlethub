-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- AlterEnum
BEGIN;
CREATE TYPE "ProductSource_new" AS ENUM ('MANUAL', 'IMPORT', 'AWIN', 'CJ', 'SCRAPER');
ALTER TABLE "public"."Product" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "source" TYPE "ProductSource_new" USING ("source"::text::"ProductSource_new");
ALTER TYPE "ProductSource" RENAME TO "ProductSource_old";
ALTER TYPE "ProductSource_new" RENAME TO "ProductSource";
DROP TYPE "public"."ProductSource_old";
ALTER TABLE "Product" ALTER COLUMN "source" SET DEFAULT 'MANUAL';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProductStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
ALTER TABLE "public"."Product" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "status" TYPE "ProductStatus_new" USING ("status"::text::"ProductStatus_new");
ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_old";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
DROP TYPE "public"."ProductStatus_old";
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropIndex
DROP INDEX "Category_status_idx";

-- AlterTable
ALTER TABLE "Brand" DROP COLUMN "status",
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "website" TEXT;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "status",
ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "sourceStore" TEXT,
ADD COLUMN "stockStatus" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
ALTER COLUMN "categoryId" SET NOT NULL,
ALTER COLUMN "sku" SET NOT NULL,
ALTER COLUMN "originalPrice" DROP NOT NULL,
ALTER COLUMN "discountPercent" SET DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "ProductImage"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropEnum
DROP TYPE "BrandStatus";

-- DropEnum
DROP TYPE "CategoryStatus";

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_size_color_key" ON "ProductVariant"("productId", "size", "color");

-- CreateIndex
CREATE INDEX "Brand_isActive_idx" ON "Brand"("isActive");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE INDEX "Product_stockStatus_idx" ON "Product"("stockStatus");

-- AddForeignKey
ALTER TABLE "Product"
ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
