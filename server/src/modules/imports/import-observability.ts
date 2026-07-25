import type { NormalizedImportProduct } from "./import-normalizer.js";

export const IMPORT_PRODUCT_PROCESS_STATES = ["NEW", "UPDATED", "UNCHANGED", "FAILED"] as const;
export type ImportProductProcessState = (typeof IMPORT_PRODUCT_PROCESS_STATES)[number];

export const IMPORT_FAILURE_REASONS = [
  "MISSING_NAME",
  "MISSING_PRICE",
  "MISSING_IMAGE",
  "INVALID_URL",
  "INVALID_BRAND",
  "MISSING_BRAND",
  "MISSING_CATEGORY",
  "NORMALIZATION_ERROR",
  "RULE_REJECTED",
  "UPSERT_ERROR",
  "UNKNOWN",
] as const;
export type ImportFailureReason = (typeof IMPORT_FAILURE_REASONS)[number];

export interface ImportValidationFailure {
  index: number;
  reason: ImportFailureReason;
  message: string;
  record: Record<string, unknown> | null;
}

export interface ConnectorDiscoveryAnalytics {
  sitemapUrlsFound: number;
  productUrlsFound: number;
  duplicateUrlsRemoved: number;
  urlsSkipped: number;
  urlsProcessed: number;
  firstDiscoveredUrls: string[];
}

export interface ConnectorNormalizationAnalytics {
  rawRecords: number;
  normalizedRecords: number;
  validatedRecords: number;
  validationFailures: number;
  failureReasons: Partial<Record<ImportFailureReason, number>>;
}

export interface ConnectorUpsertAnalytics {
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  failed: number;
}

export interface ConnectorObservability {
  discoveredCount: number;
  fetchedCount: number;
  normalizedCount: number;
  validatedCount: number;
  importedCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  strategyUsed: string | null;
  httpStatus: number | null;
  protectionType: string | null;
  urlsDiscovered: number;
  urlsProcessed: number;
  duplicateUrlsRemoved: number;
  urlsSkipped: number;
  rawRecordCount: number;
  validationFailureCount: number;
  validationFailures: ImportValidationFailure[];
  discovery: ConnectorDiscoveryAnalytics;
  normalization: ConnectorNormalizationAnalytics;
  upsert: ConnectorUpsertAnalytics;
}

export interface ImportProductProcessingResult {
  status: ImportProductProcessState;
  failureReason: ImportFailureReason | null;
  stage: "DISCOVERY" | "FETCH" | "NORMALIZE" | "VALIDATE" | "UPSERT" | "CATALOG";
  productName: string | null;
  brand: string | null;
  category: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  currentPrice: number | null;
  oldPrice: number | null;
  existingContentHash: string | null;
  newContentHash: string | null;
  productId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ImportRunStats {
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
  rejectedCount: number;
  results: ImportProductProcessingResult[];
}

export interface ConnectorHealthRunSample {
  status: string;
  discoveredCount: number;
  validatedCount: number;
  importedCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  durationMs: number | null;
}

export interface ConnectorHealthScoreBreakdown {
  healthScore: number;
  successRate: number;
  failureRate: number;
  productYield: number;
  runtimeStability: number;
}

export function createEmptyConnectorObservability(): ConnectorObservability {
  return {
    discoveredCount: 0,
    fetchedCount: 0,
    normalizedCount: 0,
    validatedCount: 0,
    importedCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    failedCount: 0,
    strategyUsed: null,
    httpStatus: null,
    protectionType: null,
    urlsDiscovered: 0,
    urlsProcessed: 0,
    duplicateUrlsRemoved: 0,
    urlsSkipped: 0,
    rawRecordCount: 0,
    validationFailureCount: 0,
    validationFailures: [],
    discovery: {
      sitemapUrlsFound: 0,
      productUrlsFound: 0,
      duplicateUrlsRemoved: 0,
      urlsSkipped: 0,
      urlsProcessed: 0,
      firstDiscoveredUrls: [],
    },
    normalization: {
      rawRecords: 0,
      normalizedRecords: 0,
      validatedRecords: 0,
      validationFailures: 0,
      failureReasons: {},
    },
    upsert: {
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      failed: 0,
    },
  };
}

export function summarizeValidationFailures(
  failures: ImportValidationFailure[],
): Partial<Record<ImportFailureReason, number>> {
  return failures.reduce<Partial<Record<ImportFailureReason, number>>>((summary, failure) => {
    summary[failure.reason] = (summary[failure.reason] ?? 0) + 1;
    return summary;
  }, {});
}

export function mapFailureReason(message: string): ImportFailureReason {
  const normalized = message.toLowerCase();

  if (normalized.includes("required field: name")) {
    return "MISSING_NAME";
  }

  if (normalized.includes("required field: price")) {
    return "MISSING_PRICE";
  }

  if (normalized.includes("required field: brand")) {
    return "MISSING_BRAND";
  }

  if (normalized.includes("required field: category")) {
    return "MISSING_CATEGORY";
  }

  if (normalized.includes("image")) {
    return "MISSING_IMAGE";
  }

  if (normalized.includes("url")) {
    return "INVALID_URL";
  }

  if (normalized.includes("brand")) {
    return "INVALID_BRAND";
  }

  return "NORMALIZATION_ERROR";
}

export function validateNormalizedProduct(product: NormalizedImportProduct): ImportFailureReason[] {
  const failures: ImportFailureReason[] = [];

  if (!product.name.trim()) {
    failures.push("MISSING_NAME");
  }

  if (!Number.isFinite(product.price) || product.price < 0) {
    failures.push("MISSING_PRICE");
  }

  if (!product.imageUrl?.trim()) {
    failures.push("MISSING_IMAGE");
  }

  if (!product.brand.trim()) {
    failures.push("INVALID_BRAND");
  }

  if (!product.sourceUrl) {
    failures.push("INVALID_URL");
  } else {
    try {
      new URL(product.sourceUrl);
    } catch {
      failures.push("INVALID_URL");
    }
  }

  return failures;
}

export function calculateConnectorHealthScore(
  runs: ConnectorHealthRunSample[],
): ConnectorHealthScoreBreakdown {
  const settledRuns = runs.filter((run) => run.status === "COMPLETED" || run.status === "FAILED");
  const completedRuns = settledRuns.filter((run) => run.status === "COMPLETED");
  const successfulRuns = completedRuns.filter((run) => {
    const successfulProducts = run.importedCount + run.updatedCount + run.unchangedCount;
    return run.failedCount === 0 && successfulProducts > 0;
  });
  const failedRuns = settledRuns.filter((run) => run.status === "FAILED" || run.failedCount > 0);

  const successRate = settledRuns.length > 0 ? Math.round((successfulRuns.length / settledRuns.length) * 100) : 0;
  const failureRate = settledRuns.length > 0 ? Math.round((failedRuns.length / settledRuns.length) * 100) : 0;

  const yieldSamples = completedRuns.map((run) => {
    const successfulProducts = run.importedCount + run.updatedCount + run.unchangedCount;
    const attemptedProducts = Math.max(run.validatedCount, run.discoveredCount, successfulProducts, run.failedCount, 1);
    return successfulProducts / attemptedProducts;
  });
  const productYield =
    yieldSamples.length > 0
      ? Math.round((yieldSamples.reduce((sum, value) => sum + value, 0) / yieldSamples.length) * 100)
      : 0;

  const durations = completedRuns.map((run) => run.durationMs).filter((value): value is number => typeof value === "number" && value > 0);
  let runtimeStability = 0;

  if (durations.length === 1) {
    runtimeStability = 100;
  } else if (durations.length > 1) {
    const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const variance = durations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / durations.length;
    const deviation = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? deviation / mean : 1;
    runtimeStability = Math.max(0, Math.round(100 - Math.min(100, coefficientOfVariation * 100)));
  }

  const healthScore = Math.round(
    successRate * 0.4 +
      Math.max(0, 100 - failureRate) * 0.2 +
      productYield * 0.25 +
      runtimeStability * 0.15,
  );

  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    successRate,
    failureRate,
    productYield,
    runtimeStability,
  };
}
