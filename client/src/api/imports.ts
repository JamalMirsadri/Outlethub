import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type ImportSourceType = "MANUAL" | "JSON_FEED" | "XML_FEED" | "SCRAPER" | "AWIN" | "CJ";
export type ImportSourceStatus = "ACTIVE" | "DISABLED" | "ERROR";
export type SyncFrequency = "MANUAL" | "HOURLY" | "EVERY_6_HOURS" | "DAILY" | "WEEKLY";
export type ImportJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type ImportLogLevel = "INFO" | "WARN" | "ERROR";

export interface ImportSourceRecord {
  id: string;
  name: string;
  sourceType: ImportSourceType;
  website: string | null;
  status: ImportSourceStatus;
  lastSyncAt: string | null;
  syncFrequency: SyncFrequency;
  configuration: Record<string, unknown> | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRuleRecord {
  id: string;
  name: string;
  minDiscount: number;
  allowedBrands: string[];
  allowedCategories: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobRecord {
  id: string;
  sourceId: string | null;
  status: ImportJobStatus;
  triggerMode: string | null;
  totalCount: number;
  discoveredCount: number;
  fetchedCount: number;
  normalizedCount: number;
  validatedCount: number;
  processedCount: number;
  importedCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  latestSnapshot: {
    id: string;
    jobId: string;
    productCount: number;
    createdAt: string;
  } | null;
  source: {
    id: string;
    name: string;
    sourceType: ImportSourceType;
    website: string | null;
  } | null;
  scraperRun: {
    id: string;
    status: string;
    productsFound: number;
    discoveredCount: number;
    fetchedCount: number;
    normalizedCount: number;
    validatedCount: number;
    productsImported: number;
    productsUpdated: number;
    unchangedCount: number;
    failedCount: number;
    connectorRun: {
      id: string;
      strategyUsed: string | null;
      httpStatus: number | null;
      protectionType: string | null;
    } | null;
    source: {
      id: string;
      name: string;
      connectorKey: string;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportLogRecord {
  id: string;
  jobId: string;
  level: ImportLogLevel;
  message: string;
  createdAt: string;
  job: {
    id: string;
    status: ImportJobStatus;
    source: {
      id: string;
      name: string;
      sourceType: ImportSourceType;
    } | null;
  } | null;
}

export interface ImportDashboardSummary {
  activeSources: number;
  lastSyncAt: string | null;
  importedProducts: number;
  failedImports: number;
  dealCount: number;
}

export interface ImportObservabilityDashboardResponse {
  summary: {
    totalRuns: number;
    discoveredCount: number;
    fetchedCount: number;
    normalizedCount: number;
    validatedCount: number;
    importedCount: number;
    updatedCount: number;
    unchangedCount: number;
    failedCount: number;
    successRate: number;
    averageThroughput: number;
  };
  connectors: Array<{
    id: string;
    status: string;
    connectorConfigurationId: string;
    connectorName: string;
    strategyUsed: string | null;
    httpStatus: number | null;
    protectionType: string | null;
    urlsDiscovered: number;
    urlsProcessed: number;
    discoveredCount: number;
    fetchedCount: number;
    normalizedCount: number;
    validatedCount: number;
    importedCount: number;
    updatedCount: number;
    unchangedCount: number;
    failedCount: number;
    duplicateUrlsRemoved: number;
    urlsSkipped: number;
    validationFailureCount: number;
    rejectedCount: number;
    durationMs: number | null;
    completedAt: string | null;
  }>;
  failureReasons: Array<{
    reason: string | null;
    count: number;
  }>;
  sources: ImportSourceRecord[];
}

export interface ImportProductResultRecord {
  id: string;
  status: "NEW" | "UPDATED" | "UNCHANGED" | "FAILED";
  failureReason: string | null;
  stage: string | null;
  productName: string | null;
  brand: string | null;
  category: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  currentPrice: number | null;
  oldPrice: number | null;
  existingContentHash: string | null;
  newContentHash: string | null;
  productId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobDetailResponse {
  job: ImportJobRecord;
  executionTrace: {
    discovery: number;
    fetch: number;
    normalize: number;
    validate: number;
    upsert: number;
    catalog: number;
  };
  processingDurationMs: number | null;
  logs: ImportLogRecord[];
  firstProcessedProducts: ImportProductResultRecord[];
  catalogRecords: Array<{
    id: string;
    name: string;
    brand: string;
    currentPrice: number;
    sourceUrl: string | null;
    lastSync: string | null;
    importStatus: string;
  }>;
  connectorRun: {
    id: string;
    strategyUsed: string | null;
    httpStatus: number | null;
    protectionType: string | null;
    diagnosticsPayload: Record<string, unknown> | null;
    discoveryPayload: Record<string, unknown> | null;
    normalizationPayload: Record<string, unknown> | null;
    upsertPayload: Record<string, unknown> | null;
  } | null;
}

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export async function getImportsDashboard() {
  return http<{ summary: ImportDashboardSummary; sources: ImportSourceRecord[] }>("/admin/imports", {
    token: getTokenOrThrow(),
  });
}

export async function getImportObservabilityDashboard() {
  return http<ImportObservabilityDashboardResponse>("/admin/import-observability", {
    token: getTokenOrThrow(),
  });
}

export async function listImportSources() {
  const response = await http<{ items: ImportSourceRecord[] }>("/admin/imports/sources", {
    token: getTokenOrThrow(),
  });
  return response.items;
}

export async function createImportSource(payload: {
  name: string;
  sourceType: ImportSourceType;
  website?: string | null;
  status?: ImportSourceStatus;
  syncFrequency: SyncFrequency;
  configuration?: Record<string, unknown> | null;
}) {
  return http<ImportSourceRecord>("/admin/imports/sources", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function updateImportSource(
  id: string,
  payload: Partial<{
    name: string;
    sourceType: ImportSourceType;
    website: string | null;
    status: ImportSourceStatus;
    syncFrequency: SyncFrequency;
    configuration: Record<string, unknown> | null;
  }>,
) {
  return http<ImportSourceRecord>(`/admin/imports/sources/${id}`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function deleteImportSource(id: string) {
  return http<void>(`/admin/imports/sources/${id}`, {
    method: "DELETE",
    token: getTokenOrThrow(),
  });
}

export async function runImport(sourceId: string) {
  return http<{ jobId: string; status: ImportJobStatus }>("/admin/imports/run", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ sourceId }),
  });
}

export async function uploadImport(payload: {
  sourceId?: string;
  name?: string;
  sourceType?: ImportSourceType;
  website?: string | null;
  format: "json" | "xml";
  content: string;
  configuration?: Record<string, unknown> | null;
}) {
  return http<{ jobId: string; status: ImportJobStatus }>("/admin/imports/upload", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function listImportJobs(params?: Partial<{ status: ImportJobStatus; sourceId: string; limit: number }>) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.sourceId) searchParams.set("sourceId", params.sourceId);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await http<{ items: ImportJobRecord[] }>(
    `/admin/imports/jobs${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );
  return response.items;
}

export async function getImportJobDetail(id: string) {
  return http<ImportJobDetailResponse>(`/admin/imports/jobs/${id}`, {
    token: getTokenOrThrow(),
  });
}

export async function listImportLogs(params?: Partial<{ jobId: string; level: ImportLogLevel; limit: number }>) {
  const searchParams = new URLSearchParams();
  if (params?.jobId) searchParams.set("jobId", params.jobId);
  if (params?.level) searchParams.set("level", params.level);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await http<{ items: ImportLogRecord[] }>(
    `/admin/imports/logs${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );
  return response.items;
}

export async function listImportRules() {
  const response = await http<{ items: ImportRuleRecord[] }>("/admin/imports/rules", {
    token: getTokenOrThrow(),
  });
  return response.items;
}

export async function createImportRule(payload: {
  name: string;
  minDiscount: number;
  allowedBrands: string[];
  allowedCategories: string[];
  isActive?: boolean;
}) {
  return http<ImportRuleRecord>("/admin/imports/rules", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function updateImportRule(
  id: string,
  payload: Partial<{
    name: string;
    minDiscount: number;
    allowedBrands: string[];
    allowedCategories: string[];
    isActive: boolean;
  }>,
) {
  return http<ImportRuleRecord>(`/admin/imports/rules/${id}`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function deleteImportRule(id: string) {
  return http<void>(`/admin/imports/rules/${id}`, {
    method: "DELETE",
    token: getTokenOrThrow(),
  });
}
