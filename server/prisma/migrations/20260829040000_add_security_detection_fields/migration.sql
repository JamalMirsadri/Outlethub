-- AlterTable
ALTER TABLE "ErrorLog" ADD COLUMN "attackType" TEXT;
ALTER TABLE "ErrorLog" ADD COLUMN "confidence" TEXT;
ALTER TABLE "ErrorLog" ADD COLUMN "userAgent" TEXT;
