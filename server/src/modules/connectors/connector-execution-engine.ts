import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { BrandSourceType, ImportSourceType, type Prisma } from "@prisma/client";
import { load } from "cheerio";
import { chromium } from "playwright";

import { ApiError } from "../../utils/api-error.js";
import {
  importNormalizer,
  type ImportSourceConfiguration,
  type NormalizedImportProduct,
} from "../imports/import-normalizer.js";
import {
  createEmptyConnectorObservability,
  mapFailureReason,
  summarizeValidationFailures,
  type ConnectorObservability,
  type ImportValidationFailure,
  validateNormalizedProduct,
} from "../imports/import-observability.js";
import { importParserRegistry } from "../imports/parser-registry.js";

const DEFAULT_CATEGORY = "General";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const DEFAULT_ACCEPT_LANGUAGE = "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7";
const DEFAULT_PRODUCTS_PER_PAGE = 50;
const DEBUG_ENV_PATH = ".dbg/sprinter-import-zero.env";
const DEBUG_SERVER_FALLBACK_URL = "http://127.0.0.1:7777/event";
const DEBUG_SESSION_FALLBACK_ID = "sprinter-import-zero";

export const CONNECTOR_STRATEGIES = ["SITEMAP", "PLAYWRIGHT", "JSON_API", "XML_FEED", "HTML_FETCH"] as const;
export type ConnectorStrategy = (typeof CONNECTOR_STRATEGIES)[number];

export const CONNECTOR_PROTECTION_TYPES = ["NONE", "AKAMAI", "CLOUDFLARE", "DATADOME", "UNKNOWN"] as const;
export type ConnectorProtectionType = (typeof CONNECTOR_PROTECTION_TYPES)[number];

export type ConnectorRuntimeBundle = Prisma.ConnectorConfigurationGetPayload<{
  include: {
    brandSource: true;
    template: true;
    fieldMappings: true;
    executionProfile: true;
    scraperSource: true;
  };
}>;

export interface ConnectorDiagnosticsResult {
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

export interface ConnectorPreviewResult {
  websiteReachable: boolean;
  selectorsWorking: boolean;
  productsFound: number;
  parsedFields: string[];
  rawRecords: Array<Record<string, unknown>>;
  normalizedProducts: NormalizedImportProduct[];
  sampleRawRecords: Array<Record<string, unknown>>;
  sampleNormalizedProducts: NormalizedImportProduct[];
  strategyUsed: ConnectorStrategy;
  diagnostics: ConnectorDiagnosticsResult;
  observability: ConnectorObservability;
}

type FetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  redirected: boolean;
  contentType: string | null;
  headers: Headers;
  content: string;
};

function createExternalId(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function resolveUrl(bundle: ConnectorRuntimeBundle): string {
  return bundle.executionProfile?.listingUrl ?? bundle.feedUrl ?? bundle.brandSource.website;
}

function buildImportConfiguration(bundle: ConnectorRuntimeBundle): ImportSourceConfiguration {
  return {
    recordPath: bundle.recordPath ?? undefined,
    fieldMap: bundle.fieldMappings.reduce<Partial<Record<string, string>>>((result, mapping) => {
      result[mapping.internalField] = mapping.externalField;
      return result;
    }, {}) as ImportSourceConfiguration["fieldMap"],
    defaultBrand: bundle.brandSource.brandName,
    defaultCategory: DEFAULT_CATEGORY,
    sourceStore: bundle.brandSource.brandName,
  };
}

function buildHttpHeaders(bundle: ConnectorRuntimeBundle) {
  return {
    "user-agent": bundle.executionProfile?.userAgent ?? DEFAULT_USER_AGENT,
    "accept-language": DEFAULT_ACCEPT_LANGUAGE,
  };
}

async function fetchContent(bundle: ConnectorRuntimeBundle, url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: buildHttpHeaders(bundle),
  });

  return {
    url,
    finalUrl: response.url,
    status: response.status,
    redirected: response.redirected,
    contentType: response.headers.get("content-type"),
    headers: response.headers,
    content: await response.text(),
  };
}

function buildRedirects(result: FetchResult) {
  return result.redirected && result.finalUrl !== result.url ? [result.finalUrl] : [];
}

function detectProtection(result: Pick<FetchResult, "status" | "headers" | "content">): ConnectorProtectionType {
  const server = result.headers.get("server")?.toLowerCase() ?? "";
  const body = result.content.toLowerCase();
  const headerKeys = Array.from(result.headers.keys()).join(" ").toLowerCase();

  if (
    server.includes("akamai") ||
    body.includes("access denied") ||
    body.includes("errors.edgesuite.net") ||
    result.headers.has("akamai-origin-hop")
  ) {
    return "AKAMAI";
  }

  if (server.includes("cloudflare") || result.headers.has("cf-ray") || body.includes("attention required") || body.includes("cloudflare")) {
    return "CLOUDFLARE";
  }

  if (headerKeys.includes("datadome") || body.includes("datadome")) {
    return "DATADOME";
  }

  if (result.status >= 400) {
    return "UNKNOWN";
  }

  return "NONE";
}

function getPreferredSampleSize(bundle: ConnectorRuntimeBundle) {
  return Math.max(1, bundle.executionProfile?.sampleSize ?? 6);
}

function getPreviewFetchLimit(bundle: ConnectorRuntimeBundle) {
  return Math.max(1, bundle.executionProfile?.pageLimit ?? 1) * DEFAULT_PRODUCTS_PER_PAGE;
}

function getFallbackStrategy(bundle: ConnectorRuntimeBundle): ConnectorStrategy {
  const inspectedUrl = resolveUrl(bundle).toLowerCase();

  if (bundle.brandSource.sourceType === BrandSourceType.JSON_FEED) {
    return "JSON_API";
  }

  if (bundle.brandSource.sourceType === BrandSourceType.XML_FEED) {
    return "XML_FEED";
  }

  if (bundle.brandSource.sourceType === BrandSourceType.MANUAL_IMPORT) {
    return "HTML_FETCH";
  }

  return inspectedUrl.includes("sitemap") ? "SITEMAP" : "PLAYWRIGHT";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Connector request failed before a response was received.";
}

function buildDiagnostics(input: {
  inspectedUrl: string;
  fetchResult: FetchResult;
  strategyUsed: ConnectorStrategy;
  sitemapUrl?: string | null;
  productsFound?: number;
  message?: string | null;
}) : ConnectorDiagnosticsResult {
  return {
    inspectedUrl: input.inspectedUrl,
    finalUrl: input.fetchResult.finalUrl,
    httpStatus: input.fetchResult.status,
    redirects: buildRedirects(input.fetchResult),
    websiteReachable: input.fetchResult.status >= 200 && input.fetchResult.status < 400,
    protectionType: detectProtection(input.fetchResult),
    strategyUsed: input.strategyUsed,
    sitemapUrl: input.sitemapUrl ?? null,
    productsFound: input.productsFound ?? 0,
    message: input.message ?? null,
  };
}

function buildFailurePreview(bundle: ConnectorRuntimeBundle, error: unknown): ConnectorPreviewResult {
  const inspectedUrl = resolveUrl(bundle);
  const diagnostics: ConnectorDiagnosticsResult = {
    inspectedUrl,
    finalUrl: inspectedUrl,
    httpStatus: 0,
    redirects: [],
    websiteReachable: false,
    protectionType: "UNKNOWN",
    strategyUsed: getFallbackStrategy(bundle),
    sitemapUrl: null,
    productsFound: 0,
    message: getErrorMessage(error),
  };

  return {
    websiteReachable: false,
    selectorsWorking: false,
    productsFound: 0,
    parsedFields: [],
    rawRecords: [],
    normalizedProducts: [],
    sampleRawRecords: [],
    sampleNormalizedProducts: [],
    strategyUsed: diagnostics.strategyUsed,
    diagnostics,
    observability: {
      ...createEmptyConnectorObservability(),
      strategyUsed: diagnostics.strategyUsed,
      protectionType: diagnostics.protectionType,
    },
  };
}

function toOptionalText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readPlaywrightValue(card: { find: (selector: string) => any }, selector: string | null | undefined, kind: "text" | "image" | "link") {
  if (!selector) {
    return null;
  }

  const node = card.find(selector).first();
  if (!node.length) {
    return null;
  }

  if (kind === "text") {
    return node.text().replace(/\s+/g, " ").trim() || null;
  }

  const attributes =
    kind === "image"
      ? ["src", "data-src", "data-lazy-src", "srcset"]
      : ["href", "data-href"];

  for (const attribute of attributes) {
    const value = node.attr(attribute);
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(" ")[0];
    }
  }

  return null;
}

function toAbsoluteUrl(baseUrl: string, value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function normalizePreviewRecords(records: Array<Record<string, unknown>>, bundle: ConnectorRuntimeBundle, website: string) {
  return records.reduce<{
    normalizedProducts: NormalizedImportProduct[];
    validationFailures: ImportValidationFailure[];
  }>((result, record, index) => {
    try {
      const normalizedRecord = importNormalizer.normalizeRecord(record, {
        configuration: buildImportConfiguration(bundle),
        sourceStore: bundle.brandSource.brandName,
        website,
      });
      const validationFailures = validateNormalizedProduct(normalizedRecord);
      if (validationFailures.length > 0) {
        result.validationFailures.push(
          ...validationFailures.map((reason) => ({
            index,
            reason,
            message: `Normalized record failed validation: ${reason}.`,
            record,
          })),
        );
        return result;
      }

      result.normalizedProducts.push(normalizedRecord);
      // #region debug-point A:normalized-dto
      if (shouldReportSprinterBundle(bundle) && index < 5) {
        reportSprinterDebugEvent("A", "connector-execution-engine:safeNormalizeRecords:success", "[DEBUG] Normalized Sprinter product DTO.", {
          index,
          name: normalizedRecord.name,
          sourceUrl: normalizedRecord.sourceUrl,
          price: normalizedRecord.price,
          oldPrice: normalizedRecord.oldPrice,
          imageUrl: normalizedRecord.imageUrl,
          brand: normalizedRecord.brand,
          category: normalizedRecord.category,
          discountPercent: normalizedRecord.discountPercent,
          sourceProductId: normalizedRecord.sourceProductId,
        });
      }
      // #endregion
    } catch (error) {
      // #region debug-point A:normalizer-failure
      if (shouldReportSprinterBundle(bundle)) {
        reportSprinterDebugEvent("A", "connector-execution-engine:safeNormalizeRecords:failure", "[DEBUG] Failed to normalize Sprinter record.", {
          index,
          error: error instanceof Error ? error.message : "Unknown normalize error",
          record,
        });
      }
      // #endregion
      result.validationFailures.push({
        index,
        reason: mapFailureReason(error instanceof Error ? error.message : "Unknown normalize error"),
        message: error instanceof Error ? error.message : "Unknown normalize error",
        record,
      });
      return result;
    }

    return result;
  }, {
    normalizedProducts: [],
    validationFailures: [],
  });
}

function shouldReportSprinterBundle(bundle: ConnectorRuntimeBundle) {
  const brandName = bundle.brandSource.brandName.toLowerCase();
  const website = resolveUrl(bundle).toLowerCase();
  return brandName.includes("sprinter") || brandName.includes("sport zone") || website.includes("sprinter");
}

function reportSprinterDebugEvent(
  hypothesisId: "A" | "B" | "C" | "D" | "E",
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  let debugServerUrl = DEBUG_SERVER_FALLBACK_URL;
  let debugSessionId = DEBUG_SESSION_FALLBACK_ID;

  try {
    const envContent = readFileSync(DEBUG_ENV_PATH, "utf8");
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {
    // Ignore debug env read failures and use fallback values.
  }

  void fetch(debugServerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: "pre-fix",
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => undefined);
}

function buildPreviewResponse(input: {
  bundle: ConnectorRuntimeBundle;
  strategyUsed: ConnectorStrategy;
  diagnostics: ConnectorDiagnosticsResult;
  rawRecords: Array<Record<string, unknown>>;
  normalizedProducts: NormalizedImportProduct[];
  observability: ConnectorObservability;
}) : ConnectorPreviewResult {
  const sampleSize = getPreferredSampleSize(input.bundle);

  return {
    websiteReachable: input.diagnostics.websiteReachable,
    selectorsWorking: input.normalizedProducts.length > 0,
    productsFound: input.normalizedProducts.length,
    parsedFields: Array.from(new Set(input.rawRecords.flatMap((record) => Object.keys(record)))),
    rawRecords: input.rawRecords,
    normalizedProducts: input.normalizedProducts,
    sampleRawRecords: input.rawRecords.slice(0, sampleSize),
    sampleNormalizedProducts: input.normalizedProducts.slice(0, sampleSize),
    strategyUsed: input.strategyUsed,
    diagnostics: {
      ...input.diagnostics,
      productsFound: input.normalizedProducts.length,
    },
    observability: input.observability,
  };
}

function buildPreviewObservability(input: {
  strategyUsed: ConnectorStrategy;
  diagnostics: ConnectorDiagnosticsResult;
  rawRecords: Array<Record<string, unknown>>;
  normalizedProducts: NormalizedImportProduct[];
  validationFailures: ImportValidationFailure[];
  discoveredCount: number;
  fetchedCount: number;
  discovery?: Partial<ConnectorObservability["discovery"]>;
}): ConnectorObservability {
  const observability = createEmptyConnectorObservability();
  observability.strategyUsed = input.strategyUsed;
  observability.httpStatus = input.diagnostics.httpStatus;
  observability.protectionType = input.diagnostics.protectionType;
  observability.discoveredCount = input.discoveredCount;
  observability.fetchedCount = input.fetchedCount;
  observability.normalizedCount = input.rawRecords.length;
  observability.validatedCount = input.normalizedProducts.length;
  observability.urlsDiscovered = input.discovery?.productUrlsFound ?? input.discoveredCount;
  observability.urlsProcessed = input.discovery?.urlsProcessed ?? input.fetchedCount;
  observability.duplicateUrlsRemoved = input.discovery?.duplicateUrlsRemoved ?? 0;
  observability.urlsSkipped = input.discovery?.urlsSkipped ?? Math.max(0, input.discoveredCount - input.fetchedCount);
  observability.rawRecordCount = input.rawRecords.length;
  observability.validationFailures = input.validationFailures;
  observability.validationFailureCount = input.validationFailures.length;
  observability.discovery = {
    ...observability.discovery,
    ...input.discovery,
    productUrlsFound: input.discovery?.productUrlsFound ?? input.discoveredCount,
    urlsProcessed: input.discovery?.urlsProcessed ?? input.fetchedCount,
    duplicateUrlsRemoved: input.discovery?.duplicateUrlsRemoved ?? 0,
    urlsSkipped: input.discovery?.urlsSkipped ?? Math.max(0, input.discoveredCount - input.fetchedCount),
  };
  observability.normalization = {
    rawRecords: input.rawRecords.length,
    normalizedRecords: input.rawRecords.length,
    validatedRecords: input.normalizedProducts.length,
    validationFailures: input.validationFailures.length,
    failureReasons: summarizeValidationFailures(input.validationFailures),
  };

  return observability;
}

async function fetchPlaywrightHtml(bundle: ConnectorRuntimeBundle, url: string) {
  const profile = bundle.executionProfile;
  const browser = await chromium.launch({
    headless: profile?.headless ?? true,
  });

  try {
    const context = await browser.newContext({
      userAgent: profile?.userAgent ?? DEFAULT_USER_AGENT,
      locale: "pt-PT",
      timezoneId: "Europe/Lisbon",
      extraHTTPHeaders: {
        "Accept-Language": DEFAULT_ACCEPT_LANGUAGE,
      },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(profile?.timeoutMs ?? 30000);
    page.setDefaultNavigationTimeout(profile?.timeoutMs ?? 30000);
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    if (!response) {
      throw new ApiError(400, "Playwright could not load the requested website.");
    }

    await page.waitForLoadState("networkidle").catch(() => undefined);

    if (profile?.productCardSelector) {
      await page.waitForSelector(profile.productCardSelector, {
        timeout: profile.timeoutMs ?? 30000,
      }).catch(() => undefined);
    }

    return {
      html: await page.content(),
      finalUrl: page.url(),
      status: response.status(),
    };
  } finally {
    await browser.close();
  }
}

async function buildPlaywrightPreview(bundle: ConnectorRuntimeBundle, fetchResult: FetchResult): Promise<ConnectorPreviewResult> {
  const profile = bundle.executionProfile;
  if (!profile?.productCardSelector) {
    throw new ApiError(400, "Playwright connector requires a product card selector.");
  }

  const playResult = await fetchPlaywrightHtml(bundle, fetchResult.finalUrl);
  const $ = load(playResult.html);
  const cards = $(profile.productCardSelector).toArray();
  const rawRecords: Array<Record<string, unknown>> = [];

  for (const element of cards.slice(0, getPreviewFetchLimit(bundle))) {
    const card = $(element);
    const title = readPlaywrightValue(card, profile.productNameSelector, "text");
    const price = readPlaywrightValue(card, profile.productPriceSelector, "text");
    const oldPrice = readPlaywrightValue(card, profile.productOldPriceSelector, "text");
    const image = toAbsoluteUrl(playResult.finalUrl, readPlaywrightValue(card, profile.productImageSelector, "image"));
    const link = toAbsoluteUrl(playResult.finalUrl, readPlaywrightValue(card, profile.productUrlSelector, "link"));

    if (!title && !price && !image && !link) {
      continue;
    }

    rawRecords.push({
      title,
      price,
      oldPrice,
      image,
      link,
      id: createExternalId(`${bundle.brandSource.id}:${link ?? title ?? rawRecords.length}`),
      brand: bundle.brandSource.brandName,
      category: DEFAULT_CATEGORY,
      currency: bundle.brandSource.currencyCode ?? "EUR",
    });
  }

  const normalization = normalizePreviewRecords(rawRecords, bundle, playResult.finalUrl);

  return buildPreviewResponse({
    bundle,
    strategyUsed: "PLAYWRIGHT",
    diagnostics: {
      ...buildDiagnostics({
        inspectedUrl: fetchResult.url,
        fetchResult: {
          ...fetchResult,
          status: playResult.status,
          finalUrl: playResult.finalUrl,
        },
        strategyUsed: "PLAYWRIGHT",
        productsFound: normalization.normalizedProducts.length,
      }),
      finalUrl: playResult.finalUrl,
      httpStatus: playResult.status,
      productsFound: normalization.normalizedProducts.length,
    },
    rawRecords,
    normalizedProducts: normalization.normalizedProducts,
    observability: buildPreviewObservability({
      strategyUsed: "PLAYWRIGHT",
      diagnostics: {
        ...buildDiagnostics({
          inspectedUrl: fetchResult.url,
          fetchResult: {
            ...fetchResult,
            status: playResult.status,
            finalUrl: playResult.finalUrl,
          },
          strategyUsed: "PLAYWRIGHT",
          productsFound: normalization.normalizedProducts.length,
        }),
        finalUrl: playResult.finalUrl,
        httpStatus: playResult.status,
        productsFound: normalization.normalizedProducts.length,
      },
      rawRecords,
      normalizedProducts: normalization.normalizedProducts,
      validationFailures: normalization.validationFailures,
      discoveredCount: cards.length,
      fetchedCount: cards.length,
    }),
  });
}

async function buildHtmlFetchPreview(bundle: ConnectorRuntimeBundle, fetchResult: FetchResult): Promise<ConnectorPreviewResult> {
  const profile = bundle.executionProfile;
  if (!profile?.productCardSelector) {
    throw new ApiError(400, "HTML fetch strategy requires a product card selector.");
  }

  const $ = load(fetchResult.content);
  const cards = $(profile.productCardSelector).toArray();
  const rawRecords: Array<Record<string, unknown>> = [];

  for (const element of cards.slice(0, getPreviewFetchLimit(bundle))) {
    const card = $(element);
    const title = readPlaywrightValue(card, profile.productNameSelector, "text");
    const price = readPlaywrightValue(card, profile.productPriceSelector, "text");
    const oldPrice = readPlaywrightValue(card, profile.productOldPriceSelector, "text");
    const image = toAbsoluteUrl(fetchResult.finalUrl, readPlaywrightValue(card, profile.productImageSelector, "image"));
    const link = toAbsoluteUrl(fetchResult.finalUrl, readPlaywrightValue(card, profile.productUrlSelector, "link"));

    if (!title && !price && !image && !link) {
      continue;
    }

    rawRecords.push({
      title,
      price,
      oldPrice,
      image,
      link,
      id: createExternalId(`${bundle.brandSource.id}:${link ?? title ?? rawRecords.length}`),
      brand: bundle.brandSource.brandName,
      category: DEFAULT_CATEGORY,
      currency: bundle.brandSource.currencyCode ?? "EUR",
    });
  }

  const normalization = normalizePreviewRecords(rawRecords, bundle, fetchResult.finalUrl);

  return buildPreviewResponse({
    bundle,
    strategyUsed: "HTML_FETCH",
    diagnostics: buildDiagnostics({
      inspectedUrl: fetchResult.url,
      fetchResult,
      strategyUsed: "HTML_FETCH",
      productsFound: normalization.normalizedProducts.length,
      message: cards.length === 0 ? "Static HTML loaded but configured selectors did not match product cards." : null,
    }),
    rawRecords,
    normalizedProducts: normalization.normalizedProducts,
    observability: buildPreviewObservability({
      strategyUsed: "HTML_FETCH",
      diagnostics: buildDiagnostics({
        inspectedUrl: fetchResult.url,
        fetchResult,
        strategyUsed: "HTML_FETCH",
        productsFound: normalization.normalizedProducts.length,
        message: cards.length === 0 ? "Static HTML loaded but configured selectors did not match product cards." : null,
      }),
      rawRecords,
      normalizedProducts: normalization.normalizedProducts,
      validationFailures: normalization.validationFailures,
      discoveredCount: cards.length,
      fetchedCount: cards.length,
    }),
  });
}

function toImportSourceType(sourceType: BrandSourceType): ImportSourceType {
  switch (sourceType) {
    case BrandSourceType.JSON_FEED:
      return ImportSourceType.JSON_FEED;
    case BrandSourceType.XML_FEED:
      return ImportSourceType.XML_FEED;
    case BrandSourceType.MANUAL_IMPORT:
      return ImportSourceType.MANUAL;
    default:
      throw new ApiError(400, `Source type ${sourceType} is not supported by the feed parser.`);
  }
}

async function buildFeedPreview(bundle: ConnectorRuntimeBundle, strategy: "JSON_API" | "XML_FEED", fetchResult?: FetchResult): Promise<ConnectorPreviewResult> {
  if (bundle.brandSource.sourceType === BrandSourceType.MANUAL_IMPORT) {
    throw new ApiError(400, "Manual import sources do not support automatic testing or preview.");
  }

  const url = resolveUrl(bundle);
  const response = fetchResult ?? await fetchContent(bundle, url);
  if (response.status >= 400) {
    throw new ApiError(400, `Connector request failed with status ${response.status}.`);
  }

  const parser = importParserRegistry.getBySourceType(toImportSourceType(bundle.brandSource.sourceType));
  const parserInput = {
    sourceType: toImportSourceType(bundle.brandSource.sourceType),
    content: response.content,
    configuration: buildImportConfiguration(bundle),
    sourceStore: bundle.brandSource.brandName,
    website: response.finalUrl,
  };

  await parser.validate(parserInput);
  const records = await parser.parse(parserInput);
  const normalizedRecords = await parser.normalize(records, {
    configuration: buildImportConfiguration(bundle),
    sourceStore: bundle.brandSource.brandName,
    website: response.finalUrl,
  });
  const validationFailures: ImportValidationFailure[] = [];
  const normalizedProducts = normalizedRecords.filter((product, index) => {
    const failures = validateNormalizedProduct(product);
    if (failures.length === 0) {
      return true;
    }

    validationFailures.push(
      ...failures.map((reason) => ({
        index,
        reason,
        message: `Normalized record failed validation: ${reason}.`,
        record: records[index] && typeof records[index] === "object" ? (records[index] as Record<string, unknown>) : null,
      })),
    );
    return false;
  });

  const rawRecords = records.map((record) =>
    typeof record === "object" && record !== null ? (record as Record<string, unknown>) : { value: record },
  );

  return buildPreviewResponse({
    bundle,
    strategyUsed: strategy,
    diagnostics: buildDiagnostics({
      inspectedUrl: url,
      fetchResult: response,
      strategyUsed: strategy,
      productsFound: normalizedProducts.length,
    }),
    rawRecords,
    normalizedProducts,
    observability: buildPreviewObservability({
      strategyUsed: strategy,
      diagnostics: buildDiagnostics({
        inspectedUrl: url,
        fetchResult: response,
        strategyUsed: strategy,
        productsFound: normalizedProducts.length,
      }),
      rawRecords,
      normalizedProducts,
      validationFailures,
      discoveredCount: rawRecords.length,
      fetchedCount: rawRecords.length,
    }),
  });
}

function flattenJsonLdValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLdValue(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const graph = record["@graph"];
    if (graph) {
      return flattenJsonLdValue(graph);
    }

    return [record];
  }

  return [];
}

function getFirstOffer(productRecord: Record<string, unknown>) {
  const offers = productRecord.offers;
  if (Array.isArray(offers)) {
    return offers.find((offer) => offer && typeof offer === "object") as Record<string, unknown> | undefined;
  }

  if (offers && typeof offers === "object") {
    return offers as Record<string, unknown>;
  }

  return undefined;
}

function extractProductFromHtml(bundle: ConnectorRuntimeBundle, url: string, html: string): Record<string, unknown> | null {
  const $ = load(html);
  const scripts = $('script[type="application/ld+json"]')
    .map((_, element) => $(element).html())
    .get()
    .filter((value): value is string => Boolean(value));

  const entities = scripts.flatMap((script) => {
    try {
      return flattenJsonLdValue(JSON.parse(script));
    } catch {
      return [];
    }
  });

  const productEntity = entities.find((entity) => {
    if (!entity || typeof entity !== "object") {
      return false;
    }

    const typeValue = (entity as Record<string, unknown>)["@type"];
    return Array.isArray(typeValue) ? typeValue.includes("Product") : typeValue === "Product";
  }) as Record<string, unknown> | undefined;

  const offer = productEntity ? getFirstOffer(productEntity) : undefined;
  const metaImage = $('meta[property="og:image"]').attr("content") ?? null;
  const titleText = $('title').text().trim();
  const fallbackTitle = titleText || null;
  const metaTitle = $('meta[property="og:title"]').attr("content") ?? fallbackTitle;
  const metaDescription = $('meta[name="description"]').attr("content") ?? null;
  const metaCurrency = $('meta[property="product:price:currency"]').attr("content") ?? null;
  const metaPrice = $('meta[property="product:price:amount"]').attr("content") ?? null;

  const name = toOptionalText(productEntity?.name) ?? metaTitle;
  const imageUrl = Array.isArray(productEntity?.image)
    ? toOptionalText(productEntity?.image[0])
    : toOptionalText(productEntity?.image) ?? metaImage;
  const sourceProductId =
    toOptionalText(productEntity?.sku) ??
    toOptionalText(offer?.sku) ??
    url.match(/(\d{6,})$/)?.[1] ??
    createExternalId(url);
  const brandValue = productEntity?.brand;
  const brand =
    (brandValue && typeof brandValue === "object"
      ? toOptionalText((brandValue as Record<string, unknown>).name)
      : toOptionalText(brandValue)) ??
    bundle.brandSource.brandName;
  const breadcrumbCategory = $('nav[aria-label*="breadcrumb"] a').eq(1).text().trim();
  const fallbackCategory = breadcrumbCategory || DEFAULT_CATEGORY;
  const category = toOptionalText(productEntity?.category) ?? fallbackCategory;
  const price =
    typeof offer?.price === "number"
      ? offer.price
      : toOptionalText(offer?.price) ?? metaPrice;
  const oldPrice =
    toOptionalText(productEntity?.highPrice) ??
    toOptionalText(productEntity?.lowPrice) ??
    null;
  const currency =
    toOptionalText(offer?.priceCurrency) ??
    toOptionalText(productEntity?.priceCurrency) ??
    metaCurrency ??
    bundle.brandSource.currencyCode ??
    "EUR";

  if (!name || !price) {
    return null;
  }

  return {
    title: name,
    brand,
    category,
    price,
    oldPrice,
    image: toAbsoluteUrl(url, imageUrl),
    link: url,
    id: sourceProductId,
    description: toOptionalText(productEntity?.description) ?? metaDescription,
    currency,
  };
}

function extractSitemapUrls(xml: string, origin: string) {
  const normalizedContent = xml.replace(/>\s+</g, "><");
  const matches = normalizedContent.match(/https?:\/\/[^\s<"]+/g) ?? [];
  const unique = Array.from(new Set(matches))
    .filter((value) => {
      try {
        return new URL(value).origin === origin;
      } catch {
        return false;
      }
    })
    .filter((value) => !/\.(jpg|jpeg|png|webp|svg|gif)$/i.test(value));

  return unique;
}

function extractSitemapProductKey(url: string) {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "");
    const slug = pathname.split("/").filter(Boolean).at(-1);
    const matchedKey = slug?.match(/-([a-z0-9]+)$/i)?.[1];
    return matchedKey?.toLowerCase() ?? pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function preferSitemapUrl(current: string, candidate: string) {
  const currentIsPt = /\/pt\//i.test(current);
  const candidateIsPt = /\/pt\//i.test(candidate);
  if (candidateIsPt && !currentIsPt) {
    return candidate;
  }

  if (currentIsPt && !candidateIsPt) {
    return current;
  }

  return current;
}

function dedupeSitemapProductUrls(urls: string[]) {
  const deduped = new Map<string, string>();
  for (const url of urls) {
    const productKey = extractSitemapProductKey(url);
    const current = deduped.get(productKey);
    deduped.set(productKey, current ? preferSitemapUrl(current, url) : url);
  }

  return Array.from(deduped.values());
}

function scoreSitemapCandidate(candidate: string) {
  const normalized = candidate.toLowerCase();
  let score = 0;

  if (normalized.includes("product") || normalized.includes("catalog") || normalized.includes("shop") || normalized.includes("sale")) {
    score += 4;
  }

  if (normalized.includes("sitemap")) {
    score += 1;
  }

  if (
    normalized.includes("help") ||
    normalized.includes("landingpage") ||
    normalized.includes("landing-page") ||
    normalized.includes("support") ||
    normalized.includes("story") ||
    normalized.includes("stories") ||
    normalized.includes("discover") ||
    normalized.includes("editorial")
  ) {
    score -= 5;
  }

  return score;
}

async function discoverSitemapUrl(bundle: ConnectorRuntimeBundle, websiteUrl: string) {
  const parsed = new URL(websiteUrl);
  const origin = parsed.origin;
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const candidates = new Set<string>([
    new URL("/endpoints/sitemap/products", origin).toString(),
    new URL("/sitemap.xml", origin).toString(),
    new URL("/sitemap-products.xml", origin).toString(),
    new URL("/sitemap_products.xml", origin).toString(),
  ]);

  try {
    const robots = await fetchContent(bundle, robotsUrl);
    const sitemapMatches = robots.content.match(/^sitemap:\s*(.+)$/gim) ?? [];
    sitemapMatches
      .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
      .filter(Boolean)
      .forEach((value) => candidates.add(value));
  } catch {
    // Ignore robots fetch failures.
  }

  const orderedCandidates = Array.from(candidates).sort((left, right) => scoreSitemapCandidate(right) - scoreSitemapCandidate(left));

  for (const candidate of orderedCandidates) {
    if (scoreSitemapCandidate(candidate) < 0) {
      continue;
    }

    try {
      const response = await fetchContent(bundle, candidate);
      if (response.status >= 400) {
        continue;
      }

      const discoveredUrls = extractSitemapUrls(response.content, origin);
      const hasProductSignal =
        scoreSitemapCandidate(candidate) > 0 ||
        discoveredUrls.some((value) => scoreSitemapCandidate(value) > 0 || /\/p\/|\/product|-\d{5,}/i.test(value));

      if (!hasProductSignal) {
        continue;
      }

      if (response.content.includes("<urlset") || response.content.includes("<sitemapindex") || discoveredUrls.length > 0) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isSitemapUrl(value: string) {
  return /sitemap/i.test(value) || /\.xml($|\?)/i.test(value);
}

async function collectProductUrlsFromSitemap(
  bundle: ConnectorRuntimeBundle,
  sitemapUrl: string,
  origin: string,
  seen = new Set<string>(),
  depth = 0,
): Promise<string[]> {
  if (depth > 2 || seen.has(sitemapUrl)) {
    return [];
  }

  seen.add(sitemapUrl);

  const response = await fetchContent(bundle, sitemapUrl);
  if (response.status >= 400) {
    return [];
  }

  const urls = extractSitemapUrls(response.content, origin);
  if (response.content.includes("<sitemapindex")) {
    const nestedSitemaps = urls
      .filter((value) => isSitemapUrl(value))
      .sort((left, right) => scoreSitemapCandidate(right) - scoreSitemapCandidate(left))
      .filter((value) => scoreSitemapCandidate(value) >= 0)
      .slice(0, 8);

    const nestedProductUrls: string[] = [];
    for (const nestedSitemap of nestedSitemaps) {
      const resolvedUrls = await collectProductUrlsFromSitemap(bundle, nestedSitemap, origin, seen, depth + 1);
      for (const resolvedUrl of resolvedUrls) {
        nestedProductUrls.push(resolvedUrl);
      }

      if (nestedProductUrls.length >= getPreviewFetchLimit(bundle) * 2) {
        break;
      }
    }

    return Array.from(new Set(nestedProductUrls));
  }

  return urls.filter((value) => !isSitemapUrl(value));
}

async function buildSitemapPreview(bundle: ConnectorRuntimeBundle, inspectedFetch: FetchResult): Promise<ConnectorPreviewResult> {
  const websiteUrl = resolveUrl(bundle);
  const sitemapUrl = await discoverSitemapUrl(bundle, websiteUrl);
  if (!sitemapUrl) {
    throw new ApiError(400, "No sitemap fallback was discovered for this connector.");
  }

  const sitemapResponse = await fetchContent(bundle, sitemapUrl);
  if (sitemapResponse.status >= 400) {
    throw new ApiError(400, `Sitemap request failed with status ${sitemapResponse.status}.`);
  }

  const origin = new URL(websiteUrl).origin;
  const sitemapUrls =
    sitemapResponse.content.includes("<sitemapindex")
      ? await collectProductUrlsFromSitemap(bundle, sitemapUrl, origin)
      : extractSitemapUrls(sitemapResponse.content, origin);
  const productUrls = dedupeSitemapProductUrls(
    sitemapUrls.filter((value) => !/\/(sitemap|categoria|category|help|ayuda|pt\/$)$/i.test(value)),
  );
  const fetchLimit = Math.min(productUrls.length, getPreviewFetchLimit(bundle));
  const rawRecords: Array<Record<string, unknown>> = [];

  // #region debug-point D:sitemap-discovery
  if (shouldReportSprinterBundle(bundle)) {
    reportSprinterDebugEvent("D", "connector-execution-engine:buildSitemapPreview:discovery", "[DEBUG] Sprinter sitemap URLs discovered.", {
      inspectedUrl: websiteUrl,
      sitemapUrl,
      sitemapUrlCount: sitemapUrls.length,
      productUrlCount: productUrls.length,
      firstFiveProductUrls: productUrls.slice(0, 5),
    });
  }
  // #endregion

  for (const [index, productUrl] of productUrls.slice(0, fetchLimit).entries()) {
    try {
      const productResponse = await fetchContent(bundle, productUrl);
      // #region debug-point D:product-page-fetch
      if (shouldReportSprinterBundle(bundle) && index < 5) {
        reportSprinterDebugEvent("D", "connector-execution-engine:buildSitemapPreview:fetch", "[DEBUG] Sprinter product page fetched.", {
          index,
          requestedUrl: productUrl,
          finalUrl: productResponse.finalUrl,
          status: productResponse.status,
        });
      }
      // #endregion
      if (productResponse.status >= 400) {
        continue;
      }

      const record = extractProductFromHtml(bundle, productResponse.finalUrl, productResponse.content);
      if (record) {
        rawRecords.push(record);
        // #region debug-point A:raw-extraction
        if (shouldReportSprinterBundle(bundle) && index < 5) {
          reportSprinterDebugEvent("A", "connector-execution-engine:buildSitemapPreview:raw", "[DEBUG] Raw Sprinter product extracted from sitemap product page.", {
            index,
            name: record.title ?? null,
            sourceUrl: record.link ?? productResponse.finalUrl,
            price: record.price ?? null,
            oldPrice: record.oldPrice ?? null,
            imageUrl: record.image ?? null,
            brand: record.brand ?? null,
            category: record.category ?? null,
            sourceProductId: record.id ?? null,
          });
        }
        // #endregion
      }
    } catch {
      continue;
    }
  }

  const normalization = normalizePreviewRecords(rawRecords, bundle, websiteUrl);

  return buildPreviewResponse({
    bundle,
    strategyUsed: "SITEMAP",
    diagnostics: buildDiagnostics({
      inspectedUrl: websiteUrl,
      fetchResult: inspectedFetch,
      strategyUsed: "SITEMAP",
      sitemapUrl,
      productsFound: normalization.normalizedProducts.length,
      message: normalization.normalizedProducts.length === 0 ? "Sitemap discovered but no product pages produced normalized products." : null,
    }),
    rawRecords,
    normalizedProducts: normalization.normalizedProducts,
    observability: buildPreviewObservability({
      strategyUsed: "SITEMAP",
      diagnostics: buildDiagnostics({
        inspectedUrl: websiteUrl,
        fetchResult: inspectedFetch,
        strategyUsed: "SITEMAP",
        sitemapUrl,
        productsFound: normalization.normalizedProducts.length,
        message: normalization.normalizedProducts.length === 0 ? "Sitemap discovered but no product pages produced normalized products." : null,
      }),
      rawRecords,
      normalizedProducts: normalization.normalizedProducts,
      validationFailures: normalization.validationFailures,
      discoveredCount: productUrls.length,
      fetchedCount: fetchLimit,
      discovery: {
        sitemapUrlsFound: sitemapUrls.length,
        productUrlsFound: productUrls.length,
        duplicateUrlsRemoved: Math.max(0, sitemapUrls.length - productUrls.length),
        urlsSkipped: Math.max(0, productUrls.length - fetchLimit),
        urlsProcessed: fetchLimit,
        firstDiscoveredUrls: productUrls.slice(0, 5),
      },
    }),
  });
}

async function inspectWebsite(bundle: ConnectorRuntimeBundle) {
  const url = resolveUrl(bundle);
  const response = await fetchContent(bundle, url);
  const protectionType = detectProtection(response);
  const sitemapUrl = bundle.brandSource.sourceType === BrandSourceType.PLAYWRIGHT
    ? await discoverSitemapUrl(bundle, url)
    : null;
  const hasConfiguredPlaywrightSelectors = Boolean(bundle.executionProfile?.productCardSelector);
  const shouldPreferConfiguredPlaywright =
    protectionType === "NONE" &&
    hasConfiguredPlaywrightSelectors &&
    (!sitemapUrl || scoreSitemapCandidate(sitemapUrl) <= 1);

  let strategyUsed: ConnectorStrategy;
  if (bundle.brandSource.sourceType === BrandSourceType.JSON_FEED) {
    strategyUsed = "JSON_API";
  } else if (bundle.brandSource.sourceType === BrandSourceType.XML_FEED) {
    strategyUsed = "XML_FEED";
  } else if (bundle.brandSource.sourceType === BrandSourceType.MANUAL_IMPORT) {
    strategyUsed = "HTML_FETCH";
  } else if (shouldPreferConfiguredPlaywright) {
    strategyUsed = "PLAYWRIGHT";
  } else if (sitemapUrl) {
    strategyUsed = "SITEMAP";
  } else if (protectionType !== "NONE") {
    strategyUsed = "HTML_FETCH";
  } else {
    strategyUsed = "PLAYWRIGHT";
  }

  return {
    url,
    response,
    protectionType,
    sitemapUrl,
    strategyUsed,
  };
}

export class ConnectorExecutionEngine {
  public async previewBundle(bundle: ConnectorRuntimeBundle): Promise<ConnectorPreviewResult> {
    try {
      const inspected = await inspectWebsite(bundle);

      if (inspected.strategyUsed === "PLAYWRIGHT") {
        return buildPlaywrightPreview(bundle, inspected.response);
      }

      if (inspected.strategyUsed === "SITEMAP") {
        return buildSitemapPreview(bundle, inspected.response);
      }

      if (inspected.strategyUsed === "JSON_API") {
        return buildFeedPreview(bundle, "JSON_API", inspected.response);
      }

      if (inspected.strategyUsed === "XML_FEED") {
        return buildFeedPreview(bundle, "XML_FEED", inspected.response);
      }

      return buildHtmlFetchPreview(bundle, inspected.response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      return buildFailurePreview(bundle, error);
    }
  }

  public async diagnoseBundle(bundle: ConnectorRuntimeBundle): Promise<ConnectorDiagnosticsResult> {
    const preview = await this.previewBundle(bundle);
    return preview.diagnostics;
  }

  public buildScraperConfiguration(bundle: ConnectorRuntimeBundle) {
    const profile = bundle.executionProfile;

    return {
      connectorConfigurationId: bundle.id,
      sourceType: bundle.brandSource.sourceType,
      headless: profile?.headless ?? true,
      timeoutMs: profile?.timeoutMs ?? 30000,
      retryAttempts: profile?.retryAttempts ?? 2,
      userAgent: profile?.userAgent ?? undefined,
      strategy: "adaptive",
      requestLimiter: {
        maxRequestsPerMinute: profile?.maxRequestsPerMinute ?? 60,
        maxConcurrentPages: profile?.maxConcurrentPages ?? 2,
      },
    };
  }
}

export const connectorExecutionEngine = new ConnectorExecutionEngine();
