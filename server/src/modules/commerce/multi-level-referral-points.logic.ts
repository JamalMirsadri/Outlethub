import type { Prisma } from "@prisma/client";

export const MULTI_LEVEL_REFERRAL_REWARD_TYPE = "MULTI_LEVEL_REFERRAL_POINTS";
export const DEFAULT_MAX_REFERRAL_LEVEL = 3;

/**
 * Default points awarded per €10 of eligible product amount, keyed by referral
 * level. Level 0 is the purchaser; levels 1..3 are the purchaser's upline.
 * These are only defaults — the calculation engine reads the persisted
 * ReferralPointSettings snapshot instead.
 */
export const DEFAULT_POINTS_PER_10_EUR: Record<number, number> = {
  0: 5,
  1: 5,
  2: 4,
  3: 3,
};

export function resolvePointsPer10Eur(
  referralLevel: number,
  pointsPer10EurByLevel: Record<number, number> = DEFAULT_POINTS_PER_10_EUR,
): number | null {
  if (!Number.isInteger(referralLevel) || referralLevel < 0) {
    return null;
  }

  const value = pointsPer10EurByLevel[referralLevel];
  return typeof value === "number" ? value : null;
}

/**
 * floor(eligibleProductAmount / 10) * pointsPer10EUR using Decimal arithmetic.
 * The result is always a non-negative integer.
 */
export function computeReferralPoints(eligibleProductAmount: Prisma.Decimal, pointsPer10EUR: number): number {
  if (!Number.isInteger(pointsPer10EUR) || pointsPer10EUR <= 0) {
    return 0;
  }

  const baseUnits = eligibleProductAmount.div(10).floor();
  return baseUnits.mul(pointsPer10EUR).toNumber();
}

/**
 * Idempotency identity: ORDER + BENEFICIARY + LEVEL + REWARD_TYPE.
 */
export function buildRewardEventKey(input: {
  orderId: string;
  beneficiaryUserId: string;
  referralLevel: number;
  rewardType?: string;
}): string {
  return [
    input.rewardType ?? MULTI_LEVEL_REFERRAL_REWARD_TYPE,
    input.orderId,
    input.beneficiaryUserId,
    `L${input.referralLevel}`,
  ].join(":");
}

export type RewardAction = "AWARD" | "REVERSE" | "NONE";

export function resolveRewardAction(status: string): RewardAction {
  if (status === "DELIVERED") {
    return "AWARD";
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
    return "REVERSE";
  }

  return "NONE";
}

/**
 * Builds the list of beneficiaries for a purchase:
 *   - the purchaser (level 0)
 *   - direct referrer (level 1)
 *   - referrer's referrer (level 2)
 *   - next referrer (level 3)
 *
 * Stops after the configured maximum referral level, never includes the
 * purchaser as an upline reward and deduplicates ancestors (defence against
 * cycles in malformed closure data).
 */
export function buildBeneficiaryPlan(
  purchaserUserId: string,
  ancestors: Array<{ ancestorUserId: string; depth: number }>,
  maxReferralLevel: number = DEFAULT_MAX_REFERRAL_LEVEL,
): Array<{ beneficiaryUserId: string; referralLevel: number }> {
  const plan: Array<{ beneficiaryUserId: string; referralLevel: number }> = [
    { beneficiaryUserId: purchaserUserId, referralLevel: 0 },
  ];
  const seen = new Set<string>([purchaserUserId]);

  for (const ancestor of [...ancestors].sort((left, right) => left.depth - right.depth)) {
    if (ancestor.depth < 1 || ancestor.depth > maxReferralLevel) {
      continue;
    }

    if (seen.has(ancestor.ancestorUserId)) {
      continue;
    }

    plan.push({ beneficiaryUserId: ancestor.ancestorUserId, referralLevel: ancestor.depth });
    seen.add(ancestor.ancestorUserId);
  }

  return plan;
}
