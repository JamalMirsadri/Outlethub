import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type ErrorLogType = "FRONTEND" | "API" | "BACKEND";
export type ErrorLogSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type ErrorLogSort = "newest" | "oldest" | "occurrences";

export interface ErrorLogRecord {
  id: string;
  type: ErrorLogType;
  severity: ErrorLogSeverity;
  message: string;
  stack: string | null;
  source: string | null;
  page: string | null;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  ip: string | null;
  requestId: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolved: boolean;
  note: string | null;
  createdAt: string;
}

export interface SystemLogsListResponse {
  items: ErrorLogRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SystemLogsSummary {
  total: number;
  unresolved: number;
  critical: number;
  high: number;
  byType: Array<{ type: ErrorLogType; count: number }>;
  bySeverity: Array<{ severity: ErrorLogSeverity; count: number }>;
}

export interface ListSystemLogsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: ErrorLogSeverity;
  type?: ErrorLogType;
  resolved?: boolean;
  userId?: string;
  route?: string;
  from?: string;
  to?: string;
  sort?: ErrorLogSort;
}

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
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

export async function listSystemLogs(params?: ListSystemLogsParams) {
  return http<SystemLogsListResponse>(
    `/admin/system-logs${buildQueryString({
      page: params?.page,
      pageSize: params?.pageSize,
      search: params?.search,
      severity: params?.severity,
      type: params?.type,
      resolved: params?.resolved,
      userId: params?.userId,
      route: params?.route,
      from: params?.from,
      to: params?.to,
      sort: params?.sort,
    })}`,
    { token: getTokenOrThrow() },
  );
}

export async function getSystemLogsSummary() {
  return http<SystemLogsSummary>("/admin/system-logs/summary", {
    token: getTokenOrThrow(),
  });
}

export async function getSystemLog(id: string) {
  return http<ErrorLogRecord>(`/admin/system-logs/${id}`, {
    token: getTokenOrThrow(),
  });
}

export async function resolveSystemLog(id: string) {
  return http<ErrorLogRecord>(`/admin/system-logs/${id}/resolve`, {
    method: "PATCH",
    token: getTokenOrThrow(),
  });
}

export async function addSystemLogNote(id: string, note: string) {
  return http<ErrorLogRecord>(`/admin/system-logs/${id}/note`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify({ note }),
  });
}

export async function deleteSystemLog(id: string) {
  return http<{ id: string; deleted: boolean }>(`/admin/system-logs/${id}`, {
    method: "DELETE",
    token: getTokenOrThrow(),
  });
}
