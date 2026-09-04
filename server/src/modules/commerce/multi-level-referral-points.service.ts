import {
  LoyaltyTransactionType,
  MultiLevelReferralPointStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { applyPointsDelta } from "./loyalty.service.js";
import {
  buildBeneficiaryPlan,
  buildRewardEventKey,
  computeReferralPoints,
  MULTI_LEVEL_REFERRAL_REWARD_TYPE,
  resolvePointsPer10Eur,
  resolveRewardAction,
} from "./multi-level-referral-points.logic.js";

const POINT_SETTINGS_ID = "default";

type PointSettingsRef = {
  purchaserPointsPer10EUR: number;
  level1PointsPer10EUR: number;
  level2PointsPer10EUR: number;
  level3PointsPer10EUR: number;
  maxReferralLevel: number;
};

function buildPointsPer10EurConfig(settings: PointSettingsRef): Record<number, number> {
  return {
    0: settings.purchaserPointsPer10EUR,
    1: settings.level1PointsPer10EUR,
    2: settings.level2PointsPer10EUR,
    3: settings.level3PointsPer10EUR,
  };
}

type OrderRef = {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
};

export class MultiLevelReferralPointsService {
  public async syncMultiLevelReferralPoints(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, userId: true, orderNumber: true, status: true },
      });

      if (!order) {
        throw new ApiError(404, "Order not found.");
      }

      const action = resolveRewardAction(order.status);
      if (action === "NONE") {
        return null;
      }

      if (action === "REVERSE") {
        return this.reversePoints(tx, order);
      }

      return this.awardPoints(tx, order);
    });
  }

  private async awardPoints(tx: Prisma.TransactionClient, order: OrderRef) {
    const itemAggregate = await tx.orderItem.aggregate({
      where: { orderId: order.id },
      _sum: { totalPrice: true },
    });

    const eligibleProductAmount = itemAggregate._sum.totalPrice ?? new Prisma.Decimal(0);
    if (eligibleProductAmount.lessThanOrEqualTo(0)) {
      return null;
    }

    await tx.referralPointSettings.upsert({
      where: { id: POINT_SETTINGS_ID },
      update: {},
      create: { id: POINT_SETTINGS_ID },
    });
    const pointSettings = await tx.referralPointSettings.findUniqueOrThrow({
      where: { id: POINT_SETTINGS_ID },
    });
    const pointsPer10EurByLevel = buildPointsPer10EurConfig(pointSettings);
    const maxReferralLevel = pointSettings.maxReferralLevel;

    const ancestors = await tx.referralClosure.findMany({
      where: {
        descendantUserId: order.userId,
        depth: { gt: 0, lte: maxReferralLevel },
      },
      orderBy: { depth: "asc" },
      select: { ancestorUserId: true, depth: true },
    });

    const plan = buildBeneficiaryPlan(order.userId, ancestors, maxReferralLevel);
    const created = [];

    for (const entry of plan) {
      const pointsPer10EUR = resolvePointsPer10Eur(entry.referralLevel, pointsPer10EurByLevel);
      if (pointsPer10EUR === null) {
        continue;
      }

      const pointsAwarded = computeReferralPoints(eligibleProductAmount, pointsPer10EUR);
      if (pointsAwarded <= 0) {
        continue;
      }

      const eventKey = buildRewardEventKey({
        orderId: order.id,
        beneficiaryUserId: entry.beneficiaryUserId,
        referralLevel: entry.referralLevel,
      });

      const existing = await tx.multiLevelReferralPointReward.findUnique({ where: { eventKey } });
      if (existing) {
        continue;
      }

      const reward = await tx.multiLevelReferralPointReward.create({
        data: {
          eventKey,
          orderId: order.id,
          purchaserUserId: order.userId,
          beneficiaryUserId: entry.beneficiaryUserId,
          referralLevel: entry.referralLevel,
          rewardType: MULTI_LEVEL_REFERRAL_REWARD_TYPE,
          eligibleProductAmount,
          pointsPer10EUR,
          pointsAwarded,
          status: MultiLevelReferralPointStatus.AWARDED,
          metadata: {
            orderNumber: order.orderNumber,
          },
        },
      });

      await applyPointsDelta(tx, {
        userId: entry.beneficiaryUserId,
        orderId: order.id,
        pointsDelta: pointsAwarded,
        type: LoyaltyTransactionType.MULTI_LEVEL_REFERRAL_REWARD,
        description: `Multi-level referral points (L${entry.referralLevel}) for order ${order.orderNumber}`,
        multiLevelReferralPointRewardId: reward.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          purchaserUserId: order.userId,
          beneficiaryUserId: entry.beneficiaryUserId,
          referralLevel: entry.referralLevel,
          eligibleProductAmount: eligibleProductAmount.toFixed(2),
          pointsPer10EUR,
          pointsAwarded,
          rewardId: reward.id,
        },
      });

      created.push(reward);
    }

    return created;
  }

  private async reversePoints(tx: Prisma.TransactionClient, order: OrderRef) {
    const rewards = await tx.multiLevelReferralPointReward.findMany({
      where: {
        orderId: order.id,
        status: MultiLevelReferralPointStatus.AWARDED,
      },
    });

    for (const reward of rewards) {
      await applyPointsDelta(tx, {
        userId: reward.beneficiaryUserId,
        orderId: order.id,
        pointsDelta: -reward.pointsAwarded,
        type: LoyaltyTransactionType.MULTI_LEVEL_REFERRAL_REVERSAL,
        description: `Multi-level referral points reversed for ${order.status.toLowerCase()} order ${order.orderNumber}`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          beneficiaryUserId: reward.beneficiaryUserId,
          purchaserUserId: reward.purchaserUserId,
          referralLevel: reward.referralLevel,
          pointsAwarded: reward.pointsAwarded,
          originalRewardId: reward.id,
          reversalReason: order.status,
        },
      });

      await tx.multiLevelReferralPointReward.update({
        where: { id: reward.id },
        data: {
          status: MultiLevelReferralPointStatus.REVERSED,
          reversedAt: new Date(),
        },
      });
    }

    return rewards;
  }
}

export const multiLevelReferralPointsService = new MultiLevelReferralPointsService();
