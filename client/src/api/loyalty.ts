import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

function getRequiredToken(): string {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export interface LoyaltyLevelRecord {
  id: string;
  title: string;
  slug: string;
  minPoints: number;
  color: string;
  icon: string | null;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyRewardRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  pointsCost: number;
  rewardType: "PERCENTAGE_DISCOUNT" | "FIXED_AMOUNT_DISCOUNT" | "FREE_SHIPPING" | "COUPON_TEMPLATE";
  startsAt: string | null;
  endsAt: string | null;
  color: string | null;
  icon: string | null;
  benefits: string[];
  stockLimit: number | null;
  usageLimit?: number | null;
  isActive: boolean;
  sortOrder: number;
  minMembershipLevelId: string | null;
  minMembershipLevel: LoyaltyLevelRecord | null;
  couponTemplateId?: string | null;
  couponTemplate?: { id: string; code: string; description: string | null } | null;
  couponPercentage?: number | null;
  couponFixedAmount?: number | null;
  couponMinimumOrderAmount?: number | null;
  couponMaximumDiscountAmount?: number | null;
  couponDurationDays?: number | null;
  couponCodePrefix?: string | null;
  redemptionCount?: number;
  isUnlocked?: boolean;
  isRedeemable?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyPointRuleRecord {
  id: string;
  name: string;
  spendAmount: number;
  pointsAwarded: number;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyPointRulePayload {
  name: string;
  spendAmount: number;
  pointsAwarded: number;
  currency?: string;
  isActive?: boolean;
  isDefault?: boolean;
  notes?: string | null;
}

export interface LoyaltyLevelPayload {
  title: string;
  minPoints: number;
  color?: string | null;
  icon?: string | null;
  benefits?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export interface LoyaltyRewardPayload {
  title: string;
  description?: string | null;
  pointsCost: number;
  rewardType: "PERCENTAGE_DISCOUNT" | "FIXED_AMOUNT_DISCOUNT" | "FREE_SHIPPING" | "COUPON_TEMPLATE";
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
}

export interface LoyaltyTransactionRecord {
  id: string;
  type:
    | "ORDER_EARN"
    | "ORDER_REVERSAL"
    | "REWARD_REDEMPTION"
    | "MANUAL_ADJUSTMENT"
    | "REFERRAL_REWARD"
    | "REFERRAL_REVERSAL"
    | "REFERRAL_MANUAL_ADJUSTMENT";
  pointsDelta: number;
  balanceAfter: number;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  order: { id: string; orderNumber: string } | null;
  reward: { id: string; title: string } | null;
  user: { id: string; email: string; name: string | null } | null;
  actorUser: { id: string; email: string; name: string | null } | null;
}

export interface LoyaltyAdminOverviewResponse {
  summary: {
    totalAccounts: number;
    totalCurrentPoints: number;
    totalEarnedPoints: number;
    totalSpentPoints: number;
  };
  pointRules: LoyaltyPointRuleRecord[];
  membershipLevels: LoyaltyLevelRecord[];
  rewards: LoyaltyRewardRecord[];
  pointHistory: LoyaltyTransactionRecord[];
}

export interface LoyaltyCustomerRewardsResponse {
  account: {
    id: string;
    currentPoints: number;
    totalEarnedPoints: number;
    totalSpentPoints: number;
    membershipLevel: LoyaltyLevelRecord | null;
  };
  progress: {
    nextLevel: LoyaltyLevelRecord | null;
    percent: number;
    pointsToNextLevel: number;
  };
  membershipLevels: LoyaltyLevelRecord[];
  rewards: LoyaltyRewardRecord[];
  history: LoyaltyTransactionRecord[];
  redemptions: Array<{
    id: string;
    pointsSpent: number;
    status: "REDEEMED" | "CANCELLED";
    notes: string | null;
    redeemedAt: string;
    cancelledAt: string | null;
    reward: { id: string; title: string };
    issuedCoupon?: { id: string; code: string } | null;
  }>;
  issuedCoupons: Array<{
    id: string;
    code: string;
    description: string | null;
    discountType: string;
    percentage: number | null;
    fixedAmount: number | null;
    freeShipping: boolean;
    minimumOrderAmount: number | null;
    maximumDiscountAmount: number | null;
    startsAt: string | null;
    endsAt: string | null;
    status: string;
    usageCount: number;
    usageCountByUser: number;
    isUsed: boolean;
    isUsedByCustomer: boolean;
    isAvailableToCustomer: boolean;
    assignmentSource: "REWARD" | "DIRECT" | "MEMBERSHIP" | "PUBLIC";
    sourceReward: { id: string; title: string } | null;
    createdAt: string;
  }>;
}

export async function getAdminLoyaltyOverview() {
  return http<LoyaltyAdminOverviewResponse>("/admin/loyalty", {
    token: getRequiredToken(),
  });
}

export async function createLoyaltyPointRule(payload: LoyaltyPointRulePayload) {
  return http<LoyaltyPointRuleRecord>("/admin/loyalty/point-rules", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateLoyaltyPointRule(id: string, payload: Partial<LoyaltyPointRulePayload>) {
  return http<LoyaltyPointRuleRecord>(`/admin/loyalty/point-rules/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteLoyaltyPointRule(id: string) {
  return http<void>(`/admin/loyalty/point-rules/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function createLoyaltyMembershipLevel(payload: LoyaltyLevelPayload) {
  return http<LoyaltyLevelRecord>("/admin/loyalty/membership-levels", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateLoyaltyMembershipLevel(id: string, payload: Partial<LoyaltyLevelPayload>) {
  return http<LoyaltyLevelRecord>(`/admin/loyalty/membership-levels/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteLoyaltyMembershipLevel(id: string) {
  return http<void>(`/admin/loyalty/membership-levels/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function createLoyaltyReward(payload: LoyaltyRewardPayload) {
  return http<LoyaltyRewardRecord>("/admin/loyalty/rewards", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateLoyaltyReward(id: string, payload: Partial<LoyaltyRewardPayload>) {
  return http<LoyaltyRewardRecord>(`/admin/loyalty/rewards/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteLoyaltyReward(id: string) {
  return http<void>(`/admin/loyalty/rewards/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function createLoyaltyManualAdjustment(payload: {
  userId: string;
  pointsDelta: number;
  reason: string;
}) {
  return http<LoyaltyTransactionRecord>("/admin/loyalty/manual-adjustments", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function getMyRewards() {
  return http<LoyaltyCustomerRewardsResponse>("/loyalty/me", {
    token: getRequiredToken(),
  });
}

export async function redeemLoyaltyReward(id: string) {
  return http<{
    redemption: { id: string; rewardId: string; pointsSpent: number; status: string; redeemedAt: string };
    coupon: { id: string; code: string; description: string | null; endsAt: string | null };
  }>(
    `/loyalty/rewards/${id}/redeem`,
    {
      method: "POST",
      token: getRequiredToken(),
      body: JSON.stringify({}),
    },
  );
}
