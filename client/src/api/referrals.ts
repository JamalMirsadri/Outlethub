import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

function getRequiredToken(): string {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export type ReferralTriggerType = "SIGNUP" | "FIRST_ORDER" | "REPEAT_ORDER";
export type ReferralRuleRewardType = "FIXED_POINTS" | "PERCENTAGE";
export type ReferralRewardStatus = "PENDING" | "AWARDED" | "REVERSED" | "CANCELLED" | "EXPIRED";
export type ReferralRelationshipStatus = "ACTIVE" | "REMOVED";

export interface ReferralTreeNode {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  level: number;
  generatedPoints: number;
  pendingPoints: number;
  purchaseCount: number;
  children: ReferralTreeNode[];
}

export interface ReferralRuleRecord {
  id: string;
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
  conditions: Record<string, unknown> | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralRewardRecord {
  id: string;
  trigger: ReferralTriggerType;
  levelNumber: number;
  title: string;
  description: string | null;
  pointsAwarded: number;
  basePoints: number | null;
  status: ReferralRewardStatus;
  pendingAt: string | null;
  awardedAt: string | null;
  reversedAt: string | null;
  createdAt: string;
  sourceUser: {
    id: string;
    email: string;
    name: string;
  };
  beneficiaryUser?: {
    id: string;
    email: string;
    name: string;
  } | null;
  order: {
    id: string;
    orderNumber: string;
  } | null;
  rule: {
    id: string;
    name: string;
  } | null;
}

export interface CustomerReferralOverviewResponse {
  profile: {
    id: string;
    name: string;
    email: string;
    referralCode: string;
    referralLinkPath: string;
  };
  summary: {
    directReferralCount: number;
    networkReferralCount: number;
    successfulPurchaseCount: number;
    pointsReceived: number;
    pointsPending: number;
  };
  directReferrals: Array<{
    id: string;
    referredUserId: string;
    referredUserName: string;
    referredUserEmail: string;
    joinedAt: string;
  }>;
  earningsHistory: ReferralRewardRecord[];
  tree: ReferralTreeNode[];
}

export interface AdminReferralOverviewResponse {
  summary: {
    totalReferrals: number;
    activeReferrals: number;
    totalPointsGenerated: number;
    pointsDistributed: number;
    conversionRate: number;
  };
  referralGrowth: Array<{
    month: string;
    count: number;
  }>;
  topReferrers: Array<{
    userId: string;
    name: string;
    email: string;
    referralCode: string | null;
    pointsGenerated: number;
  }>;
  rules: ReferralRuleRecord[];
  relationships: Array<{
    id: string;
    referrerUserId: string;
    referrerName: string;
    referrerEmail: string;
    referrerCode: string;
    referredUserId: string;
    referredUserName: string;
    referredUserEmail: string;
    referredUserCode: string;
    status: ReferralRelationshipStatus;
    sourceChannel: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  rewards: ReferralRewardRecord[];
}

export interface ReferralRulePayload {
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
  conditions?: Record<string, unknown> | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ReferralRelationshipPayload {
  referrerUserId: string;
  referredUserId: string;
  notes?: string | null;
}

export interface ReferralRelationshipUpdatePayload {
  referrerUserId: string;
  notes?: string | null;
  status?: ReferralRelationshipStatus;
}

export async function getMyReferrals() {
  return http<CustomerReferralOverviewResponse>("/referrals/me", {
    token: getRequiredToken(),
  });
}

export async function getAdminReferrals() {
  return http<AdminReferralOverviewResponse>("/admin/referrals", {
    token: getRequiredToken(),
  });
}

export async function createReferralRule(payload: ReferralRulePayload) {
  return http<ReferralRuleRecord>("/admin/referrals/rules", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateReferralRule(id: string, payload: Partial<ReferralRulePayload>) {
  return http<ReferralRuleRecord>(`/admin/referrals/rules/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteReferralRule(id: string) {
  return http<void>(`/admin/referrals/rules/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function createReferralRelationship(payload: ReferralRelationshipPayload) {
  return http<{
    id: string;
    referrerUserId: string;
    referredUserId: string;
    sourceChannel: string | null;
    status: ReferralRelationshipStatus;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>("/admin/referrals/relationships", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateReferralRelationship(
  id: string,
  payload: ReferralRelationshipUpdatePayload,
) {
  return http<{
    id: string;
    referrerUserId: string;
    referredUserId: string;
    sourceChannel: string | null;
    status: ReferralRelationshipStatus;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>(`/admin/referrals/relationships/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteReferralRelationship(id: string) {
  return http<void>(`/admin/referrals/relationships/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function updateReferralUserCode(id: string, payload: { referralCode: string }) {
  return http<{
    id: string;
    referralCode: string;
    email: string;
    name: string;
  }>(`/admin/referrals/users/${id}/code`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}
