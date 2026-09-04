import {
  MultiLevelReferralPointStatus,
  Prisma,
  ReferralCommissionStatus,
  ReferralRank,
  WalletTransactionType,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { walletService } from "./wallet.service.js";
import {
  buildCommissionBeneficiaries,
  buildCommissionEventKey,
  computeCommission,
  DEFAULT_LEVEL_CONFIGS,
  DEFAULT_MAX_COMMISSION_LEVEL,
  HARD_MAX_COMMISSION_LEVEL,
  resolveCommissionAction,
  resolveMaxCommissionLevel,
} from "./referral-commission.logic.js";

const EUR = "EUR";
const SETTINGS_ID = "default";

function money(value: Prisma.Decimal | number | string | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

type OrderRef = {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
};

export class ReferralCommissionService {
  public async ensureDefaultConfigs(tx: Prisma.TransactionClient): Promise<void> {
    const existing = await tx.referralCommissionConfig.findMany({
      select: { levelNumber: true, rank: true },
    });
    const existingKeys = new Set(existing.map((config) => `${config.levelNumber}:${config.rank}`));

    for (const config of DEFAULT_LEVEL_CONFIGS) {
      if (existingKeys.has(`${config.levelNumber}:${config.rank}`)) {
        continue;
      }

      await tx.referralCommissionConfig.create({
        data: {
          levelNumber: config.levelNumber,
          rank: config.rank,
          percentage: new Prisma.Decimal(config.percentage),
          isActive: true,
        },
      });
    }

    await tx.referralCommissionSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID, maxCommissionLevel: DEFAULT_MAX_COMMISSION_LEVEL },
    });
  }

  public async getConfigs() {
    await prisma.$transaction(async (tx) => this.ensureDefaultConfigs(tx));

    const [configs, settings] = await Promise.all([
      prisma.referralCommissionConfig.findMany({
        orderBy: [{ levelNumber: "asc" }, { rank: "asc" }],
      }),
      prisma.referralCommissionSettings.findUnique({ where: { id: SETTINGS_ID } }),
    ]);

    return {
      maxCommissionLevel: settings?.maxCommissionLevel ?? DEFAULT_MAX_COMMISSION_LEVEL,
      items: configs.map((config) => ({
        levelNumber: config.levelNumber,
        rank: config.rank,
        percentage: money(config.percentage),
        isActive: config.isActive,
        updatedAt: config.updatedAt,
      })),
    };
  }

  public async updateConfig(
    actorUserId: string,
    input: { levelNumber: number; rank: ReferralRank; percentage: number; isActive: boolean },
  ) {
    if (
      !Number.isInteger(input.levelNumber) ||
      input.levelNumber < 1 ||
      input.levelNumber > HARD_MAX_COMMISSION_LEVEL
    ) {
      throw new ApiError(400, "Commission level must be 1 or 2.");
    }

    if (!Number.isFinite(input.percentage) || input.percentage < 0 || input.percentage > 100) {
      throw new ApiError(400, "Percentage must be between 0 and 100.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.ensureDefaultConfigs(tx);

      const result = await tx.referralCommissionConfig.upsert({
        where: {
          levelNumber_rank: {
            levelNumber: input.levelNumber,
            rank: input.rank,
          },
        },
        update: {
          percentage: new Prisma.Decimal(input.percentage).toDecimalPlaces(2),
          isActive: input.isActive,
        },
        create: {
          levelNumber: input.levelNumber,
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
          metadata: {
            levelNumber: input.levelNumber,
            rank: input.rank,
            percentage: money(result.percentage),
            isActive: input.isActive,
          },
        },
      });

      return result;
    });

    return {
      levelNumber: updated.levelNumber,
      rank: updated.rank,
      percentage: money(updated.percentage),
      isActive: updated.isActive,
    };
  }

  public async updateSettings(actorUserId: string, input: { maxCommissionLevel: number }) {
    if (
      !Number.isInteger(input.maxCommissionLevel) ||
      input.maxCommissionLevel < 0 ||
      input.maxCommissionLevel > HARD_MAX_COMMISSION_LEVEL
    ) {
      throw new ApiError(400, "Maximum commission level must be between 0 and 2.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.ensureDefaultConfigs(tx);

      const result = await tx.referralCommissionSettings.upsert({
        where: { id: SETTINGS_ID },
        update: { maxCommissionLevel: input.maxCommissionLevel },
        create: { id: SETTINGS_ID, maxCommissionLevel: input.maxCommissionLevel },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: "USER",
          action: "REFERRAL_COMMISSION_SETTINGS_UPDATED",
          entityType: "referral_commission_settings",
          entityId: SETTINGS_ID,
          metadata: { maxCommissionLevel: input.maxCommissionLevel },
        },
      });

      return result;
    });

    return { maxCommissionLevel: updated.maxCommissionLevel };
  }

  /**
   * Idempotently awards (on DELIVERED) or reverses (on CANCELLED/REFUNDED) the
   * multi-level referral commission for an order. Commission is derived from
   * product line amounts only (sum of OrderItem.totalPrice).
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

      const action = resolveCommissionAction(order.status);
      if (action === "NONE") {
        return null;
      }

      if (action === "REVERSE") {
        return this.reverseCommission(tx, order);
      }

      return this.awardCommission(tx, order);
    });
  }

  public async getUserReferralSummary(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, referralCode: true, referralRank: true },
    });

    const [
      commissionAggregate,
      recentCommissions,
      levelOneConfig,
      levelTwoConfig,
      commissionByLevel,
      pointByLevel,
      levelCounts,
    ] = await Promise.all([
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
      prisma.referralCommissionConfig.findUnique({
        where: { levelNumber_rank: { levelNumber: 1, rank: user.referralRank } },
      }),
      prisma.referralCommissionConfig.findUnique({
        where: { levelNumber_rank: { levelNumber: 2, rank: user.referralRank } },
      }),
      prisma.referralCommission.groupBy({
        by: ["referralLevel"],
        where: { referrerUserId: userId, status: ReferralCommissionStatus.AWARDED },
        _sum: { commissionAmount: true },
      }),
      prisma.multiLevelReferralPointReward.groupBy({
        by: ["referralLevel"],
        where: { beneficiaryUserId: userId, status: MultiLevelReferralPointStatus.AWARDED },
        _sum: { pointsAwarded: true },
      }),
      prisma.referralClosure.groupBy({
        by: ["depth"],
        where: { ancestorUserId: userId, depth: { in: [1, 2, 3] } },
        _count: { _all: true },
      }),
    ]);

    const commissionByLevelMap = new Map(
      commissionByLevel.map((row) => [row.referralLevel, row._sum.commissionAmount ?? 0]),
    );
    const pointByLevelMap = new Map(
      pointByLevel.map((row) => [row.referralLevel, row._sum.pointsAwarded ?? 0]),
    );
    const levelCountMap = new Map(levelCounts.map((row) => [row.depth, row._count._all]));

    const level1Commission = new Prisma.Decimal(commissionByLevelMap.get(1) ?? 0);
    const level2Commission = new Prisma.Decimal(commissionByLevelMap.get(2) ?? 0);

    return {
      referralCode: user.referralCode,
      rank: user.referralRank,
      percentage: levelOneConfig?.isActive ? money(levelOneConfig.percentage) : "0.00",
      totalEarned: money(commissionAggregate._sum.commissionAmount),
      rates: {
        level1Percentage: levelOneConfig?.isActive ? money(levelOneConfig.percentage) : "0.00",
        level2Percentage: levelTwoConfig?.isActive ? money(levelTwoConfig.percentage) : "0.00",
      },
      commission: {
        level1Commission: money(level1Commission),
        level2Commission: money(level2Commission),
        totalCommission: money(level1Commission.add(level2Commission)),
      },
      points: {
        purchaserPoints: pointByLevelMap.get(0) ?? 0,
        level1Points: pointByLevelMap.get(1) ?? 0,
        level2Points: pointByLevelMap.get(2) ?? 0,
        level3Points: pointByLevelMap.get(3) ?? 0,
        totalPoints: (pointByLevelMap.get(1) ?? 0) + (pointByLevelMap.get(2) ?? 0) + (pointByLevelMap.get(3) ?? 0),
      },
      referrals: {
        directCount: levelCountMap.get(1) ?? 0,
        level2Count: levelCountMap.get(2) ?? 0,
        level3Count: levelCountMap.get(3) ?? 0,
      },
      recentCommissions: recentCommissions.map((commission) => ({
        id: commission.id,
        orderId: commission.orderId,
        orderNumber: commission.order.orderNumber,
        referralLevel: commission.referralLevel,
        rank: commission.rank,
        percentage: money(commission.percentage),
        eligibleProductAmount: money(commission.eligibleProductAmount),
        commissionAmount: money(commission.commissionAmount),
        walletTransactionId: commission.walletTransactionId,
        status: commission.status,
        createdAt: commission.createdAt,
      })),
    };
  }

  public async listCommissions(query: {
    page: number;
    pageSize: number;
    referrerUserId?: string;
    purchaserUserId?: string;
    rank?: ReferralRank;
    orderId?: string;
    level?: number;
    status?: ReferralCommissionStatus;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.ReferralCommissionWhereInput = {};

    if (query.referrerUserId) {
      where.referrerUserId = query.referrerUserId;
    }

    if (query.purchaserUserId) {
      where.purchaserUserId = query.purchaserUserId;
    }

    if (query.rank) {
      where.rank = query.rank;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.level !== undefined) {
      where.referralLevel = query.level;
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
        referralLevel: commission.referralLevel,
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
    const [totalCommissions, totalAmount, byRank, byLevel, byReferrer, reversed] = await Promise.all([
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
        by: ["referralLevel"],
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
      byLevel: byLevel.map((row) => ({
        level: row.referralLevel,
        count: 0,
        amount: money(row._sum.commissionAmount),
      })),
      topReferrers: byReferrer.map((row) => ({
        referrerUserId: row.referrerUserId,
        amount: money(row._sum.commissionAmount),
      })),
    };
  }

  private async awardCommission(tx: Prisma.TransactionClient, order: OrderRef) {
    const settings = await tx.referralCommissionSettings.findUnique({ where: { id: SETTINGS_ID } });
    const maxLevel = resolveMaxCommissionLevel(
      settings?.maxCommissionLevel ?? DEFAULT_MAX_COMMISSION_LEVEL,
    );

    if (maxLevel < 1) {
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

    const ancestors = await tx.referralClosure.findMany({
      where: {
        descendantUserId: order.userId,
        depth: { gte: 1, lte: maxLevel },
      },
      orderBy: { depth: "asc" },
      select: { ancestorUserId: true, depth: true },
    });

    const beneficiaries = buildCommissionBeneficiaries(ancestors, maxLevel);
    const results = [];

    for (const entry of beneficiaries) {
      const referralLevel = entry.referralLevel;
      const beneficiaryUserId = entry.beneficiaryUserId;

      const beneficiary = await tx.user.findUnique({
        where: { id: beneficiaryUserId },
        select: { id: true, referralRank: true },
      });
      if (!beneficiary) {
        continue;
      }

      const config = await tx.referralCommissionConfig.findUnique({
        where: {
          levelNumber_rank: {
            levelNumber: referralLevel,
            rank: beneficiary.referralRank,
          },
        },
      });
      if (!config || !config.isActive) {
        continue;
      }

      const eventKey = buildCommissionEventKey(order.id, beneficiaryUserId, referralLevel);
      const existing = await tx.referralCommission.findUnique({ where: { eventKey } });
      if (existing) {
        continue;
      }

      const commissionAmount = computeCommission(eligibleProductAmount, config.percentage);
      if (commissionAmount.lessThanOrEqualTo(0)) {
        continue;
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId: beneficiaryUserId },
        select: { id: true },
      });
      if (!wallet) {
        continue;
      }

      const walletTransaction = await walletService.applyWalletTransactionWithinTransaction(tx, {
        walletId: wallet.id,
        amount: commissionAmount,
        type: WalletTransactionType.REFERRAL_COMMISSION,
        direction: "credit",
        referenceType: "ORDER",
        referenceId: order.id,
        description: `Referral commission (L${referralLevel})`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          purchaserUserId: order.userId,
          beneficiaryUserId,
          referralLevel,
          rank: beneficiary.referralRank,
          percentage: config.percentage.toFixed(2),
          eligibleProductAmount: eligibleProductAmount.toFixed(2),
        },
      });

      const commission = await tx.referralCommission.create({
        data: {
          eventKey,
          orderId: order.id,
          referrerUserId: beneficiaryUserId,
          purchaserUserId: order.userId,
          referralLevel,
          rank: beneficiary.referralRank,
          percentage: config.percentage,
          eligibleProductAmount,
          commissionAmount,
          walletTransactionId: walletTransaction.id,
          status: ReferralCommissionStatus.AWARDED,
          metadata: {
            orderNumber: order.orderNumber,
          },
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
            beneficiaryUserId,
            purchaserUserId: order.userId,
            referralLevel,
            rank: beneficiary.referralRank,
            percentage: config.percentage.toFixed(2),
            eligibleProductAmount: eligibleProductAmount.toFixed(2),
            commissionAmount: commissionAmount.toFixed(2),
          },
        },
      });

      results.push(commission);
    }

    return results;
  }

  private async reverseCommission(tx: Prisma.TransactionClient, order: OrderRef) {
    const commissions = await tx.referralCommission.findMany({
      where: { orderId: order.id, status: ReferralCommissionStatus.AWARDED },
    });

    for (const commission of commissions) {
      const wallet = await tx.wallet.findUnique({
        where: { userId: commission.referrerUserId },
        select: { id: true },
      });
      if (!wallet) {
        continue;
      }

      await walletService.applyWalletTransactionWithinTransaction(tx, {
        walletId: wallet.id,
        amount: commission.commissionAmount,
        type: WalletTransactionType.REFERRAL_COMMISSION_REVERSAL,
        direction: "debit",
        referenceType: "ORDER",
        referenceId: order.id,
        description: `Referral commission reversal (L${commission.referralLevel})`,
        metadata: {
          originalCommissionId: commission.id,
          originalWalletTransactionId: commission.walletTransactionId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          beneficiaryUserId: commission.referrerUserId,
          referralLevel: commission.referralLevel,
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
            beneficiaryUserId: commission.referrerUserId,
            referralLevel: commission.referralLevel,
            commissionAmount: commission.commissionAmount.toFixed(2),
          },
        },
      });
    }

    return commissions;
  }
}

export const referralCommissionService = new ReferralCommissionService();
