import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type ConnectorSourceType = "PLAYWRIGHT" | "JSON_FEED" | "XML_FEED" | "MANUAL_IMPORT";
export type ConnectorStatus = "ACTIVE" | "DISABLED" | "ERROR";
export type ConnectorRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type SyncFrequency = "MANUAL" | "HOURLY" | "EVERY_6_HOURS" | "DAILY" | "WEEKLY";
export type ConnectorStrategy = "SITEMAP" | "PLAYWRIGHT" | "JSON_API" | "XML_FEED" | "HTML_FETCH";
export type ConnectorProtectionType = "NONE" | "AKAMAI" | "CLOUDFLARE" | "DATADOME" | "UNKNOWN";

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export interface ConnectorTemplateRecord {
  id: string;
  key: string;
  name: string;
  sourceType: ConnectorSourceType;
  description: string | null;
  isSystemTemplate: boolean;
}

export interface ConnectorDetailRecord {
  id: string;
  brandSourceId: string;
  template: ConnectorTemplateRecord;
  brandSource: {
    id: string;
    brandName: string;
    website: string;
    countryCode: string | null;
    currencyCode: string | null;
    region: string | null;
    sourceType: ConnectorSourceType;
    status: ConnectorStatus;
  };
  isEnabled: boolean;
  feedUrl: string | null;
  recordPath: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  importApprovedAt: string | null;
  fieldMappings: Array<{
    id: string;
    externalField: string;
    internalField: string;
  }>;
  executionProfile: {
    id: string;
    listingUrl: string | null;
    headless: boolean;
    timeoutMs: number;
    retryAttempts: number;
    userAgent: string | null;
    maxRequestsPerMinute: number | null;
    maxConcurrentPages: number | null;
    pageLimit: number;
    sampleSize: number;
    productCardSelector: string | null;
    productNameSelector: string | null;
    productPriceSelector: string | null;
    productOldPriceSelector: string | null;
    productImageSelector: string | null;
    productUrlSelector: string | null;
    paginationSelector: string | null;
    nextPageSelector: string | null;
  } | null;
  scraperSource: {
    id: string;
    name: string;
    status: ConnectorStatus;
    syncFrequency: SyncFrequency;
    connectorKey: string;
    lastRunAt: string | null;
    runCount: number;
  } | null;
  latestRun: {
    id: string;
    status: ConnectorRunStatus;
    productsFound: number;
    productsImported: number;
    productsUpdated: number;
    failedCount: number;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  latestSync: {
    id: string;
    status: ConnectorRunStatus;
    productsChecked: number;
    productsChanged: number;
    completedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  health?: {
    healthScore: number;
    websiteReachable: boolean;
    selectorsValid: boolean;
    productsFound: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
  };
}

export interface ConnectorDashboardResponse {
  summary: {
    dynamicConnectorsCreated: number;
    activeConnectors: number;
    failedConnectors: number;
    importedProducts: number;
    productsUpdated: number;
  };
  items: ConnectorDetailRecord[];
}

export interface ConnectorPreviewResponse {
  productCount: number;
  parsedFields: string[];
  sampleProducts: Array<{
    name: string;
    brand: string;
    category: string;
    price: number;
    oldPrice: number | null;
    discountPercent: number;
    imageUrl: string | null;
    sourceStore: string;
    sourceUrl: string | null;
    sourceProductId: string | null;
    description: string | null;
    currency: string;
    contentHash: string;
  }>;
  rawSamples: Array<Record<string, unknown>>;
  strategyUsed: ConnectorStrategy;
  diagnostics: ConnectorDiagnosticsResponse;
}

export interface ConnectorTestResponse {
  websiteReachable: boolean;
  selectorsWorking: boolean;
  productsFound: number;
  parsedFields: string[];
  sampleProducts: ConnectorPreviewResponse["sampleProducts"];
  strategyUsed: ConnectorStrategy | null;
  diagnostics: ConnectorDiagnosticsResponse | null;
  autoRepair: ConnectorAutoRepairResponse | null;
}

export interface ConnectorDiagnosticsResponse {
  inspectedUrl: string;
  finalUrl: string;
  httpStatus: number;
  redirects: string[];
  websiteReachable: boolean;
  protectionType: ConnectorProtectionType;
  strategyUsed: ConnectorStrategy;
  sitemapUrl: string | null;
  productsFound: number;
  message: string | null;
}

export interface ConnectorAnalyzeResponse {
  websiteReachable: boolean;
  analyzedUrl: string;
  analyzedUrls: string[];
  selectors: {
    productCardSelector: string | null;
    productNameSelector: string | null;
    productPriceSelector: string | null;
    productOldPriceSelector: string | null;
    productImageSelector: string | null;
    productUrlSelector: string | null;
    paginationSelector: string | null;
    nextPageSelector: string | null;
  };
  parsedFields: string[];
  productsFound: number;
  sampleProducts: ConnectorPreviewResponse["sampleProducts"];
}

export interface ConnectorAutoRepairResponse {
  brandSourceId: string;
  websiteUrl: string;
  suggestedExecutionProfile: {
    listingUrl: string;
    productCardSelector: string | null;
    productNameSelector: string | null;
    productPriceSelector: string | null;
    productOldPriceSelector: string | null;
    productImageSelector: string | null;
    productUrlSelector: string | null;
    paginationSelector: string | null;
    nextPageSelector: string | null;
    sampleSize: number;
  };
  sampleProducts: ConnectorPreviewResponse["sampleProducts"];
  productsFound: number;
  parsedFields: string[];
}

export interface ConnectorHealthDashboardResponse {
  summary: {
    averageHealthScore: number;
    healthyConnectors: number;
    needsAttention: number;
  };
  items: Array<ConnectorDetailRecord & {
    health: NonNullable<ConnectorDetailRecord["health"]>;
    recommendedAction: string;
  }>;
}

export async function getConnectorsDashboard() {
  return http<ConnectorDashboardResponse>("/admin/connectors", {
    token: getTokenOrThrow(),
  });
}

export async function getConnectorsHealth() {
  return http<ConnectorHealthDashboardResponse>("/admin/connectors/health", {
    token: getTokenOrThrow(),
  });
}

export async function listConnectorTemplates() {
  const response = await http<{ items: ConnectorTemplateRecord[] }>("/admin/connectors/templates", {
    token: getTokenOrThrow(),
  });

  return response.items;
}

export async function getConnectorDetail(brandSourceId: string) {
  return http<ConnectorDetailRecord>(`/admin/connectors/${brandSourceId}`, {
    token: getTokenOrThrow(),
  });
}

export async function updateConnectorDetail(
  brandSourceId: string,
  payload: Partial<{
    templateKey: string;
    syncFrequency: SyncFrequency;
    isEnabled: boolean;
    feedUrl: string | null;
    recordPath: string | null;
    fieldMappings: Array<{ externalField: string; internalField: string }>;
    executionProfile: Partial<ConnectorDetailRecord["executionProfile"]>;
  }>,
) {
  return http<ConnectorDetailRecord>(`/admin/connectors/${brandSourceId}`, {
    method: "PUT",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function testConnector(brandSourceId: string) {
  return http<ConnectorTestResponse>(`/admin/connectors/${brandSourceId}/test`, {
    method: "POST",
    token: getTokenOrThrow(),
  });
}

export async function analyzeConnectorWebsite(payload: {
  websiteUrl: string;
  brandName?: string | null;
  currencyCode?: string | null;
}) {
  return http<ConnectorAnalyzeResponse>("/admin/connectors/analyze", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function previewConnectorImport(brandSourceId: string) {
  return http<ConnectorPreviewResponse>(`/admin/connectors/${brandSourceId}/preview`, {
    method: "POST",
    token: getTokenOrThrow(),
  });
}

export async function getConnectorDiagnostics(brandSourceId: string) {
  return http<ConnectorDiagnosticsResponse>(`/admin/connectors/${brandSourceId}/diagnostics`, {
    token: getTokenOrThrow(),
  });
}

export async function runConnectorImport(brandSourceId: string) {
  return http<{ runId: string; status: ConnectorRunStatus; sourceId: string; trigger: "manual" | "schedule" }>(
    `/admin/connectors/${brandSourceId}/run`,
    {
      method: "POST",
      token: getTokenOrThrow(),
      body: JSON.stringify({ trigger: "manual" }),
    },
  );
}

export async function autoRepairConnector(brandSourceId: string) {
  return http<ConnectorAutoRepairResponse>(`/admin/connectors/${brandSourceId}/auto-repair`, {
    method: "POST",
    token: getTokenOrThrow(),
  });
}

export async function listConnectorImportHistory(brandSourceId: string) {
  const response = await http<{
    items: Array<{
      id: string;
      status: ConnectorRunStatus;
      productsFound: number;
      productsImported: number;
      productsUpdated: number;
      failedCount: number;
      errorMessage: string | null;
      startedAt: string | null;
      completedAt: string | null;
      importJob: {
        id: string;
        status: string;
        importedCount: number;
        updatedCount: number;
      } | null;
    }>;
  }>(`/admin/connectors/${brandSourceId}/history`, {
    token: getTokenOrThrow(),
  });

  return response.items;
}
