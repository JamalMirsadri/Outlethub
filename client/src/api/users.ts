import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type AdminUserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  preferredCurrency: string;
  status: AdminUserStatus;
  role: "CUSTOMER";
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    ordersCount: number;
    totalSpent: number;
    totalRefunded: number;
    waitingPaymentCount: number;
    waitingApprovalCount: number;
    waitingReceiveCount: number;
    deliveredCount: number;
    cancelledCount: number;
    activeSessionCount: number;
    defaultShippingAddressId: string | null;
    defaultBillingAddressId: string | null;
  };
}

export interface AdminUserDetail extends AdminUserSummary {
  addresses: Array<{
    id: string;
    fullName: string;
    phone: string | null;
    countryCode: string;
    city: string;
    postalCode: string;
    addressLine1: string;
    addressLine2: string | null;
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    refundedAmount: number;
    currency: string;
    paymentProvider: string;
    paymentStatus: string | null;
    customerName: string;
    customerEmail: string;
    trackingNumber: string | null;
    carrier: string | null;
    estimatedDeliveryDate: string | null;
    createdAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    itemCount: number;
    items: Array<{
      id: string;
      productId: string | null;
      title: string;
      brandName: string | null;
      quantity: number;
      imageUrl: string | null;
      unitPrice: number;
      totalPrice: number;
    }>;
    waitingPayment: boolean;
    waitingApproval: boolean;
    waitingReceive: boolean;
  }>;
  recentPayments: Array<{
    id: string;
    provider: string;
    kind: string;
    status: string;
    currency: string;
    amount: number;
    paymentReference: string | null;
    reviewRequestedAt: string | null;
    approvedAt: string | null;
    processedAt: string | null;
    createdAt: string;
    orderId: string | null;
  }>;
  sessionCount: number;
}

interface AdminUsersListResponse {
  items: AdminUserSummary[];
  summary: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    suspendedUsers: number;
    deletedUsers: number;
    waitingPaymentUsers: number;
    waitingApprovalUsers: number;
    waitingReceiveUsers: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function getRequiredToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
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

export async function listAdminUsers(params?: {
  search?: string;
  status?: AdminUserStatus | "ALL";
  sort?: "newest" | "oldest" | "lastLogin";
  page?: number;
  pageSize?: number;
}) {
  const query = buildQueryString({
    search: params?.search,
    status: params?.status && params.status !== "ALL" ? params.status : undefined,
    sort: params?.sort ?? "newest",
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 50,
  });

  return http<AdminUsersListResponse>(`/admin/users${query}`, {
    token: getRequiredToken(),
  });
}

export async function getAdminUserDetail(id: string) {
  return http<AdminUserDetail>(`/admin/users/${id}`, {
    token: getRequiredToken(),
  });
}

export async function updateAdminUserStatus(id: string, status: Exclude<AdminUserStatus, "PENDING">) {
  return http<AdminUserDetail>(`/admin/users/${id}/status`, {
    method: "PATCH",
    token: getRequiredToken(),
    body: JSON.stringify({ status }),
  });
}

export async function adminResetUserPassword(
  id: string,
  payload: { newPassword: string; confirmPassword: string },
) {
  return http<{ message: string }>(`/admin/users/${id}/reset-password`, {
    method: "POST",
    token: getRequiredToken(),
    body: JSON.stringify(payload),
  });
}

export async function revokeAdminUserSessions(id: string) {
  return http<{ message: string }>(`/admin/users/${id}/revoke-sessions`, {
    method: "POST",
    token: getRequiredToken(),
  });
}

export async function deleteAdminUser(id: string) {
  return http<AdminUserDetail>(`/admin/users/${id}`, {
    method: "DELETE",
    token: getRequiredToken(),
  });
}
