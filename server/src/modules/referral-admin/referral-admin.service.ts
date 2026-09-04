import {
  MultiLevelReferralPointStatus,
  Prisma,
  ReferralCommissionStatus,
  ReferralRelationshipStatus,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

const POINT_SETTINGS_ID = "default";

function money(value: Prisma.Decimal | number | string | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

export class ReferralAdminService {
  public async getPointSettings() {
    const settings = await prisma.$transaction(async (tx) => {
      await tx.referralPointSettings.upsert({
        where: { id: POINT_SETTINGS_ID },
        update: {},
        create: { id: POINT_SETTINGS_ID },
      });

      return tx.referralPointSettings.findUniqueOrThrow({ where: { id: POINT_SETTINGS_ID } });
    });

    return {
      id: settings.id,
      purchaserPointsPer10EUR: settings.purchaserPointsPer10EUR,
      level1PointsPer10EUR: settings.level1PointsPer10EUR,
      level2PointsPer10EUR: settings.level2PointsPer10EUR,
      level3PointsPer10EUR: settings.level3PointsPer10EUR,
      maxReferralLevel: settings.maxReferralLevel,
      updatedAt: settings.updatedAt,
    };
  }

  public async updatePointSettings(
    actorUserId: string,
    input: {
      purchaserPointsPer10EUR: number;
      level1PointsPer10EUR: number;
      level2PointsPer10EUR: number;
      level3PointsPer10EUR: number;
      maxReferralLevel: number;
    },
  ) {
    const pointFields = [
      input.purchaserPointsPer10EUR,
      input.level1PointsPer10EUR,
      input.level2PointsPer10EUR,
      input.level3PointsPer10EUR,
    ];

    if (pointFields.some((value) => !Number.isInteger(value) || value < 0)) {
      throw new ApiError(400, "Point values must be non-negative integers.");
    }

    if (!Number.isInteger(input.maxReferralLevel) || input.maxReferralLevel < 1 || input.maxReferralLevel > 3) {
      throw new ApiError(400, "Maximum referral point level must be between 1 and 3.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.referralPointSettings.upsert({
        where: { id: POINT_SETTINGS_ID },
        update: {},
        create: { id: POINT_SETTINGS_ID },
      });

      const result = await tx.referralPointSettings.update({
        where: { id: POINT_SETTINGS_ID },
        data: {
          purchaserPointsPer10EUR: input.purchaserPointsPer10EUR,
          level1PointsPer10EUR: input.level1PointsPer10EUR,
          level2PointsPer10EUR: input.level2PointsPer10EUR,
          level3PointsPer10EUR: input.level3PointsPer10EUR,
          maxReferralLevel: input.maxReferralLevel,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: "USER",
          action: "REFERRAL_POINT_SETTINGS_UPDATED",
          entityType: "referral_point_settings",
          entityId: POINT_SETTINGS_ID,
          metadata: { ...input },
        },
      });

      return result;
    });

    return {
      id: updated.id,
      purchaserPointsPer10EUR: updated.purchaserPointsPer10EUR,
      level1PointsPer10EUR: updated.level1PointsPer10EUR,
      level2PointsPer10EUR: updated.level2PointsPer10EUR,
      level3PointsPer10EUR: updated.level3PointsPer10EUR,
      maxReferralLevel: updated.maxReferralLevel,
      updatedAt: updated.updatedAt,
    };
  }

  public async listPointRewards(query: {
    page: number;
    pageSize: number;
    purchaserUserId?: string;
    beneficiaryUserId?: string;
    level?: number;
    status?: MultiLevelReferralPointStatus;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.MultiLevelReferralPointRewardWhereInput = {};

    if (query.purchaserUserId) {
      where.purchaserUserId = query.purchaserUserId;
    }

    if (query.beneficiaryUserId) {
      where.beneficiaryUserId = query.beneficiaryUserId;
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
      prisma.multiLevelReferralPointReward.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          order: { select: { id: true, orderNumber: true } },
          purchaserUser: { select: { id: true, email: true, fullName: true } },
          beneficiaryUser: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.multiLevelReferralPointReward.count({ where }),
    ]);

    return {
      items: items.map((reward) => ({
        id: reward.id,
        orderId: reward.orderId,
        orderNumber: reward.order.orderNumber,
        purchaserUserId: reward.purchaserUserId,
        purchaserEmail: reward.purchaserUser.email,
        beneficiaryUserId: reward.beneficiaryUserId,
        beneficiaryEmail: reward.beneficiaryUser.email,
        referralLevel: reward.referralLevel,
        pointsPer10EUR: reward.pointsPer10EUR,
        eligibleProductAmount: money(reward.eligibleProductAmount),
        pointsAwarded: reward.pointsAwarded,
        status: reward.status,
        createdAt: reward.createdAt,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  public async getAdminReferralOverview() {
    const [usersWithCodes, directReferrals, levelRows, pointRows, commissionRows] = await Promise.all([
      prisma.user.count({ where: { referralCode: { not: "" } } }),
      prisma.referralRelationship.count({ where: { status: ReferralRelationshipStatus.ACTIVE } }),
      prisma.referralClosure.groupBy({
        by: ["depth"],
        where: { depth: { in: [1, 2, 3] } },
        _count: { _all: true },
      }),
      prisma.multiLevelReferralPointReward.groupBy({
        by: ["referralLevel"],
        where: { status: MultiLevelReferralPointStatus.AWARDED },
        _sum: { pointsAwarded: true },
      }),
      prisma.referralCommission.groupBy({
        by: ["referralLevel"],
        where: { status: ReferralCommissionStatus.AWARDED },
        _sum: { commissionAmount: true },
      }),
    ]);

    const levelCounts = new Map(levelRows.map((row) => [row.depth, row._count._all]));
    const pointTotals = new Map(pointRows.map((row) => [row.referralLevel, row._sum.pointsAwarded ?? 0]));
    const commissionTotals = new Map(commissionRows.map((row) => [row.referralLevel, row._sum.commissionAmount ?? 0]));

    const purchaserPoints = pointTotals.get(0) ?? 0;
    const level1Points = pointTotals.get(1) ?? 0;
    const level2Points = pointTotals.get(2) ?? 0;
    const level3Points = pointTotals.get(3) ?? 0;
    const totalReferralPoints = level1Points + level2Points + level3Points;

    const level1Commission = new Prisma.Decimal(commissionTotals.get(1) ?? 0);
    const level2Commission = new Prisma.Decimal(commissionTotals.get(2) ?? 0);
    const totalCommission = level1Commission.add(level2Commission);

    return {
      referrals: {
        totalUsersWithReferralCodes: usersWithCodes,
        totalDirectReferrals: directReferrals,
        level1: levelCounts.get(1) ?? 0,
        level2: levelCounts.get(2) ?? 0,
        level3: levelCounts.get(3) ?? 0,
      },
      points: {
        purchaserPoints,
        level1Points,
        level2Points,
        level3Points,
        totalReferralPoints,
      },
      commission: {
        level1Commission: money(level1Commission),
        level2Commission: money(level2Commission),
        totalCommission: money(totalCommission),
      },
    };
  }
}

export const referralAdminService = new ReferralAdminService();
