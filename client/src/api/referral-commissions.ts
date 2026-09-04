import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type ReferralRank = "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
export type ReferralCommissionStatus = "AWARDED" | "REVERSED";

export interface ReferralCommissionConfigItem {
  levelNumber: number;
  rank: ReferralRank;
  percentage: string;
  isActive: boolean;
  updatedAt: string;
}

export interface ReferralCommissionConfig {
  maxCommissionLevel: number;
  items: ReferralCommissionConfigItem[];
}

export interface ReferralCommissionRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  referrerUserId: string;
  referrerEmail: string;
  referrerCode: string | null;
  purchaserUserId: string;
  purchaserEmail: string;
  referralLevel: number;
  rank: ReferralRank;
  percentage: string;
  eligibleProductAmount: string;
  commissionAmount: string;
  walletTransactionId: string;
  status: ReferralCommissionStatus;
  createdAt: string;
}

export interface UserReferralSummary {
  referralCode: string | null;
  rank: ReferralRank;
  percentage: string;
  totalEarned: string;
  rates: {
    level1Percentage: string;
    level2Percentage: string;
  };
  commission: {
    level1Commission: string;
    level2Commission: string;
    totalCommission: string;
  };
  points: {
    purchaserPoints: number;
    level1Points: number;
    level2Points: number;
    level3Points: number;
    totalPoints: number;
  };
  referrals: {
    directCount: number;
    level2Count: number;
    level3Count: number;
  };
  recentCommissions: Array<{
    id: string;
    orderId: string;
    orderNumber: string;
    referralLevel: number;
    rank: ReferralRank;
    percentage: string;
    eligibleProductAmount: string;
    commissionAmount: string;
    walletTransactionId: string;
    status: ReferralCommissionStatus;
    createdAt: string;
  }>;
}

export interface ReferralCommissionOverview {
  totalCommissions: number;
  totalAmount: string;
  reversedCommissions: number;
  byRank: Array<{ rank: ReferralRank; count: number; amount: string }>;
  byLevel: Array<{ level: number; count: number; amount: string }>;
  topReferrers: Array<{ referrerUserId: string; amount: string }>;
}

export interface ReferralPointSettings {
  id: string;
  purchaserPointsPer10EUR: number;
  level1PointsPer10EUR: number;
  level2PointsPer10EUR: number;
  level3PointsPer10EUR: number;
  maxReferralLevel: number;
  updatedAt: string;
}

export interface ReferralPointRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  purchaserUserId: string;
  purchaserEmail: string;
  beneficiaryUserId: string;
  beneficiaryEmail: string;
  referralLevel: number;
  pointsPer10EUR: number;
  eligibleProductAmount: string;
  pointsAwarded: number;
  status: "AWARDED" | "REVERSED";
  createdAt: string;
}

export interface ReferralAdminOverview {
  referrals: {
    totalUsersWithReferralCodes: number;
    totalDirectReferrals: number;
    level1: number;
    level2: number;
    level3: number;
  };
  points: {
    purchaserPoints: number;
    level1Points: number;
    level2Points: number;
    level3Points: number;
    totalReferralPoints: number;
  };
  commission: {
    level1Commission: string;
    level2Commission: string;
    totalCommission: string;
  };
}

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export async function getUserReferralSummary() {
  return http<UserReferralSummary>("/referral-commissions", { token: getTokenOrThrow() });
}

export async function listOwnCommissions(params?: { page?: number; pageSize?: number }) {
  return http<{ items: ReferralCommissionRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
    `/referral-commissions/transactions${buildQueryString({ page: params?.page, pageSize: params?.pageSize })}`,
    { token: getTokenOrThrow() },
  );
}

export async function getCommissionConfig() {
  return http<ReferralCommissionConfig>("/admin/commission-config", { token: getTokenOrThrow() });
}

export async function updateCommissionConfig(payload: { levelNumber: number; rank: ReferralRank; percentage: number; isActive: boolean }) {
  return http<ReferralCommissionConfigItem>("/admin/commission-config", {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function updateCommissionSettings(payload: { maxCommissionLevel: number }) {
  return http<{ maxCommissionLevel: number }>("/admin/commission-settings", {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function getCommissionsOverview() {
  return http<ReferralCommissionOverview>("/admin/commissions/overview", { token: getTokenOrThrow() });
}

export async function listCommissions(params?: {
  page?: number;
  pageSize?: number;
  referrerUserId?: string;
  purchaserUserId?: string;
  rank?: ReferralRank;
  orderId?: string;
  level?: number;
  status?: ReferralCommissionStatus;
  from?: string;
  to?: string;
}) {
  return http<{ items: ReferralCommissionRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
    `/admin/commissions${buildQueryString({
      page: params?.page,
      pageSize: params?.pageSize,
      referrerUserId: params?.referrerUserId,
      purchaserUserId: params?.purchaserUserId,
      rank: params?.rank,
      orderId: params?.orderId,
      level: params?.level,
      status: params?.status,
      from: params?.from,
      to: params?.to,
    })}`,
    { token: getTokenOrThrow() },
  );
}

export async function getPointSettings() {
  return http<ReferralPointSettings>("/admin/referral-point-settings", { token: getTokenOrThrow() });
}

export async function updatePointSettings(payload: {
  purchaserPointsPer10EUR: number;
  level1PointsPer10EUR: number;
  level2PointsPer10EUR: number;
  level3PointsPer10EUR: number;
  maxReferralLevel: number;
}) {
  return http<ReferralPointSettings>("/admin/referral-point-settings", {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function listPointRewards(params?: {
  page?: number;
  pageSize?: number;
  purchaserUserId?: string;
  beneficiaryUserId?: string;
  level?: number;
  status?: "AWARDED" | "REVERSED";
  from?: string;
  to?: string;
}) {
  return http<{ items: ReferralPointRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
    `/admin/referral-points${buildQueryString({
      page: params?.page,
      pageSize: params?.pageSize,
      purchaserUserId: params?.purchaserUserId,
      beneficiaryUserId: params?.beneficiaryUserId,
      level: params?.level,
      status: params?.status,
      from: params?.from,
      to: params?.to,
    })}`,
    { token: getTokenOrThrow() },
  );
}

export async function getReferralOverview() {
  return http<ReferralAdminOverview>("/admin/referral-overview", { token: getTokenOrThrow() });
}
