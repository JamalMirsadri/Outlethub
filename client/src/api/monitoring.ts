import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type SyncFrequency = "MANUAL" | "HOURLY" | "EVERY_6_HOURS" | "DAILY" | "WEEKLY";
export type ScraperStatus = "ACTIVE" | "DISABLED" | "ERROR";
export type SyncRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type AlertType = "PRICE_DROP" | "PRICE_INCREASE" | "STOCK_CHANGE" | "SYNC_FAILURE" | "SCRAPER_FAILURE";
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface MonitoringDashboardResponse {
  summary: {
    totalSources: number;
    activeSources: number;
    totalSyncRuns: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    importedCount: number;
    updatedCount: number;
    unchangedCount: number;
    failedCount: number;
    averageHealthScore: number;
  };
  selectedSource: {
    id: string;
    name: string;
    status: ScraperStatus;
    connectorKey: string;
    syncFrequency: SyncFrequency;
    lastRunAt: string | null;
    lastSyncStatus: SyncRunStatus | null;
    healthScore: number;
    successRate: number;
    failureRate: number;
    productYield: number;
    runtimeStability: number;
    importedCount: number;
    updatedCount: number;
    unchangedCount: number;
    failedCount: number;
  } | null;
  sources: Array<{
    id: string;
    name: string;
    status: ScraperStatus;
    connectorKey: string;
    syncFrequency: SyncFrequency;
    lastRunAt: string | null;
    lastSyncStatus: SyncRunStatus | null;
    healthScore: number;
    successRate: number;
    failureRate: number;
    productYield: number;
    runtimeStability: number;
    importedCount: number;
    updatedCount: number;
    unchangedCount: number;
    failedCount: number;
  }>;
  monitoring: {
    lastSync: {
      id: string;
      startedAt: string | null;
      completedAt: string | null;
      status: SyncRunStatus;
      productsChecked: number;
      productsChanged: number;
      createdAt: string;
      updatedAt: string;
    } | null;
    productsChecked: number;
    productsChanged: number;
    priceDrops: number;
    priceChanges: number;
    stockChanges: number;
    failedSyncs: number;
  };
  analytics: {
    importedProducts: number;
    activeProducts: number;
    priceChangeCount: number;
    averageDiscount: number;
    topDeals: Array<{
      id: string;
      name: string;
      price: number;
      oldPrice: number | null;
      discountPercent: number;
      dealLevel: string;
      sourceUrl: string | null;
      updatedAt: string;
    }>;
  } | null;
  recentRuns: SyncHistoryRecord[];
  failureReasons: Array<{
    reason: string | null;
    count: number;
  }>;
  alerts: {
    total: number;
    unread: number;
    critical: number;
  };
  queueStatus: {
    syncScheduler: Record<string, number>;
    priceMonitor: Record<string, number>;
  };
}

export interface AlertRecord {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface SyncHistoryRecord {
  id: string;
  sourceId: string;
  startedAt: string | null;
  completedAt: string | null;
  status: SyncRunStatus;
  productsChecked: number;
  productsChanged: number;
  source: {
    id: string;
    name: string;
    connectorKey: string;
    syncFrequency: SyncFrequency;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMonitoringLogRecord {
  id: string;
  status: "UPDATED" | "NO_CHANGES" | "FAILED" | "BLOCKED" | "REMOVED";
  changedFields: string[];
  errorMessage: string | null;
  responseTimeMs: number | null;
  responseStatus: number | null;
  lastCheckedAt: string;
  nextScheduledCheck: string | null;
  createdAt: string;
}

export interface ProductMonitoringOverview {
  productId: string;
  sourceUrl: string | null;
  enabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  lastCheckedAt: string | null;
  nextScheduledCheck: string | null;
  latestLog: ProductMonitoringLogRecord | null;
}

export interface GlobalProductMonitoringSettings {
  enabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
}

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export async function getMonitoringDashboard(params?: { sourceId?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.sourceId) searchParams.set("sourceId", params.sourceId);

  return http<MonitoringDashboardResponse>(`/admin/monitoring${searchParams.size ? `?${searchParams.toString()}` : ""}`, {
    token: getTokenOrThrow(),
  });
}

export async function runMonitoringSync(sourceId: string, trigger: "manual" | "schedule" = "manual") {
  return http<{ sourceId: string; status: string; trigger: "manual" | "schedule" }>("/admin/monitoring/run", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ sourceId, trigger }),
  });
}

export async function updateMonitoringSourceSettings(payload: { sourceId: string } & Partial<{ syncFrequency: SyncFrequency; status: ScraperStatus }>) {
  return http<{ id: string; syncFrequency: SyncFrequency; status: ScraperStatus }>("/admin/monitoring/settings", {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function listAlerts(params?: Partial<{ unreadOnly: boolean; limit: number }>) {
  const searchParams = new URLSearchParams();
  if (typeof params?.unreadOnly === "boolean") searchParams.set("unreadOnly", String(params.unreadOnly));
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await http<{ items: AlertRecord[] }>(
    `/admin/alerts${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );

  return response.items;
}

export async function markAlertRead(id: string) {
  return http<{ id: string; isRead: boolean }>(`/admin/alerts/${id}/read`, {
    method: "PATCH",
    token: getTokenOrThrow(),
  });
}

export async function listSyncHistory(params?: Partial<{ sourceId: string; status: SyncRunStatus; limit: number }>) {
  const searchParams = new URLSearchParams();
  if (params?.sourceId) searchParams.set("sourceId", params.sourceId);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await http<{ items: SyncHistoryRecord[] }>(
    `/admin/sync-history${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );

  return response.items;
}

export async function getGlobalProductMonitoringSettings() {
  return http<GlobalProductMonitoringSettings>("/admin/monitoring/product-settings", {
    token: getTokenOrThrow(),
  });
}

export async function updateGlobalProductMonitoringSettings(
  payload: Partial<{
    enabled: boolean;
    intervalMinutes: number;
    timeoutMs: number;
  }>,
) {
  return http<GlobalProductMonitoringSettings>("/admin/monitoring/product-settings", {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function getProductMonitoringSettings(productId: string) {
  return http<ProductMonitoringOverview>(`/admin/monitoring/products/${productId}`, {
    token: getTokenOrThrow(),
  });
}

export async function updateProductMonitoringSettings(
  productId: string,
  payload: Partial<{
    enabled: boolean;
    intervalMinutes: number | null;
  }>,
) {
  return http<{
    productId: string;
    override: {
      enabled?: boolean;
      intervalMinutes?: number | null;
    };
    resolved: {
      enabled: boolean;
      intervalMinutes: number;
      timeoutMs: number;
      override: {
        enabled?: boolean;
        intervalMinutes?: number | null;
      } | null;
    };
  }>(`/admin/monitoring/products/${productId}/settings`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function runProductMonitoring(productId: string, trigger: "manual" | "schedule" = "manual") {
  return http<{ productId: string; status: string; trigger: "manual" | "schedule" }>(
    `/admin/monitoring/products/${productId}/run`,
    {
      method: "POST",
      token: getTokenOrThrow(),
      body: JSON.stringify({ trigger }),
    },
  );
}
