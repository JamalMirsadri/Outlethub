import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { load, type CheerioAPI } from "cheerio";
import { Prisma, ProductStatus, ScraperStatus, ScraperType, StockStatus } from "@prisma/client";

import { priceMonitorQueue } from "../../config/bullmq.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { pricingService } from "../commerce/pricing.service.js";
import { browserManager, type BrowserManagerConfig } from "../scrapers/browser/browser-manager.js";
import type { BrowserCapturedNetworkEntry, BrowserPageHandle } from "../scrapers/contracts/browser-adapter.js";
import { alertManager } from "./alert-manager.js";

const PRODUCT_MONITORING_GLOBAL_SETTING_KEY = "product-monitoring.global";
const PRODUCT_MONITORING_OVERRIDES_SETTING_KEY = "product-monitoring.overrides";
const PRODUCT_MONITORING_WEBSITE_PROFILES_SETTING_KEY = "product-monitoring.website-profiles";
const PRODUCT_MONITORING_LOG_PREFIX = "PRODUCT_MONITOR_CHECK_";

const WEBSITE_PROFILE_STRATEGY_PRIORITY = ["API", "JSON_LD", "DOM", "XPATH", "VISION"] as const;
const DEFAULT_DOM_PRICE_SELECTORS = [
  'meta[property="product:price:amount"]',
  'meta[itemprop="price"]',
  '[itemprop="price"]',
  '[data-testid*="price"]',
  '[class*="price"]',
] as const;
const DEFAULT_DOM_AVAILABILITY_SELECTORS = [
  '[data-testid*="availability"]',
  '[data-testid*="stock"]',
  '[class*="stock"]',
  '[class*="availability"]',
  'button[type="submit"]',
  "body",
] as const;
const DEFAULT_DOM_SIZE_SELECTORS = [
  "[data-size]",
  '[data-testid*="size"]',
  '[class*="size"] button',
  '[class*="size"] [role="option"]',
  'select[name*="size"] option',
] as const;
const DEFAULT_XPATH_PRICE_SELECTORS = [
  "//*[@itemprop='price']",
  "//meta[@property='product:price:amount']",
  "//*[contains(translate(@class,'PRICE','price'),'price')]",
] as const;
const DEFAULT_XPATH_AVAILABILITY_SELECTORS = [
  "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'out of stock')]",
  "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sold out')]",
  "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'add to cart')]",
  "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'add to bag')]",
] as const;
const DEFAULT_XPATH_SIZE_SELECTORS = [
  "//*[@data-size]",
  "//*[contains(translate(@data-testid,'SIZE','size'),'size')]",
  "//select[contains(translate(@name,'SIZE','size'),'size')]//option",
] as const;

function reportManualUpdateDebug(
  hypothesisId: "B" | "C" | "D" | "E",
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  let url = "http://127.0.0.1:7777/event";
  let sessionId = "manual-update-stuck";
  try {
    const env = readFileSync(".dbg/manual-update-stuck.env", "utf8");
    url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1] ?? url;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1] ?? sessionId;
  } catch {}

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      runId: "pre-fix",
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

interface ProductMonitoringGlobalConfig {
  enabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
}

interface ProductMonitoringOverrideConfig {
  enabled?: boolean;
  intervalMinutes?: number | null;
}

interface ProductMonitoringOverrideMap {
  [productId: string]: ProductMonitoringOverrideConfig;
}

interface ResolvedProductMonitoringConfig extends ProductMonitoringGlobalConfig {
  override: ProductMonitoringOverrideConfig | null;
}

type WebsiteProfileExtractionStrategy = (typeof WEBSITE_PROFILE_STRATEGY_PRIORITY)[number];
type WebsiteProfileStatus = "VALID" | "INVALID" | "REPAIRING";

interface WebsiteProfileSelectors {
  price: string[];
  availability: string[];
  size: string[];
}

interface WebsiteProfileXpaths {
  price: string[];
  availability: string[];
  size: string[];
}

interface WebsiteProfileApiConfig {
  endpoint: string | null;
  method: string | null;
  transport: "XHR" | "FETCH" | "GRAPHQL" | null;
  endpointTemplate: string | null;
  requestBodyTemplate: string | null;
  jsonPath: string[];
}

interface WebsiteProfileJsonLdConfig {
  scriptSelector: string | null;
  jsonPath: string[];
}

interface WebsiteProfileAntiBotConfig {
  scraperType: ScraperType;
  headless: boolean;
  timeoutMs: number;
  retryAttempts: number;
  userAgent: string | null;
  stealth: boolean;
  proxy: {
    server: string;
    username?: string;
    password?: string;
  } | null;
  requestLimiter: {
    maxRequestsPerMinute?: number;
    maxConcurrentPages?: number;
  } | null;
}

interface WebsiteProfileRetryPolicy {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  retryableStatuses: MonitoringVerificationStatus[];
}

interface WebsiteProfileRepairLock {
  ownerProductId: string;
  acquiredAt: string;
  expiresAt: string;
}

interface WebsiteMonitoringProfile {
  host: string;
  status: WebsiteProfileStatus;
  extractionPriority: WebsiteProfileExtractionStrategy[];
  activeStrategy: Exclude<WebsiteProfileExtractionStrategy, "VISION"> | null;
  api: WebsiteProfileApiConfig;
  jsonLd: WebsiteProfileJsonLdConfig;
  selectors: WebsiteProfileSelectors;
  xpaths: WebsiteProfileXpaths;
  antiBotConfig: WebsiteProfileAntiBotConfig;
  retryPolicy: WebsiteProfileRetryPolicy;
  monitoringIntervalMinutes: number;
  failureReason: string | null;
  repairCount: number;
  lastValidatedAt: string | null;
  lastFailedAt: string | null;
  repairLock: WebsiteProfileRepairLock | null;
  sampleProductUrl: string | null;
  sourceStore: string | null;
}

interface WebsiteProfileMap {
  [host: string]: WebsiteMonitoringProfile;
}

interface ParsedSourceVariant {
  size: string | null;
  color: string | null;
  stockQuantity: number;
}

interface ParsedSourceSnapshot {
  price: number | null;
  variants: ParsedSourceVariant[];
  stockStatus: StockStatus;
  blocked: boolean;
  removed: boolean;
  failureReason: string | null;
  sizeSignalStrength: "none" | "general" | "color-specific";
  monitoringStatus: MonitoringVerificationStatus;
  extractionStrategy: WebsiteProfileExtractionStrategy | null;
  matchedSelectors: Partial<WebsiteProfileSelectors>;
  matchedXpaths: Partial<WebsiteProfileXpaths>;
}

type MonitoringExtractionStage =
  | "API_REQUEST"
  | "HTTP_REQUEST"
  | "BROWSER_SESSION"
  | "STEALTH_BROWSER"
  | "ANTI_BLOCK_PROXY"
  | "VISION_FALLBACK";

type MonitoringVerificationStatus =
  | "VERIFIED"
  | "FORBIDDEN_403"
  | "RATE_LIMITED_429"
  | "CAPTCHA"
  | "LOGIN_REQUIRED"
  | "CLOUDFLARE"
  | "AKAMAI"
  | "REMOVED_404"
  | "UNVERIFIED";

interface ProductMonitoringOutcome {
  productId: string;
  status: "UPDATED" | "NO_CHANGES" | "FAILED" | "BLOCKED" | "REMOVED";
  changedFields: string[];
  responseTimeMs: number;
  responseStatus: number | null;
  checkedAt: Date;
  nextScheduledCheck: Date | null;
  errorMessage: string | null;
  rescheduleRequired: boolean;
  monitoringStatus: MonitoringVerificationStatus;
  attemptedStages: MonitoringExtractionStage[];
  successfulStage: MonitoringExtractionStage | null;
  extractionStrategy: WebsiteProfileExtractionStrategy | null;
  websiteHost: string | null;
  profileStatus: WebsiteProfileStatus | null;
}

interface MonitoringStageFetchResult {
  stage: MonitoringExtractionStage;
  responseStatus: number | null;
  finalUrl: string;
  headers: Record<string, string>;
  html: string;
  renderedText: string | null;
  apiResponseJson: unknown | null;
  xpathResults?: Partial<Record<keyof WebsiteProfileXpaths, Array<{ expression: string; values: string[] }>>>;
  networkEntries?: BrowserCapturedNetworkEntry[];
  responseTimeMs: number;
}

interface MonitoringAttemptOutcome {
  stage: MonitoringExtractionStage;
  fetchResult: MonitoringStageFetchResult;
  parsedSnapshot: ParsedSourceSnapshot;
}

interface ProfileExtractionOutcome {
  snapshot: ParsedSourceSnapshot;
  repairedProfile: WebsiteMonitoringProfile | null;
}

function getDefaultGlobalConfig(): ProductMonitoringGlobalConfig {
  return {
    enabled: true,
    intervalMinutes: 360,
    timeoutMs: 30000,
  };
}

function createDefaultRetryPolicy(): WebsiteProfileRetryPolicy {
  return {
    maxAttempts: WEBSITE_PROFILE_STRATEGY_PRIORITY.length,
    baseBackoffMs: 1000,
    maxBackoffMs: 15000,
    retryableStatuses: [
      "FORBIDDEN_403",
      "RATE_LIMITED_429",
      "CAPTCHA",
      "LOGIN_REQUIRED",
      "CLOUDFLARE",
      "AKAMAI",
      "UNVERIFIED",
    ],
  };
}

function buildRepairLock(input: {
  ownerProductId: string;
  checkedAt: Date;
  timeoutMs: number;
  retryPolicy: WebsiteProfileRetryPolicy;
}): WebsiteProfileRepairLock {
  const lockDurationMs = Math.max(
    input.timeoutMs * Math.max(1, input.retryPolicy.maxAttempts),
    input.retryPolicy.baseBackoffMs * Math.max(1, input.retryPolicy.maxAttempts),
    30_000,
  );

  return {
    ownerProductId: input.ownerProductId,
    acquiredAt: input.checkedAt.toISOString(),
    expiresAt: new Date(input.checkedAt.getTime() + lockDurationMs).toISOString(),
  };
}

function isRepairLockActive(profile: Pick<WebsiteMonitoringProfile, "status" | "repairLock">, now: Date): boolean {
  if (profile.status !== "REPAIRING" || !profile.repairLock) {
    return false;
  }

  const expiresAt = Date.parse(profile.repairLock.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

function createDefaultSelectors(): WebsiteProfileSelectors {
  return {
    price: [...DEFAULT_DOM_PRICE_SELECTORS],
    availability: [...DEFAULT_DOM_AVAILABILITY_SELECTORS],
    size: [...DEFAULT_DOM_SIZE_SELECTORS],
  };
}

function createDefaultXpaths(): WebsiteProfileXpaths {
  return {
    price: [...DEFAULT_XPATH_PRICE_SELECTORS],
    availability: [...DEFAULT_XPATH_AVAILABILITY_SELECTORS],
    size: [...DEFAULT_XPATH_SIZE_SELECTORS],
  };
}

function createDefaultApiConfig(): WebsiteProfileApiConfig {
  return {
    endpoint: null,
    method: null,
    transport: null,
    endpointTemplate: null,
    requestBodyTemplate: null,
    jsonPath: [],
  };
}

function createDefaultJsonLdConfig(): WebsiteProfileJsonLdConfig {
  return {
    scriptSelector: 'script[type="application/ld+json"]',
    jsonPath: [],
  };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9,.-]/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value instanceof Prisma.Decimal) {
    return Number(value);
  }

  return null;
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function compactStringArray(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => normalizeLabel(value)).filter((value): value is string => Boolean(value)))];
}

function isLikelySizeValue(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return /^(xxs|xs|s|m|l|xl|xxl|xxxl|one size|onesize|free size|free|[0-9]{2}(\.[0-9])?|[0-9]{1,2}w|[0-9]{1,2}l|[0-9]{1,2}\/[0-9]{1,2})$/i.test(
    normalized,
  );
}

function decimalEquals(left: Prisma.Decimal | null, right: Prisma.Decimal | null): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.equals(right);
}

function normalizeVariantKey(variant: { size?: string | null; color?: string | null }): string {
  const size = normalizeLabel(variant.size)?.toLowerCase() ?? "";
  const color = normalizeLabel(variant.color)?.toLowerCase() ?? "";
  return `${color}::${size}`;
}

function detectBlocked(html: string): boolean {
  return /(captcha|verify you are human|unusual traffic|attention required|cloudflare|robot check|access denied)/i.test(html);
}

function detectCaptcha(html: string): boolean {
  return /(captcha|verify you are human|robot check|recaptcha|hcaptcha|px-captcha)/i.test(html);
}

function detectLoginRequired(html: string, finalUrl: string): boolean {
  return (
    /(sign in|log in|login required|please log in|please sign in|account required)/i.test(html) ||
    /(\/login|\/signin|\/account)/i.test(finalUrl)
  );
}

function detectCloudflare(
  responseStatus: number | null,
  headers: Record<string, string>,
  html: string,
): boolean {
  const server = (headers.server ?? "").toLowerCase();
  const headerKeys = Object.keys(headers).join(" ").toLowerCase();
  const body = html.toLowerCase();
  return (
    server.includes("cloudflare") ||
    headerKeys.includes("cf-ray") ||
    body.includes("attention required") ||
    body.includes("cloudflare")
  );
}

function detectAkamai(headers: Record<string, string>, html: string): boolean {
  const server = (headers.server ?? "").toLowerCase();
  const headerKeys = Object.keys(headers).join(" ").toLowerCase();
  const body = html.toLowerCase();
  return (
    server.includes("akamai") ||
    headerKeys.includes("akamai-origin-hop") ||
    body.includes("errors.edgesuite.net") ||
    body.includes("access denied")
  );
}

function detectRateLimited(responseStatus: number | null, html: string): boolean {
  return responseStatus === 429 || /too many requests|rate limit/i.test(html);
}

function detectRemoved(responseStatus: number | null, html: string): boolean {
  if (responseStatus === 404 || responseStatus === 410) {
    return true;
  }

  return /(product (is )?no longer available|page not found|404 not found|sold out online|this item is unavailable|product removed)/i.test(
    html,
  );
}

function classifyMonitoringResponse(input: {
  responseStatus: number | null;
  headers: Record<string, string>;
  html: string;
  finalUrl: string;
}): MonitoringVerificationStatus {
  if (detectRemoved(input.responseStatus, input.html)) {
    return "REMOVED_404";
  }

  if (detectRateLimited(input.responseStatus, input.html)) {
    return "RATE_LIMITED_429";
  }

  if (detectCaptcha(input.html)) {
    return "CAPTCHA";
  }

  if (detectLoginRequired(input.html, input.finalUrl)) {
    return "LOGIN_REQUIRED";
  }

  if (detectCloudflare(input.responseStatus, input.headers, input.html)) {
    return "CLOUDFLARE";
  }

  if (detectAkamai(input.headers, input.html)) {
    return "AKAMAI";
  }

  if (input.responseStatus === 403) {
    return "FORBIDDEN_403";
  }

  return "VERIFIED";
}

function parseAvailability(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value <= 0) {
      return false;
    }

    return true;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("in stock") ||
    normalized.includes("instock") ||
    normalized.includes("available") ||
    normalized.includes("true")
  ) {
    return true;
  }

  if (
    normalized.includes("out of stock") ||
    normalized.includes("sold out") ||
    normalized.includes("unavailable") ||
    normalized.includes("false")
  ) {
    return false;
  }

  return null;
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function visitUnknown(value: unknown, visitor: (input: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => visitUnknown(item, visitor));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  visitor(value);
  Object.values(value).forEach((entry) => visitUnknown(entry, visitor));
}

function readFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    const normalized = normalizeLabel(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function readFirstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = toFiniteNumber(record[key]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseJsonBody(value: string | null | undefined): unknown | null {
  if (!value) {
    return null;
  }

  return safeJsonParse(value);
}

function scoreProductLikeRecord(record: Record<string, unknown>): number {
  let score = 0;

  const price =
    readFirstNumber(record, ["price", "salePrice", "currentPrice", "amount", "value"]) ??
    readFirstNumber(record, ["finalPrice", "offerPrice"]);
  if (price !== null && price > 0) {
    score += 4;
  }

  const availability = parseAvailability(
    record.availability ??
      record.available ??
      record.inStock ??
      record.isAvailable ??
      record.stockStatus ??
      record.inventoryStatus,
  );
  if (availability !== null) {
    score += 2;
  }

  const size = readFirstString(record, ["size", "sizeName", "displaySize", "option1", "waist", "label"]);
  if (isLikelySizeValue(size)) {
    score += 2;
  }

  const variants =
    Array.isArray(record.variants) ||
    Array.isArray(record.options) ||
    Array.isArray(record.skus) ||
    Array.isArray(record.items);
  if (variants) {
    score += 3;
  }

  if (record["@type"] === "Product" || record["@type"] === "Offer") {
    score += 2;
  }

  return score;
}

function findBestJsonPath(
  value: unknown,
  currentPath: string[] = [],
): { path: string[]; score: number; value: unknown } | null {
  if (Array.isArray(value)) {
    let best: { path: string[]; score: number; value: unknown } | null = null;
    value.forEach((entry, index) => {
      const candidate = findBestJsonPath(entry, [...currentPath, String(index)]);
      if (candidate && (!best || candidate.score > best.score)) {
        best = candidate;
      }
    });
    return best;
  }

  if (!isRecord(value)) {
    return null;
  }

  let best: { path: string[]; score: number; value: unknown } | null = null;
  const score = scoreProductLikeRecord(value);
  if (score > 0) {
    best = {
      path: currentPath,
      score,
      value,
    };
  }

  for (const [key, entry] of Object.entries(value)) {
    const candidate = findBestJsonPath(entry, [...currentPath, key]);
    if (candidate && (!best || candidate.score > best.score)) {
      best = candidate;
    }
  }

  return best;
}

function readJsonPath(value: unknown, path: string[]): unknown | null {
  let current: unknown = value;

  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return null;
      }
      current = current[index];
      continue;
    }

    if (!isRecord(current) || !(segment in current)) {
      return null;
    }

    current = current[segment];
  }

  return current;
}

function buildSourceTemplateContext(sourceUrl: string) {
  const parsed = new URL(sourceUrl);
  const searchParams = Object.fromEntries(parsed.searchParams.entries());
  return {
    host: parsed.hostname.replace(/^www\./, "").toLowerCase(),
    pathname: parsed.pathname,
    pathSegments: parsed.pathname.split("/").filter(Boolean),
    searchParams,
  };
}

function buildEndpointTemplate(targetUrl: string, sourceUrl: string): string {
  const templateContext = buildSourceTemplateContext(sourceUrl);
  let template = targetUrl;

  const replacements: Array<{ raw: string; token: string }> = [
    { raw: sourceUrl, token: "{{source.url}}" },
    { raw: templateContext.pathname, token: "{{source.pathname}}" },
    ...templateContext.pathSegments.map((segment, index) => ({
      raw: segment,
      token: `{{source.pathSegments.${index}}}`,
    })),
    ...Object.entries(templateContext.searchParams).map(([key, value]) => ({
      raw: value,
      token: `{{source.query.${key}}}`,
    })),
  ]
    .filter((entry) => entry.raw.length > 2)
    .sort((left, right) => right.raw.length - left.raw.length);

  for (const replacement of replacements) {
    template = template.split(replacement.raw).join(replacement.token);
  }

  return template;
}

function resolveEndpointTemplate(template: string, sourceUrl: string): string {
  const templateContext = buildSourceTemplateContext(sourceUrl);
  let resolved = template
    .replaceAll("{{source.url}}", sourceUrl)
    .replaceAll("{{source.pathname}}", templateContext.pathname);

  templateContext.pathSegments.forEach((segment, index) => {
    resolved = resolved.replaceAll(`{{source.pathSegments.${index}}}`, segment);
  });

  for (const [key, value] of Object.entries(templateContext.searchParams)) {
    resolved = resolved.replaceAll(`{{source.query.${key}}}`, value);
  }

  return resolved;
}

function inferTransportFromNetworkEntry(entry: BrowserCapturedNetworkEntry): WebsiteProfileApiConfig["transport"] {
  if (entry.resourceType === "graphql" || /graphql/i.test(entry.url) || /graphql/i.test(entry.postData ?? "")) {
    return "GRAPHQL";
  }

  if (entry.resourceType === "fetch") {
    return "FETCH";
  }

  return "XHR";
}

function detectApiMetadataFromNetworkEntries(
  entries: BrowserCapturedNetworkEntry[],
  sourceUrl: string,
): WebsiteProfileApiConfig | null {
  let best:
    | {
        score: number;
        entry: BrowserCapturedNetworkEntry;
        jsonPath: string[];
      }
    | null = null;

  for (const entry of entries) {
    if (!entry.responseBody || (entry.status ?? 0) < 200 || (entry.status ?? 0) >= 400) {
      continue;
    }

    const responseJson = parseJsonBody(entry.responseBody);
    if (!responseJson) {
      continue;
    }

    const candidate = findBestJsonPath(responseJson);
    if (!candidate || candidate.score <= 0) {
      continue;
    }

    let score = candidate.score;
    if (/product|products|pdp|graphql|catalog|item/i.test(entry.url)) {
      score += 2;
    }
    if ((entry.postData ?? "").includes(sourceUrl)) {
      score += 2;
    }
    if (entry.method.toUpperCase() !== "GET") {
      score += 1;
    }

    if (!best || score > best.score) {
      best = {
        score,
        entry,
        jsonPath: candidate.path,
      };
    }
  }

  if (!best) {
    return null;
  }

  return {
    endpoint: best.entry.url,
    method: best.entry.method.toUpperCase(),
    transport: inferTransportFromNetworkEntry(best.entry),
    endpointTemplate: buildEndpointTemplate(best.entry.url, sourceUrl),
    requestBodyTemplate: best.entry.postData ? buildEndpointTemplate(best.entry.postData, sourceUrl) : null,
    jsonPath: best.jsonPath,
  };
}

function detectJsonLdMetadata($: CheerioAPI): WebsiteProfileJsonLdConfig {
  const payloads: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text().trim();
    if (!text) {
      return;
    }

    const parsed = safeJsonParse(text);
    if (parsed) {
      payloads.push(parsed);
    }
  });

  let bestPath: string[] = [];
  let bestScore = 0;
  payloads.forEach((payload) => {
    const candidate = findBestJsonPath(payload);
    if (candidate && candidate.score > bestScore) {
      bestPath = candidate.path;
      bestScore = candidate.score;
    }
  });

  return {
    scriptSelector: 'script[type="application/ld+json"]',
    jsonPath: bestPath,
  };
}

function collectJsonPayloads($: CheerioAPI): unknown[] {
  const payloads: unknown[] = [];

  $("script").each((_, element) => {
    const text = $(element).text().trim();
    if (!text) {
      return;
    }

    const scriptType = ($(element).attr("type") ?? "").toLowerCase();
    const scriptId = ($(element).attr("id") ?? "").toLowerCase();

    if (scriptType === "application/ld+json" || scriptType === "application/json" || scriptId.includes("next") || scriptId.includes("nuxt")) {
      const parsed = safeJsonParse(text);
      if (parsed) {
        payloads.push(parsed);
      }
    }
  });

  return payloads;
}

function extractVariantsFromJson(payloads: unknown[]): {
  variants: ParsedSourceVariant[];
  sizeSignalStrength: ParsedSourceSnapshot["sizeSignalStrength"];
} {
  const variants = new Map<string, ParsedSourceVariant>();
  let sizeSignalStrength: ParsedSourceSnapshot["sizeSignalStrength"] = "none";

  payloads.forEach((payload) => {
    visitUnknown(payload, (record) => {
      const size = readFirstString(record, ["size", "sizeName", "displaySize", "option1", "waist", "label"]);
      const color = readFirstString(record, ["color", "colour", "colorName", "colourName", "option2"]);
      const quantity = readFirstNumber(record, ["stockQuantity", "availableQuantity", "inventory", "quantity"]);
      const availability = parseAvailability(
        record.availability ??
          record.available ??
          record.inStock ??
          record.isAvailable ??
          record.stockStatus ??
          record.inventoryStatus,
      );

      const normalizedSize = isLikelySizeValue(size) ? size : null;
      const normalizedColor = color;
      if (!normalizedSize && !normalizedColor) {
        return;
      }

      const inferredStock =
        quantity !== null ? Math.max(0, Math.floor(quantity)) : availability === false ? 0 : 1;
      if (inferredStock <= 0) {
        return;
      }

      if (normalizedColor && normalizedSize) {
        sizeSignalStrength = "color-specific";
      } else if (normalizedSize && sizeSignalStrength === "none") {
        sizeSignalStrength = "general";
      }

      const key = normalizeVariantKey({
        size: normalizedSize,
        color: normalizedColor,
      });

      variants.set(key, {
        size: normalizedSize,
        color: normalizedColor,
        stockQuantity: inferredStock,
      });
    });
  });

  return {
    variants: Array.from(variants.values()),
    sizeSignalStrength,
  };
}

function extractPriceFromJson(payloads: unknown[]): number | null {
  const candidates: Array<{ value: number; score: number }> = [];

  payloads.forEach((payload) => {
    visitUnknown(payload, (record) => {
      const directPrice =
        readFirstNumber(record, ["price", "salePrice", "currentPrice", "amount", "value"]) ??
        readFirstNumber(record, ["finalPrice", "offerPrice"]);

      if (directPrice === null || directPrice <= 0) {
        return;
      }

      let score = 1;
      if (record.availability || record.inStock || record.available) {
        score += 2;
      }
      if (record.priceCurrency || record.currency) {
        score += 1;
      }
      if (record["@type"] === "Offer" || record["@type"] === "Product") {
        score += 2;
      }

      candidates.push({
        value: directPrice,
        score,
      });
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.value ?? null;
}

function extractPriceFromDom($: CheerioAPI): number | null {
  const selectorCandidates = [
    'meta[property="product:price:amount"]',
    'meta[itemprop="price"]',
    '[itemprop="price"]',
    '[data-testid*="price"]',
    '[class*="price"]',
  ];

  for (const selector of selectorCandidates) {
    const element = $(selector).first();
    if (!element || element.length === 0) {
      continue;
    }

    const candidate = element.attr("content") ?? element.text();
    const parsed = toFiniteNumber(candidate);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  const bodyText = $("body").text();
  const match = bodyText.match(/(?:EUR|USD|€|\$)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  return match ? toFiniteNumber(match[1]) : null;
}

function extractPriceFromText(text: string): number | null {
  const matches = Array.from(text.matchAll(/(?:EUR|USD|GBP|€|\$|£)\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi));
  for (const match of matches) {
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function extractAvailabilityFromDom($: CheerioAPI): StockStatus {
  const bodyText = $("body").text().toLowerCase();
  if (/(out of stock|sold out|currently unavailable|unavailable)/i.test(bodyText)) {
    return StockStatus.OUT_OF_STOCK;
  }

  if (/(add to cart|add to bag|in stock|available now)/i.test(bodyText)) {
    return StockStatus.IN_STOCK;
  }

  return StockStatus.UNKNOWN;
}

function extractGeneralSizesFromDom($: CheerioAPI): ParsedSourceVariant[] {
  const variants = new Map<string, ParsedSourceVariant>();
  const selectors = [
    "[data-size]",
    '[data-testid*="size"]',
    '[class*="size"] button',
    '[class*="size"] [role="option"]',
    'select[name*="size"] option',
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, element) => {
      const text = normalizeLabel($(element).attr("data-size") ?? $(element).text());
      if (!isLikelySizeValue(text)) {
        return;
      }

      const isDisabled =
        $(element).attr("disabled") !== undefined ||
        $(element).attr("aria-disabled") === "true" ||
        /disabled|unavailable|out-of-stock/.test($(element).attr("class") ?? "");

      if (isDisabled) {
        return;
      }

      const key = normalizeVariantKey({ size: text, color: null });
      variants.set(key, {
        size: text,
        color: null,
        stockQuantity: 1,
      });
    });
  });

  return Array.from(variants.values());
}

function extractGeneralSizesFromText(text: string): ParsedSourceVariant[] {
  const variants = new Map<string, ParsedSourceVariant>();

  for (const line of text.split(/\r?\n/)) {
    const normalized = normalizeLabel(line);
    if (!isLikelySizeValue(normalized)) {
      continue;
    }

    const key = normalizeVariantKey({ size: normalized, color: null });
    variants.set(key, {
      size: normalized,
      color: null,
      stockQuantity: 1,
    });
  }

  return Array.from(variants.values());
}

function emptySnapshot(
  monitoringStatus: MonitoringVerificationStatus,
  overrides?: Partial<ParsedSourceSnapshot>,
): ParsedSourceSnapshot {
  return {
    price: null,
    variants: [],
    stockStatus: StockStatus.UNKNOWN,
    blocked: false,
    removed: false,
    failureReason: null,
    sizeSignalStrength: "none",
    monitoringStatus,
    extractionStrategy: null,
    matchedSelectors: {},
    matchedXpaths: {},
    ...overrides,
  };
}

function inferSizeSignalStrength(variants: ParsedSourceVariant[]): ParsedSourceSnapshot["sizeSignalStrength"] {
  if (variants.some((variant) => normalizeLabel(variant.color) && normalizeLabel(variant.size))) {
    return "color-specific";
  }

  if (variants.length > 0) {
    return "general";
  }

  return "none";
}

function extractPriceFromDomWithSelectors($: CheerioAPI, selectors: string[]): { price: number | null; selector: string | null } {
  for (const selector of selectors) {
    const element = $(selector).first();
    if (!element || element.length === 0) {
      continue;
    }

    const candidate = element.attr("content") ?? element.text();
    const parsed = toFiniteNumber(candidate);
    if (parsed !== null && parsed > 0) {
      return {
        price: parsed,
        selector,
      };
    }
  }

  return {
    price: extractPriceFromDom($),
    selector: null,
  };
}

function extractAvailabilityFromDomWithSelectors(
  $: CheerioAPI,
  selectors: string[],
): { stockStatus: StockStatus; selector: string | null } {
  for (const selector of selectors) {
    const text = $(selector)
      .map((_, element) => $(element).text())
      .get()
      .join(" ")
      .trim();
    if (!text) {
      continue;
    }

    const lowered = text.toLowerCase();
    if (/(out of stock|sold out|currently unavailable|unavailable)/i.test(lowered)) {
      return {
        stockStatus: StockStatus.OUT_OF_STOCK,
        selector,
      };
    }

    if (/(add to cart|add to bag|in stock|available now)/i.test(lowered)) {
      return {
        stockStatus: StockStatus.IN_STOCK,
        selector,
      };
    }
  }

  return {
    stockStatus: extractAvailabilityFromDom($),
    selector: null,
  };
}

function extractSizesFromDomWithSelectors(
  $: CheerioAPI,
  selectors: string[],
): { variants: ParsedSourceVariant[]; selector: string | null } {
  for (const selector of selectors) {
    const variants = new Map<string, ParsedSourceVariant>();
    $(selector).each((_, element) => {
      const text = normalizeLabel($(element).attr("data-size") ?? $(element).text());
      if (!isLikelySizeValue(text)) {
        return;
      }

      const isDisabled =
        $(element).attr("disabled") !== undefined ||
        $(element).attr("aria-disabled") === "true" ||
        /disabled|unavailable|out-of-stock/.test($(element).attr("class") ?? "");

      if (isDisabled) {
        return;
      }

      const key = normalizeVariantKey({ size: text, color: null });
      variants.set(key, {
        size: text,
        color: null,
        stockQuantity: 1,
      });
    });

    if (variants.size > 0) {
      return {
        variants: Array.from(variants.values()),
        selector,
      };
    }
  }

  return {
    variants: extractGeneralSizesFromDom($),
    selector: null,
  };
}

function buildVerifiedSnapshot(input: {
  price: number | null;
  variants: ParsedSourceVariant[];
  stockStatus: StockStatus;
  extractionStrategy: WebsiteProfileExtractionStrategy;
  failureReason?: string | null;
  matchedSelectors?: Partial<WebsiteProfileSelectors>;
  matchedXpaths?: Partial<WebsiteProfileXpaths>;
}): ParsedSourceSnapshot {
  return {
    price: input.price,
    variants: input.variants,
    stockStatus: input.stockStatus,
    blocked: false,
    removed: false,
    failureReason:
      input.failureReason ??
      (input.price === null && input.variants.length === 0 && input.stockStatus === StockStatus.UNKNOWN
        ? "Unable to detect product data from the source page."
        : null),
    sizeSignalStrength: inferSizeSignalStrength(input.variants),
    monitoringStatus: "VERIFIED",
    extractionStrategy: input.extractionStrategy,
    matchedSelectors: input.matchedSelectors ?? {},
    matchedXpaths: input.matchedXpaths ?? {},
  };
}

function extractUsingJsonPayloads(
  payloads: unknown[],
  strategy: Extract<WebsiteProfileExtractionStrategy, "API" | "JSON_LD">,
): ParsedSourceSnapshot {
  const variants = extractVariantsFromJson(payloads);
  const price = extractPriceFromJson(payloads);
  const stockStatus = variants.variants.length > 0 ? StockStatus.IN_STOCK : StockStatus.UNKNOWN;

  return buildVerifiedSnapshot({
    price,
    variants: variants.variants,
    stockStatus,
    extractionStrategy: strategy,
  });
}

function extractUsingDomProfile(
  $: CheerioAPI,
  profile: WebsiteMonitoringProfile,
): ParsedSourceSnapshot {
  const priceMatch = extractPriceFromDomWithSelectors($, profile.selectors.price);
  const availabilityMatch = extractAvailabilityFromDomWithSelectors($, profile.selectors.availability);
  const sizeMatch = extractSizesFromDomWithSelectors($, profile.selectors.size);

  return buildVerifiedSnapshot({
    price: priceMatch.price,
    variants: sizeMatch.variants,
    stockStatus: sizeMatch.variants.length > 0 ? StockStatus.IN_STOCK : availabilityMatch.stockStatus,
    extractionStrategy: "DOM",
    matchedSelectors: {
      ...(priceMatch.selector ? { price: [priceMatch.selector] } : {}),
      ...(availabilityMatch.selector ? { availability: [availabilityMatch.selector] } : {}),
      ...(sizeMatch.selector ? { size: [sizeMatch.selector] } : {}),
    },
  });
}

function extractUsingXPathProfile(
  profile: WebsiteMonitoringProfile,
  xpathResults: MonitoringStageFetchResult["xpathResults"],
): ParsedSourceSnapshot {
  const priceCandidates = xpathResults?.price ?? [];
  const availabilityCandidates = xpathResults?.availability ?? [];
  const sizeCandidates = xpathResults?.size ?? [];

  let price: number | null = null;
  let matchedPriceExpression: string | null = null;
  for (const candidate of priceCandidates) {
    for (const value of candidate.values) {
      const parsed = toFiniteNumber(value);
      if (parsed !== null && parsed > 0) {
        price = parsed;
        matchedPriceExpression = candidate.expression;
        break;
      }
    }
    if (price !== null) {
      break;
    }
  }

  let stockStatus: StockStatus = StockStatus.UNKNOWN;
  let matchedAvailabilityExpression: string | null = null;
  for (const candidate of availabilityCandidates) {
    const text = candidate.values.join(" ").toLowerCase();
    if (/(out of stock|sold out|currently unavailable|unavailable)/i.test(text)) {
      stockStatus = StockStatus.OUT_OF_STOCK;
      matchedAvailabilityExpression = candidate.expression;
      break;
    }
    if (/(add to cart|add to bag|in stock|available now)/i.test(text)) {
      stockStatus = StockStatus.IN_STOCK;
      matchedAvailabilityExpression = candidate.expression;
      break;
    }
  }

  const variants = new Map<string, ParsedSourceVariant>();
  let matchedSizeExpression: string | null = null;
  for (const candidate of sizeCandidates) {
    const currentVariants = extractGeneralSizesFromText(candidate.values.join("\n"));
    if (currentVariants.length === 0) {
      continue;
    }
    matchedSizeExpression = candidate.expression;
    for (const variant of currentVariants) {
      variants.set(normalizeVariantKey(variant), variant);
    }
    break;
  }

  return buildVerifiedSnapshot({
    price,
    variants: Array.from(variants.values()),
    stockStatus: variants.size > 0 ? StockStatus.IN_STOCK : stockStatus,
    extractionStrategy: "XPATH",
    matchedXpaths: {
      ...(matchedPriceExpression ? { price: [matchedPriceExpression] } : {}),
      ...(matchedAvailabilityExpression ? { availability: [matchedAvailabilityExpression] } : {}),
      ...(matchedSizeExpression ? { size: [matchedSizeExpression] } : {}),
    },
  });
}

function createBlockedSnapshot(
  monitoringStatus: MonitoringVerificationStatus,
  failureReason: string,
): ParsedSourceSnapshot {
  return emptySnapshot(monitoringStatus, {
    blocked: true,
    failureReason,
  });
}

function parseSourceSnapshot(input: {
  profile: WebsiteMonitoringProfile;
  html: string;
  responseStatus: number | null;
  headers?: Record<string, string>;
  finalUrl?: string;
  renderedText?: string | null;
  apiResponseJson?: unknown | null;
  xpathResults?: MonitoringStageFetchResult["xpathResults"];
  allowVisionRepair?: boolean;
}): ProfileExtractionOutcome {
  const html = input.html;
  const responseStatus = input.responseStatus;
  const monitoringStatus = classifyMonitoringResponse({
    responseStatus,
    headers: input.headers ?? {},
    html,
    finalUrl: input.finalUrl ?? "",
  });
  const $ = load(html);

  if (monitoringStatus === "CAPTCHA") {
    return {
      snapshot: createBlockedSnapshot("CAPTCHA", "CAPTCHA challenge detected."),
      repairedProfile: null,
    };
  }

  if (monitoringStatus === "CLOUDFLARE") {
    return {
      snapshot: createBlockedSnapshot("CLOUDFLARE", "Cloudflare protection detected."),
      repairedProfile: null,
    };
  }

  if (monitoringStatus === "AKAMAI") {
    return {
      snapshot: createBlockedSnapshot("AKAMAI", "Akamai protection detected."),
      repairedProfile: null,
    };
  }

  if (monitoringStatus === "LOGIN_REQUIRED") {
    return {
      snapshot: createBlockedSnapshot("LOGIN_REQUIRED", "Login required to access the source product page."),
      repairedProfile: null,
    };
  }

  if (monitoringStatus === "RATE_LIMITED_429") {
    return {
      snapshot: createBlockedSnapshot("RATE_LIMITED_429", "Rate limited by the source website."),
      repairedProfile: null,
    };
  }

  if (monitoringStatus === "FORBIDDEN_403") {
    return {
      snapshot: createBlockedSnapshot("FORBIDDEN_403", "Source website returned 403 Forbidden."),
      repairedProfile: null,
    };
  }

  if (monitoringStatus === "REMOVED_404") {
    return {
      snapshot: emptySnapshot("REMOVED_404", {
        stockStatus: StockStatus.OUT_OF_STOCK,
        removed: true,
        failureReason: "Source product returned 404/removed state.",
      }),
      repairedProfile: null,
    };
  }

  const payloads = collectJsonPayloads($);
  const strategyOrder = [
    ...(input.profile.activeStrategy ? [input.profile.activeStrategy] : []),
    ...input.profile.extractionPriority.filter((strategy) => strategy !== input.profile.activeStrategy),
  ].filter((strategy, index, values) => values.indexOf(strategy) === index);

  for (const strategy of strategyOrder) {
    if (strategy === "VISION" && !input.allowVisionRepair) {
      continue;
    }

    if (strategy === "API") {
      const apiRoot =
        input.apiResponseJson && input.profile.api.jsonPath.length > 0
          ? readJsonPath(input.apiResponseJson, input.profile.api.jsonPath)
          : input.apiResponseJson;
      const apiPayloads = apiRoot ? [apiRoot] : payloads;
      const snapshot = extractUsingJsonPayloads(apiPayloads, "API");
      if (snapshot.price !== null || snapshot.variants.length > 0) {
        return {
          snapshot,
          repairedProfile: null,
        };
      }
      continue;
    }

    if (strategy === "JSON_LD") {
      const jsonLdPayloads: unknown[] = [];
      $('script[type="application/ld+json"]').each((_, element) => {
        const text = $(element).text().trim();
        if (!text) {
          return;
        }
        const parsed = safeJsonParse(text);
        if (parsed) {
          const resolved = input.profile.jsonLd.jsonPath.length > 0 ? readJsonPath(parsed, input.profile.jsonLd.jsonPath) : parsed;
          jsonLdPayloads.push(resolved ?? parsed);
        }
      });
      const snapshot = extractUsingJsonPayloads(jsonLdPayloads, "JSON_LD");
      if (snapshot.price !== null || snapshot.variants.length > 0) {
        return {
          snapshot,
          repairedProfile: null,
        };
      }
      continue;
    }

    if (strategy === "DOM") {
      const snapshot = extractUsingDomProfile($, input.profile);
      if (snapshot.price !== null || snapshot.variants.length > 0 || snapshot.stockStatus !== StockStatus.UNKNOWN) {
        return {
          snapshot,
          repairedProfile: null,
        };
      }
      continue;
    }

    if (strategy === "XPATH") {
      const snapshot = extractUsingXPathProfile(input.profile, input.xpathResults);
      if (snapshot.price !== null || snapshot.variants.length > 0 || snapshot.stockStatus !== StockStatus.UNKNOWN) {
        return {
          snapshot,
          repairedProfile: null,
        };
      }
      continue;
    }

    if (strategy === "VISION" && input.renderedText) {
      const renderedTextPrice = extractPriceFromText(input.renderedText);
      const renderedTextVariants = extractGeneralSizesFromText(input.renderedText);
      const repairedProfile: WebsiteMonitoringProfile = {
        ...input.profile,
        status: "VALID",
        activeStrategy: "DOM",
        selectors: {
          price: [...DEFAULT_DOM_PRICE_SELECTORS],
          availability: [...DEFAULT_DOM_AVAILABILITY_SELECTORS],
          size: [...DEFAULT_DOM_SIZE_SELECTORS],
        },
        failureReason: null,
        repairCount: input.profile.repairCount + 1,
      };
      const repairedSnapshot = buildVerifiedSnapshot({
        price: renderedTextPrice,
        variants: renderedTextVariants,
        stockStatus:
          renderedTextVariants.length > 0
            ? StockStatus.IN_STOCK
            : /(out of stock|sold out|currently unavailable|unavailable)/i.test(input.renderedText)
              ? StockStatus.OUT_OF_STOCK
              : /(add to cart|add to bag|in stock|available now)/i.test(input.renderedText)
                ? StockStatus.IN_STOCK
                : StockStatus.UNKNOWN,
        extractionStrategy: "VISION",
      });
      return {
        snapshot: repairedSnapshot,
        repairedProfile,
      };
    }
  }

  return {
    snapshot: emptySnapshot("UNVERIFIED", {
      failureReason: "Website profile could not extract product data with the configured strategy order.",
    }),
    repairedProfile: null,
  };
}

function mapAuditLog(entry: {
  id: string;
  action: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  const metadata = isRecord(entry.metadata) ? entry.metadata : {};

  return {
    id: entry.id,
    status: entry.action.replace(PRODUCT_MONITORING_LOG_PREFIX, ""),
    changedFields: Array.isArray(metadata.changedFields)
      ? metadata.changedFields.filter((value): value is string => typeof value === "string")
      : [],
    monitoringStatus:
      typeof metadata.monitoringStatus === "string"
        ? metadata.monitoringStatus
        : "UNVERIFIED",
    attemptedStages: Array.isArray(metadata.attemptedStages)
      ? metadata.attemptedStages.filter((value): value is string => typeof value === "string")
      : [],
    successfulStage: typeof metadata.successfulStage === "string" ? metadata.successfulStage : null,
    extractionStrategy: typeof metadata.extractionStrategy === "string" ? metadata.extractionStrategy : null,
    websiteHost: typeof metadata.websiteHost === "string" ? metadata.websiteHost : null,
    profileStatus: typeof metadata.profileStatus === "string" ? metadata.profileStatus : null,
    errorMessage: typeof metadata.errorMessage === "string" ? metadata.errorMessage : null,
    responseTimeMs: typeof metadata.responseTimeMs === "number" ? metadata.responseTimeMs : null,
    responseStatus: typeof metadata.responseStatus === "number" ? metadata.responseStatus : null,
    lastCheckedAt: typeof metadata.lastCheckedAt === "string" ? metadata.lastCheckedAt : entry.createdAt.toISOString(),
    nextScheduledCheck: typeof metadata.nextScheduledCheck === "string" ? metadata.nextScheduledCheck : null,
    createdAt: entry.createdAt,
  };
}

function parseSourceHost(sourceUrl: string): string | null {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function defaultProfileForHost(input: {
  host: string;
  sourceStore: string | null;
  sampleProductUrl: string;
  antiBotConfig: WebsiteProfileAntiBotConfig;
  intervalMinutes: number;
}): WebsiteMonitoringProfile {
  return {
    host: input.host,
    status: "VALID",
    extractionPriority: [...WEBSITE_PROFILE_STRATEGY_PRIORITY],
    activeStrategy: null,
    api: createDefaultApiConfig(),
    jsonLd: createDefaultJsonLdConfig(),
    selectors: createDefaultSelectors(),
    xpaths: createDefaultXpaths(),
    antiBotConfig: input.antiBotConfig,
    retryPolicy: createDefaultRetryPolicy(),
    monitoringIntervalMinutes: input.intervalMinutes,
    failureReason: null,
    repairCount: 0,
    lastValidatedAt: null,
    lastFailedAt: null,
    repairLock: null,
    sampleProductUrl: input.sampleProductUrl,
    sourceStore: input.sourceStore,
  };
}

function normalizeProfileStatus(value: unknown): WebsiteProfileStatus {
  return value === "INVALID" || value === "REPAIRING" ? value : "VALID";
}

function normalizeWebsiteProfile(host: string, value: unknown, defaults: WebsiteMonitoringProfile): WebsiteMonitoringProfile {
  if (!isRecord(value)) {
    return defaults;
  }

  const priority = Array.isArray(value.extractionPriority)
    ? value.extractionPriority.filter(
        (entry): entry is WebsiteProfileExtractionStrategy =>
          typeof entry === "string" && WEBSITE_PROFILE_STRATEGY_PRIORITY.includes(entry as WebsiteProfileExtractionStrategy),
      )
    : defaults.extractionPriority;
  const retryableStatuses = Array.isArray(value.retryPolicy) ? createDefaultRetryPolicy().retryableStatuses : undefined;
  const retryPolicy = isRecord(value.retryPolicy)
    ? {
        maxAttempts:
          typeof value.retryPolicy.maxAttempts === "number" && value.retryPolicy.maxAttempts > 0
            ? value.retryPolicy.maxAttempts
            : defaults.retryPolicy.maxAttempts,
        baseBackoffMs:
          typeof value.retryPolicy.baseBackoffMs === "number" && value.retryPolicy.baseBackoffMs > 0
            ? value.retryPolicy.baseBackoffMs
            : defaults.retryPolicy.baseBackoffMs,
        maxBackoffMs:
          typeof value.retryPolicy.maxBackoffMs === "number" && value.retryPolicy.maxBackoffMs > 0
            ? value.retryPolicy.maxBackoffMs
            : defaults.retryPolicy.maxBackoffMs,
        retryableStatuses: Array.isArray(value.retryPolicy.retryableStatuses)
          ? value.retryPolicy.retryableStatuses.filter(
              (entry): entry is MonitoringVerificationStatus =>
                typeof entry === "string" && createDefaultRetryPolicy().retryableStatuses.includes(entry as MonitoringVerificationStatus),
            )
          : defaults.retryPolicy.retryableStatuses,
      }
    : defaults.retryPolicy;
  const selectors = isRecord(value.selectors)
    ? {
        price: Array.isArray(value.selectors.price)
          ? value.selectors.price.filter((entry): entry is string => typeof entry === "string")
          : defaults.selectors.price,
        availability: Array.isArray(value.selectors.availability)
          ? value.selectors.availability.filter((entry): entry is string => typeof entry === "string")
          : defaults.selectors.availability,
        size: Array.isArray(value.selectors.size)
          ? value.selectors.size.filter((entry): entry is string => typeof entry === "string")
          : defaults.selectors.size,
      }
    : defaults.selectors;
  const api = isRecord(value.api)
    ? {
        endpoint: typeof value.api.endpoint === "string" ? value.api.endpoint : defaults.api.endpoint,
        method: typeof value.api.method === "string" ? value.api.method : defaults.api.method,
        transport:
          value.api.transport === "XHR" || value.api.transport === "FETCH" || value.api.transport === "GRAPHQL"
            ? value.api.transport
            : defaults.api.transport,
        endpointTemplate:
          typeof value.api.endpointTemplate === "string" ? value.api.endpointTemplate : defaults.api.endpointTemplate,
        requestBodyTemplate:
          typeof value.api.requestBodyTemplate === "string" ? value.api.requestBodyTemplate : defaults.api.requestBodyTemplate,
        jsonPath: Array.isArray(value.api.jsonPath)
          ? value.api.jsonPath.filter((entry): entry is string => typeof entry === "string")
          : defaults.api.jsonPath,
      }
    : defaults.api;
  const jsonLd = isRecord(value.jsonLd)
    ? {
        scriptSelector:
          typeof value.jsonLd.scriptSelector === "string" ? value.jsonLd.scriptSelector : defaults.jsonLd.scriptSelector,
        jsonPath: Array.isArray(value.jsonLd.jsonPath)
          ? value.jsonLd.jsonPath.filter((entry): entry is string => typeof entry === "string")
          : defaults.jsonLd.jsonPath,
      }
    : defaults.jsonLd;
  const xpaths = isRecord(value.xpaths)
    ? {
        price: Array.isArray(value.xpaths.price)
          ? value.xpaths.price.filter((entry): entry is string => typeof entry === "string")
          : defaults.xpaths.price,
        availability: Array.isArray(value.xpaths.availability)
          ? value.xpaths.availability.filter((entry): entry is string => typeof entry === "string")
          : defaults.xpaths.availability,
        size: Array.isArray(value.xpaths.size)
          ? value.xpaths.size.filter((entry): entry is string => typeof entry === "string")
          : defaults.xpaths.size,
      }
    : defaults.xpaths;
  const antiBotConfig = isRecord(value.antiBotConfig)
    ? {
        scraperType:
          value.antiBotConfig.scraperType === ScraperType.PUPPETEER ? ScraperType.PUPPETEER : defaults.antiBotConfig.scraperType,
        headless:
          typeof value.antiBotConfig.headless === "boolean" ? value.antiBotConfig.headless : defaults.antiBotConfig.headless,
        timeoutMs:
          typeof value.antiBotConfig.timeoutMs === "number" ? value.antiBotConfig.timeoutMs : defaults.antiBotConfig.timeoutMs,
        retryAttempts:
          typeof value.antiBotConfig.retryAttempts === "number"
            ? value.antiBotConfig.retryAttempts
            : defaults.antiBotConfig.retryAttempts,
        userAgent:
          typeof value.antiBotConfig.userAgent === "string"
            ? value.antiBotConfig.userAgent
            : defaults.antiBotConfig.userAgent,
        stealth:
          typeof value.antiBotConfig.stealth === "boolean" ? value.antiBotConfig.stealth : defaults.antiBotConfig.stealth,
        proxy: isRecord(value.antiBotConfig.proxy) && typeof value.antiBotConfig.proxy.server === "string"
          ? {
              server: value.antiBotConfig.proxy.server,
              username:
                typeof value.antiBotConfig.proxy.username === "string" ? value.antiBotConfig.proxy.username : undefined,
              password:
                typeof value.antiBotConfig.proxy.password === "string" ? value.antiBotConfig.proxy.password : undefined,
            }
          : defaults.antiBotConfig.proxy,
        requestLimiter: isRecord(value.antiBotConfig.requestLimiter)
          ? {
              maxRequestsPerMinute:
                typeof value.antiBotConfig.requestLimiter.maxRequestsPerMinute === "number"
                  ? value.antiBotConfig.requestLimiter.maxRequestsPerMinute
                  : defaults.antiBotConfig.requestLimiter?.maxRequestsPerMinute,
              maxConcurrentPages:
                typeof value.antiBotConfig.requestLimiter.maxConcurrentPages === "number"
                  ? value.antiBotConfig.requestLimiter.maxConcurrentPages
                  : defaults.antiBotConfig.requestLimiter?.maxConcurrentPages,
            }
          : defaults.antiBotConfig.requestLimiter,
      }
    : defaults.antiBotConfig;

  return {
    host,
    status: normalizeProfileStatus(value.status),
    extractionPriority: priority.length > 0 ? priority : defaults.extractionPriority,
    activeStrategy:
      value.activeStrategy === "API" || value.activeStrategy === "JSON_LD" || value.activeStrategy === "DOM" || value.activeStrategy === "XPATH"
        ? value.activeStrategy
        : defaults.activeStrategy,
    api,
    jsonLd,
    selectors,
    xpaths,
    antiBotConfig,
    retryPolicy: retryPolicy.retryableStatuses.length > 0 ? retryPolicy : defaults.retryPolicy,
    monitoringIntervalMinutes:
      typeof value.monitoringIntervalMinutes === "number" && value.monitoringIntervalMinutes >= 5
        ? value.monitoringIntervalMinutes
        : defaults.monitoringIntervalMinutes,
    failureReason: typeof value.failureReason === "string" ? value.failureReason : null,
    repairCount: typeof value.repairCount === "number" ? value.repairCount : defaults.repairCount,
    lastValidatedAt: typeof value.lastValidatedAt === "string" ? value.lastValidatedAt : null,
    lastFailedAt: typeof value.lastFailedAt === "string" ? value.lastFailedAt : null,
    repairLock:
      isRecord(value.repairLock) &&
      typeof value.repairLock.ownerProductId === "string" &&
      typeof value.repairLock.acquiredAt === "string" &&
      typeof value.repairLock.expiresAt === "string"
        ? {
            ownerProductId: value.repairLock.ownerProductId,
            acquiredAt: value.repairLock.acquiredAt,
            expiresAt: value.repairLock.expiresAt,
          }
        : defaults.repairLock,
    sampleProductUrl: typeof value.sampleProductUrl === "string" ? value.sampleProductUrl : defaults.sampleProductUrl,
    sourceStore: typeof value.sourceStore === "string" ? value.sourceStore : defaults.sourceStore,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildHttpHeaders(userAgent?: string): Record<string, string> {
  return {
    "user-agent":
      userAgent ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "accept-language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    pragma: "no-cache",
    "cache-control": "no-cache",
    "upgrade-insecure-requests": "1",
  };
}

function normalizeHeaders(headers: Headers | Record<string, string> | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function isRetryableMonitoringStatus(status: MonitoringVerificationStatus): boolean {
  return (
    status === "FORBIDDEN_403" ||
    status === "RATE_LIMITED_429" ||
    status === "CAPTCHA" ||
    status === "CLOUDFLARE" ||
    status === "AKAMAI" ||
    status === "LOGIN_REQUIRED" ||
    status === "UNVERIFIED"
  );
}

function computeBackoffMs(input: {
  attemptIndex: number;
  monitoringStatus: MonitoringVerificationStatus;
  retryPolicy: WebsiteProfileRetryPolicy;
  requestLimiter?: BrowserManagerConfig["requestLimiter"] | null;
}): number {
  const minimumLimiterDelay =
    input.requestLimiter?.maxRequestsPerMinute && input.requestLimiter.maxRequestsPerMinute > 0
      ? Math.ceil(60000 / input.requestLimiter.maxRequestsPerMinute)
      : 0;
  const base =
    input.monitoringStatus === "RATE_LIMITED_429"
      ? Math.max(2000, input.retryPolicy.baseBackoffMs)
      : input.retryPolicy.baseBackoffMs;
  return Math.max(minimumLimiterDelay, Math.min(input.retryPolicy.maxBackoffMs, base * 2 ** input.attemptIndex));
}

async function performHttpRequestStage(
  sourceUrl: string,
  timeoutMs: number,
  userAgent?: string,
): Promise<MonitoringStageFetchResult> {
  const startedAt = Date.now();
  const response = await fetch(sourceUrl, {
    headers: buildHttpHeaders(userAgent),
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });

  return {
    stage: "API_REQUEST",
    responseStatus: response.status,
    finalUrl: response.url,
    headers: normalizeHeaders(response.headers),
    html: await response.text(),
    renderedText: null,
    apiResponseJson: null,
    responseTimeMs: Date.now() - startedAt,
  };
}

async function performBrowserStage(
  sourceUrl: string,
  browserConfig: BrowserManagerConfig,
  stage: MonitoringExtractionStage,
  captureRenderedText: boolean,
  xpathExpressions?: WebsiteProfileXpaths,
): Promise<MonitoringStageFetchResult> {
  const startedAt = Date.now();
  const session = await browserManager.createSession(browserConfig);

  try {
    const page = await session.newPage();
    const navigation = await navigatePage(page, sourceUrl);
    const html = page.content ? await page.content() : "";
    const renderedText = captureRenderedText && page.text ? await page.text().catch(() => "") : null;
    const networkEntries = page.networkEntries ? await page.networkEntries().catch(() => []) : [];
    const xpathResults =
      page.queryXPath && xpathExpressions
        ? {
            price: await Promise.all(
              xpathExpressions.price.map(async (expression) => ({
                expression,
                values: await page.queryXPath!(expression).catch(() => []),
              })),
            ),
            availability: await Promise.all(
              xpathExpressions.availability.map(async (expression) => ({
                expression,
                values: await page.queryXPath!(expression).catch(() => []),
              })),
            ),
            size: await Promise.all(
              xpathExpressions.size.map(async (expression) => ({
                expression,
                values: await page.queryXPath!(expression).catch(() => []),
              })),
            ),
          }
        : undefined;
    if (stage === "VISION_FALLBACK" && page.screenshot) {
      await page.screenshot().catch(() => undefined);
    }
    await page.close();

    return {
      stage,
      responseStatus: navigation.status,
      finalUrl: navigation.url,
      headers: normalizeHeaders(navigation.headers),
      html,
      renderedText,
      apiResponseJson: null,
      xpathResults,
      networkEntries,
      responseTimeMs: Date.now() - startedAt,
    };
  } finally {
    await session.close();
  }
}

async function performProfileApiStage(
  profile: WebsiteMonitoringProfile,
  sourceUrl: string,
): Promise<MonitoringStageFetchResult | null> {
  if (!profile.api.endpointTemplate) {
    return null;
  }

  const startedAt = Date.now();
  const endpoint = resolveEndpointTemplate(profile.api.endpointTemplate, sourceUrl);
  const method = profile.api.method?.toUpperCase() ?? "GET";
  const requestBody = profile.api.requestBodyTemplate
    ? resolveEndpointTemplate(profile.api.requestBodyTemplate, sourceUrl)
    : undefined;

  const response = await fetch(endpoint, {
    method,
    headers: {
      ...buildHttpHeaders(profile.antiBotConfig.userAgent ?? undefined),
      accept: "application/json, text/plain, */*",
      ...(method !== "GET" ? { "content-type": "application/json" } : {}),
    },
    body: method !== "GET" ? requestBody : undefined,
    signal: AbortSignal.timeout(profile.antiBotConfig.timeoutMs),
    redirect: "follow",
  });

  const responseText = await response.text();
  const responseJson = safeJsonParse(responseText);

  return {
    stage: "HTTP_REQUEST",
    responseStatus: response.status,
    finalUrl: response.url,
    headers: normalizeHeaders(response.headers),
    html: responseText,
    renderedText: null,
    apiResponseJson: responseJson,
    responseTimeMs: Date.now() - startedAt,
  };
}

function buildBrowserConfigFromSource(
  source: { scraperType: ScraperType; configuration: Prisma.JsonValue | null } | null,
  timeoutMs: number,
  options?: {
    stealth?: boolean;
    disableProxy?: boolean;
  },
): BrowserManagerConfig {
  const configuration = isRecord(source?.configuration) ? source.configuration : {};
  const proxyConfig = isRecord(configuration.proxy) ? configuration.proxy : null;
  const proxyServer = proxyConfig && typeof proxyConfig.server === "string" ? proxyConfig.server : null;
  const requestLimiterConfig = isRecord(configuration.requestLimiter) ? configuration.requestLimiter : null;

  return {
    scraperType: source?.scraperType ?? ScraperType.PLAYWRIGHT,
    headless: typeof configuration.headless === "boolean" ? configuration.headless : true,
    timeoutMs: typeof configuration.timeoutMs === "number" ? configuration.timeoutMs : timeoutMs,
    retryAttempts: typeof configuration.retryAttempts === "number" ? configuration.retryAttempts : 2,
    userAgent: typeof configuration.userAgent === "string" ? configuration.userAgent : undefined,
    stealth: options?.stealth ?? false,
    proxy: !options?.disableProxy && proxyServer
      ? {
          server: proxyServer,
          username: typeof proxyConfig?.username === "string" ? proxyConfig.username : undefined,
          password: typeof proxyConfig?.password === "string" ? proxyConfig.password : undefined,
        }
      : null,
    requestLimiter: requestLimiterConfig
      ? {
          maxRequestsPerMinute: typeof requestLimiterConfig.maxRequestsPerMinute === "number" ? requestLimiterConfig.maxRequestsPerMinute : undefined,
          maxConcurrentPages: typeof requestLimiterConfig.maxConcurrentPages === "number" ? requestLimiterConfig.maxConcurrentPages : undefined,
        }
      : null,
  };
}

function buildBrowserConfigFromProfile(
  profile: WebsiteMonitoringProfile,
  options?: {
    useProxy?: boolean;
    stealth?: boolean;
  },
): BrowserManagerConfig {
  return {
    scraperType: profile.antiBotConfig.scraperType,
    headless: profile.antiBotConfig.headless,
    timeoutMs: profile.antiBotConfig.timeoutMs,
    retryAttempts: profile.antiBotConfig.retryAttempts,
    userAgent: profile.antiBotConfig.userAgent ?? undefined,
    stealth: options?.stealth ?? profile.antiBotConfig.stealth,
    proxy: options?.useProxy ? profile.antiBotConfig.proxy : null,
    requestLimiter: profile.antiBotConfig.requestLimiter,
  };
}

async function navigatePage(
  page: BrowserPageHandle,
  sourceUrl: string,
): Promise<{ status: number | null; url: string; headers?: Record<string, string> }> {
  if (!page.goto) {
    throw new Error("Browser page navigation is not available.");
  }

  return page.goto(sourceUrl);
}

export class ProductMonitoringService {
  public async getGlobalSettings(): Promise<ProductMonitoringGlobalConfig> {
    const stored = await prisma.setting.findUnique({
      where: { key: PRODUCT_MONITORING_GLOBAL_SETTING_KEY },
    });

    if (!stored || !isRecord(stored.value)) {
      return getDefaultGlobalConfig();
    }

    const defaults = getDefaultGlobalConfig();
    return {
      enabled: typeof stored.value.enabled === "boolean" ? stored.value.enabled : defaults.enabled,
      intervalMinutes:
        typeof stored.value.intervalMinutes === "number" && stored.value.intervalMinutes >= 5
          ? stored.value.intervalMinutes
          : defaults.intervalMinutes,
      timeoutMs:
        typeof stored.value.timeoutMs === "number" && stored.value.timeoutMs >= 5000
          ? stored.value.timeoutMs
          : defaults.timeoutMs,
    };
  }

  public async updateGlobalSettings(input: Partial<ProductMonitoringGlobalConfig>): Promise<ProductMonitoringGlobalConfig> {
    const current = await this.getGlobalSettings();
    const next: ProductMonitoringGlobalConfig = {
      enabled: input.enabled ?? current.enabled,
      intervalMinutes: input.intervalMinutes ?? current.intervalMinutes,
      timeoutMs: input.timeoutMs ?? current.timeoutMs,
    };

    await prisma.setting.upsert({
      where: { key: PRODUCT_MONITORING_GLOBAL_SETTING_KEY },
      update: {
        value: toInputJsonValue(next),
        description: "Global product monitoring configuration.",
        isPublic: false,
      },
      create: {
        key: PRODUCT_MONITORING_GLOBAL_SETTING_KEY,
        value: toInputJsonValue(next),
        description: "Global product monitoring configuration.",
        isPublic: false,
      },
    });

    return next;
  }

  public async getOverrideMap(): Promise<ProductMonitoringOverrideMap> {
    const stored = await prisma.setting.findUnique({
      where: { key: PRODUCT_MONITORING_OVERRIDES_SETTING_KEY },
    });

    if (!stored || !isRecord(stored.value)) {
      return {};
    }

    const overrides: ProductMonitoringOverrideMap = {};

    for (const [key, value] of Object.entries(stored.value)) {
      if (!isRecord(value)) {
        continue;
      }

      overrides[key] = {
        enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
        intervalMinutes: typeof value.intervalMinutes === "number" && value.intervalMinutes >= 5 ? value.intervalMinutes : undefined,
      };
    }

    return overrides;
  }

  public async updateProductOverride(
    productId: string,
    input: { enabled?: boolean; intervalMinutes?: number | null },
  ): Promise<ProductMonitoringOverrideConfig> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const overrides = await this.getOverrideMap();
    const nextOverride: ProductMonitoringOverrideConfig = {
      enabled: input.enabled ?? overrides[productId]?.enabled,
      intervalMinutes: input.intervalMinutes === null ? undefined : input.intervalMinutes ?? overrides[productId]?.intervalMinutes,
    };

    const nextOverrides = {
      ...overrides,
      [productId]: nextOverride,
    };

    if (nextOverride.enabled === undefined && nextOverride.intervalMinutes === undefined) {
      delete nextOverrides[productId];
    }

    await prisma.setting.upsert({
      where: { key: PRODUCT_MONITORING_OVERRIDES_SETTING_KEY },
      update: {
        value: toInputJsonValue(nextOverrides),
        description: "Per-product monitoring interval overrides.",
        isPublic: false,
      },
      create: {
        key: PRODUCT_MONITORING_OVERRIDES_SETTING_KEY,
        value: toInputJsonValue(nextOverrides),
        description: "Per-product monitoring interval overrides.",
        isPublic: false,
      },
    });

    return nextOverrides[productId] ?? {};
  }

  public async getWebsiteProfileMap(): Promise<WebsiteProfileMap> {
    const stored = await prisma.setting.findUnique({
      where: { key: PRODUCT_MONITORING_WEBSITE_PROFILES_SETTING_KEY },
    });

    if (!stored || !isRecord(stored.value)) {
      return {};
    }

    const global = getDefaultGlobalConfig();
    const profiles: WebsiteProfileMap = {};
    for (const [host, value] of Object.entries(stored.value)) {
      const defaults = defaultProfileForHost({
        host,
        sourceStore: null,
        sampleProductUrl: `https://${host}`,
        antiBotConfig: {
          scraperType: ScraperType.PLAYWRIGHT,
          headless: true,
          timeoutMs: global.timeoutMs,
          retryAttempts: 2,
          userAgent: null,
          stealth: false,
          proxy: null,
          requestLimiter: null,
        },
        intervalMinutes: global.intervalMinutes,
      });
      profiles[host] = normalizeWebsiteProfile(host, value, defaults);
    }

    return profiles;
  }

  private async saveWebsiteProfileMap(profiles: WebsiteProfileMap): Promise<void> {
    await prisma.setting.upsert({
      where: { key: PRODUCT_MONITORING_WEBSITE_PROFILES_SETTING_KEY },
      update: {
        value: toInputJsonValue(profiles),
        description: "Reusable website profiles for product monitoring.",
        isPublic: false,
      },
      create: {
        key: PRODUCT_MONITORING_WEBSITE_PROFILES_SETTING_KEY,
        value: toInputJsonValue(profiles),
        description: "Reusable website profiles for product monitoring.",
        isPublic: false,
      },
    });
  }

  private async resolveScraperSourceForProfile(sourceUrl: string, sourceStore: string | null) {
    const sourceHost = parseSourceHost(sourceUrl);
    const scraperSources = sourceHost
      ? await prisma.scraperSource.findMany({
          where: {
            status: ScraperStatus.ACTIVE,
          },
          select: {
            id: true,
            scraperType: true,
            configuration: true,
            website: true,
            name: true,
          },
        })
      : [];

    return (
      scraperSources.find((candidate) => {
        const candidateHost = candidate.website ? parseSourceHost(candidate.website) : null;
        return Boolean(candidateHost && candidateHost === sourceHost);
      }) ??
      scraperSources.find(
        (candidate) =>
          typeof sourceStore === "string" &&
          candidate.name.toLowerCase() === sourceStore.toLowerCase(),
      ) ??
      null
    );
  }

  private mapAntiBotConfig(
    browserConfig: BrowserManagerConfig,
    global: ProductMonitoringGlobalConfig,
  ): WebsiteProfileAntiBotConfig {
    return {
      scraperType: browserConfig.scraperType ?? ScraperType.PLAYWRIGHT,
      headless: browserConfig.headless ?? true,
      timeoutMs: browserConfig.timeoutMs ?? global.timeoutMs,
      retryAttempts: browserConfig.retryAttempts ?? 2,
      userAgent: browserConfig.userAgent ?? null,
      stealth: Boolean(browserConfig.stealth),
      proxy: browserConfig.proxy
        ? {
            server: browserConfig.proxy.server,
            username: browserConfig.proxy.username,
            password: browserConfig.proxy.password,
          }
        : null,
      requestLimiter: browserConfig.requestLimiter
        ? {
            maxRequestsPerMinute: browserConfig.requestLimiter.maxRequestsPerMinute,
            maxConcurrentPages: browserConfig.requestLimiter.maxConcurrentPages,
          }
        : null,
    };
  }

  public async ensureWebsiteProfileForProduct(productId: string): Promise<WebsiteMonitoringProfile | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sourceUrl: true,
        sourceStore: true,
      },
    });

    if (!product?.sourceUrl) {
      return null;
    }

    const profile = await this.ensureWebsiteProfileForSource({
      sourceUrl: product.sourceUrl,
      sourceStore: product.sourceStore ?? null,
    });
    if (!profile) {
      return null;
    }

    return this.captureWebsiteProfileMetadata({
      sourceUrl: product.sourceUrl,
      sourceStore: product.sourceStore ?? null,
      profile,
    });
  }

  public async ensureWebsiteProfileForSource(input: {
    sourceUrl: string;
    sourceStore: string | null;
  }): Promise<WebsiteMonitoringProfile | null> {
    const host = parseSourceHost(input.sourceUrl);
    if (!host) {
      return null;
    }

    const [global, profiles, scraperSource] = await Promise.all([
      this.getGlobalSettings(),
      this.getWebsiteProfileMap(),
      this.resolveScraperSourceForProfile(input.sourceUrl, input.sourceStore),
    ]);
    const browserConfig = buildBrowserConfigFromSource(scraperSource, global.timeoutMs, {
      stealth: true,
    });
    const defaults = defaultProfileForHost({
      host,
      sourceStore: input.sourceStore,
      sampleProductUrl: input.sourceUrl,
      antiBotConfig: this.mapAntiBotConfig(browserConfig, global),
      intervalMinutes: global.intervalMinutes,
    });
    const existing = profiles[host];
    const nextProfile = existing
      ? {
          ...normalizeWebsiteProfile(host, existing, defaults),
          sampleProductUrl: existing.sampleProductUrl ?? input.sourceUrl,
          sourceStore: existing.sourceStore ?? input.sourceStore,
        }
      : defaults;

    if (!existing || JSON.stringify(existing) !== JSON.stringify(nextProfile)) {
      await this.saveWebsiteProfileMap({
        ...profiles,
        [host]: nextProfile,
      });
    }

    return nextProfile;
  }

  private async captureWebsiteProfileMetadata(input: {
    sourceUrl: string;
    sourceStore: string | null;
    profile: WebsiteMonitoringProfile;
  }): Promise<WebsiteMonitoringProfile> {
    const shouldCapture =
      !input.profile.api.endpointTemplate ||
      input.profile.api.jsonPath.length === 0 ||
      input.profile.jsonLd.jsonPath.length === 0;

    if (!shouldCapture) {
      return input.profile;
    }

    try {
      const browserConfig = buildBrowserConfigFromProfile(input.profile, {
        useProxy: Boolean(input.profile.antiBotConfig.proxy),
        stealth: true,
      });
      const capture = await performBrowserStage(
        input.sourceUrl,
        browserConfig,
        "BROWSER_SESSION",
        true,
        input.profile.xpaths,
      );
      const $ = load(capture.html);
      const apiMetadata = detectApiMetadataFromNetworkEntries(capture.networkEntries ?? [], input.sourceUrl);
      const jsonLdMetadata = detectJsonLdMetadata($);
      const domSnapshot = extractUsingDomProfile($, input.profile);
      const xpathSnapshot = extractUsingXPathProfile(input.profile, capture.xpathResults);

      const nextProfile: WebsiteMonitoringProfile = {
        ...input.profile,
        sampleProductUrl: input.sourceUrl,
        sourceStore: input.sourceStore,
        api: apiMetadata ?? input.profile.api,
        jsonLd:
          jsonLdMetadata.jsonPath.length > 0 || !input.profile.jsonLd.jsonPath.length
            ? jsonLdMetadata
            : input.profile.jsonLd,
        selectors: {
          price: domSnapshot.matchedSelectors.price ?? input.profile.selectors.price,
          availability: domSnapshot.matchedSelectors.availability ?? input.profile.selectors.availability,
          size: domSnapshot.matchedSelectors.size ?? input.profile.selectors.size,
        },
        xpaths: {
          price: xpathSnapshot.matchedXpaths.price ?? input.profile.xpaths.price,
          availability: xpathSnapshot.matchedXpaths.availability ?? input.profile.xpaths.availability,
          size: xpathSnapshot.matchedXpaths.size ?? input.profile.xpaths.size,
        },
        activeStrategy:
          (apiMetadata?.endpointTemplate
            ? "API"
            : jsonLdMetadata.jsonPath.length > 0
              ? "JSON_LD"
              : domSnapshot.matchedSelectors.price || domSnapshot.matchedSelectors.size
                ? "DOM"
                : xpathSnapshot.matchedXpaths.price || xpathSnapshot.matchedXpaths.size
                  ? "XPATH"
                  : input.profile.activeStrategy) ?? input.profile.activeStrategy,
      };

      await this.updateWebsiteProfile(nextProfile);
      return nextProfile;
    } catch {
      return input.profile;
    }
  }

  private async updateWebsiteProfile(profile: WebsiteMonitoringProfile): Promise<void> {
    const profiles = await this.getWebsiteProfileMap();
    await this.saveWebsiteProfileMap({
      ...profiles,
      [profile.host]: profile,
    });
  }

  private async acquireWebsiteProfileRepairLock(
    profile: WebsiteMonitoringProfile,
    productId: string,
    checkedAt: Date,
  ): Promise<{ acquired: boolean; profile: WebsiteMonitoringProfile }> {
    const profiles = await this.getWebsiteProfileMap();
    const currentProfile = profiles[profile.host] ?? profile;
    const now = checkedAt;

    if (
      isRepairLockActive(currentProfile, now) &&
      currentProfile.repairLock?.ownerProductId &&
      currentProfile.repairLock.ownerProductId !== productId
    ) {
      return {
        acquired: false,
        profile: currentProfile,
      };
    }

    const nextProfile: WebsiteMonitoringProfile = {
      ...currentProfile,
      status: "REPAIRING",
      repairLock: buildRepairLock({
        ownerProductId: productId,
        checkedAt,
        timeoutMs: currentProfile.antiBotConfig.timeoutMs,
        retryPolicy: currentProfile.retryPolicy,
      }),
    };

    await this.saveWebsiteProfileMap({
      ...profiles,
      [profile.host]: nextProfile,
    });

    return {
      acquired: true,
      profile: nextProfile,
    };
  }

  private async waitForWebsiteProfileRepair(
    host: string,
    currentProductId: string,
    timeoutMs: number,
  ): Promise<WebsiteMonitoringProfile | null> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const profiles = await this.getWebsiteProfileMap();
      const profile = profiles[host] ?? null;
      if (!profile) {
        return null;
      }

      const now = new Date();
      const activeRepair = isRepairLockActive(profile, now);
      const ownedByCurrentProduct = profile.repairLock?.ownerProductId === currentProductId;

      if (!activeRepair || ownedByCurrentProduct) {
        if (profile.status === "REPAIRING" && !ownedByCurrentProduct && !activeRepair) {
          const releasedProfile: WebsiteMonitoringProfile = {
            ...profile,
            status: "INVALID",
            repairLock: null,
          };
          await this.updateWebsiteProfile(releasedProfile);
          return releasedProfile;
        }

        return profile;
      }

      await sleep(1000);
    }

    const profiles = await this.getWebsiteProfileMap();
    return profiles[host] ?? null;
  }

  private async markWebsiteProfileValidation(
    profile: WebsiteMonitoringProfile,
    input: {
      status: WebsiteProfileStatus;
      failureReason: string | null;
      activeStrategy?: Exclude<WebsiteProfileExtractionStrategy, "VISION"> | null;
      matchedSelectors?: Partial<WebsiteProfileSelectors>;
      matchedXpaths?: Partial<WebsiteProfileXpaths>;
      checkedAt: Date;
      repaired?: boolean;
    },
  ): Promise<WebsiteMonitoringProfile> {
    const nextProfile: WebsiteMonitoringProfile = {
      ...profile,
      status: input.status,
      failureReason: input.failureReason,
      activeStrategy: input.activeStrategy ?? profile.activeStrategy,
      selectors: {
        price: input.matchedSelectors?.price ?? profile.selectors.price,
        availability: input.matchedSelectors?.availability ?? profile.selectors.availability,
        size: input.matchedSelectors?.size ?? profile.selectors.size,
      },
      xpaths: {
        price: input.matchedXpaths?.price ?? profile.xpaths.price,
        availability: input.matchedXpaths?.availability ?? profile.xpaths.availability,
        size: input.matchedXpaths?.size ?? profile.xpaths.size,
      },
      lastValidatedAt: input.status === "VALID" ? input.checkedAt.toISOString() : profile.lastValidatedAt,
      lastFailedAt: input.status === "INVALID" ? input.checkedAt.toISOString() : profile.lastFailedAt,
      repairCount: input.repaired ? profile.repairCount + 1 : profile.repairCount,
      repairLock: input.status === "REPAIRING" ? profile.repairLock : null,
    };

    await this.updateWebsiteProfile(nextProfile);
    return nextProfile;
  }

  private async queueSiblingProductsForProfile(host: string, excludeProductId: string): Promise<void> {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        sourceUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        sourceUrl: true,
      },
    });

    const matchingProducts = products.filter(
      (product) => product.id !== excludeProductId && product.sourceUrl && parseSourceHost(product.sourceUrl) === host,
    );

    await Promise.all(
      matchingProducts.map((product) =>
        priceMonitorQueue.add("process-product-monitor", {
          productId: product.id,
          trigger: "schedule",
          jobType: "product-monitor-check",
        }),
      ),
    );
  }

  public async getResolvedConfig(productId: string): Promise<ResolvedProductMonitoringConfig> {
    const [global, overrides, product] = await Promise.all([
      this.getGlobalSettings(),
      this.getOverrideMap(),
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          sourceUrl: true,
          sourceStore: true,
        },
      }),
    ]);
    const override = overrides[productId] ?? null;
    const profile = product?.sourceUrl
      ? await this.ensureWebsiteProfileForSource({
          sourceUrl: product.sourceUrl,
          sourceStore: product.sourceStore ?? null,
        })
      : null;

    return {
      enabled: override?.enabled ?? global.enabled,
      intervalMinutes: override?.intervalMinutes ?? profile?.monitoringIntervalMinutes ?? global.intervalMinutes,
      timeoutMs: profile?.antiBotConfig.timeoutMs ?? global.timeoutMs,
      override,
    };
  }

  public async listScheduledProducts(): Promise<Array<{ productId: string; intervalMinutes: number }>> {
    const [global, overrides, products] = await Promise.all([
      this.getGlobalSettings(),
      this.getOverrideMap(),
      prisma.product.findMany({
        where: {
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          sourceUrl: {
            not: null,
          },
        },
        select: {
          id: true,
          sourceUrl: true,
          sourceStore: true,
        },
      }),
    ]);

    if (!global.enabled) {
      return Promise.all(
        products
          .filter((product) => overrides[product.id]?.enabled === true && (overrides[product.id]?.intervalMinutes ?? global.intervalMinutes) >= 5)
          .map(async (product) => {
            const profile = product.sourceUrl
              ? await this.ensureWebsiteProfileForSource({
                  sourceUrl: product.sourceUrl,
                  sourceStore: product.sourceStore ?? null,
                })
              : null;
            return {
              productId: product.id,
              intervalMinutes: overrides[product.id]?.intervalMinutes ?? profile?.monitoringIntervalMinutes ?? global.intervalMinutes,
            };
          }),
      );
    }

    return Promise.all(
      products
        .filter((product) => overrides[product.id]?.enabled !== false)
        .map(async (product) => {
          const profile = product.sourceUrl
            ? await this.ensureWebsiteProfileForSource({
                sourceUrl: product.sourceUrl,
                sourceStore: product.sourceStore ?? null,
              })
            : null;
          return {
            productId: product.id,
            intervalMinutes: overrides[product.id]?.intervalMinutes ?? profile?.monitoringIntervalMinutes ?? global.intervalMinutes,
          };
        }),
    );
  }

  public async getProductOverview(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sourceUrl: true,
        status: true,
        lastSyncedAt: true,
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const [config, latestLog, profile] = await Promise.all([
      this.getResolvedConfig(productId),
      prisma.auditLog.findFirst({
        where: {
          entityType: "Product",
          entityId: productId,
          action: {
            startsWith: PRODUCT_MONITORING_LOG_PREFIX,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      product.sourceUrl
        ? this.ensureWebsiteProfileForSource({
            sourceUrl: product.sourceUrl,
            sourceStore: null,
          })
        : Promise.resolve(null),
    ]);

    const lastCheckedAt = latestLog?.createdAt ?? product.lastSyncedAt ?? null;
    return {
      productId: product.id,
      sourceUrl: product.sourceUrl,
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
      timeoutMs: config.timeoutMs,
      websiteProfile: profile
        ? {
            host: profile.host,
            status: profile.status,
            activeStrategy: profile.activeStrategy,
            monitoringIntervalMinutes: profile.monitoringIntervalMinutes,
            lastValidatedAt: profile.lastValidatedAt,
            lastFailedAt: profile.lastFailedAt,
            failureReason: profile.failureReason,
            repairCount: profile.repairCount,
          }
        : null,
      lastCheckedAt,
      nextScheduledCheck: this.buildNextScheduledCheck(lastCheckedAt, config),
      latestLog: latestLog ? mapAuditLog(latestLog) : null,
    };
  }

  public async listProductLogs(productId: string, limit = 50) {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "Product",
        entityId: productId,
        action: {
          startsWith: PRODUCT_MONITORING_LOG_PREFIX,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return logs.map(mapAuditLog);
  }

  public async checkProduct(productId: string): Promise<ProductMonitoringOutcome> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: [{ color: "asc" }, { size: "asc" }],
        },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const config = await this.getResolvedConfig(productId);
    const checkedAt = new Date();
    const nextScheduledCheck = this.buildNextScheduledCheck(checkedAt, config);

    // #region debug-point B:check-product-entry
    reportManualUpdateDebug("B", "product-monitoring.service.ts:checkProduct:entry", "checkProduct entered", {
      productId: product.id,
      sourceUrl: product.sourceUrl,
      sourceStore: product.sourceStore,
      currentFinalPrice: product.price.toString(),
      currentOutletPrice: product.outletPrice?.toString() ?? null,
      currentSupplierPrice: product.supplierPrice?.toString() ?? null,
      variantCount: product.variants.length,
      monitoringEnabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
    });
    // #endregion

    if (!product.sourceUrl) {
      return this.writeAuditLog(product.id, {
        status: "FAILED",
        changedFields: [],
        responseTimeMs: 0,
        responseStatus: null,
        checkedAt,
        nextScheduledCheck,
        errorMessage: "Product is missing a source URL.",
        rescheduleRequired: false,
        monitoringStatus: "UNVERIFIED",
        attemptedStages: [],
        successfulStage: null,
        extractionStrategy: null,
        websiteHost: null,
        profileStatus: null,
      });
    }

    const sourceUrl = product.sourceUrl;
    const profile = await this.ensureWebsiteProfileForSource({
      sourceUrl,
      sourceStore: product.sourceStore ?? null,
    });
    if (!profile) {
      return this.writeAuditLog(product.id, {
        status: "FAILED",
        changedFields: [],
        responseTimeMs: 0,
        responseStatus: null,
        checkedAt,
        nextScheduledCheck,
        errorMessage: "Website profile could not be resolved for this product.",
        rescheduleRequired: false,
        monitoringStatus: "UNVERIFIED",
        attemptedStages: [],
        successfulStage: null,
        extractionStrategy: null,
        websiteHost: null,
        profileStatus: null,
      });
    }

    const startedAt = Date.now();
    let responseStatus: number | null = null;
    const attemptedStages: MonitoringExtractionStage[] = [];
    let profileState: WebsiteMonitoringProfile = profile;
    let waitedForRepair = false;
    const repairWaitMs = Math.max(
      profileState.antiBotConfig.timeoutMs * Math.max(1, profileState.retryPolicy.maxAttempts),
      profileState.retryPolicy.maxBackoffMs,
      30_000,
    );

    try {
      if (isRepairLockActive(profileState, checkedAt) && profileState.repairLock?.ownerProductId !== product.id) {
        const waitedProfile = await this.waitForWebsiteProfileRepair(profileState.host, product.id, repairWaitMs);
        if (waitedProfile) {
          profileState = waitedProfile;
          waitedForRepair = true;
        }
        if (isRepairLockActive(profileState, checkedAt) && profileState.repairLock?.ownerProductId !== product.id) {
          return this.writeAuditLog(product.id, {
            status: "FAILED",
            changedFields: [],
            responseTimeMs: 0,
            responseStatus: null,
            checkedAt,
            nextScheduledCheck,
            errorMessage: "Website profile repair is still in progress for this source.",
            rescheduleRequired: false,
            monitoringStatus: "UNVERIFIED",
            attemptedStages,
            successfulStage: null,
            extractionStrategy: null,
            websiteHost: profileState.host,
            profileStatus: profileState.status,
          });
        }
      }

      const standardBrowserConfig = buildBrowserConfigFromProfile(profileState, {
        useProxy: false,
        stealth: false,
      });
      const stealthBrowserConfig = buildBrowserConfigFromProfile(profileState, {
        useProxy: false,
        stealth: true,
      });
      const antiBlockBrowserConfig = buildBrowserConfigFromProfile(profileState, {
        useProxy: Boolean(profileState.antiBotConfig.proxy),
        stealth: true,
      });

      const stagePlan: Array<{
        stage: MonitoringExtractionStage;
        run: () => Promise<MonitoringStageFetchResult>;
      }> = [
        ...(profileState.api.endpointTemplate
          ? [
              {
                stage: "API_REQUEST" as const,
                run: async () =>
                  (await performProfileApiStage(profileState, sourceUrl)) ??
                  performHttpRequestStage(sourceUrl, config.timeoutMs, standardBrowserConfig.userAgent),
              },
            ]
          : []),
        {
          stage: "HTTP_REQUEST",
          run: () => performHttpRequestStage(sourceUrl, config.timeoutMs, standardBrowserConfig.userAgent),
        },
        {
          stage: "BROWSER_SESSION",
          run: () => performBrowserStage(sourceUrl, standardBrowserConfig, "BROWSER_SESSION", false, profileState.xpaths),
        },
        {
          stage: "STEALTH_BROWSER",
          run: () => performBrowserStage(sourceUrl, stealthBrowserConfig, "STEALTH_BROWSER", false, profileState.xpaths),
        },
      ];

      if (antiBlockBrowserConfig.proxy || antiBlockBrowserConfig.requestLimiter) {
        stagePlan.push({
          stage: "ANTI_BLOCK_PROXY",
          run: () => performBrowserStage(sourceUrl, antiBlockBrowserConfig, "ANTI_BLOCK_PROXY", false, profileState.xpaths),
        });
      }

      let lastAttempt: MonitoringAttemptOutcome | null = null;

      const plannedStages = stagePlan.slice(0, Math.max(1, profileState.retryPolicy.maxAttempts));
      for (let index = 0; index < plannedStages.length; index += 1) {
        const stageEntry = plannedStages[index]!;
        attemptedStages.push(stageEntry.stage);

        const fetchResult = await stageEntry.run();
        responseStatus = fetchResult.responseStatus;
        const extraction = parseSourceSnapshot({
          profile: profileState,
          html: fetchResult.html,
          responseStatus: fetchResult.responseStatus,
          headers: fetchResult.headers,
          finalUrl: fetchResult.finalUrl,
          apiResponseJson: fetchResult.apiResponseJson,
          renderedText: stageEntry.stage === "VISION_FALLBACK" ? fetchResult.renderedText : null,
          xpathResults: fetchResult.xpathResults,
          allowVisionRepair: false,
        });
        const parsedSnapshot = extraction.snapshot;
        lastAttempt = {
          stage: stageEntry.stage,
          fetchResult,
          parsedSnapshot,
        };

        // #region debug-point C:parsed-source-snapshot
        reportManualUpdateDebug("C", "product-monitoring.service.ts:checkProduct:parsed", "parsed source snapshot", {
          productId: product.id,
          stage: stageEntry.stage,
          responseStatus: fetchResult.responseStatus,
          responseTimeMs: fetchResult.responseTimeMs,
          parsedPrice: parsedSnapshot.price,
          variantCount: parsedSnapshot.variants.length,
          stockStatus: parsedSnapshot.stockStatus,
          blocked: parsedSnapshot.blocked,
          removed: parsedSnapshot.removed,
          failureReason: parsedSnapshot.failureReason,
          sizeSignalStrength: parsedSnapshot.sizeSignalStrength,
          monitoringStatus: parsedSnapshot.monitoringStatus,
          extractionStrategy: parsedSnapshot.extractionStrategy,
          profileHost: profileState.host,
          profileStatus: profileState.status,
        });
        // #endregion

        if (parsedSnapshot.removed || parsedSnapshot.stockStatus === StockStatus.OUT_OF_STOCK) {
          profileState = await this.markWebsiteProfileValidation(profileState, {
            status: "VALID",
            failureReason: null,
            activeStrategy:
              parsedSnapshot.extractionStrategy && parsedSnapshot.extractionStrategy !== "VISION"
                ? parsedSnapshot.extractionStrategy
                : profileState.activeStrategy,
            checkedAt,
          });
          const changedFields = await this.applyRemovedState(product.id, product.stockStatus, checkedAt);
          return this.writeAuditLog(product.id, {
            status: parsedSnapshot.removed ? "REMOVED" : "UPDATED",
            changedFields,
            responseTimeMs: fetchResult.responseTimeMs,
            responseStatus: fetchResult.responseStatus,
            checkedAt,
            nextScheduledCheck,
            errorMessage: parsedSnapshot.failureReason,
            rescheduleRequired: changedFields.includes("status"),
            monitoringStatus: parsedSnapshot.monitoringStatus,
            attemptedStages,
            successfulStage: stageEntry.stage,
            extractionStrategy: parsedSnapshot.extractionStrategy,
            websiteHost: profileState.host,
            profileStatus: profileState.status,
          });
        }

        const hasVerifiedData =
          parsedSnapshot.monitoringStatus === "VERIFIED" &&
          (parsedSnapshot.price !== null ||
            parsedSnapshot.variants.length > 0 ||
            parsedSnapshot.stockStatus !== StockStatus.UNKNOWN);

        if (hasVerifiedData) {
          if (extraction.repairedProfile) {
            profileState = {
              ...extraction.repairedProfile,
              lastValidatedAt: checkedAt.toISOString(),
              lastFailedAt: null,
            };
            await this.updateWebsiteProfile(profileState);
            await this.queueSiblingProductsForProfile(profileState.host, product.id);
          } else {
            profileState = await this.markWebsiteProfileValidation(profileState, {
              status: "VALID",
              failureReason: null,
              activeStrategy:
                parsedSnapshot.extractionStrategy && parsedSnapshot.extractionStrategy !== "VISION"
                  ? parsedSnapshot.extractionStrategy
                  : profileState.activeStrategy,
              matchedSelectors: parsedSnapshot.matchedSelectors,
              matchedXpaths: parsedSnapshot.matchedXpaths,
              checkedAt,
            });
          }
          const changedFields = await this.applyDetectedSnapshot(product.id, product, parsedSnapshot, checkedAt);
          // #region debug-point D:check-product-outcome
          reportManualUpdateDebug("D", "product-monitoring.service.ts:checkProduct:outcome", "checkProduct finished detection phase", {
            productId: product.id,
            stage: stageEntry.stage,
            changedFields,
            finalStatus: changedFields.length > 0 ? "UPDATED" : "NO_CHANGES",
            monitoringStatus: parsedSnapshot.monitoringStatus,
            extractionStrategy: parsedSnapshot.extractionStrategy,
            profileHost: profileState.host,
            profileStatus: profileState.status,
          });
          // #endregion
          return this.writeAuditLog(product.id, {
            status: changedFields.length > 0 ? "UPDATED" : "NO_CHANGES",
            changedFields,
            responseTimeMs: fetchResult.responseTimeMs,
            responseStatus: fetchResult.responseStatus,
            checkedAt,
            nextScheduledCheck,
            errorMessage: null,
            rescheduleRequired: false,
            monitoringStatus: parsedSnapshot.monitoringStatus,
            attemptedStages,
            successfulStage: stageEntry.stage,
            extractionStrategy: parsedSnapshot.extractionStrategy,
            websiteHost: profileState.host,
            profileStatus: profileState.status,
          });
        }

        const shouldContinue =
          index < plannedStages.length - 1 &&
          (parsedSnapshot.blocked ||
            profileState.retryPolicy.retryableStatuses.includes(
              parsedSnapshot.monitoringStatus === "VERIFIED" ? "UNVERIFIED" : parsedSnapshot.monitoringStatus,
            ) ||
            (parsedSnapshot.failureReason !== null &&
              parsedSnapshot.price === null &&
              parsedSnapshot.variants.length === 0 &&
              parsedSnapshot.stockStatus === StockStatus.UNKNOWN));

        if (shouldContinue) {
          await sleep(
            computeBackoffMs({
              attemptIndex: index,
              monitoringStatus:
                parsedSnapshot.monitoringStatus === "VERIFIED" ? "UNVERIFIED" : parsedSnapshot.monitoringStatus,
              retryPolicy: profileState.retryPolicy,
              requestLimiter: antiBlockBrowserConfig.requestLimiter,
            }),
          );
          continue;
        }
      }

      if (lastAttempt && !waitedForRepair) {
        const repairLock = await this.acquireWebsiteProfileRepairLock(profileState, product.id, checkedAt);
        if (!repairLock.acquired) {
          const waitedProfile = await this.waitForWebsiteProfileRepair(profileState.host, product.id, repairWaitMs);
          if (waitedProfile) {
            profileState = waitedProfile;
            waitedForRepair = true;
          }
          if (profileState.status === "VALID") {
            return this.checkProduct(product.id);
          }
        } else {
          profileState = repairLock.profile;

          const repairStage = await performBrowserStage(
            sourceUrl,
            antiBlockBrowserConfig.proxy || antiBlockBrowserConfig.requestLimiter ? antiBlockBrowserConfig : stealthBrowserConfig,
            "VISION_FALLBACK",
            true,
            profileState.xpaths,
          );
          attemptedStages.push("VISION_FALLBACK");
          responseStatus = repairStage.responseStatus;
          const repairExtraction = parseSourceSnapshot({
            profile: profileState,
            html: repairStage.html,
            responseStatus: repairStage.responseStatus,
            headers: repairStage.headers,
            finalUrl: repairStage.finalUrl,
            apiResponseJson: repairStage.apiResponseJson,
            renderedText: repairStage.renderedText,
            xpathResults: repairStage.xpathResults,
            allowVisionRepair: true,
          });
          const repairSnapshot = repairExtraction.snapshot;
          lastAttempt = {
            stage: "VISION_FALLBACK",
            fetchResult: repairStage,
            parsedSnapshot: repairSnapshot,
          };

          // #region debug-point C:parsed-source-snapshot
          reportManualUpdateDebug("C", "product-monitoring.service.ts:checkProduct:parsed", "parsed source snapshot", {
            productId: product.id,
            stage: "VISION_FALLBACK",
            responseStatus: repairStage.responseStatus,
            responseTimeMs: repairStage.responseTimeMs,
            parsedPrice: repairSnapshot.price,
            variantCount: repairSnapshot.variants.length,
            stockStatus: repairSnapshot.stockStatus,
            blocked: repairSnapshot.blocked,
            removed: repairSnapshot.removed,
            failureReason: repairSnapshot.failureReason,
            sizeSignalStrength: repairSnapshot.sizeSignalStrength,
            monitoringStatus: repairSnapshot.monitoringStatus,
            extractionStrategy: repairSnapshot.extractionStrategy,
            profileHost: profileState.host,
            profileStatus: profileState.status,
          });
          // #endregion

          if (repairSnapshot.removed || repairSnapshot.stockStatus === StockStatus.OUT_OF_STOCK) {
            profileState = await this.markWebsiteProfileValidation(profileState, {
              status: "VALID",
              failureReason: null,
              activeStrategy:
                repairSnapshot.extractionStrategy && repairSnapshot.extractionStrategy !== "VISION"
                  ? repairSnapshot.extractionStrategy
                  : profileState.activeStrategy,
              checkedAt,
              repaired: true,
            });
            const changedFields = await this.applyRemovedState(product.id, product.stockStatus, checkedAt);
            return this.writeAuditLog(product.id, {
              status: repairSnapshot.removed ? "REMOVED" : "UPDATED",
              changedFields,
              responseTimeMs: repairStage.responseTimeMs,
              responseStatus: repairStage.responseStatus,
              checkedAt,
              nextScheduledCheck,
              errorMessage: repairSnapshot.failureReason,
              rescheduleRequired: changedFields.includes("status"),
              monitoringStatus: repairSnapshot.monitoringStatus,
              attemptedStages,
              successfulStage: "VISION_FALLBACK",
              extractionStrategy: repairSnapshot.extractionStrategy,
              websiteHost: profileState.host,
              profileStatus: profileState.status,
            });
          }

          const repairHasVerifiedData =
            repairSnapshot.monitoringStatus === "VERIFIED" &&
            (repairSnapshot.price !== null ||
              repairSnapshot.variants.length > 0 ||
              repairSnapshot.stockStatus !== StockStatus.UNKNOWN);

          if (repairHasVerifiedData) {
            if (repairExtraction.repairedProfile) {
              profileState = await this.markWebsiteProfileValidation(
                {
                  ...profileState,
                  ...repairExtraction.repairedProfile,
                  repairLock: profileState.repairLock,
                },
                {
                  status: "VALID",
                  failureReason: null,
                  activeStrategy: repairExtraction.repairedProfile.activeStrategy,
                  checkedAt,
                  repaired: true,
                },
              );
              await this.queueSiblingProductsForProfile(profileState.host, product.id);
            } else {
              profileState = await this.markWebsiteProfileValidation(profileState, {
                status: "VALID",
                failureReason: null,
                activeStrategy:
                  repairSnapshot.extractionStrategy && repairSnapshot.extractionStrategy !== "VISION"
                    ? repairSnapshot.extractionStrategy
                    : profileState.activeStrategy,
                matchedSelectors: repairSnapshot.matchedSelectors,
                matchedXpaths: repairSnapshot.matchedXpaths,
                checkedAt,
                repaired: true,
              });
            }
            const changedFields = await this.applyDetectedSnapshot(product.id, product, repairSnapshot, checkedAt);
            return this.writeAuditLog(product.id, {
              status: changedFields.length > 0 ? "UPDATED" : "NO_CHANGES",
              changedFields,
              responseTimeMs: repairStage.responseTimeMs,
              responseStatus: repairStage.responseStatus,
              checkedAt,
              nextScheduledCheck,
              errorMessage: null,
              rescheduleRequired: false,
              monitoringStatus: repairSnapshot.monitoringStatus,
              attemptedStages,
              successfulStage: "VISION_FALLBACK",
              extractionStrategy: repairSnapshot.extractionStrategy,
              websiteHost: profileState.host,
              profileStatus: profileState.status,
            });
          }

          profileState = await this.markWebsiteProfileValidation(profileState, {
            status: "INVALID",
            failureReason: repairSnapshot.failureReason ?? "Website profile repair failed.",
            checkedAt,
          });
        }
      }

      if (lastAttempt) {
        profileState = await this.markWebsiteProfileValidation(profileState, {
          status: "INVALID",
          failureReason: lastAttempt.parsedSnapshot.failureReason ?? "Website profile extraction failed.",
          checkedAt,
        });
      }

      return this.writeAuditLog(product.id, {
        status: lastAttempt?.parsedSnapshot.blocked ? "BLOCKED" : "FAILED",
        changedFields: [],
        responseTimeMs: lastAttempt?.fetchResult.responseTimeMs ?? Date.now() - startedAt,
        responseStatus: lastAttempt?.fetchResult.responseStatus ?? responseStatus,
        checkedAt,
        nextScheduledCheck,
        errorMessage: lastAttempt?.parsedSnapshot.failureReason ?? "Source could not be verified.",
        rescheduleRequired: false,
        monitoringStatus:
          lastAttempt?.parsedSnapshot.monitoringStatus === "VERIFIED"
            ? "UNVERIFIED"
            : lastAttempt?.parsedSnapshot.monitoringStatus ?? "UNVERIFIED",
        attemptedStages,
        successfulStage: null,
        extractionStrategy: lastAttempt?.parsedSnapshot.extractionStrategy ?? null,
        websiteHost: profileState.host,
        profileStatus: profileState.status,
      });
    } catch (error) {
      // #region debug-point B:check-product-error
      reportManualUpdateDebug("B", "product-monitoring.service.ts:checkProduct:error", "checkProduct threw error", {
        productId: product.id,
        responseStatus,
        errorMessage: error instanceof Error ? error.message : "Product monitoring failed.",
      });
      // #endregion
      return this.writeAuditLog(product.id, {
        status: "FAILED",
        changedFields: [],
        responseTimeMs: Date.now() - startedAt,
        responseStatus,
        checkedAt,
        nextScheduledCheck,
        errorMessage: error instanceof Error ? error.message : "Product monitoring failed.",
        rescheduleRequired: false,
        monitoringStatus: "UNVERIFIED",
        attemptedStages,
        successfulStage: null,
        extractionStrategy: null,
        websiteHost: profileState.host,
        profileStatus: profileState.status,
      });
    }
  }

  private async applyRemovedState(productId: string, previousStockStatus: StockStatus, checkedAt: Date): Promise<string[]> {
    await prisma.$transaction(async (transaction) => {
      await transaction.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.DRAFT,
          stock: 0,
          stockStatus: StockStatus.OUT_OF_STOCK,
          lastSyncedAt: checkedAt,
          sizes: [],
          colors: [],
        },
      });

      await transaction.productVariant.updateMany({
        where: { productId },
        data: {
          stockQuantity: 0,
        },
      });
    });

    if (previousStockStatus !== StockStatus.OUT_OF_STOCK) {
      await prisma.stockChange.create({
        data: {
          productId,
          oldStatus: previousStockStatus,
          newStatus: StockStatus.OUT_OF_STOCK,
        },
      });

      await alertManager.createStockAlerts({
        sourceStore: "Product Monitoring",
        stockChanges: [
          {
            productId,
            oldStatus: previousStockStatus,
            newStatus: StockStatus.OUT_OF_STOCK,
          },
        ],
      });
    }

    return ["status", "availability", "sizes"];
  }

  private async applyDetectedSnapshot(
    productId: string,
    existing: {
      id: string;
      price: Prisma.Decimal;
      outletPrice: Prisma.Decimal | null;
      supplierPrice: Prisma.Decimal | null;
      stockStatus: StockStatus;
      status: ProductStatus;
      variants: Array<{ size: string | null; color: string | null; stockQuantity: number }>;
    },
    parsedSnapshot: ParsedSourceSnapshot,
    checkedAt: Date,
  ): Promise<string[]> {
    const changedFields = new Set<string>();
    const previousFinalPrice = existing.price;

    await prisma.$transaction(async (transaction) => {
      const productData: Prisma.ProductUpdateInput = {
        stockStatus: parsedSnapshot.stockStatus === StockStatus.UNKNOWN ? existing.stockStatus : parsedSnapshot.stockStatus,
        status: existing.status === ProductStatus.ARCHIVED ? ProductStatus.ARCHIVED : ProductStatus.ACTIVE,
        lastSyncedAt: checkedAt,
      };

      if (parsedSnapshot.price !== null) {
        const newSourcePrice = new Prisma.Decimal(parsedSnapshot.price);
        if (!decimalEquals(existing.outletPrice, newSourcePrice) || !decimalEquals(existing.supplierPrice, newSourcePrice)) {
          productData.outletPrice = newSourcePrice;
          productData.supplierPrice = newSourcePrice;
          changedFields.add("price");
        }
      }

      await transaction.product.update({
        where: { id: productId },
        data: productData,
      });

      const existingAvailableVariantKeys = new Set(
        existing.variants.filter((variant) => variant.stockQuantity > 0).map((variant) => normalizeVariantKey(variant)),
      );
      const detectedVariantKeys = new Set(parsedSnapshot.variants.map((variant) => normalizeVariantKey(variant)));
      const hasVariantDifference =
        detectedVariantKeys.size > 0 &&
        (detectedVariantKeys.size !== existingAvailableVariantKeys.size ||
          Array.from(detectedVariantKeys).some((key) => !existingAvailableVariantKeys.has(key)));

      const canFullySyncVariants =
        parsedSnapshot.variants.length > 0 &&
        (parsedSnapshot.sizeSignalStrength === "color-specific" ||
          existing.variants.every((variant) => !variant.color));

      if (canFullySyncVariants && hasVariantDifference) {
        await transaction.productVariant.deleteMany({
          where: { productId },
        });

        await transaction.productVariant.createMany({
          data: parsedSnapshot.variants.map((variant) => ({
            productId,
            size: variant.size,
            color: variant.color,
            stockQuantity: Math.max(1, variant.stockQuantity),
          })),
        });

        const sizes = compactStringArray(parsedSnapshot.variants.map((variant) => variant.size));
        const colors = compactStringArray(parsedSnapshot.variants.map((variant) => variant.color));
        const stock = parsedSnapshot.variants.reduce((sum, variant) => sum + Math.max(1, variant.stockQuantity), 0);

        await transaction.product.update({
          where: { id: productId },
          data: {
            sizes,
            colors,
            stock,
          },
        });

        changedFields.add("sizes");
        changedFields.add("availability");
      } else if (parsedSnapshot.sizeSignalStrength === "general" && parsedSnapshot.variants.length > 0) {
        const sizes = compactStringArray(parsedSnapshot.variants.map((variant) => variant.size));
        const currentSizes = compactStringArray(existing.variants.map((variant) => variant.size));
        if (sizes.join("|") !== currentSizes.join("|")) {
          await transaction.product.update({
            where: { id: productId },
            data: {
              sizes,
            },
          });
          changedFields.add("sizes");
        }
      }
    });

    if (changedFields.has("price")) {
      await pricingService.repriceProduct(productId);
    }

    const refreshed = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        price: true,
        stockStatus: true,
      },
    });

    if (!refreshed) {
      return Array.from(changedFields);
    }

    if (!previousFinalPrice.equals(refreshed.price)) {
      changedFields.add("finalPrice");
      const changePercent = previousFinalPrice.isZero()
        ? new Prisma.Decimal(0)
        : refreshed.price.minus(previousFinalPrice).div(previousFinalPrice).mul(100).toDecimalPlaces(2);

      await prisma.$transaction(async (transaction) => {
        await transaction.priceChange.create({
          data: {
            productId,
            oldPrice: previousFinalPrice,
            newPrice: refreshed.price,
            changePercent,
          },
        });

        await transaction.priceHistory.create({
          data: {
            productId,
            oldPrice: previousFinalPrice,
            newPrice: refreshed.price,
            discountPercent: null,
          },
        });
      });

      await alertManager.createPriceAlerts({
        sourceStore: "Product Monitoring",
        priceChanges: [
          {
            productId,
            oldPrice: previousFinalPrice.toFixed(2),
            newPrice: refreshed.price.toFixed(2),
            changePercent: changePercent.toFixed(2),
          },
        ],
      });
    }

    if (existing.stockStatus !== refreshed.stockStatus) {
      changedFields.add("availability");
      await prisma.stockChange.create({
        data: {
          productId,
          oldStatus: existing.stockStatus,
          newStatus: refreshed.stockStatus,
        },
      });

      await alertManager.createStockAlerts({
        sourceStore: "Product Monitoring",
        stockChanges: [
          {
            productId,
            oldStatus: existing.stockStatus,
            newStatus: refreshed.stockStatus,
          },
        ],
      });
    }

    // #region debug-point E:apply-detected-snapshot-result
    reportManualUpdateDebug("E", "product-monitoring.service.ts:applyDetectedSnapshot", "applyDetectedSnapshot completed", {
      productId,
      changedFields: Array.from(changedFields),
      previousFinalPrice: previousFinalPrice.toString(),
      refreshedFinalPrice: refreshed.price.toString(),
      previousStockStatus: existing.stockStatus,
      refreshedStockStatus: refreshed.stockStatus,
    });
    // #endregion

    return Array.from(changedFields);
  }

  private buildNextScheduledCheck(
    lastCheckedAt: Date | null,
    config: Pick<ResolvedProductMonitoringConfig, "enabled" | "intervalMinutes">,
  ): Date | null {
    if (!config.enabled) {
      return null;
    }

    const base = lastCheckedAt ?? new Date();
    return new Date(base.getTime() + config.intervalMinutes * 60 * 1000);
  }

  private async writeAuditLog(
    productId: string,
    outcome: Omit<ProductMonitoringOutcome, "productId">,
  ): Promise<ProductMonitoringOutcome> {
    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: `${PRODUCT_MONITORING_LOG_PREFIX}${outcome.status}`,
        entityType: "Product",
        entityId: productId,
        metadata: toInputJsonValue({
          changedFields: outcome.changedFields,
          monitoringStatus: outcome.monitoringStatus,
          attemptedStages: outcome.attemptedStages,
          successfulStage: outcome.successfulStage,
          extractionStrategy: outcome.extractionStrategy,
          websiteHost: outcome.websiteHost,
          profileStatus: outcome.profileStatus,
          errorMessage: outcome.errorMessage,
          responseTimeMs: outcome.responseTimeMs,
          responseStatus: outcome.responseStatus,
          lastCheckedAt: outcome.checkedAt.toISOString(),
          nextScheduledCheck: outcome.nextScheduledCheck?.toISOString() ?? null,
        }),
      },
    });

    return {
      productId,
      ...outcome,
    };
  }
}

export const productMonitoringService = new ProductMonitoringService();
