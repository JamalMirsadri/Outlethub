-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('ADMIN_CREDIT', 'ADMIN_DEBIT', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_CANCELLED', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "adminNote" TEXT,

    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_walletId_key" ON "Wallet"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_status_idx" ON "Wallet"("status");

-- CreateIndex
CREATE INDEX "Wallet_createdAt_idx" ON "Wallet"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceId_idx" ON "WalletTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_walletId_idx" ON "WalletWithdrawal"("walletId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_userId_idx" ON "WalletWithdrawal"("userId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_status_idx" ON "WalletWithdrawal"("status");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_requestedAt_idx" ON "WalletWithdrawal"("requestedAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
