import {
  LoyaltyTransactionType,
  Prisma,
  ReferralRelationshipStatus,
  ReferralRewardStatus,
  ReferralRuleRewardType,
  ReferralTriggerType,
  RoleCode,
  UserStatus,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { generateUniqueReferralCode, normalizeReferralCode } from "../../utils/referral-code.js";
import {
  applyPointsDelta,
  calculatePoints,
  getDefaultRule,
  getOrCreateAccount,
  type PrismaExecutor,
  toNumber,
} from "./loyalty.service.js";

const ACTIVE_REFERRAL_REWARD_STATUSES = [ReferralRewardStatus.PENDING, ReferralRewardStatus.AWARDED];
const ORDER_PENDING_STATUSES = [
  "PENDING",
  "PAYMENT_APPROVED",
  "PAID",
  "PROCESSING",
  "PURCHASED_FROM_SUPPLIER",
  "SHIPPED",
] as const;

function buildUserDisplayName(user: {
  email: string;
  fullName: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function buildRelationshipNotes(channel: string, referrerCode: string) {
  return `Referral captured via ${channel.toLowerCase()} using code ${referrerCode}`;
}

function buildEventKey(input: {
  trigger: ReferralTriggerType;
  beneficiaryUserId: string;
  sourceUserId: string;
  ruleId: string;
  orderId?: string | null;
}) {
  return [
    "referral",
    input.trigger,
    input.orderId ?? "signup",
    input.beneficiaryUserId,
    input.sourceUserId,
    input.ruleId,
  ].join(":");
}

function resolveOrderTrigger(purchaseIndex: number) {
  return purchaseIndex <= 1 ? ReferralTriggerType.FIRST_ORDER : ReferralTriggerType.REPEAT_ORDER;
}

async function ensureReferralIdentity(executor: PrismaExecutor, userId: string) {
  const user = await executor.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      referralCode: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const referralCode =
    user.referralCode ||
    (await generateUniqueReferralCode(executor, {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
    }));

  if (!user.referralCode) {
    await executor.user.update({
      where: { id: user.id },
      data: {
        referralCode,
      },
    });
  }

  await executor.referralClosure.upsert({
    where: {
      ancestorUserId_descendantUserId: {
        ancestorUserId: user.id,
        descendantUserId: user.id,
      },
    },
    update: {
      depth: 0,
    },
    create: {
      ancestorUserId: user.id,
      descendantUserId: user.id,
      depth: 0,
    },
  });

  return {
    ...user,
    referralCode,
  };
}

async function rebuildReferralClosure(executor: PrismaExecutor) {
  const [users, relationships] = await Promise.all([
    executor.user.findMany({
      select: { id: true },
    }),
    executor.referralRelationship.findMany({
      where: { status: ReferralRelationshipStatus.ACTIVE },
      select: {
        referrerUserId: true,
        referredUserId: true,
      },
    }),
  ]);

  const parentByChild = new Map<string, string>();
  for (const relationship of relationships) {
    parentByChild.set(relationship.referredUserId, relationship.referrerUserId);
  }

  const closureRows: Array<{ ancestorUserId: string; descendantUserId: string; depth: number }> = [];

  for (const user of users) {
    closureRows.push({
      ancestorUserId: user.id,
      descendantUserId: user.id,
      depth: 0,
    });

    const visited = new Set<string>([user.id]);
    let currentUserId = user.id;
    let parentUserId = parentByChild.get(currentUserId);
    let depth = 1;

    while (parentUserId) {
      if (visited.has(parentUserId)) {
        throw new ApiError(400, "Referral loop detected.");
      }

      closureRows.push({
        ancestorUserId: parentUserId,
        descendantUserId: user.id,
        depth,
      });

      visited.add(parentUserId);
      currentUserId = parentUserId;
      parentUserId = parentByChild.get(currentUserId);
      depth += 1;
    }
  }

  await executor.referralClosure.deleteMany();
  if (closureRows.length > 0) {
    await executor.referralClosure.createMany({
      data: closureRows,
    });
  }
}

async function assertRelationshipIsValid(
  executor: PrismaExecutor,
  input: {
    referrerUserId: string;
    referredUserId: string;
    ignoreRelationshipId?: string | null;
  },
) {
  if (input.referrerUserId === input.referredUserId) {
    throw new ApiError(400, "Self referral is not allowed.");
  }

  const [referrer, referredUser, existingRelationship, loopEdge] = await Promise.all([
    executor.user.findFirst({
      where: {
        id: input.referrerUserId,
        role: { code: RoleCode.CUSTOMER },
        status: {
          not: UserStatus.DELETED,
        },
      },
      select: { id: true },
    }),
    executor.user.findFirst({
      where: {
        id: input.referredUserId,
        role: { code: RoleCode.CUSTOMER },
        status: {
          not: UserStatus.DELETED,
        },
      },
      select: { id: true },
    }),
    executor.referralRelationship.findUnique({
      where: {
        referredUserId: input.referredUserId,
      },
      select: {
        id: true,
        referrerUserId: true,
      },
    }),
    executor.referralClosure.findUnique({
      where: {
        ancestorUserId_descendantUserId: {
          ancestorUserId: input.referredUserId,
          descendantUserId: input.referrerUserId,
        },
      },
      select: {
        ancestorUserId: true,
      },
    }),
  ]);

  if (!referrer) {
    throw new ApiError(404, "Referrer customer was not found.");
  }

  if (!referredUser) {
    throw new ApiError(404, "Referred customer was not found.");
  }

  if (
    existingRelationship &&
    existingRelationship.id !== input.ignoreRelationshipId &&
    existingRelationship.referrerUserId !== input.referrerUserId
  ) {
    throw new ApiError(400, "This customer already has a direct referrer.");
  }

  if (loopEdge) {
    throw new ApiError(400, "This change would create a referral loop.");
  }
}

async function getActiveRules(
  executor: PrismaExecutor,
  trigger: ReferralTriggerType,
  eventTimestamp: Date,
) {
  return executor.referralRule.findMany({
    where: {
      trigger,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: eventTimestamp } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: eventTimestamp } }] }],
    },
    orderBy: [{ levelNumber: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function countDistinctRewardSourcesForRule(
  executor: PrismaExecutor,
  input: {
    beneficiaryUserId: string;
    ruleId: string;
    sourceUserId: string;
  },
) {
  const existingForSource = await executor.referralReward.findFirst({
    where: {
      beneficiaryUserId: input.beneficiaryUserId,
      ruleId: input.ruleId,
      sourceUserId: input.sourceUserId,
    },
    select: { id: true },
  });

  if (existingForSource) {
    return 0;
  }

  const grouped = await executor.referralReward.findMany({
    where: {
      beneficiaryUserId: input.beneficiaryUserId,
      ruleId: input.ruleId,
    },
    distinct: ["sourceUserId"],
    select: { sourceUserId: true },
  });

  return grouped.length;
}

async function sumActiveRulePoints(
  executor: PrismaExecutor,
  input: {
    beneficiaryUserId: string;
    ruleId: string;
  },
) {
  const aggregate = await executor.referralReward.aggregate({
    where: {
      beneficiaryUserId: input.beneficiaryUserId,
      ruleId: input.ruleId,
      status: {
        in: ACTIVE_REFERRAL_REWARD_STATUSES,
      },
    },
    _sum: {
      pointsAwarded: true,
    },
  });

  return aggregate._sum.pointsAwarded ?? 0;
}

function resolveRewardPoints(
  input: {
    rewardType: ReferralRuleRewardType;
    rewardValue: Prisma.Decimal;
  },
  basePoints: number,
) {
  if (input.rewardType === ReferralRuleRewardType.PERCENTAGE) {
    return Math.max(0, Math.floor((basePoints * Number(input.rewardValue)) / 100));
  }

  return Math.max(0, Math.floor(Number(input.rewardValue)));
}

async function buildRewardPayout(
  executor: PrismaExecutor,
  input: {
    beneficiaryUserId: string;
    sourceUserId: string;
    relationshipId: string | null;
    rule: {
      id: string;
      trigger: ReferralTriggerType;
      levelNumber: number;
      rewardType: ReferralRuleRewardType;
      rewardValue: Prisma.Decimal;
      minOrderAmount: Prisma.Decimal | null;
      maxRewardPoints: number | null;
      maxReferralCount: number | null;
      expiresInDays: number | null;
      name: string;
      description: string | null;
    };
    eventTimestamp: Date;
    order?: {
      id: string;
      orderNumber: string;
      totalAmount: Prisma.Decimal;
      createdAt: Date;
    } | null;
    relationshipCreatedAt?: Date | null;
    basePoints: number;
  },
) {
  if (
    input.rule.minOrderAmount &&
    input.order &&
    input.order.totalAmount.lessThan(input.rule.minOrderAmount)
  ) {
    return null;
  }

  if (
    input.rule.expiresInDays &&
    input.relationshipCreatedAt &&
    input.order &&
    input.order.createdAt >
      new Date(input.relationshipCreatedAt.getTime() + input.rule.expiresInDays * 24 * 60 * 60 * 1000)
  ) {
    return null;
  }

  if (input.rule.maxReferralCount) {
    const distinctSourceCount = await countDistinctRewardSourcesForRule(executor, {
      beneficiaryUserId: input.beneficiaryUserId,
      ruleId: input.rule.id,
      sourceUserId: input.sourceUserId,
    });

    if (distinctSourceCount >= input.rule.maxReferralCount) {
      return null;
    }
  }

  let pointsAwarded = resolveRewardPoints(
    {
      rewardType: input.rule.rewardType,
      rewardValue: input.rule.rewardValue,
    },
    input.basePoints,
  );

  if (pointsAwarded <= 0) {
    return null;
  }

  if (input.rule.maxRewardPoints) {
    const alreadyAllocated = await sumActiveRulePoints(executor, {
      beneficiaryUserId: input.beneficiaryUserId,
      ruleId: input.rule.id,
    });
    const remainingPoints = Math.max(0, input.rule.maxRewardPoints - alreadyAllocated);
    pointsAwarded = Math.min(pointsAwarded, remainingPoints);
    if (pointsAwarded <= 0) {
      return null;
    }
  }

  const title =
    input.rule.trigger === ReferralTriggerType.SIGNUP
      ? `Referral signup reward • L${input.rule.levelNumber}`
      : `Referral order reward • L${input.rule.levelNumber}`;

  const description =
    input.rule.trigger === ReferralTriggerType.SIGNUP
      ? `Signup reward from your level ${input.rule.levelNumber} referral network.`
      : `Order reward from your level ${input.rule.levelNumber} referral network.`;

  return {
    eventKey: buildEventKey({
      trigger: input.rule.trigger,
      beneficiaryUserId: input.beneficiaryUserId,
      sourceUserId: input.sourceUserId,
      ruleId: input.rule.id,
      orderId: input.order?.id ?? null,
    }),
    title,
    description,
    pointsAwarded,
    expiresAt:
      input.rule.expiresInDays && input.relationshipCreatedAt
        ? new Date(input.relationshipCreatedAt.getTime() + input.rule.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
  };
}

async function markRewardPending(
  executor: PrismaExecutor,
  input: {
    relationshipId: string | null;
    beneficiaryUserId: string;
    sourceUserId: string;
    orderId?: string | null;
    rule: {
      id: string;
      trigger: ReferralTriggerType;
      levelNumber: number;
      rewardType: ReferralRuleRewardType;
      rewardValue: Prisma.Decimal;
    };
    eventKey: string;
    title: string;
    description: string | null;
    pointsAwarded: number;
    basePoints: number;
    eventTimestamp: Date;
    expiresAt?: Date | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const existing = await executor.referralReward.findUnique({
    where: { eventKey: input.eventKey },
    include: {
      loyaltyTransaction: true,
    },
  });

  if (!existing) {
    return executor.referralReward.create({
      data: {
        relationshipId: input.relationshipId ?? null,
        ruleId: input.rule.id,
        beneficiaryUserId: input.beneficiaryUserId,
        sourceUserId: input.sourceUserId,
        orderId: input.orderId ?? null,
        eventKey: input.eventKey,
        trigger: input.rule.trigger,
        levelNumber: input.rule.levelNumber,
        rewardType: input.rule.rewardType,
        rewardValue: input.rule.rewardValue,
        basePoints: input.basePoints,
        pointsAwarded: input.pointsAwarded,
        status: ReferralRewardStatus.PENDING,
        title: input.title,
        description: input.description,
        metadata: input.metadata ?? Prisma.JsonNull,
        pendingAt: input.eventTimestamp,
        expiresAt: input.expiresAt ?? null,
      },
      include: {
        loyaltyTransaction: true,
      },
    });
  }

  return executor.referralReward.update({
    where: { id: existing.id },
    data: {
      relationshipId: input.relationshipId ?? undefined,
      ruleId: input.rule.id,
      rewardType: input.rule.rewardType,
      rewardValue: input.rule.rewardValue,
      levelNumber: input.rule.levelNumber,
      pointsAwarded: input.pointsAwarded,
      basePoints: input.basePoints,
      title: input.title,
      description: input.description,
      expiresAt: input.expiresAt ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
      status:
        existing.status === ReferralRewardStatus.AWARDED
          ? ReferralRewardStatus.AWARDED
          : ReferralRewardStatus.PENDING,
      pendingAt: existing.pendingAt ?? input.eventTimestamp,
      reversedAt:
        existing.status === ReferralRewardStatus.REVERSED ||
        existing.status === ReferralRewardStatus.CANCELLED
          ? existing.reversedAt
          : null,
    },
    include: {
      loyaltyTransaction: true,
    },
  });
}

async function awardReferralReward(
  executor: PrismaExecutor,
  reward: {
    id: string;
    beneficiaryUserId: string;
    orderId: string | null;
    pointsAwarded: number;
    title: string;
    description: string | null;
    status: ReferralRewardStatus;
    loyaltyTransaction?: { id: string } | null;
    sourceUser: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null };
  },
) {
  if (reward.pointsAwarded <= 0) {
    return reward;
  }

  if (reward.status === ReferralRewardStatus.AWARDED && reward.loyaltyTransaction) {
    return reward;
  }

  const sourceName = buildUserDisplayName(reward.sourceUser);
  const transaction = await applyPointsDelta(executor, {
    userId: reward.beneficiaryUserId,
    orderId: reward.orderId,
    referralRewardId: reward.id,
    pointsDelta: reward.pointsAwarded,
    type: LoyaltyTransactionType.REFERRAL_REWARD,
    description: reward.title,
    metadata: {
      sourceUserId: reward.sourceUser.id,
      sourceUserName: sourceName,
      referralRewardId: reward.id,
      reason: reward.description,
    },
  });

  return executor.referralReward.update({
    where: { id: reward.id },
    data: {
      status: ReferralRewardStatus.AWARDED,
      awardedAt: new Date(),
      metadata: {
        sourceUserId: reward.sourceUser.id,
        sourceUserName: sourceName,
        awardTransactionId: transaction.id,
      },
    },
    include: {
      loyaltyTransaction: true,
      sourceUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

async function reverseReferralReward(
  executor: PrismaExecutor,
  reward: {
    id: string;
    beneficiaryUserId: string;
    orderId: string | null;
    pointsAwarded: number;
    status: ReferralRewardStatus;
    loyaltyTransaction?: { id: string } | null;
  },
  reason: string,
) {
  if (
    reward.status === ReferralRewardStatus.REVERSED ||
    reward.status === ReferralRewardStatus.CANCELLED ||
    reward.pointsAwarded <= 0
  ) {
    return reward;
  }

  if (reward.status === ReferralRewardStatus.AWARDED && reward.loyaltyTransaction) {
    await applyPointsDelta(executor, {
      userId: reward.beneficiaryUserId,
      orderId: reward.orderId,
      pointsDelta: -reward.pointsAwarded,
      type: LoyaltyTransactionType.REFERRAL_REVERSAL,
      description: reason,
      metadata: {
        referralRewardId: reward.id,
        awardTransactionId: reward.loyaltyTransaction.id,
        reversalReason: reason,
      },
    });
  }

  return executor.referralReward.update({
    where: { id: reward.id },
    data: {
      status:
        reward.status === ReferralRewardStatus.PENDING
          ? ReferralRewardStatus.CANCELLED
          : ReferralRewardStatus.REVERSED,
      reversedAt: new Date(),
      metadata: {
        reversalReason: reason,
      },
    },
    include: {
      loyaltyTransaction: true,
    },
  });
}

function mapRule(rule: {
  id: string;
  name: string;
  description: string | null;
  trigger: ReferralTriggerType;
  levelNumber: number;
  rewardType: ReferralRuleRewardType;
  rewardValue: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxRewardPoints: number | null;
  maxReferralCount: number | null;
  expiresInDays: number | null;
  conditions: Prisma.JsonValue | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    trigger: rule.trigger,
    levelNumber: rule.levelNumber,
    rewardType: rule.rewardType,
    rewardValue: Number(rule.rewardValue),
    minOrderAmount: toNumber(rule.minOrderAmount),
    maxRewardPoints: rule.maxRewardPoints,
    maxReferralCount: rule.maxReferralCount,
    expiresInDays: rule.expiresInDays,
    conditions: rule.conditions ?? null,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    isActive: rule.isActive,
    sortOrder: rule.sortOrder,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function mapRewardRecord(reward: {
  id: string;
  trigger: ReferralTriggerType;
  levelNumber: number;
  title: string;
  description: string | null;
  pointsAwarded: number;
  basePoints: number | null;
  status: ReferralRewardStatus;
  pendingAt: Date | null;
  awardedAt: Date | null;
  reversedAt: Date | null;
  createdAt: Date;
  sourceUser: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null };
  beneficiaryUser?: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null } | null;
  order?: { id: string; orderNumber: string } | null;
  rule?: { id: string; name: string } | null;
}) {
  return {
    id: reward.id,
    trigger: reward.trigger,
    levelNumber: reward.levelNumber,
    title: reward.title,
    description: reward.description,
    pointsAwarded: reward.pointsAwarded,
    basePoints: reward.basePoints,
    status: reward.status,
    pendingAt: reward.pendingAt,
    awardedAt: reward.awardedAt,
    reversedAt: reward.reversedAt,
    createdAt: reward.createdAt,
    sourceUser: {
      id: reward.sourceUser.id,
      email: reward.sourceUser.email,
      name: buildUserDisplayName(reward.sourceUser),
    },
    beneficiaryUser: reward.beneficiaryUser
      ? {
          id: reward.beneficiaryUser.id,
          email: reward.beneficiaryUser.email,
          name: buildUserDisplayName(reward.beneficiaryUser),
        }
      : null,
    order: reward.order
      ? {
          id: reward.order.id,
          orderNumber: reward.order.orderNumber,
        }
      : null,
    rule: reward.rule
      ? {
          id: reward.rule.id,
          name: reward.rule.name,
        }
      : null,
  };
}

export class ReferralService {
  public async createUniqueReferralCode(
    executor: PrismaExecutor,
    input: {
      email: string;
      fullName?: string | null;
      userId?: string | null;
    },
  ) {
    return generateUniqueReferralCode(executor, {
      userId: input.userId ?? null,
      email: input.email,
      fullName: input.fullName ?? null,
    });
  }

  public async registerReferralForNewUser(
    executor: PrismaExecutor,
    input: {
      userId: string;
      referralCode?: string | null;
    },
  ) {
    await ensureReferralIdentity(executor, input.userId);

    const normalizedCode = normalizeReferralCode(input.referralCode);
    if (!normalizedCode) {
      return null;
    }

    const referrer = await executor.user.findFirst({
      where: {
        referralCode: normalizedCode,
        role: {
          code: RoleCode.CUSTOMER,
        },
        status: {
          not: UserStatus.DELETED,
        },
      },
      select: {
        id: true,
        referralCode: true,
      },
    });

    if (!referrer) {
      throw new ApiError(400, "Referral code is invalid.");
    }

    await assertRelationshipIsValid(executor, {
      referrerUserId: referrer.id,
      referredUserId: input.userId,
    });

    const relationship = await executor.referralRelationship.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: input.userId,
        referralCodeUsed: referrer.referralCode,
        sourceChannel: "REGISTER",
        status: ReferralRelationshipStatus.ACTIVE,
        notes: buildRelationshipNotes("REGISTER", referrer.referralCode),
      },
    });

    await rebuildReferralClosure(executor);
    await this.syncSignupRewardsForUser(executor, input.userId);

    return relationship;
  }

  public async syncSignupRewardsForUser(executor: PrismaExecutor, sourceUserId: string) {
    await ensureReferralIdentity(executor, sourceUserId);

    const [relationship, ancestors, rules, sourceUser] = await Promise.all([
      executor.referralRelationship.findUnique({
        where: { referredUserId: sourceUserId },
        select: {
          id: true,
          createdAt: true,
        },
      }),
      executor.referralClosure.findMany({
        where: {
          descendantUserId: sourceUserId,
          depth: {
            gt: 0,
          },
        },
        orderBy: {
          depth: "asc",
        },
        select: {
          ancestorUserId: true,
          depth: true,
        },
      }),
      getActiveRules(executor, ReferralTriggerType.SIGNUP, new Date()),
      executor.user.findUniqueOrThrow({
        where: { id: sourceUserId },
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
        },
      }),
    ]);

    if (!relationship || ancestors.length === 0 || rules.length === 0) {
      return [];
    }

    const ancestorByDepth = new Map<number, string>();
    for (const ancestor of ancestors) {
      ancestorByDepth.set(ancestor.depth, ancestor.ancestorUserId);
    }

    const issuedRewards = [];
    for (const rule of rules) {
      const beneficiaryUserId = ancestorByDepth.get(rule.levelNumber);
      if (!beneficiaryUserId) {
        continue;
      }

      const payout = await buildRewardPayout(executor, {
        beneficiaryUserId,
        sourceUserId,
        relationshipId: relationship.id,
        rule,
        eventTimestamp: new Date(),
        relationshipCreatedAt: relationship.createdAt,
        basePoints: 0,
      });

      if (!payout) {
        continue;
      }

      const pending = await markRewardPending(executor, {
        relationshipId: relationship.id,
        beneficiaryUserId,
        sourceUserId,
        rule,
        eventKey: payout.eventKey,
        title: payout.title,
        description: payout.description,
        pointsAwarded: payout.pointsAwarded,
        basePoints: 0,
        eventTimestamp: new Date(),
        expiresAt: payout.expiresAt,
        metadata: {
          sourceUserId,
          sourceUserName: buildUserDisplayName(sourceUser),
          trigger: ReferralTriggerType.SIGNUP,
        },
      });

      const awarded = await awardReferralReward(executor, {
        ...pending,
        sourceUser,
      });
      issuedRewards.push(awarded);
    }

    return issuedRewards;
  }

  public async syncOrderReferralRewards(orderId: string) {
    return prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      });

      if (!order) {
        throw new ApiError(404, "Order not found.");
      }

      await ensureReferralIdentity(transaction, order.userId);

      const relationship = await transaction.referralRelationship.findUnique({
        where: { referredUserId: order.userId },
        select: {
          id: true,
          createdAt: true,
        },
      });

      if (!relationship) {
        return [];
      }

      const [priorOrdersCount, defaultRule, ancestors, sourceUser] = await Promise.all([
        transaction.order.count({
          where: {
            userId: order.userId,
            id: {
              not: order.id,
            },
            status: {
              notIn: ["CANCELLED", "REFUNDED"],
            },
            createdAt: {
              lte: order.createdAt,
            },
          },
        }),
        getDefaultRule(transaction),
        transaction.referralClosure.findMany({
          where: {
            descendantUserId: order.userId,
            depth: {
              gt: 0,
            },
          },
          orderBy: {
            depth: "asc",
          },
          select: {
            ancestorUserId: true,
            depth: true,
          },
        }),
        transaction.user.findUniqueOrThrow({
          where: { id: order.userId },
          select: {
            id: true,
            email: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        }),
      ]);

      const trigger = resolveOrderTrigger(priorOrdersCount + 1);
      const rules = await getActiveRules(transaction, trigger, order.createdAt);

      if (ancestors.length === 0 || rules.length === 0) {
        return [];
      }

      const basePoints = defaultRule ? calculatePoints(Number(order.totalAmount), defaultRule) : 0;
      const ancestorByDepth = new Map<number, string>();
      for (const ancestor of ancestors) {
        ancestorByDepth.set(ancestor.depth, ancestor.ancestorUserId);
      }

      const results = [];
      for (const rule of rules) {
        const beneficiaryUserId = ancestorByDepth.get(rule.levelNumber);
        if (!beneficiaryUserId) {
          continue;
        }

        const payout = await buildRewardPayout(transaction, {
          beneficiaryUserId,
          sourceUserId: order.userId,
          relationshipId: relationship.id,
          rule,
          eventTimestamp: order.createdAt,
          order,
          relationshipCreatedAt: relationship.createdAt,
          basePoints,
        });

        if (!payout) {
          continue;
        }

        const pending = await markRewardPending(transaction, {
          relationshipId: relationship.id,
          beneficiaryUserId,
          sourceUserId: order.userId,
          orderId: order.id,
          rule,
          eventKey: payout.eventKey,
          title: payout.title,
          description: payout.description,
          pointsAwarded: payout.pointsAwarded,
          basePoints,
          eventTimestamp: order.createdAt,
          expiresAt: payout.expiresAt,
          metadata: {
            orderNumber: order.orderNumber,
            sourceUserId: order.userId,
            sourceUserName: buildUserDisplayName(sourceUser),
            trigger,
          },
        });

        if (order.status === "DELIVERED") {
          results.push(
            await awardReferralReward(transaction, {
              ...pending,
              sourceUser,
            }),
          );
          continue;
        }

        if (order.status === "CANCELLED" || order.status === "REFUNDED") {
          results.push(
            await reverseReferralReward(
              transaction,
              {
                ...pending,
              },
              `Referral reward reversed for ${order.status.toLowerCase()} order ${order.orderNumber}`,
            ),
          );
          continue;
        }

        if (ORDER_PENDING_STATUSES.includes(order.status as (typeof ORDER_PENDING_STATUSES)[number])) {
          results.push(pending);
        }
      }

      return results;
    });
  }

  public async getCustomerOverview(userId: string) {
    await ensureReferralIdentity(prisma, userId);
    await getOrCreateAccount(prisma, userId);

    const [user, directRelationships, descendantClosures, awardedRewards, history] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          referralCode: true,
          createdAt: true,
        },
      }),
      prisma.referralRelationship.findMany({
        where: {
          referrerUserId: userId,
          status: ReferralRelationshipStatus.ACTIVE,
        },
        include: {
          referredUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.referralClosure.findMany({
        where: {
          ancestorUserId: userId,
          depth: {
            gt: 0,
          },
        },
        select: {
          descendantUserId: true,
          depth: true,
        },
        orderBy: [{ depth: "asc" }, { createdAt: "asc" }],
      }),
      prisma.referralReward.aggregate({
        where: {
          beneficiaryUserId: userId,
          status: ReferralRewardStatus.AWARDED,
        },
        _sum: {
          pointsAwarded: true,
        },
      }),
      prisma.referralReward.findMany({
        where: {
          beneficiaryUserId: userId,
        },
        include: {
          sourceUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 200,
      }),
    ]);

    const descendantIds = descendantClosures.map((item) => item.descendantUserId);
    const [descendantUsers, descendantOrders, generatedPointsBySource, pendingPointsBySource, activeRelationships] = descendantIds.length
      ? await Promise.all([
          prisma.user.findMany({
            where: {
              id: {
                in: descendantIds,
              },
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
          }),
          prisma.order.groupBy({
            by: ["userId"],
            where: {
              userId: {
                in: descendantIds,
              },
              status: "DELIVERED",
            },
            _count: {
              id: true,
            },
          }),
          prisma.referralReward.groupBy({
            by: ["sourceUserId"],
            where: {
              beneficiaryUserId: userId,
              sourceUserId: {
                in: descendantIds,
              },
              status: ReferralRewardStatus.AWARDED,
            },
            _sum: {
              pointsAwarded: true,
            },
          }),
          prisma.referralReward.groupBy({
            by: ["sourceUserId"],
            where: {
              beneficiaryUserId: userId,
              sourceUserId: {
                in: descendantIds,
              },
              status: ReferralRewardStatus.PENDING,
            },
            _sum: {
              pointsAwarded: true,
            },
          }),
          prisma.referralRelationship.findMany({
            where: {
              status: ReferralRelationshipStatus.ACTIVE,
              OR: [
                { referrerUserId: userId },
                {
                  referrerUserId: {
                    in: descendantIds,
                  },
                },
              ],
            },
            include: {
              referredUser: {
                select: {
                  id: true,
                },
              },
            },
          }),
        ])
      : [[], [], [], [], []];

    const purchaseCountByUserId = new Map(
      descendantOrders.map((item) => [item.userId, item._count.id]),
    );
    const generatedPointsMap = new Map(
      generatedPointsBySource.map((item) => [item.sourceUserId, item._sum.pointsAwarded ?? 0]),
    );
    const pendingPointsMap = new Map(
      pendingPointsBySource.map((item) => [item.sourceUserId, item._sum.pointsAwarded ?? 0]),
    );
    const descendantDepthMap = new Map(
      descendantClosures.map((item) => [item.descendantUserId, item.depth]),
    );
    const descendantUserMap = new Map(descendantUsers.map((item) => [item.id, item]));
    const childrenByParent = new Map<string, string[]>();

    for (const relationship of activeRelationships) {
      if (
        relationship.referrerUserId !== userId &&
        !descendantDepthMap.has(relationship.referrerUserId)
      ) {
        continue;
      }

      const children = childrenByParent.get(relationship.referrerUserId) ?? [];
      children.push(relationship.referredUser.id);
      childrenByParent.set(relationship.referrerUserId, children);
    }

    type CustomerTreeNode = {
      id: string;
      name: string;
      email: string;
      joinedAt: Date;
      level: number;
      generatedPoints: number;
      pendingPoints: number;
      purchaseCount: number;
      children: CustomerTreeNode[];
    };

    const buildTree = (parentUserId: string): CustomerTreeNode[] => {
      const childIds = childrenByParent.get(parentUserId) ?? [];
      return childIds
        .map((childId) => {
          const child = descendantUserMap.get(childId);
          if (!child) {
            return null;
          }

          return {
            id: child.id,
            name: buildUserDisplayName(child),
            email: child.email,
            joinedAt: child.createdAt,
            level: descendantDepthMap.get(child.id) ?? 0,
            generatedPoints: generatedPointsMap.get(child.id) ?? 0,
            pendingPoints: pendingPointsMap.get(child.id) ?? 0,
            purchaseCount: purchaseCountByUserId.get(child.id) ?? 0,
            children: buildTree(child.id),
          };
        })
        .filter((item): item is CustomerTreeNode => Boolean(item));
    };

    const pendingAggregate = await prisma.referralReward.aggregate({
      where: {
        beneficiaryUserId: userId,
        status: ReferralRewardStatus.PENDING,
      },
      _sum: {
        pointsAwarded: true,
      },
    });

    return {
      profile: {
        id: user.id,
        name: buildUserDisplayName(user),
        email: user.email,
        referralCode: user.referralCode,
        referralLinkPath: `/register?ref=${user.referralCode}`,
      },
      summary: {
        directReferralCount: directRelationships.length,
        networkReferralCount: descendantIds.length,
        successfulPurchaseCount: descendantOrders.reduce((sum, item) => sum + item._count.id, 0),
        pointsReceived: awardedRewards._sum.pointsAwarded ?? 0,
        pointsPending: pendingAggregate._sum.pointsAwarded ?? 0,
      },
      directReferrals: directRelationships.map((relationship) => ({
        id: relationship.id,
        referredUserId: relationship.referredUser.id,
        referredUserName: buildUserDisplayName(relationship.referredUser),
        referredUserEmail: relationship.referredUser.email,
        joinedAt: relationship.referredUser.createdAt,
      })),
      earningsHistory: history.map(mapRewardRecord),
      tree: buildTree(userId),
    };
  }

  public async getAdminOverview() {
    const [rules, relationships, rewards, topReferrerCandidates, recentHistory] = await Promise.all([
      prisma.referralRule.findMany({
        orderBy: [{ trigger: "asc" }, { levelNumber: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.referralRelationship.findMany({
        where: {
          status: ReferralRelationshipStatus.ACTIVE,
        },
        include: {
          referrerUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
              referralCode: true,
            },
          },
          referredUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
              referralCode: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.referralReward.findMany({
        include: {
          sourceUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
          beneficiaryUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.referralReward.groupBy({
        by: ["beneficiaryUserId"],
        where: {
          status: ReferralRewardStatus.AWARDED,
        },
        _sum: {
          pointsAwarded: true,
        },
      }),
      prisma.referralReward.findMany({
        include: {
          sourceUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
          beneficiaryUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 200,
      }),
    ]);

    const totalPointsGenerated = rewards
      .filter((reward) => reward.status === ReferralRewardStatus.AWARDED)
      .reduce((sum, reward) => sum + reward.pointsAwarded, 0);
    const activeReferrals = new Set(
      rewards
        .filter((reward) => reward.status === ReferralRewardStatus.AWARDED && reward.orderId)
        .map((reward) => reward.sourceUserId),
    ).size;

    const relationshipGrowthMap = new Map<string, number>();
    for (const relationship of relationships) {
      const growthKey = relationship.createdAt.toISOString().slice(0, 7);
      relationshipGrowthMap.set(growthKey, (relationshipGrowthMap.get(growthKey) ?? 0) + 1);
    }

    const topReferrerUsers = topReferrerCandidates.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: topReferrerCandidates.map((item) => item.beneficiaryUserId),
            },
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            firstName: true,
            lastName: true,
            referralCode: true,
          },
        })
      : [];

    const topReferrerMap = new Map(topReferrerUsers.map((item) => [item.id, item]));

    return {
      summary: {
        totalReferrals: relationships.length,
        activeReferrals,
        totalPointsGenerated,
        pointsDistributed: totalPointsGenerated,
        conversionRate: relationships.length > 0 ? Number(((activeReferrals / relationships.length) * 100).toFixed(2)) : 0,
      },
      referralGrowth: Array.from(relationshipGrowthMap.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, count]) => ({
          month,
          count,
        })),
      topReferrers: topReferrerCandidates
        .sort((left, right) => (right._sum.pointsAwarded ?? 0) - (left._sum.pointsAwarded ?? 0))
        .slice(0, 10)
        .map((entry) => {
          const user = topReferrerMap.get(entry.beneficiaryUserId);
          return {
            userId: entry.beneficiaryUserId,
            name: user ? buildUserDisplayName(user) : entry.beneficiaryUserId,
            email: user?.email ?? "",
            referralCode: user?.referralCode ?? null,
            pointsGenerated: entry._sum.pointsAwarded ?? 0,
          };
        }),
      rules: rules.map(mapRule),
      relationships: relationships.map((relationship) => ({
        id: relationship.id,
        referrerUserId: relationship.referrerUser.id,
        referrerName: buildUserDisplayName(relationship.referrerUser),
        referrerEmail: relationship.referrerUser.email,
        referrerCode: relationship.referrerUser.referralCode,
        referredUserId: relationship.referredUser.id,
        referredUserName: buildUserDisplayName(relationship.referredUser),
        referredUserEmail: relationship.referredUser.email,
        referredUserCode: relationship.referredUser.referralCode,
        status: relationship.status,
        sourceChannel: relationship.sourceChannel,
        createdAt: relationship.createdAt,
        updatedAt: relationship.updatedAt,
      })),
      rewards: recentHistory.map(mapRewardRecord),
    };
  }

  public async createRule(input: {
    name: string;
    description?: string | null;
    trigger: ReferralTriggerType;
    levelNumber: number;
    rewardType: ReferralRuleRewardType;
    rewardValue: number;
    minOrderAmount?: number | null;
    maxRewardPoints?: number | null;
    maxReferralCount?: number | null;
    expiresInDays?: number | null;
    conditions?: Prisma.InputJsonValue | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const created = await prisma.referralRule.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        trigger: input.trigger,
        levelNumber: input.levelNumber,
        rewardType: input.rewardType,
        rewardValue: new Prisma.Decimal(input.rewardValue),
        minOrderAmount:
          input.minOrderAmount !== null && input.minOrderAmount !== undefined
            ? new Prisma.Decimal(input.minOrderAmount)
            : null,
        maxRewardPoints: input.maxRewardPoints ?? null,
        maxReferralCount: input.maxReferralCount ?? null,
        expiresInDays: input.expiresInDays ?? null,
        conditions: input.conditions ?? Prisma.JsonNull,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    return mapRule(created);
  }

  public async updateRule(
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      trigger: ReferralTriggerType;
      levelNumber: number;
      rewardType: ReferralRuleRewardType;
      rewardValue: number;
      minOrderAmount: number | null;
      maxRewardPoints: number | null;
      maxReferralCount: number | null;
      expiresInDays: number | null;
      conditions: Prisma.InputJsonValue | null;
      startsAt: string | null;
      endsAt: string | null;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    const existing = await prisma.referralRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, "Referral rule not found.");
    }

    const updated = await prisma.referralRule.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        trigger: input.trigger,
        levelNumber: input.levelNumber,
        rewardType: input.rewardType,
        rewardValue:
          input.rewardValue === undefined ? undefined : new Prisma.Decimal(input.rewardValue),
        minOrderAmount:
          input.minOrderAmount === undefined
            ? undefined
            : input.minOrderAmount === null
              ? null
              : new Prisma.Decimal(input.minOrderAmount),
        maxRewardPoints: input.maxRewardPoints,
        maxReferralCount: input.maxReferralCount,
        expiresInDays: input.expiresInDays,
        conditions: input.conditions === undefined ? undefined : input.conditions ?? Prisma.JsonNull,
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
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    return mapRule(updated);
  }

  public async deleteRule(id: string) {
    const [existing, rewardCount] = await Promise.all([
      prisma.referralRule.findUnique({
        where: { id },
      }),
      prisma.referralReward.count({
        where: { ruleId: id },
      }),
    ]);

    if (!existing) {
      throw new ApiError(404, "Referral rule not found.");
    }

    if (rewardCount > 0) {
      throw new ApiError(400, "This referral rule has already generated rewards and cannot be deleted.");
    }

    await prisma.referralRule.delete({
      where: { id },
    });
  }

  public async updateUserReferralCode(actorUserId: string, input: { userId: string; referralCode: string }) {
    const normalizedCode = normalizeReferralCode(input.referralCode);
    if (!normalizedCode || normalizedCode.length < 4) {
      throw new ApiError(400, "Referral code must contain at least 4 letters or digits.");
    }

    const existing = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        referralCode: true,
      },
    });

    if (!existing) {
      throw new ApiError(404, "Customer not found.");
    }

    const conflict = await prisma.user.findFirst({
      where: {
        referralCode: normalizedCode,
        id: {
          not: input.userId,
        },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ApiError(409, "Referral code is already in use.");
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.user.update({
        where: { id: input.userId },
        data: {
          referralCode: normalizedCode,
        },
        select: {
          id: true,
          referralCode: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_REFERRAL_CODE_UPDATED",
          entityType: "user",
          entityId: input.userId,
          metadata: {
            previousReferralCode: existing.referralCode,
            nextReferralCode: normalizedCode,
          },
        },
      });

      return result;
    });

    return {
      id: updated.id,
      referralCode: updated.referralCode,
      email: updated.email,
      name: buildUserDisplayName(updated),
    };
  }

  public async createRelationship(
    actorUserId: string,
    input: {
      referrerUserId: string;
      referredUserId: string;
      notes?: string | null;
    },
  ) {
    return prisma.$transaction(async (transaction) => {
      await ensureReferralIdentity(transaction, input.referrerUserId);
      await ensureReferralIdentity(transaction, input.referredUserId);
      await assertRelationshipIsValid(transaction, input);

      const referrer = await transaction.user.findUniqueOrThrow({
        where: { id: input.referrerUserId },
        select: {
          referralCode: true,
        },
      });

      const created = await transaction.referralRelationship.create({
        data: {
          referrerUserId: input.referrerUserId,
          referredUserId: input.referredUserId,
          referralCodeUsed: referrer.referralCode,
          sourceChannel: "ADMIN",
          status: ReferralRelationshipStatus.ACTIVE,
          notes: input.notes ?? buildRelationshipNotes("ADMIN", referrer.referralCode),
          createdByUserId: actorUserId,
        },
      });

      await rebuildReferralClosure(transaction);
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_REFERRAL_RELATIONSHIP_CREATED",
          entityType: "referral_relationship",
          entityId: created.id,
          metadata: {
            referrerUserId: input.referrerUserId,
            referredUserId: input.referredUserId,
          },
        },
      });

      return created;
    });
  }

  public async updateRelationship(
    actorUserId: string,
    relationshipId: string,
    input: {
      referrerUserId: string;
      notes?: string | null;
      status?: ReferralRelationshipStatus;
    },
  ) {
    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.referralRelationship.findUnique({
        where: { id: relationshipId },
      });

      if (!existing) {
        throw new ApiError(404, "Referral relationship not found.");
      }

      await assertRelationshipIsValid(transaction, {
        referrerUserId: input.referrerUserId,
        referredUserId: existing.referredUserId,
        ignoreRelationshipId: relationshipId,
      });

      const updated = await transaction.referralRelationship.update({
        where: { id: relationshipId },
        data: {
          referrerUserId: input.referrerUserId,
          status: input.status,
          notes: input.notes,
          createdByUserId: actorUserId,
        },
      });

      await rebuildReferralClosure(transaction);
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_REFERRAL_RELATIONSHIP_UPDATED",
          entityType: "referral_relationship",
          entityId: relationshipId,
          metadata: {
            previousReferrerUserId: existing.referrerUserId,
            nextReferrerUserId: input.referrerUserId,
            previousStatus: existing.status,
            nextStatus: input.status ?? existing.status,
          },
        },
      });

      return updated;
    });
  }

  public async deleteRelationship(actorUserId: string, relationshipId: string) {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.referralRelationship.findUnique({
        where: { id: relationshipId },
      });

      if (!existing) {
        throw new ApiError(404, "Referral relationship not found.");
      }

      await transaction.referralRelationship.delete({
        where: { id: relationshipId },
      });
      await rebuildReferralClosure(transaction);
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_REFERRAL_RELATIONSHIP_DELETED",
          entityType: "referral_relationship",
          entityId: relationshipId,
          metadata: {
            referrerUserId: existing.referrerUserId,
            referredUserId: existing.referredUserId,
          },
        },
      });
    });
  }
}

export const referralService = new ReferralService();
