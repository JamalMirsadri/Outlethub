import { randomUUID } from "node:crypto";
import { Prisma, WalletStatus, WalletTransactionType, WithdrawalStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

const EUR = "EUR";

function money(value: Prisma.Decimal | number | string | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

export interface WalletView {
  id: string;
  walletId: string;
  userId: string;
  currency: string;
  balance: string;
  status: WalletStatus;
  createdAt: Date;
}

export interface WalletTransactionView {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: Date;
  createdBy: string | null;
}

export interface WalletWithdrawalView {
  id: string;
  walletId: string;
  userId: string;
  amount: string;
  currency: string;
  status: WithdrawalStatus;
  requestedAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
  adminNote: string | null;
}

function toWalletView(wallet: {
  id: string;
  walletId: string;
  userId: string;
  currency: string;
  balance: Prisma.Decimal;
  status: WalletStatus;
  createdAt: Date;
}): WalletView {
  return {
    id: wallet.id,
    walletId: wallet.walletId,
    userId: wallet.userId,
    currency: wallet.currency,
    balance: money(wallet.balance),
    status: wallet.status,
    createdAt: wallet.createdAt,
  };
}

function toTransactionView(transaction: {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  currency: string;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: Date;
  createdBy: string | null;
}): WalletTransactionView {
  return {
    id: transaction.id,
    walletId: transaction.walletId,
    type: transaction.type,
    amount: money(transaction.amount),
    balanceBefore: money(transaction.balanceBefore),
    balanceAfter: money(transaction.balanceAfter),
    currency: transaction.currency,
    status: transaction.status,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    description: transaction.description,
    createdAt: transaction.createdAt,
    createdBy: transaction.createdBy,
  };
}

function toWithdrawalView(withdrawal: {
  id: string;
  walletId: string;
  userId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: WithdrawalStatus;
  requestedAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
  adminNote: string | null;
}): WalletWithdrawalView {
  return {
    id: withdrawal.id,
    walletId: withdrawal.walletId,
    userId: withdrawal.userId,
    amount: money(withdrawal.amount),
    currency: withdrawal.currency,
    status: withdrawal.status,
    requestedAt: withdrawal.requestedAt,
    processedAt: withdrawal.processedAt,
    processedBy: withdrawal.processedBy,
    adminNote: withdrawal.adminNote,
  };
}

interface LockedWalletRow {
  id: string;
  walletId: string;
  userId: string;
  balance: Prisma.Decimal;
  status: WalletStatus;
}

export class WalletService {
  /**
   * Creates exactly one EUR wallet for a newly registered user. Called inside
   * the same transaction that creates the user, so a user is never left
   * without a wallet.
   */
  public async createForUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.wallet.create({
      data: {
        walletId: randomUUID(),
        userId,
        currency: EUR,
        balance: new Prisma.Decimal(0),
        status: WalletStatus.ACTIVE,
      },
    });
  }

  public async getOwnWallet(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        withdrawals: {
          where: { status: WithdrawalStatus.PENDING },
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!wallet) {
      throw new ApiError(404, "Wallet not found.");
    }

    return {
      ...toWalletView(wallet),
      pendingWithdrawals: wallet.withdrawals.map(toWithdrawalView),
    };
  }

  public async listOwnTransactions(userId: string, page: number, pageSize: number) {
    const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { id: true } });
    if (!wallet) {
      throw new ApiError(404, "Wallet not found.");
    }

    const where = { walletId: wallet.id };
    const [items, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return {
      items: items.map(toTransactionView),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  public async adminCredit(input: {
    walletId: string;
    amount: string;
    reason: string;
    reference?: string | null;
    actorUserId: string;
  }) {
    return this.applyBalanceChange({
      walletId: input.walletId,
      amount: input.amount,
      type: WalletTransactionType.ADMIN_CREDIT,
      description: input.reason,
      reference: input.reference,
      actorUserId: input.actorUserId,
      operation: "credit",
    });
  }

  public async adminDebit(input: {
    walletId: string;
    amount: string;
    reason: string;
    reference?: string | null;
    actorUserId: string;
  }) {
    return this.applyBalanceChange({
      walletId: input.walletId,
      amount: input.amount,
      type: WalletTransactionType.ADMIN_DEBIT,
      description: input.reason,
      reference: input.reference,
      actorUserId: input.actorUserId,
      operation: "debit",
    });
  }

  public async setWalletStatus(walletId: string, status: WalletStatus, actorUserId: string, reason?: string | null) {
    const wallet = await prisma.wallet.findUnique({ where: { walletId } });
    if (!wallet) {
      throw new ApiError(404, "Wallet not found.");
    }

    const updated = await prisma.wallet.update({ where: { id: wallet.id }, data: { status } });

    await prisma.auditLog.create({
      data: {
        actorUserId,
        actorType: "USER",
        action: status === WalletStatus.SUSPENDED ? "WALLET_SUSPEND" : "WALLET_ACTIVATE",
        entityType: "wallet",
        entityId: wallet.id,
        metadata: { walletId, reason: reason ?? null },
      },
    });

    return toWalletView(updated);
  }

  public async listWallets(query: { page: number; pageSize: number; search?: string; status?: WalletStatus }) {
    const where: Prisma.WalletWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { walletId: { contains: query.search, mode: "insensitive" } },
        { user: { email: { contains: query.search, mode: "insensitive" } } },
        { user: { fullName: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
      prisma.wallet.count({ where }),
    ]);

    return {
      items: items.map((wallet) => ({
        ...toWalletView(wallet),
        user: wallet.user,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  public async getWalletByPublicId(walletId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { walletId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        withdrawals: { orderBy: { requestedAt: "desc" }, take: 20 },
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!wallet) {
      throw new ApiError(404, "Wallet not found.");
    }

    return {
      ...toWalletView(wallet),
      user: wallet.user,
      withdrawals: wallet.withdrawals.map(toWithdrawalView),
      transactions: wallet.transactions.map(toTransactionView),
    };
  }

  public async requestWithdrawal(userId: string, amount: string) {
    const amountDecimal = new Prisma.Decimal(amount);

    return prisma.$transaction(async (tx) => {
      const row = await this.lockWalletByUserId(tx, userId);

      if (row.status !== WalletStatus.ACTIVE) {
        throw new ApiError(409, "Wallet is not active.");
      }

      const reserved = await this.reservedAmount(tx, row.id);
      const available = row.balance.sub(reserved);

      if (amountDecimal.greaterThan(available)) {
        throw new ApiError(409, "Insufficient available balance.");
      }

      const withdrawal = await tx.walletWithdrawal.create({
        data: {
          walletId: row.id,
          userId,
          amount: amountDecimal,
          currency: EUR,
          status: WithdrawalStatus.PENDING,
        },
      });

      return toWithdrawalView(withdrawal);
    });
  }

  public async listWithdrawals(query: { page: number; pageSize: number; search?: string; status?: WithdrawalStatus }) {
    const where: Prisma.WalletWithdrawalWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { wallet: { walletId: { contains: query.search, mode: "insensitive" } } },
        { user: { email: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.walletWithdrawal.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
      prisma.walletWithdrawal.count({ where }),
    ]);

    return {
      items: items.map((withdrawal) => ({
        ...toWithdrawalView(withdrawal),
        user: withdrawal.user,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  public async approveWithdrawal(id: string, actorUserId: string, adminNote?: string | null) {
    return this.transitionWithdrawal(id, WithdrawalStatus.APPROVED, WithdrawalStatus.PENDING, actorUserId, adminNote, false);
  }

  public async rejectWithdrawal(id: string, actorUserId: string, adminNote?: string | null) {
    return this.transitionWithdrawal(id, WithdrawalStatus.REJECTED, WithdrawalStatus.PENDING, actorUserId, adminNote, false);
  }

  public async cancelWithdrawal(id: string, actorUserId: string, adminNote?: string | null) {
    return this.transitionWithdrawal(id, WithdrawalStatus.CANCELLED, WithdrawalStatus.PENDING, actorUserId, adminNote, false);
  }

  public async completeWithdrawal(id: string, actorUserId: string, adminNote?: string | null) {
    return this.transitionWithdrawal(id, WithdrawalStatus.COMPLETED, WithdrawalStatus.APPROVED, actorUserId, adminNote, true);
  }

  public async adminOverview() {
    const [total, active, suspended, balanceAggregate, pendingWithdrawals, credits, debits] = await Promise.all([
      prisma.wallet.count(),
      prisma.wallet.count({ where: { status: WalletStatus.ACTIVE } }),
      prisma.wallet.count({ where: { status: WalletStatus.SUSPENDED } }),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.walletWithdrawal.count({ where: { status: WithdrawalStatus.PENDING } }),
      prisma.walletTransaction.aggregate({ where: { type: WalletTransactionType.ADMIN_CREDIT }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: WalletTransactionType.ADMIN_DEBIT }, _sum: { amount: true } }),
    ]);

    return {
      totalWallets: total,
      activeWallets: active,
      suspendedWallets: suspended,
      totalBalance: money(balanceAggregate._sum.balance),
      pendingWithdrawals,
      totalCredits: money(credits._sum.amount),
      totalDebits: money(debits._sum.amount),
    };
  }

  /**
   * Low-level, concurrency-safe credit/debit primitive used by the referral
   * commission engine. Operates within an existing transaction and locks the
   * wallet row before mutating the balance and writing the immutable ledger.
   */
  public async applyWalletTransactionWithinTransaction(
    tx: Prisma.TransactionClient,
    input: {
      walletId: string;
      amount: Prisma.Decimal;
      type: WalletTransactionType;
      direction: "credit" | "debit";
      referenceType: string;
      referenceId: string;
      description: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const row = await this.lockWalletById(tx, input.walletId);
    if (row.status !== WalletStatus.ACTIVE) {
      throw new ApiError(409, "Wallet is not active.");
    }

    const balanceAfter = input.direction === "credit" ? row.balance.add(input.amount) : row.balance.sub(input.amount);
    if (balanceAfter.isNegative()) {
      throw new ApiError(409, "Insufficient funds.");
    }

    await tx.wallet.update({ where: { id: row.id }, data: { balance: balanceAfter } });

    return tx.walletTransaction.create({
      data: {
        walletId: row.id,
        type: input.type,
        amount: input.amount,
        balanceBefore: row.balance,
        balanceAfter,
        currency: EUR,
        status: "COMPLETED",
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        metadata: input.metadata ?? Prisma.JsonNull,
        createdBy: null,
      },
    });
  }

  private async applyBalanceChange(input: {
    walletId: string;
    amount: string;
    type: WalletTransactionType;
    description: string;
    reference?: string | null;
    actorUserId: string;
    operation: "credit" | "debit";
  }) {
    const amountDecimal = new Prisma.Decimal(input.amount);

    return prisma.$transaction(async (tx) => {
      const row = await this.lockWalletByPublicId(tx, input.walletId);

      if (row.status !== WalletStatus.ACTIVE) {
        throw new ApiError(409, "Wallet is not active.");
      }

      const balanceAfter = input.operation === "credit" ? row.balance.add(amountDecimal) : row.balance.sub(amountDecimal);

      if (balanceAfter.isNegative()) {
        throw new ApiError(409, "Insufficient funds.");
      }

      await tx.wallet.update({ where: { id: row.id }, data: { balance: balanceAfter } });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: row.id,
          type: input.type,
          amount: amountDecimal,
          balanceBefore: row.balance,
          balanceAfter,
          currency: EUR,
          status: "COMPLETED",
          referenceType: input.reference ? "admin" : null,
          referenceId: input.reference ?? null,
          description: input.description,
          createdBy: input.actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          actorType: "USER",
          action: input.operation === "credit" ? "WALLET_CREDIT" : "WALLET_DEBIT",
          entityType: "wallet",
          entityId: row.id,
          metadata: {
            walletId: input.walletId,
            amount: money(amountDecimal),
            balanceBefore: money(row.balance),
            balanceAfter: money(balanceAfter),
            reason: input.description,
          },
        },
      });

      return {
        wallet: {
          walletId: row.walletId,
          balance: money(balanceAfter),
        },
        transaction: toTransactionView(transaction),
      };
    });
  }

  private async transitionWithdrawal(
    id: string,
    toStatus: WithdrawalStatus,
    fromStatus: WithdrawalStatus,
    actorUserId: string,
    adminNote: string | null | undefined,
    debitBalance: boolean,
  ) {
    return prisma.$transaction(async (tx) => {
      const withdrawal = await tx.walletWithdrawal.findUnique({ where: { id } });
      if (!withdrawal) {
        throw new ApiError(404, "Withdrawal request not found.");
      }

      if (withdrawal.status !== fromStatus) {
        throw new ApiError(409, `Withdrawal cannot transition from ${withdrawal.status}.`);
      }

      const wallet = await this.lockWalletById(tx, withdrawal.walletId);
      if (debitBalance && wallet.status !== WalletStatus.ACTIVE) {
        throw new ApiError(409, "Wallet is not active.");
      }

      if (debitBalance) {
        const balanceAfter = wallet.balance.sub(withdrawal.amount);
        if (balanceAfter.isNegative()) {
          throw new ApiError(409, "Insufficient funds.");
        }

        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.WITHDRAWAL_COMPLETED,
            amount: withdrawal.amount,
            balanceBefore: wallet.balance,
            balanceAfter,
            currency: EUR,
            status: "COMPLETED",
            referenceType: "withdrawal",
            referenceId: withdrawal.id,
            description: "Withdrawal completed",
            createdBy: actorUserId,
          },
        });
      }

      const updated = await tx.walletWithdrawal.update({
        where: { id },
        data: {
          status: toStatus,
          processedAt: new Date(),
          processedBy: actorUserId,
          adminNote: adminNote ?? withdrawal.adminNote,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: "USER",
          action: `WITHDRAWAL_${toStatus}`,
          entityType: "wallet_withdrawal",
          entityId: withdrawal.id,
          metadata: { walletId: withdrawal.walletId, amount: money(withdrawal.amount), adminNote: adminNote ?? null },
        },
      });

      return toWithdrawalView(updated);
    });
  }

  private async lockWalletByPublicId(tx: Prisma.TransactionClient, walletId: string): Promise<LockedWalletRow> {
    const rows = await tx.$queryRaw<LockedWalletRow[]>`
      SELECT id, "walletId", "userId", balance, status
      FROM "Wallet"
      WHERE "walletId" = ${walletId}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      throw new ApiError(404, "Wallet not found.");
    }

    return { ...row, balance: new Prisma.Decimal(row.balance) };
  }

  private async lockWalletById(tx: Prisma.TransactionClient, id: string): Promise<LockedWalletRow> {
    const rows = await tx.$queryRaw<LockedWalletRow[]>`
      SELECT id, "walletId", "userId", balance, status
      FROM "Wallet"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      throw new ApiError(404, "Wallet not found.");
    }

    return { ...row, balance: new Prisma.Decimal(row.balance) };
  }

  private async lockWalletByUserId(tx: Prisma.TransactionClient, userId: string): Promise<LockedWalletRow> {
    const rows = await tx.$queryRaw<LockedWalletRow[]>`
      SELECT id, "walletId", "userId", balance, status
      FROM "Wallet"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      throw new ApiError(404, "Wallet not found.");
    }

    return { ...row, balance: new Prisma.Decimal(row.balance) };
  }

  private async reservedAmount(tx: Prisma.TransactionClient, walletId: string): Promise<Prisma.Decimal> {
    const aggregate = await tx.walletWithdrawal.aggregate({
      where: { walletId, status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED] } },
      _sum: { amount: true },
    });

    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }
}

export const walletService = new WalletService();
