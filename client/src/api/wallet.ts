import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type WalletStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";

export interface WalletUser {
  id: string;
  email: string;
  fullName: string | null;
}

export interface WalletView {
  id: string;
  walletId: string;
  userId: string;
  currency: string;
  balance: string;
  status: WalletStatus;
  createdAt: string;
  pendingWithdrawals?: WithdrawalView[];
  user?: WalletUser;
  withdrawals?: WithdrawalView[];
  transactions?: WalletTransactionView[];
}

export interface WalletTransactionView {
  id: string;
  walletId: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface WithdrawalView {
  id: string;
  walletId: string;
  userId: string;
  amount: string;
  currency: string;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  adminNote: string | null;
  user?: WalletUser;
}

export interface WalletOverview {
  totalWallets: number;
  activeWallets: number;
  suspendedWallets: number;
  totalBalance: string;
  pendingWithdrawals: number;
  totalCredits: string;
  totalDebits: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
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

export async function getWallet() {
  return http<WalletView>("/wallet", { token: getTokenOrThrow() });
}

export async function listWalletTransactions(params?: { page?: number; pageSize?: number }) {
  return http<Paginated<WalletTransactionView>>(
    `/wallet/transactions${buildQueryString({ page: params?.page, pageSize: params?.pageSize })}`,
    { token: getTokenOrThrow() },
  );
}

export async function requestWithdrawal(amount: string) {
  return http<WithdrawalView>("/wallet/withdrawals", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ amount }),
  });
}

export async function getWalletOverview() {
  return http<WalletOverview>("/admin/wallets/overview", { token: getTokenOrThrow() });
}

export async function listWallets(params?: { page?: number; pageSize?: number; search?: string; status?: WalletStatus }) {
  return http<Paginated<WalletView>>(
    `/admin/wallets${buildQueryString({ page: params?.page, pageSize: params?.pageSize, search: params?.search, status: params?.status })}`,
    { token: getTokenOrThrow() },
  );
}

export async function getAdminWallet(walletId: string) {
  return http<WalletView>(`/admin/wallets/${walletId}`, { token: getTokenOrThrow() });
}

export async function creditWallet(walletId: string, payload: { amount: string; reason: string; reference?: string }) {
  return http<{ wallet: { walletId: string; balance: string }; transaction: WalletTransactionView }>(
    `/admin/wallets/${walletId}/credit`,
    { method: "POST", token: getTokenOrThrow(), body: JSON.stringify(payload) },
  );
}

export async function debitWallet(walletId: string, payload: { amount: string; reason: string; reference?: string }) {
  return http<{ wallet: { walletId: string; balance: string }; transaction: WalletTransactionView }>(
    `/admin/wallets/${walletId}/debit`,
    { method: "POST", token: getTokenOrThrow(), body: JSON.stringify(payload) },
  );
}

export async function suspendWallet(walletId: string, reason?: string) {
  return http<WalletView>(`/admin/wallets/${walletId}/suspend`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function activateWallet(walletId: string, reason?: string) {
  return http<WalletView>(`/admin/wallets/${walletId}/activate`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function listWithdrawals(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WithdrawalStatus;
}) {
  return http<Paginated<WithdrawalView>>(
    `/admin/wallet-withdrawals${buildQueryString({ page: params?.page, pageSize: params?.pageSize, search: params?.search, status: params?.status })}`,
    { token: getTokenOrThrow() },
  );
}

export async function approveWithdrawal(id: string, adminNote?: string) {
  return http<WithdrawalView>(`/admin/wallet-withdrawals/${id}/approve`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ adminNote: adminNote ?? null }),
  });
}

export async function rejectWithdrawal(id: string, adminNote?: string) {
  return http<WithdrawalView>(`/admin/wallet-withdrawals/${id}/reject`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ adminNote: adminNote ?? null }),
  });
}

export async function cancelWithdrawal(id: string, adminNote?: string) {
  return http<WithdrawalView>(`/admin/wallet-withdrawals/${id}/cancel`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ adminNote: adminNote ?? null }),
  });
}

export async function completeWithdrawal(id: string, adminNote?: string) {
  return http<WithdrawalView>(`/admin/wallet-withdrawals/${id}/complete`, {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ adminNote: adminNote ?? null }),
  });
}
