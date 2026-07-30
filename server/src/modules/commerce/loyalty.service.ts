import {
  LoyaltyOrderAwardStatus,
  LoyaltyRedemptionStatus,
  LoyaltyRewardType,
  LoyaltyTransactionType,
  Prisma,
  type LoyaltyMembershipLevel,
  type LoyaltyPointRule,
  type LoyaltyReward,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { couponService } from "./coupon.service.js";

const DEFAULT_LEVELS = [
  {
    title: "Bronze",
    slug: "bronze",
    minPoints: 0,
    color: "#B08D57",
    icon: "medal",
    benefits: ["Access to member rewards", "Earn points on completed orders"],
    sortOrder: 0,
  },
  {
    title: "Silver",
    slug: "silver",
    minPoints: 250,
    color: "#C0C0C0",
    icon: "shield",
    benefits: ["Priority reward unlocks", "Early access to selected drops"],
    sortOrder: 1,
  },
  {
    title: "Gold",
    slug: "gold",
    minPoints: 750,
    color: "#D4AF37",
    icon: "crown",
    benefits: ["Premium reward selection", "Higher-value member-only perks"],
    sortOrder: 2,
  },
  {
    title: "Platinum",
    slug: "platinum",
    minPoints: 1500,
    color: "#7D8CA3",
    icon: "gem",
    benefits: ["Top-tier loyalty status", "Exclusive seasonal rewards"],
    sortOrder: 3,
  },
  {
    title: "Diamond",
    slug: "diamond",
    minPoints: 3000,
    color: "#7FDBFF",
    icon: "sparkles",
    benefits: ["Highest membership tier", "Elite access to premium rewards"],
    sortOrder: 4,
  },
];

const DEFAULT_POINT_RULE = {
  name: "Default Order Points",
  spendAmount: new Prisma.Decimal(1),
  pointsAwarded: 1,
  currency: "EUR",
  isActive: true,
  isDefault: true,
  notes: "1 point is awarded for every 1 EUR on completed orders.",
};

const LOYALTY_RECONCILE_ORDER_STATUSES = ["DELIVERED", "CANCELLED", "REFUNDED"] as const;

export type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

export function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (!value) {
    return null;
  }

  return Number(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function calculatePoints(orderAmount: number, rule: { spendAmount: Prisma.Decimal; pointsAwarded: number }): number {
  const spendAmount = Number(rule.spendAmount);

  if (!(orderAmount > 0) || !(spendAmount > 0) || !(rule.pointsAwarded > 0)) {
    return 0;
  }

  return Math.floor(orderAmount / spendAmount) * rule.pointsAwarded;
}

function mapLevel(level: LoyaltyMembershipLevel) {
  return {
    id: level.id,
    title: level.title,
    slug: level.slug,
    minPoints: level.minPoints,
    color: level.color,
    icon: level.icon,
    benefits: toStringArray(level.benefits),
    sortOrder: level.sortOrder,
    isActive: level.isActive,
    createdAt: level.createdAt,
    updatedAt: level.updatedAt,
  };
}

function mapPointRule(rule: LoyaltyPointRule) {
  return {
    id: rule.id,
    name: rule.name,
    spendAmount: toNumber(rule.spendAmount) ?? 0,
    pointsAwarded: rule.pointsAwarded,
    currency: rule.currency,
    isActive: rule.isActive,
    isDefault: rule.isDefault,
    notes: rule.notes,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function mapReward(
  reward: LoyaltyReward & {
    minMembershipLevel?: LoyaltyMembershipLevel | null;
    couponTemplate?: { id: string; code: string; description: string | null } | null;
    _count?: { redemptions: number };
  },
) {
  return {
    id: reward.id,
    title: reward.title,
    slug: reward.slug,
    description: reward.description,
    pointsCost: reward.pointsCost,
    rewardType: reward.rewardType,
    startsAt: reward.startsAt,
    endsAt: reward.endsAt,
    color: reward.color,
    icon: reward.icon,
    benefits: toStringArray(reward.benefits),
    stockLimit: reward.stockLimit,
    usageLimit: reward.stockLimit,
    isActive: reward.isActive,
    sortOrder: reward.sortOrder,
    minMembershipLevelId: reward.minMembershipLevelId,
    minMembershipLevel: reward.minMembershipLevel ? mapLevel(reward.minMembershipLevel) : null,
    couponTemplateId: reward.couponTemplateId,
    couponTemplate: reward.couponTemplate
      ? {
          id: reward.couponTemplate.id,
          code: reward.couponTemplate.code,
          description: reward.couponTemplate.description,
        }
      : null,
    couponPercentage: toNumber(reward.couponPercentage),
    couponFixedAmount: toNumber(reward.couponFixedAmount),
    couponMinimumOrderAmount: toNumber(reward.couponMinimumOrderAmount),
    couponMaximumDiscountAmount: toNumber(reward.couponMaximumDiscountAmount),
    couponDurationDays: reward.couponDurationDays,
    couponCodePrefix: reward.couponCodePrefix,
    redemptionCount: reward._count?.redemptions ?? 0,
    createdAt: reward.createdAt,
    updatedAt: reward.updatedAt,
  };
}

function mapTransaction(
  transaction: {
    id: string;
    type: LoyaltyTransactionType;
    pointsDelta: number;
    balanceAfter: number;
    description: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    order?: { id: string; orderNumber: string } | null;
    reward?: { id: string; title: string } | null;
    user?: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null } | null;
    actorUser?: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null } | null;
  },
) {
  const buildName = (
    user: { fullName: string | null; firstName: string | null; lastName: string | null; email: string } | null | undefined,
  ) => {
    if (!user) {
      return null;
    }

    return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  };

  return {
    id: transaction.id,
    type: transaction.type,
    pointsDelta: transaction.pointsDelta,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    metadata: transaction.metadata ?? null,
    createdAt: transaction.createdAt,
    order: transaction.order
      ? {
          id: transaction.order.id,
          orderNumber: transaction.order.orderNumber,
        }
      : null,
    reward: transaction.reward
      ? {
          id: transaction.reward.id,
          title: transaction.reward.title,
        }
      : null,
    user: transaction.user
      ? {
          id: transaction.user.id,
          email: transaction.user.email,
          name: buildName(transaction.user),
        }
      : null,
    actorUser: transaction.actorUser
      ? {
          id: transaction.actorUser.id,
          email: transaction.actorUser.email,
          name: buildName(transaction.actorUser),
        }
      : null,
  };
}

function mapIssuedCoupon(
  coupon: {
    id: string;
    code: string;
    description: string | null;
    discountType: string;
    percentage: Prisma.Decimal | null;
    fixedAmount: Prisma.Decimal | null;
    freeShipping: boolean;
    minimumOrderAmount: Prisma.Decimal | null;
    maximumDiscountAmount: Prisma.Decimal | null;
    startsAt: Date | null;
    endsAt: Date | null;
    status: string;
    createdAt: Date;
    sourceReward?: { id: string; title: string } | null;
    _count?: { orderApplications: number };
    usageCount?: number;
    usageCountByUser?: number;
    isUsedByCustomer?: boolean;
    isAvailableToCustomer?: boolean;
    assignmentSource?: string;
  },
) {
  const usageCount = coupon.usageCount ?? coupon._count?.orderApplications ?? 0;
  const usageCountByUser = coupon.usageCountByUser ?? usageCount;
  const isUsedByCustomer = coupon.isUsedByCustomer ?? usageCountByUser > 0;

  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    percentage: toNumber(coupon.percentage),
    fixedAmount: toNumber(coupon.fixedAmount),
    freeShipping: coupon.freeShipping,
    minimumOrderAmount: toNumber(coupon.minimumOrderAmount),
    maximumDiscountAmount: toNumber(coupon.maximumDiscountAmount),
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    status: coupon.status,
    usageCount,
    usageCountByUser,
    isUsed: isUsedByCustomer,
    isUsedByCustomer,
    isAvailableToCustomer: coupon.isAvailableToCustomer ?? !isUsedByCustomer,
    assignmentSource: coupon.assignmentSource ?? "REWARD",
    sourceReward: coupon.sourceReward
      ? {
          id: coupon.sourceReward.id,
          title: coupon.sourceReward.title,
        }
      : null,
    createdAt: coupon.createdAt,
  };
}

async function ensureBootstrap(executor: PrismaExecutor = prisma) {
  const [ruleCount, levelCount] = await Promise.all([
    executor.loyaltyPointRule.count(),
    executor.loyaltyMembershipLevel.count(),
  ]);

  if (ruleCount === 0) {
    await executor.loyaltyPointRule.create({
      data: DEFAULT_POINT_RULE,
    });
  }

  if (levelCount === 0) {
    await executor.loyaltyMembershipLevel.createMany({
      data: DEFAULT_LEVELS.map((level) => ({
        ...level,
        benefits: level.benefits,
      })),
    });
  }
}

async function getActiveLevels(executor: PrismaExecutor) {
  return executor.loyaltyMembershipLevel.findMany({
    where: { isActive: true },
    orderBy: [{ minPoints: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function synchronizeEligibleOrderPoints(
  executor: PrismaExecutor,
  filter?: {
    userId?: string;
  },
) {
  const eligibleOrders = await executor.order.findMany({
    where: {
      ...(filter?.userId ? { userId: filter.userId } : {}),
      status: {
        in: [...LOYALTY_RECONCILE_ORDER_STATUSES],
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  for (const order of eligibleOrders) {
    await loyaltyService.reconcileOrderPoints(order.id);
  }
}

function resolveMembershipLevel(levels: LoyaltyMembershipLevel[], currentPoints: number) {
  let resolved = levels[0] ?? null;

  for (const level of levels) {
    if (currentPoints >= level.minPoints) {
      resolved = level;
    }
  }

  return resolved;
}

function resolveNextMembershipLevel(levels: LoyaltyMembershipLevel[], currentPoints: number) {
  return levels.find((level) => level.minPoints > currentPoints) ?? null;
}

async function syncMembershipLevel(
  executor: PrismaExecutor,
  accountId: string,
  currentPoints: number,
): Promise<LoyaltyMembershipLevel | null> {
  const levels = await getActiveLevels(executor);
  const currentLevel = resolveMembershipLevel(levels, currentPoints);

  await executor.loyaltyAccount.update({
    where: { id: accountId },
    data: {
      membershipLevelId: currentLevel?.id ?? null,
    },
  });

  return currentLevel;
}

export async function getOrCreateAccount(executor: PrismaExecutor, userId: string) {
  const created = await executor.loyaltyAccount.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
    },
  });

  await syncMembershipLevel(executor, created.id, created.currentPoints);

  return executor.loyaltyAccount.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      membershipLevel: true,
    },
  });
}

export async function getDefaultRule(executor: PrismaExecutor) {
  return executor.loyaltyPointRule.findFirst({
    where: {
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function applyPointsDelta(
  executor: PrismaExecutor,
  input: {
    userId: string;
    pointsDelta: number;
    type: LoyaltyTransactionType;
    description: string;
    orderId?: string | null;
    rewardId?: string | null;
    redemptionId?: string | null;
    referralRewardId?: string | null;
    actorUserId?: string | null;
    metadata?: Prisma.JsonValue;
  },
) {
  const account = await getOrCreateAccount(executor, input.userId);
  const nextCurrentPoints = account.currentPoints + input.pointsDelta;
  const nextTotalEarned = input.pointsDelta > 0 ? account.totalEarnedPoints + input.pointsDelta : account.totalEarnedPoints;
  const nextTotalSpent =
    input.pointsDelta < 0 ? account.totalSpentPoints + Math.abs(input.pointsDelta) : account.totalSpentPoints;

  await executor.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      currentPoints: nextCurrentPoints,
      totalEarnedPoints: nextTotalEarned,
      totalSpentPoints: nextTotalSpent,
    },
  });

  await syncMembershipLevel(executor, account.id, nextCurrentPoints);

  return executor.loyaltyPointTransaction.create({
    data: {
      accountId: account.id,
      userId: input.userId,
      orderId: input.orderId ?? null,
      rewardId: input.rewardId ?? null,
      redemptionId: input.redemptionId ?? null,
      referralRewardId: input.referralRewardId ?? null,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      pointsDelta: input.pointsDelta,
      balanceAfter: nextCurrentPoints,
      description: input.description,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

function canAccessReward(
  reward: LoyaltyReward & { minMembershipLevel?: LoyaltyMembershipLevel | null },
  accountPoints: number,
  currentLevel: LoyaltyMembershipLevel | null,
  redemptionCount: number,
) {
  const now = new Date();
  const meetsPoints = accountPoints >= reward.pointsCost;
  const meetsLevel =
    !reward.minMembershipLevel ||
    Boolean(currentLevel && currentLevel.minPoints >= reward.minMembershipLevel.minPoints);
  const isWithinSchedule =
    (!reward.startsAt || reward.startsAt <= now) && (!reward.endsAt || reward.endsAt >= now);
  const hasRemainingUsage =
    reward.stockLimit === null || redemptionCount < reward.stockLimit;
  const isRewardAvailable = reward.isActive && isWithinSchedule && hasRemainingUsage;

  return {
    isUnlocked: meetsLevel,
    isRedeemable: meetsLevel && meetsPoints && isRewardAvailable,
    isRewardAvailable,
  };
}

export class LoyaltyService {
  public async getAdminOverview() {
    await ensureBootstrap();
    await synchronizeEligibleOrderPoints(prisma);

    const [rules, levels, rewards, accountsAggregate, recentTransactions] = await Promise.all([
      prisma.loyaltyPointRule.findMany({
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
      prisma.loyaltyMembershipLevel.findMany({
        orderBy: [{ minPoints: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.loyaltyReward.findMany({
        include: {
          minMembershipLevel: true,
          couponTemplate: {
            select: {
              id: true,
              code: true,
              description: true,
            },
          },
          _count: {
            select: { redemptions: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.loyaltyAccount.aggregate({
        _count: { id: true },
        _sum: {
          currentPoints: true,
          totalEarnedPoints: true,
          totalSpentPoints: true,
        },
      }),
      prisma.loyaltyPointTransaction.findMany({
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
          actorUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return {
      summary: {
        totalAccounts: accountsAggregate._count.id,
        totalCurrentPoints: accountsAggregate._sum.currentPoints ?? 0,
        totalEarnedPoints: accountsAggregate._sum.totalEarnedPoints ?? 0,
        totalSpentPoints: accountsAggregate._sum.totalSpentPoints ?? 0,
      },
      pointRules: rules.map(mapPointRule),
      membershipLevels: levels.map(mapLevel),
      rewards: rewards.map(mapReward),
      pointHistory: recentTransactions.map(mapTransaction),
    };
  }

  public async getCustomerRewards(userId: string) {
    await ensureBootstrap();
    await synchronizeEligibleOrderPoints(prisma, { userId });

    const [account, levels, rewards, transactions, redemptions, issuedRewardCoupons, assignedCoupons] = await Promise.all([
      getOrCreateAccount(prisma, userId),
      prisma.loyaltyMembershipLevel.findMany({
        where: { isActive: true },
        orderBy: [{ minPoints: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.loyaltyReward.findMany({
        where: { isActive: true },
        include: {
          minMembershipLevel: true,
          couponTemplate: {
            select: {
              id: true,
              code: true,
              description: true,
            },
          },
          _count: {
            select: { redemptions: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.loyaltyPointTransaction.findMany({
        where: { userId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
            },
          },
          actorUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.loyaltyRewardRedemption.findMany({
        where: { userId },
        include: {
          reward: {
            select: {
              id: true,
              title: true,
            },
          },
          issuedCoupon: {
            select: {
              id: true,
              code: true,
            },
          },
        },
        orderBy: { redeemedAt: "desc" },
        take: 50,
      }),
      prisma.coupon.findMany({
        where: {
          issuedToUserId: userId,
          isGeneratedRewardCoupon: true,
        },
        include: {
          sourceReward: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              orderApplications: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      couponService.getCustomerAssignedCoupons(userId),
    ]);

    const currentLevel =
      account.membershipLevel ??
      resolveMembershipLevel(levels, account.currentPoints);
    const nextLevel = resolveNextMembershipLevel(levels, account.currentPoints);
    const progressBase = currentLevel?.minPoints ?? 0;
    const progressTarget = nextLevel?.minPoints ?? progressBase;
    const progressPercent =
      progressTarget > progressBase
        ? Math.max(0, Math.min(100, ((account.currentPoints - progressBase) / (progressTarget - progressBase)) * 100))
        : 100;

    const issuedCoupons = [
      ...issuedRewardCoupons.map((coupon) =>
        mapIssuedCoupon({
          ...coupon,
          usageCountByUser: coupon._count?.orderApplications ?? 0,
          isUsedByCustomer: (coupon._count?.orderApplications ?? 0) > 0,
          isAvailableToCustomer: (coupon._count?.orderApplications ?? 0) === 0,
          assignmentSource: "REWARD",
        }),
      ),
      ...assignedCoupons.map((coupon) => mapIssuedCoupon(coupon)),
    ].filter((coupon, index, collection) => collection.findIndex((entry) => entry.id === coupon.id) === index);

    return {
      account: {
        id: account.id,
        currentPoints: account.currentPoints,
        totalEarnedPoints: account.totalEarnedPoints,
        totalSpentPoints: account.totalSpentPoints,
        membershipLevel: currentLevel ? mapLevel(currentLevel) : null,
      },
      progress: {
        nextLevel: nextLevel ? mapLevel(nextLevel) : null,
        percent: progressPercent,
        pointsToNextLevel: nextLevel ? Math.max(0, nextLevel.minPoints - account.currentPoints) : 0,
      },
      membershipLevels: levels.map(mapLevel),
      rewards: rewards.map((reward) => {
        const access = canAccessReward(
          reward,
          account.currentPoints,
          currentLevel,
          reward._count?.redemptions ?? 0,
        );
        return {
          ...mapReward(reward),
          ...access,
        };
      }),
      history: transactions.map(mapTransaction),
      redemptions: redemptions.map((redemption) => ({
        id: redemption.id,
        pointsSpent: redemption.pointsSpent,
        status: redemption.status,
        notes: redemption.notes,
        redeemedAt: redemption.redeemedAt,
        cancelledAt: redemption.cancelledAt,
        reward: redemption.reward,
        issuedCoupon: redemption.issuedCoupon,
      })),
      issuedCoupons,
    };
  }

  public async createPointRule(input: {
    name: string;
    spendAmount: number;
    pointsAwarded: number;
    currency?: string;
    isActive?: boolean;
    isDefault?: boolean;
    notes?: string | null;
  }) {
    await ensureBootstrap();

    return mapPointRule(
      await prisma.$transaction(async (transaction) => {
        if (input.isDefault) {
          await transaction.loyaltyPointRule.updateMany({
            data: { isDefault: false },
            where: { isDefault: true },
          });
        }

        return transaction.loyaltyPointRule.create({
          data: {
            name: input.name,
            spendAmount: new Prisma.Decimal(input.spendAmount),
            pointsAwarded: input.pointsAwarded,
            currency: input.currency ?? "EUR",
            isActive: input.isActive ?? true,
            isDefault: input.isDefault ?? false,
            notes: input.notes ?? null,
          },
        });
      }),
    );
  }

  public async updatePointRule(
    id: string,
    input: Partial<{
      name: string;
      spendAmount: number;
      pointsAwarded: number;
      currency: string;
      isActive: boolean;
      isDefault: boolean;
      notes: string | null;
    }>,
  ) {
    await ensureBootstrap();

    const existing = await prisma.loyaltyPointRule.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Point rule not found.");
    }

    return mapPointRule(
      await prisma.$transaction(async (transaction) => {
        if (input.isDefault) {
          await transaction.loyaltyPointRule.updateMany({
            data: { isDefault: false },
            where: { isDefault: true },
          });
        }

        return transaction.loyaltyPointRule.update({
          where: { id },
          data: {
            name: input.name,
            spendAmount: input.spendAmount !== undefined ? new Prisma.Decimal(input.spendAmount) : undefined,
            pointsAwarded: input.pointsAwarded,
            currency: input.currency,
            isActive: input.isActive,
            isDefault: input.isDefault,
            notes: input.notes,
          },
        });
      }),
    );
  }

  public async deletePointRule(id: string) {
    const [existing, awardsCount] = await Promise.all([
      prisma.loyaltyPointRule.findUnique({ where: { id } }),
      prisma.loyaltyOrderPointAward.count({ where: { pointRuleId: id } }),
    ]);

    if (!existing) {
      throw new ApiError(404, "Point rule not found.");
    }

    if (awardsCount > 0) {
      throw new ApiError(400, "This point rule has been used by completed orders and cannot be deleted.");
    }

    await prisma.loyaltyPointRule.delete({ where: { id } });
  }

  public async createMembershipLevel(input: {
    title: string;
    minPoints: number;
    color?: string | null;
    icon?: string | null;
    benefits?: string[];
    sortOrder?: number;
    isActive?: boolean;
  }) {
    await ensureBootstrap();

    const created = await prisma.loyaltyMembershipLevel.create({
      data: {
        title: input.title,
        slug: slugify(input.title),
        minPoints: input.minPoints,
        color: input.color ?? "#B08D57",
        icon: input.icon ?? null,
        benefits: input.benefits ?? [],
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });

    await this.recalculateMembershipLevels();

    return mapLevel(created);
  }

  public async updateMembershipLevel(
    id: string,
    input: Partial<{
      title: string;
      minPoints: number;
      color: string | null;
      icon: string | null;
      benefits: string[];
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const existing = await prisma.loyaltyMembershipLevel.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Membership level not found.");
    }

    const updated = await prisma.loyaltyMembershipLevel.update({
      where: { id },
      data: {
        title: input.title,
        slug: input.title ? slugify(input.title) : undefined,
        minPoints: input.minPoints,
        color: input.color ?? undefined,
        icon: input.icon !== undefined ? input.icon : undefined,
        benefits: input.benefits ?? undefined,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });

    await this.recalculateMembershipLevels();

    return mapLevel(updated);
  }

  public async deleteMembershipLevel(id: string) {
    const [existing, accountsCount, rewardsCount] = await Promise.all([
      prisma.loyaltyMembershipLevel.findUnique({ where: { id } }),
      prisma.loyaltyAccount.count({ where: { membershipLevelId: id } }),
      prisma.loyaltyReward.count({ where: { minMembershipLevelId: id } }),
    ]);

    if (!existing) {
      throw new ApiError(404, "Membership level not found.");
    }

    if (accountsCount > 0 || rewardsCount > 0) {
      throw new ApiError(400, "This membership level is in use and cannot be deleted.");
    }

    await prisma.loyaltyMembershipLevel.delete({ where: { id } });
  }

  public async createReward(input: {
    title: string;
    description?: string | null;
    pointsCost: number;
    rewardType: LoyaltyRewardType;
    startsAt?: string | null;
    endsAt?: string | null;
    minMembershipLevelId?: string | null;
    couponTemplateId?: string | null;
    couponPercentage?: number | null;
    couponFixedAmount?: number | null;
    couponMinimumOrderAmount?: number | null;
    couponMaximumDiscountAmount?: number | null;
    couponDurationDays?: number | null;
    couponCodePrefix?: string | null;
    color?: string | null;
    icon?: string | null;
    benefits?: string[];
    stockLimit?: number | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const created = await prisma.loyaltyReward.create({
      data: {
        title: input.title,
        slug: slugify(`${input.title}-${Date.now()}`),
        description: input.description ?? null,
        pointsCost: input.pointsCost,
        rewardType: input.rewardType,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        minMembershipLevelId: input.minMembershipLevelId ?? null,
        couponTemplateId: input.couponTemplateId ?? null,
        couponPercentage:
          input.couponPercentage !== null && input.couponPercentage !== undefined
            ? new Prisma.Decimal(input.couponPercentage)
            : null,
        couponFixedAmount:
          input.couponFixedAmount !== null && input.couponFixedAmount !== undefined
            ? new Prisma.Decimal(input.couponFixedAmount)
            : null,
        couponMinimumOrderAmount:
          input.couponMinimumOrderAmount !== null && input.couponMinimumOrderAmount !== undefined
            ? new Prisma.Decimal(input.couponMinimumOrderAmount)
            : null,
        couponMaximumDiscountAmount:
          input.couponMaximumDiscountAmount !== null && input.couponMaximumDiscountAmount !== undefined
            ? new Prisma.Decimal(input.couponMaximumDiscountAmount)
            : null,
        couponDurationDays: input.couponDurationDays ?? null,
        couponCodePrefix: input.couponCodePrefix ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        benefits: input.benefits ?? [],
        stockLimit: input.stockLimit ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      include: {
        minMembershipLevel: true,
        couponTemplate: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return mapReward(created);
  }

  public async updateReward(
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      pointsCost: number;
      rewardType: LoyaltyRewardType;
      startsAt: string | null;
      endsAt: string | null;
      minMembershipLevelId: string | null;
      couponTemplateId: string | null;
      couponPercentage: number | null;
      couponFixedAmount: number | null;
      couponMinimumOrderAmount: number | null;
      couponMaximumDiscountAmount: number | null;
      couponDurationDays: number | null;
      couponCodePrefix: string | null;
      color: string | null;
      icon: string | null;
      benefits: string[];
      stockLimit: number | null;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    const existing = await prisma.loyaltyReward.findUnique({ where: { id } });

    if (!existing) {
      throw new ApiError(404, "Reward not found.");
    }

    const updated = await prisma.loyaltyReward.update({
      where: { id },
      data: {
        title: input.title,
        slug: input.title ? slugify(input.title) : undefined,
        description: input.description,
        pointsCost: input.pointsCost,
        rewardType: input.rewardType,
        startsAt:
          input.startsAt === undefined
            ? undefined
            : input.startsAt === null
              ? null
              : new Date(input.startsAt),
        endsAt:
          input.endsAt === undefined
            ? undefined
            : input.endsAt === null
              ? null
              : new Date(input.endsAt),
        minMembershipLevelId: input.minMembershipLevelId,
        couponTemplateId: input.couponTemplateId,
        couponPercentage:
          input.couponPercentage === undefined
            ? undefined
            : input.couponPercentage === null
              ? null
              : new Prisma.Decimal(input.couponPercentage),
        couponFixedAmount:
          input.couponFixedAmount === undefined
            ? undefined
            : input.couponFixedAmount === null
              ? null
              : new Prisma.Decimal(input.couponFixedAmount),
        couponMinimumOrderAmount:
          input.couponMinimumOrderAmount === undefined
            ? undefined
            : input.couponMinimumOrderAmount === null
              ? null
              : new Prisma.Decimal(input.couponMinimumOrderAmount),
        couponMaximumDiscountAmount:
          input.couponMaximumDiscountAmount === undefined
            ? undefined
            : input.couponMaximumDiscountAmount === null
              ? null
              : new Prisma.Decimal(input.couponMaximumDiscountAmount),
        couponDurationDays: input.couponDurationDays,
        couponCodePrefix: input.couponCodePrefix,
        color: input.color,
        icon: input.icon,
        benefits: input.benefits ?? undefined,
        stockLimit: input.stockLimit,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
      include: {
        minMembershipLevel: true,
        couponTemplate: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return mapReward(updated);
  }

  public async deleteReward(id: string) {
    const [existing, redemptionCount] = await Promise.all([
      prisma.loyaltyReward.findUnique({ where: { id } }),
      prisma.loyaltyRewardRedemption.count({ where: { rewardId: id } }),
    ]);

    if (!existing) {
      throw new ApiError(404, "Reward not found.");
    }

    if (redemptionCount > 0) {
      throw new ApiError(400, "This reward has already been redeemed and cannot be deleted.");
    }

    await prisma.loyaltyReward.delete({ where: { id } });
  }

  public async redeemReward(userId: string, rewardId: string) {
    return prisma.$transaction(async (transaction) => {
      await ensureBootstrap(transaction);

      const [account, reward, levels] = await Promise.all([
        getOrCreateAccount(transaction, userId),
        transaction.loyaltyReward.findUnique({
          where: { id: rewardId },
          include: {
            minMembershipLevel: true,
            couponTemplate: true,
            _count: {
              select: {
                redemptions: true,
              },
            },
          },
        }),
        getActiveLevels(transaction),
      ]);

      if (!reward || !reward.isActive) {
        throw new ApiError(404, "Reward not found.");
      }

      const currentLevel =
        account.membershipLevel ?? resolveMembershipLevel(levels, account.currentPoints);
      const access = canAccessReward(
        reward,
        account.currentPoints,
        currentLevel,
        reward._count?.redemptions ?? 0,
      );

      if (!access.isUnlocked) {
        throw new ApiError(400, "Your membership level does not unlock this reward yet.");
      }

      if (!access.isRedeemable) {
        throw new ApiError(400, "You do not have enough points to redeem this reward.");
      }

      if (!access.isRewardAvailable) {
        throw new ApiError(400, "This reward is no longer available.");
      }

      const redemption = await transaction.loyaltyRewardRedemption.create({
        data: {
          accountId: account.id,
          userId,
          rewardId,
          pointsSpent: reward.pointsCost,
          status: LoyaltyRedemptionStatus.REDEEMED,
          notes: `Redeemed reward ${reward.title}`,
        },
      });

      const issuedCoupon = await couponService.createIssuedCouponFromReward(transaction, {
        userId,
        reward,
        redemptionId: redemption.id,
      });

      await transaction.loyaltyRewardRedemption.update({
        where: { id: redemption.id },
        data: {
          notes: `Redeemed reward ${reward.title} -> coupon ${issuedCoupon.code}`,
          metadata: {
            issuedCouponId: issuedCoupon.id,
            issuedCouponCode: issuedCoupon.code,
          },
        },
      });

      await applyPointsDelta(transaction, {
        userId,
        rewardId,
        redemptionId: redemption.id,
        pointsDelta: -reward.pointsCost,
        type: LoyaltyTransactionType.REWARD_REDEMPTION,
        description: `Redeemed reward ${reward.title}`,
        metadata: {
          rewardTitle: reward.title,
          issuedCouponId: issuedCoupon.id,
          issuedCouponCode: issuedCoupon.code,
        },
      });

      return {
        redemption: {
          id: redemption.id,
          rewardId: redemption.rewardId,
          pointsSpent: redemption.pointsSpent,
          status: redemption.status,
          redeemedAt: redemption.redeemedAt,
        },
        coupon: {
          id: issuedCoupon.id,
          code: issuedCoupon.code,
          description: issuedCoupon.description,
          endsAt: issuedCoupon.endsAt,
        },
      };
    });
  }

  public async applyManualAdjustment(
    actorUserId: string,
    input: {
      userId: string;
      pointsDelta: number;
      reason: string;
    },
  ) {
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new ApiError(404, "Customer not found.");
    }

    const transaction = await prisma.$transaction(async (tx) =>
      applyPointsDelta(tx, {
        userId: input.userId,
        actorUserId,
        pointsDelta: input.pointsDelta,
        type: LoyaltyTransactionType.MANUAL_ADJUSTMENT,
        description: input.reason,
        metadata: {
          adjustmentReason: input.reason,
        },
      }),
    );

    return mapTransaction(transaction);
  }

  public async reconcileOrderPoints(orderId: string) {
    return prisma.$transaction(async (transaction) => {
      await ensureBootstrap(transaction);

      const order = await transaction.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
        },
      });

      if (!order) {
        throw new ApiError(404, "Order not found.");
      }

      const account = await getOrCreateAccount(transaction, order.userId);
      const existingAward = await transaction.loyaltyOrderPointAward.findUnique({
        where: { orderId },
      });

      if (order.status === "DELIVERED") {
        const defaultRule = await getDefaultRule(transaction);

        if (!defaultRule) {
          return null;
        }

        if (existingAward?.status === LoyaltyOrderAwardStatus.AWARDED) {
          return existingAward;
        }

        const awardedPoints =
          existingAward?.awardedPoints && existingAward.awardedPoints > 0
            ? existingAward.awardedPoints
            : calculatePoints(Number(order.totalAmount), defaultRule);

        if (awardedPoints <= 0) {
          return null;
        }

        await applyPointsDelta(transaction, {
          userId: order.userId,
          orderId: order.id,
          pointsDelta: awardedPoints,
          type: LoyaltyTransactionType.ORDER_EARN,
          description: `Points earned from completed order ${order.orderNumber}`,
          metadata: {
            orderNumber: order.orderNumber,
            ruleId: defaultRule.id,
            currency: order.currency,
            orderTotalAmount: toNumber(order.totalAmount),
          },
        });

        return transaction.loyaltyOrderPointAward.upsert({
          where: { orderId: order.id },
          update: {
            accountId: account.id,
            userId: order.userId,
            pointRuleId: defaultRule.id,
            awardedPoints,
            spendAmount: order.totalAmount,
            status: LoyaltyOrderAwardStatus.AWARDED,
            awardedAt: new Date(),
            reversedAt: null,
            metadata: {
              orderNumber: order.orderNumber,
              currency: order.currency,
            },
          },
          create: {
            orderId: order.id,
            accountId: account.id,
            userId: order.userId,
            pointRuleId: defaultRule.id,
            awardedPoints,
            spendAmount: order.totalAmount,
            status: LoyaltyOrderAwardStatus.AWARDED,
            awardedAt: new Date(),
            metadata: {
              orderNumber: order.orderNumber,
              currency: order.currency,
            },
          },
        });
      }

      if (
        (order.status === "CANCELLED" || order.status === "REFUNDED") &&
        existingAward &&
        existingAward.status === LoyaltyOrderAwardStatus.AWARDED &&
        existingAward.awardedPoints > 0
      ) {
        await applyPointsDelta(transaction, {
          userId: order.userId,
          orderId: order.id,
          pointsDelta: -existingAward.awardedPoints,
          type: LoyaltyTransactionType.ORDER_REVERSAL,
          description: `Points reversed for ${order.status.toLowerCase()} order ${order.orderNumber}`,
          metadata: {
            orderNumber: order.orderNumber,
            reversalReason: order.status,
          },
        });

        return transaction.loyaltyOrderPointAward.update({
          where: { orderId: order.id },
          data: {
            status: LoyaltyOrderAwardStatus.REVERSED,
            reversedAt: new Date(),
          },
        });
      }

      return existingAward;
    });
  }

  public async recalculateMembershipLevels() {
    await ensureBootstrap();

    const accounts = await prisma.loyaltyAccount.findMany({
      select: {
        id: true,
        currentPoints: true,
      },
    });

    await Promise.all(accounts.map((account) => syncMembershipLevel(prisma, account.id, account.currentPoints)));
  }
}

export const loyaltyService = new LoyaltyService();
