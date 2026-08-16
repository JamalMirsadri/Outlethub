ALTER TABLE "RefreshToken"
ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "RefreshToken"
SET "lastActivityAt" = COALESCE("lastActivityAt", "createdAt");

CREATE INDEX IF NOT EXISTS "RefreshToken_lastActivityAt_idx" ON "RefreshToken"("lastActivityAt");
