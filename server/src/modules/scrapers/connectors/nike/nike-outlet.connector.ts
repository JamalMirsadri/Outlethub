import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { ScraperType, StockStatus } from "@prisma/client";
import { load } from "cheerio";

import { createEmptyConnectorObservability, type ConnectorObservability } from "../../../imports/import-observability.js";
import type { NormalizedImportProduct } from "../../../imports/import-normalizer.js";
import type {
  RawScraperProduct,
  ScraperConnector,
  ScraperConnectorContext,
} from "../../contracts/scraper-connector.js";

const DEFAULT_NIKE_OUTLET_URL = "https://www.nike.com/w/sale-3yaep";
const DEFAULT_BRAND = "Nike";
const DEFAULT_CATEGORY = "Sale";
const DEFAULT_CURRENCY = "USD";
const DEFAULT_MAX_PRODUCTS = 48;
const DEBUG_ENV_PATH = ".dbg/nike-import-empty-catalog.env";
const DEBUG_SERVER_FALLBACK_URL = "http://127.0.0.1:7777/event";
const DEBUG_SESSION_FALLBACK_ID = "nike-import-empty-catalog";

export interface RawNikeOutletProduct extends RawScraperProduct {
  title: string;
  brandName: string;
  categoryName: string;
  salePrice: number;
  listPrice: number;
  discountPercent: number;
  image: { url: string | null };
  url: string;
  externalId: string;
  description: string | null;
}

function parseMoney(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  // Handle cases where multiple prices are in the same string (e.g., "34,99 €49,99 €30% de desconto")
  // We want to extract the first valid price we find
  const match = value.match(/(\d+)[.,](\d{2})/);
  if (match) {
    return Number(`${match[1]}.${match[2]}`);
  }

  const normalized = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
}

function computeDiscountPercent(price: number, oldPrice: number): number {
  if (oldPrice <= 0 || oldPrice <= price) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((1 - price / oldPrice) * 100)));
}

function normalizeCategoryLabel(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_CATEGORY;
  }

  const normalized = value
    .replace(/^(men|women|boys|girls|kids|big kids|little kids|older kids|younger kids|baby|babies|toddlers)[’']?s?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || DEFAULT_CATEGORY;
}

function buildSourceProductId(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? createHash("sha1").update(url).digest("hex");
  } catch {
    return createHash("sha1").update(url).digest("hex");
  }
}

function buildContentHash(input: Omit<NormalizedImportProduct, "contentHash">): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function toAbsoluteNikeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `https://www.nike.com${value}`;
  }

  return null;
}

function getListingUrl(context: ScraperConnectorContext): string {
  return context.source.website ?? DEFAULT_NIKE_OUTLET_URL;
}

function shouldReportNikeContext(context: ScraperConnectorContext) {
  const sourceName = context.source.name.toLowerCase();
  const website = (context.source.website ?? "").toLowerCase();
  const connectorKey = context.source.connectorKey.toLowerCase();
  return sourceName.includes("nike") || website.includes("nike") || connectorKey.includes("nike");
}

function reportNikeDebugEvent(
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

export function extractNikeOutletProductsFromHtml(html: string): RawNikeOutletProduct[] {
  const $ = load(html);
  const seen = new Set<string>();
  const products: RawNikeOutletProduct[] = [];

  $("[data-testid='product-card']").each((_, element) => {
    if (products.length >= DEFAULT_MAX_PRODUCTS) {
      return false;
    }

    const card = $(element);
    const url =
      toAbsoluteNikeUrl(card.find("a.product-card__link-overlay").attr("href")) ??
      toAbsoluteNikeUrl(card.find("a[data-testid='product-card__link-overlay']").attr("href"));
    const title = card.find(".product-card__title").first().text().trim();
    const subtitle = card.find(".product-card__subtitle").first().text().trim();
    const imageUrl =
      card.find("img.product-card__hero-image").attr("src") ??
      card.find("img").first().attr("src") ??
      null;
    const currentPriceText =
      card.find("[data-testid='product-price-reduced']").first().text().trim() ||
      card.find(".product-price.is--current-price").first().text().trim() ||
      null;
    const oldPriceText =
      card.find("[data-testid='product-price']").last().text().trim() ||
      card.find(".product-price.is--striked-out").first().text().trim() ||
      null;
    const salePrice = parseMoney(currentPriceText);
    const listPrice = parseMoney(oldPriceText);

    if (!url || !title || salePrice === null || listPrice === null || listPrice <= salePrice) {
      return;
    }

    const sourceProductId = buildSourceProductId(url);
    if (seen.has(sourceProductId)) {
      return;
    }

    seen.add(sourceProductId);

    products.push({
      title,
      brandName: DEFAULT_BRAND,
      categoryName: normalizeCategoryLabel(subtitle),
      salePrice,
      listPrice,
      discountPercent: computeDiscountPercent(salePrice, listPrice),
      image: {
        url: imageUrl,
      },
      url,
      externalId: sourceProductId,
      description: [title, subtitle].filter(Boolean).join(" - ") || null,
    });
  });

  return products;
}

export class NikeOutletConnector implements ScraperConnector {
  public readonly key = "nike-outlet";
  public readonly scraperType = ScraperType.PLAYWRIGHT;
  private initialized = false;
  private readonly observabilityCache = new Map<string, ConnectorObservability>();

  public async initialize(_context: ScraperConnectorContext): Promise<void> {
    this.initialized = true;
  }

  public async run(context: ScraperConnectorContext): Promise<RawNikeOutletProduct[]> {
    return this.extractProducts(context);
  }

  public async extractProducts(context: ScraperConnectorContext): Promise<RawNikeOutletProduct[]> {
    if (!this.initialized) {
      throw new Error("NikeOutletConnector was not initialized.");
    }

    const response = await fetch(getListingUrl(context), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`Nike Outlet request failed with status ${response.status}.`);
    }

    const html = await response.text();
    const products = extractNikeOutletProductsFromHtml(html);
    // #region debug-point C:nike-raw-products
    if (shouldReportNikeContext(context)) {
      reportNikeDebugEvent("C", "nike-outlet.connector:extractProducts", "[DEBUG] Nike connector extracted raw products.", {
        runId: context.runId,
        sourceId: context.source.id,
        sourceName: context.source.name,
        listingUrl: getListingUrl(context),
        responseStatus: response.status,
        htmlLength: html.length,
        extractedCount: products.length,
        sampleRawProducts: products.slice(0, 5).map((product) => ({
          title: product.title,
          brandName: product.brandName,
          categoryName: product.categoryName,
          salePrice: product.salePrice,
          listPrice: product.listPrice,
          discountPercent: product.discountPercent,
          imageUrl: product.image.url,
          url: product.url,
          externalId: product.externalId,
        })),
      });
    }
    // #endregion
    if (products.length === 0) {
      throw new Error("Nike Outlet Connector found no discounted products.");
    }

    this.observabilityCache.set(context.runId, {
      ...createEmptyConnectorObservability(),
      strategyUsed: "PLAYWRIGHT",
      httpStatus: response.status,
      discoveredCount: products.length,
      fetchedCount: products.length,
      normalizedCount: products.length,
      validatedCount: products.length,
      urlsDiscovered: products.length,
      urlsProcessed: products.length,
      rawRecordCount: products.length,
      discovery: {
        sitemapUrlsFound: 0,
        productUrlsFound: products.length,
        duplicateUrlsRemoved: 0,
        urlsSkipped: 0,
        urlsProcessed: products.length,
        firstDiscoveredUrls: products.map((product) => product.url).slice(0, 5),
      },
      normalization: {
        rawRecords: products.length,
        normalizedRecords: products.length,
        validatedRecords: products.length,
        validationFailures: 0,
        failureReasons: {},
      },
    });

    return products;
  }

  public async normalize(
    products: RawScraperProduct[],
    context: ScraperConnectorContext,
  ): Promise<NormalizedImportProduct[]> {
    const normalizedProducts = products.map((product, index) => {
      const name = String(product.title ?? `Nike Outlet Product ${index + 1}`);
      const brand = String(product.brandName ?? DEFAULT_BRAND);
      const category = String(product.categoryName ?? DEFAULT_CATEGORY);
      const price = Number(product.salePrice ?? 0);
      const oldPrice = Number(product.listPrice ?? price);
      const discountPercent =
        typeof product.discountPercent === "number" && Number.isFinite(product.discountPercent)
          ? product.discountPercent
          : computeDiscountPercent(price, oldPrice);
      const imageUrl =
        typeof product.image === "object" && product.image && "url" in product.image
          ? String((product.image as { url: string | null }).url ?? "")
          : null;
      const sourceUrl = typeof product.url === "string" ? product.url : getListingUrl(context);
      const sourceProductId =
        typeof product.externalId === "string" ? product.externalId : buildSourceProductId(sourceUrl);
      const description = typeof product.description === "string" ? product.description : null;

      const normalizedRecord = {
        name,
        brand,
        category,
        price,
        oldPrice,
        discountPercent,
        imageUrl: imageUrl || null,
        sourceStore: context.source.name,
        sourceUrl,
        sourceProductId,
        description,
        currency: DEFAULT_CURRENCY,
        stockStatus: StockStatus.IN_STOCK,
      };

      return {
        ...normalizedRecord,
        contentHash: buildContentHash(normalizedRecord),
      };
    });

    // #region debug-point A:nike-normalized-products
    if (shouldReportNikeContext(context)) {
      reportNikeDebugEvent("A", "nike-outlet.connector:normalize", "[DEBUG] Nike connector normalized raw products into DTOs.", {
        runId: context.runId,
        sourceId: context.source.id,
        inputCount: products.length,
        outputCount: normalizedProducts.length,
        sampleNormalizedProducts: normalizedProducts.slice(0, 5).map((product) => ({
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price,
          oldPrice: product.oldPrice,
          discountPercent: product.discountPercent,
          imageUrl: product.imageUrl,
          sourceStore: product.sourceStore,
          sourceUrl: product.sourceUrl,
          sourceProductId: product.sourceProductId,
          currency: product.currency,
          stockStatus: product.stockStatus,
          contentHash: product.contentHash,
        })),
      });
    }
    // #endregion

    return normalizedProducts;
  }

  public async shutdown(_context: ScraperConnectorContext): Promise<void> {
    this.initialized = false;
  }

  public async getObservability(context: ScraperConnectorContext): Promise<ConnectorObservability | null> {
    return this.observabilityCache.get(context.runId) ?? null;
  }
}

export const nikeOutletConnector = new NikeOutletConnector();
