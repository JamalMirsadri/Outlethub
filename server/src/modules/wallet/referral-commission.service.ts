import {
  Prisma,
  ReferralCommissionStatus,
  ReferralRank,
  ReferralRelationshipStatus,
  WalletTransactionType,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { walletService } from "./wallet.service.js";

const EUR = "EUR";

const DEFAULT_RANK_CONFIGS: Array<{ rank: ReferralRank; percentage: string }> = [
  { rank: ReferralRank.SILVER, percentage: "2.00" },
  { rank: ReferralRank.GOLD, percentage: "2.50" },
  { rank: ReferralRank.PLATINUM, percentage: "3.00" },
  { rank: ReferralRank.DIAMOND, percentage: "3.50" },
];

function money(value: Prisma.Decimal | number | string | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

function buildCommissionEventKey(orderId: string, referrerUserId: string): string {
  return `REFERRAL_COMMISSION:ORDER:${orderId}:USER:${referrerUserId}`;
}

export class ReferralCommissionService {
  public async ensureDefaultConfigs(tx: Prisma.TransactionClient): Promise<void> {
    const existing = await tx.referralCommissionConfig.findMany({ select: { rank: true } });
    const existingRanks = new Set(existing.map((config) => config.rank));

    for (const config of DEFAULT_RANK_CONFIGS) {
      if (existingRanks.has(config.rank)) {
        continue;
      }

      await tx.referralCommissionConfig.create({
        data: { rank: config.rank, percentage: new Prisma.Decimal(config.percentage), isActive: true },
      });
    }
  }

  public async getConfigs() {
    await prisma.$transaction(async (tx) => this.ensureDefaultConfigs(tx));

    const configs = await prisma.referralCommissionConfig.findMany({
      orderBy: { rank: "asc" },
    });

    return configs.map((config) => ({
      rank: config.rank,
      percentage: money(config.percentage),
      isActive: config.isActive,
      updatedAt: config.updatedAt,
    }));
  }

  public async updateConfig(actorUserId: string, input: { rank: ReferralRank; percentage: number; isActive: boolean }) {
    if (!Number.isFinite(input.percentage) || input.percentage < 0 || input.percentage > 100) {
      throw new ApiError(400, "Percentage must be between 0 and 100.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.ensureDefaultConfigs(tx);

      const result = await tx.referralCommissionConfig.upsert({
        where: { rank: input.rank },
        update: {
          percentage: new Prisma.Decimal(input.percentage).toDecimalPlaces(2),
          isActive: input.isActive,
        },
        create: {
          rank: input.rank,
          percentage: new Prisma.Decimal(input.percentage).toDecimalPlaces(2),
          isActive: input.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: "USER",
          action: "REFERRAL_COMMISSION_CONFIG_UPDATED",
          entityType: "referral_commission_config",
          entityId: result.id,
          metadata: { rank: input.rank, percentage: money(result.percentage), isActive: input.isActive },
        },
      });

      return result;
    });

    return { rank: updated.rank, percentage: money(updated.percentage), isActive: updated.isActive };
  }

  /**
   * Idempotently awards (on DELIVERED) or reverses (on CANCELLED/REFUNDED) the
   * direct-referrer commission for an order. Commission is derived from product
   * line amounts only (sum of OrderItem.totalPrice), never shipping/tax/fees.
   */
  public async syncOrderCommission(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, userId: true, orderNumber: true, status: true },
      });

      if (!order) {
        throw new ApiError(404, "Order not found.");
      }

      if (order.status === "DELIVERED") {
        return this.awardCommission(tx, order);
      }

      if (order.status === "CANCELLED" || order.status === "REFUNDED") {
        return this.reverseCommission(tx, order);
      }

      return null;
    });
  }

  public async getUserReferralSummary(userId: string) {
    const [user, commissionAggregate, recentCommissions, configs] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, referralCode: true, referralRank: true },
      }),
      prisma.referralCommission.aggregate({
        where: { referrerUserId: userId, status: ReferralCommissionStatus.AWARDED },
        _sum: { commissionAmount: true },
      }),
      prisma.referralCommission.findMany({
        where: { referrerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { order: { select: { id: true, orderNumber: true } } },
      }),
      prisma.referralCommissionConfig.findMany({ select: { rank: true, percentage: true, isActive: true } }),
    ]);

    const configByRank = new Map(configs.map((config) => [config.rank, config]));
    const activeConfig = configByRank.get(user.referralRank);

    return {
      referralCode: user.referralCode,
      rank: user.referralRank,
      percentage: activeConfig?.isActive ? money(activeConfig.percentage) : "0.00",
      totalEarned: money(commissionAggregate._sum.commissionAmount),
      recentCommissions: recentCommissions.map((commission) => ({
        id: commission.id,
        orderId: commission.orderId,
        orderNumber: commission.order.orderNumber,
        rank: commission.rank,
        percentage: money(commission.percentage),
        eligibleProductAmount: money(commission.eligibleProductAmount),
        commissionAmount: money(commission.commissionAmount),
        status: commission.status,
        createdAt: commission.createdAt,
      })),
    };
  }

  public async listCommissions(query: {
    page: number;
    pageSize: number;
    referrerUserId?: string;
    rank?: ReferralRank;
    orderId?: string;
    status?: ReferralCommissionStatus;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.ReferralCommissionWhereInput = {};

    if (query.referrerUserId) {
      where.referrerUserId = query.referrerUserId;
    }

    if (query.rank) {
      where.rank = query.rank;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.referralCommission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          order: { select: { id: true, orderNumber: true } },
          referrerUser: { select: { id: true, email: true, fullName: true, referralCode: true } },
          purchaserUser: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.referralCommission.count({ where }),
    ]);

    return {
      items: items.map((commission) => ({
        id: commission.id,
        orderId: commission.orderId,
        orderNumber: commission.order.orderNumber,
        referrerUserId: commission.referrerUserId,
        referrerEmail: commission.referrerUser.email,
        referrerCode: commission.referrerUser.referralCode,
        purchaserUserId: commission.purchaserUserId,
        purchaserEmail: commission.purchaserUser.email,
        rank: commission.rank,
        percentage: money(commission.percentage),
        eligibleProductAmount: money(commission.eligibleProductAmount),
        commissionAmount: money(commission.commissionAmount),
        walletTransactionId: commission.walletTransactionId,
        status: commission.status,
        createdAt: commission.createdAt,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  public async getAdminOverview() {
    const [totalCommissions, totalAmount, byRank, byReferrer, reversed] = await Promise.all([
      prisma.referralCommission.count({ where: { status: ReferralCommissionStatus.AWARDED } }),
      prisma.referralCommission.aggregate({
        where: { status: ReferralCommissionStatus.AWARDED },
        _sum: { commissionAmount: true },
      }),
      prisma.referralCommission.groupBy({
        by: ["rank"],
        where: { status: ReferralCommissionStatus.AWARDED },
        _sum: { commissionAmount: true },
      }),
      prisma.referralCommission.groupBy({
        by: ["referrerUserId"],
        where: { status: ReferralCommissionStatus.AWARDED },
        _sum: { commissionAmount: true },
        orderBy: { _sum: { commissionAmount: "desc" } },
        take: 10,
      }),
      prisma.referralCommission.count({ where: { status: ReferralCommissionStatus.REVERSED } }),
    ]);

    return {
      totalCommissions,
      totalAmount: money(totalAmount._sum.commissionAmount),
      reversedCommissions: reversed,
      byRank: byRank.map((row) => ({
        rank: row.rank,
        count: 0,
        amount: money(row._sum.commissionAmount),
      })),
      topReferrers: byReferrer.map((row) => ({
        referrerUserId: row.referrerUserId,
        amount: money(row._sum.commissionAmount),
      })),
    };
  }

  private async awardCommission(
    tx: Prisma.TransactionClient,
    order: { id: string; userId: string; orderNumber: string },
  ) {
    const relationship = await tx.referralRelationship.findUnique({
      where: { referredUserId: order.userId },
    });

    if (!relationship || relationship.status !== ReferralRelationshipStatus.ACTIVE) {
      return null;
    }

    const referrerUserId = relationship.referrerUserId;
    const eventKey = buildCommissionEventKey(order.id, referrerUserId);

    const existing = await tx.referralCommission.findUnique({ where: { eventKey } });
    if (existing) {
      return null;
    }

    const referrer = await tx.user.findUnique({
      where: { id: referrerUserId },
      select: { id: true, referralRank: true },
    });
    if (!referrer) {
      return null;
    }

    const config = await tx.referralCommissionConfig.findUnique({ where: { rank: referrer.referralRank } });
    if (!config || !config.isActive) {
      return null;
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId: referrerUserId },
      select: { id: true, walletId: true },
    });
    if (!wallet) {
      return null;
    }

    const itemAggregate = await tx.orderItem.aggregate({
      where: { orderId: order.id },
      _sum: { totalPrice: true },
    });
    const eligibleProductAmount = itemAggregate._sum.totalPrice ?? new Prisma.Decimal(0);
    if (eligibleProductAmount.lessThanOrEqualTo(0)) {
      return null;
    }

    // Decimal-only arithmetic; round half-up to 2 decimal EUR.
    const commissionAmount = eligibleProductAmount
      .mul(config.percentage)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (commissionAmount.lessThanOrEqualTo(0)) {
      return null;
    }

    const walletTransaction = await walletService.applyWalletTransactionWithinTransaction(tx, {
      walletId: wallet.id,
      amount: commissionAmount,
      type: WalletTransactionType.REFERRAL_COMMISSION,
      direction: "credit",
      referenceType: "ORDER",
      referenceId: order.id,
      description: "Referral commission",
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        purchaserUserId: order.userId,
        referrerUserId,
        rank: referrer.referralRank,
        percentage: config.percentage.toFixed(2),
        eligibleProductAmount: eligibleProductAmount.toFixed(2),
      },
    });

    const commission = await tx.referralCommission.create({
      data: {
        eventKey,
        orderId: order.id,
        referrerUserId,
        purchaserUserId: order.userId,
        rank: referrer.referralRank,
        percentage: config.percentage,
        eligibleProductAmount,
        commissionAmount,
        walletTransactionId: walletTransaction.id,
        status: ReferralCommissionStatus.AWARDED,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "REFERRAL_COMMISSION_AWARDED",
        entityType: "order",
        entityId: order.id,
        metadata: {
          walletTransactionId: walletTransaction.id,
          referrerUserId,
          purchaserUserId: order.userId,
          rank: referrer.referralRank,
          percentage: config.percentage.toFixed(2),
          eligibleProductAmount: eligibleProductAmount.toFixed(2),
          commissionAmount: commissionAmount.toFixed(2),
        },
      },
    });

    return commission;
  }

  private async reverseCommission(tx: Prisma.TransactionClient, order: { id: string; orderNumber: string }) {
    const commission = await tx.referralCommission.findFirst({
      where: { orderId: order.id, status: ReferralCommissionStatus.AWARDED },
    });

    if (!commission) {
      return null;
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId: commission.referrerUserId },
      select: { id: true },
    });
    if (!wallet) {
      return null;
    }

    await walletService.applyWalletTransactionWithinTransaction(tx, {
      walletId: wallet.id,
      amount: commission.commissionAmount,
      type: WalletTransactionType.REFERRAL_COMMISSION_REVERSAL,
      direction: "debit",
      referenceType: "ORDER",
      referenceId: order.id,
      description: "Referral commission reversal",
      metadata: {
        originalCommissionId: commission.id,
        originalWalletTransactionId: commission.walletTransactionId,
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    });

    await tx.referralCommission.update({
      where: { id: commission.id },
      data: { status: ReferralCommissionStatus.REVERSED, reversedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "REFERRAL_COMMISSION_REVERSED",
        entityType: "order",
        entityId: order.id,
        metadata: {
          commissionId: commission.id,
          referrerUserId: commission.referrerUserId,
          commissionAmount: commission.commissionAmount.toFixed(2),
        },
      },
    });

    return commission;
  }
}

export const referralCommissionService = new ReferralCommissionService();
