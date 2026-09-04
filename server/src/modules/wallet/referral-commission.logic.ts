import { Prisma, ReferralRank } from "@prisma/client";

export const HARD_MAX_COMMISSION_LEVEL = 2;
export const DEFAULT_MAX_COMMISSION_LEVEL = 2;

export const DEFAULT_LEVEL_CONFIGS: Array<{ levelNumber: number; rank: ReferralRank; percentage: string }> = [
  { levelNumber: 1, rank: ReferralRank.SILVER, percentage: "2.00" },
  { levelNumber: 1, rank: ReferralRank.GOLD, percentage: "2.50" },
  { levelNumber: 1, rank: ReferralRank.PLATINUM, percentage: "3.00" },
  { levelNumber: 1, rank: ReferralRank.DIAMOND, percentage: "3.50" },
  { levelNumber: 2, rank: ReferralRank.SILVER, percentage: "0.50" },
  { levelNumber: 2, rank: ReferralRank.GOLD, percentage: "0.50" },
  { levelNumber: 2, rank: ReferralRank.PLATINUM, percentage: "0.50" },
  { levelNumber: 2, rank: ReferralRank.DIAMOND, percentage: "0.50" },
];

/**
 * Decimal-only commission: eligibleProductAmount × percentage / 100,
 * rounded half-up to 2 decimal places.
 */
export function computeCommission(eligibleProductAmount: Prisma.Decimal, percentage: Prisma.Decimal): Prisma.Decimal {
  return eligibleProductAmount
    .mul(percentage)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Idempotency identity: ORDER + BENEFICIARY + LEVEL.
 */
export function buildCommissionEventKey(orderId: string, beneficiaryUserId: string, referralLevel: number): string {
  return `REFERRAL_COMMISSION:ORDER:${orderId}:USER:${beneficiaryUserId}:LEVEL:${referralLevel}`;
}

export type CommissionAction = "AWARD" | "REVERSE" | "NONE";

export function resolveCommissionAction(status: string): CommissionAction {
  if (status === "DELIVERED") {
    return "AWARD";
  }

  if (status === "CANCELLED" || status === "REFUNDED") {
    return "REVERSE";
  }

  return "NONE";
}

/**
 * Clamps the admin-configured maximum commission level to the hard cap.
 */
export function resolveMaxCommissionLevel(configuredLevel: number): number {
  const safe = Number.isInteger(configuredLevel) ? configuredLevel : 0;
  return Math.min(Math.max(safe, 0), HARD_MAX_COMMISSION_LEVEL);
}

/**
 * Maps a purchaser's upline (from ReferralClosure) into commission beneficiaries,
 * limited to the configured maximum level and deduplicated (cycle guard).
 */
export function buildCommissionBeneficiaries(
  ancestors: Array<{ ancestorUserId: string; depth: number }>,
  maxLevel: number,
): Array<{ beneficiaryUserId: string; referralLevel: number }> {
  const result: Array<{ beneficiaryUserId: string; referralLevel: number }> = [];
  const seen = new Set<string>();

  for (const ancestor of [...ancestors].sort((left, right) => left.depth - right.depth)) {
    if (ancestor.depth < 1 || ancestor.depth > maxLevel) {
      continue;
    }

    if (seen.has(ancestor.ancestorUserId)) {
      continue;
    }

    result.push({ beneficiaryUserId: ancestor.ancestorUserId, referralLevel: ancestor.depth });
    seen.add(ancestor.ancestorUserId);
  }

  return result;
}
