import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";
import type { CartPromotionRecord, CouponDiscountType, CouponStatus } from "@/api/commerce";

function getRequiredToken(): string {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export interface CouponRecord {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  percentage: number | null;
  fixedAmount: number | null;
  freeShipping: boolean;
  minimumOrderAmount: number | null;
  maximumDiscountAmount: number | null;
  usageLimit: number | null;
  usagePerUser: number | null;
  startsAt: string | null;
  endsAt: string | null;
  allowedProductIds: string[];
  allowedCategoryIds: string[];
  allowedBrandIds: string[];
  excludedProductIds: string[];
  excludedCategoryIds: string[];
  excludedBrandIds: string[];
  allowedMembershipLevelIds: string[];
  status: CouponStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CouponUsageRecord {
  id: string;
  code: string;
  discountAmount: number;
  shippingDiscountAmount: number;
  totalSavingsAmount: number;
  qualifiedSubtotal: number;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customerEmail: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface CouponAdminOverviewResponse {
  summary: {
    totalCoupons: number;
    activeCoupons: number;
    totalUsages: number;
  };
  coupons: CouponRecord[];
  usageHistory: CouponUsageRecord[];
  membershipLevels: Array<{
    id: string;
    title: string;
    color: string;
    icon: string | null;
    minPoints: number;
  }>;
}

export interface CouponPayload {
  code: string;
  description?: string | null;
  discountType: CouponDiscountType;
  percentage?: number | null;
  fixedAmount?: number | null;
  freeShipping?: boolean;
  minimumOrderAmount?: number | null;
  maximumDiscountAmount?: number | null;
  usageLimit?: number | null;
  usagePerUser?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  allowedProductIds?: string[];
  allowedCategoryIds?: string[];
  allowedBrandIds?: string[];
  excludedProductIds?: string[];
  excludedCategoryIds?: string[];
  excludedBrandIds?: string[];
  allowedMembershipLevelIds?: string[];
  status?: CouponStatus;
}

export async function getAdminCouponOverview() {
  return http<CouponAdminOverviewResponse>("/admin/coupons", {
    token: getRequiredToken(),
  });
}

export async function createCoupon(payload: CouponPayload) {
  return http<CouponRecord>("/admin/coupons", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function updateCoupon(id: string, payload: Partial<CouponPayload>) {
  return http<CouponRecord>(`/admin/coupons/${id}`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function deleteCoupon(id: string) {
  return http<void>(`/admin/coupons/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}

export async function duplicateCoupon(id: string) {
  return http<CouponRecord>(`/admin/coupons/${id}/duplicate`, {
    method: "POST",
    token: getRequiredToken(),
  });
}

export async function applyCheckoutPromotionCode(code: string) {
  return http<CartPromotionRecord>("/checkout/promotion", {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify({ code }),
  });
}

export async function clearCheckoutPromotionCode() {
  return http<void>("/checkout/promotion", {
    method: "DELETE",
    token: getRequiredToken(),
  });
}
