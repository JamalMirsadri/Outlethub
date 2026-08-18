ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Payment_expiresAt_idx" ON "Payment"("expiresAt");

ALTER TABLE "BusinessSettings"
ADD COLUMN IF NOT EXISTS "bankTransferPaymentDeadlineHours" INTEGER NOT NULL DEFAULT 3;
