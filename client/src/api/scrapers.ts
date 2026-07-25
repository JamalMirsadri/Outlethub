import { getAccessToken } from "@/services/auth.service";
import { http } from "@/services/http";

export type ScraperType = "PLAYWRIGHT" | "PUPPETEER";
export type ScraperStatus = "ACTIVE" | "DISABLED" | "ERROR";
export type ScraperRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type ScraperArtifactType = "SCREENSHOT" | "HTML_DUMP" | "JSON_DUMP";

export interface ScraperSourceRecord {
  id: string;
  name: string;
  website: string | null;
  status: ScraperStatus;
  scraperType: ScraperType;
  connectorKey: string;
  lastRunAt: string | null;
  configuration: Record<string, unknown> | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScraperArtifactRecord {
  id: string;
  scraperRunId: string;
  type: ScraperArtifactType;
  filePath: string;
  createdAt: string;
}

export interface ScraperRunRecord {
  id: string;
  sourceId: string;
  status: ScraperRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  productsFound: number;
  productsImported: number;
  productsUpdated: number;
  failedCount: number;
  errorMessage: string | null;
  artifacts: ScraperArtifactRecord[];
  importJob: {
    id: string;
    status: string;
    importedCount: number;
    updatedCount: number;
  } | null;
  source: {
    id: string;
    name: string;
    scraperType: ScraperType;
    connectorKey: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScraperDashboardSummary {
  activeScrapers: number;
  lastRunAt: string | null;
  productsFound: number;
  productsImported: number;
  failedRuns: number;
}

function getTokenOrThrow(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication is required.");
  }

  return token;
}

export async function getScrapersDashboard() {
  return http<{ summary: ScraperDashboardSummary; sources: ScraperSourceRecord[] }>("/admin/scrapers", {
    token: getTokenOrThrow(),
  });
}

export async function listScraperSources() {
  const response = await http<{ items: ScraperSourceRecord[] }>("/admin/scrapers/sources", {
    token: getTokenOrThrow(),
  });
  return response.items;
}

export async function createScraperSource(payload: {
  name: string;
  website?: string | null;
  status?: ScraperStatus;
  scraperType: ScraperType;
  connectorKey: string;
  configuration?: Record<string, unknown> | null;
}) {
  return http<ScraperSourceRecord>("/admin/scrapers/sources", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function updateScraperSource(
  id: string,
  payload: Partial<{
    name: string;
    website: string | null;
    status: ScraperStatus;
    scraperType: ScraperType;
    connectorKey: string;
    configuration: Record<string, unknown> | null;
  }>,
) {
  return http<ScraperSourceRecord>(`/admin/scrapers/sources/${id}`, {
    method: "PATCH",
    token: getTokenOrThrow(),
    body: JSON.stringify(payload),
  });
}

export async function deleteScraperSource(id: string) {
  return http<void>(`/admin/scrapers/sources/${id}`, {
    method: "DELETE",
    token: getTokenOrThrow(),
  });
}

export async function runScraper(sourceId: string) {
  return http<{ runId: string; status: ScraperRunStatus }>("/admin/scrapers/run", {
    method: "POST",
    token: getTokenOrThrow(),
    body: JSON.stringify({ sourceId }),
  });
}

export async function listScraperRuns(params?: Partial<{ status: ScraperRunStatus; sourceId: string; limit: number }>) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.sourceId) searchParams.set("sourceId", params.sourceId);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await http<{ items: ScraperRunRecord[] }>(
    `/admin/scrapers/runs${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      token: getTokenOrThrow(),
    },
  );

  return response.items;
}
