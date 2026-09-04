import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type ReferralRank = "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
export type ReferralCommissionStatus = "AWARDED" | "REVERSED";

export interface ReferralCommissionConfigItem {
  rank: ReferralRank;
  percentage: string;
  isActive: boolean;
  updatedAt: string;
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
  recentCommissions: Array<{
    id: string;
    orderId: string;
    orderNumber: string;
    rank: ReferralRank;
    percentage: string;
    eligibleProductAmount: string;
    commissionAmount: string;
    status: ReferralCommissionStatus;
    createdAt: string;
  }>;
}

export interface ReferralCommissionOverview {
  totalCommissions: number;
  totalAmount: string;
  reversedCommissions: number;
  byRank: Array<{ rank: ReferralRank; count: number; amount: string }>;
  topReferrers: Array<{ referrerUserId: string; amount: string }>;
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
  return http<{ items: ReferralCommissionConfigItem[] }>("/admin/commission-config", { token: getTokenOrThrow() });
}

export async function updateCommissionConfig(payload: { rank: ReferralRank; percentage: number; isActive: boolean }) {
  return http<ReferralCommissionConfigItem>("/admin/commission-config", {
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
  rank?: ReferralRank;
  orderId?: string;
  status?: ReferralCommissionStatus;
  from?: string;
  to?: string;
}) {
  return http<{ items: ReferralCommissionRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
    `/admin/commissions${buildQueryString({
      page: params?.page,
      pageSize: params?.pageSize,
      referrerUserId: params?.referrerUserId,
      rank: params?.rank,
      orderId: params?.orderId,
      status: params?.status,
      from: params?.from,
      to: params?.to,
    })}`,
    { token: getTokenOrThrow() },
  );
}
