import { ScraperType } from "@prisma/client";

import { createEmptyConnectorObservability, type ConnectorObservability } from "../../../imports/import-observability.js";
import type { NormalizedImportProduct } from "../../../imports/import-normalizer.js";
import type {
  RawScraperProduct,
  ScraperConnector,
  ScraperConnectorContext,
} from "../../contracts/scraper-connector.js";

function buildHashSeed(sourceName: string, name: string): string {
  return `${sourceName}:${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export class DemoConnector implements ScraperConnector {
  public readonly key = "demo";
  public readonly scraperType = ScraperType.PLAYWRIGHT;
  private initialized = false;
  private readonly observabilityCache = new Map<string, ConnectorObservability>();

  public async initialize(_context: ScraperConnectorContext): Promise<void> {
    this.initialized = true;
  }

  public async run(context: ScraperConnectorContext): Promise<RawScraperProduct[]> {
    return this.extractProducts(context);
  }

  public async extractProducts(context: ScraperConnectorContext): Promise<RawScraperProduct[]> {
    if (!this.initialized) {
      throw new Error("DemoConnector was not initialized.");
    }

    const sourceName = context.source.name;

    const rawProducts = [
      {
        title: `${sourceName} Demo Jacket`,
        brandName: "Demo Brand",
        categoryName: "Demo Apparel",
        salePrice: 89,
        listPrice: 180,
        image: { url: "https://example.com/demo-jacket.jpg" },
        url: "https://example.com/demo-jacket",
        externalId: buildHashSeed(sourceName, "demo-jacket"),
        description: "Generated product from DemoConnector.",
      },
      {
        title: `${sourceName} Demo Sneaker`,
        brandName: "Demo Brand",
        categoryName: "Demo Footwear",
        salePrice: 120,
        listPrice: 240,
        image: { url: "https://example.com/demo-sneaker.jpg" },
        url: "https://example.com/demo-sneaker",
        externalId: buildHashSeed(sourceName, "demo-sneaker"),
        description: "Generated product from DemoConnector.",
      },
    ];

    this.observabilityCache.set(context.runId, {
      ...createEmptyConnectorObservability(),
      strategyUsed: "PLAYWRIGHT",
      httpStatus: 200,
      discoveredCount: rawProducts.length,
      fetchedCount: rawProducts.length,
      normalizedCount: rawProducts.length,
      validatedCount: rawProducts.length,
      urlsDiscovered: rawProducts.length,
      urlsProcessed: rawProducts.length,
      rawRecordCount: rawProducts.length,
      discovery: {
        sitemapUrlsFound: 0,
        productUrlsFound: rawProducts.length,
        duplicateUrlsRemoved: 0,
        urlsSkipped: 0,
        urlsProcessed: rawProducts.length,
        firstDiscoveredUrls: rawProducts
          .map((product) => (typeof product.url === "string" ? product.url : null))
          .filter((value): value is string => Boolean(value))
          .slice(0, 5),
      },
      normalization: {
        rawRecords: rawProducts.length,
        normalizedRecords: rawProducts.length,
        validatedRecords: rawProducts.length,
        validationFailures: 0,
        failureReasons: {},
      },
    });

    return rawProducts;
  }

  public async normalize(
    products: RawScraperProduct[],
    context: ScraperConnectorContext,
  ): Promise<NormalizedImportProduct[]> {
    return products.map((product, index) => {
      const name = String(product.title ?? `Demo Product ${index + 1}`);
      const brand = String(product.brandName ?? "Demo Brand");
      const category = String(product.categoryName ?? "Demo Category");
      const price = Number(product.salePrice ?? 0);
      const oldPrice = Number(product.listPrice ?? price);
      const discountPercent = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
      const imageUrl =
        typeof product.image === "object" && product.image && "url" in product.image
          ? String((product.image as { url: string }).url)
          : null;
      const sourceUrl = typeof product.url === "string" ? product.url : context.source.website ?? null;
      const sourceProductId = typeof product.externalId === "string" ? product.externalId : null;
      const description = typeof product.description === "string" ? product.description : null;
      const contentHash = buildHashSeed(context.source.name, `${name}-${price}-${oldPrice}-${sourceProductId ?? index}`);

      return {
        name,
        brand,
        category,
        price,
        oldPrice,
        discountPercent,
        imageUrl,
        sourceStore: context.source.name,
        sourceUrl,
        sourceProductId,
        description,
        currency: "USD",
        contentHash,
      };
    });
  }

  public async shutdown(_context: ScraperConnectorContext): Promise<void> {
    this.initialized = false;
  }

  public async getObservability(context: ScraperConnectorContext): Promise<ConnectorObservability | null> {
    return this.observabilityCache.get(context.runId) ?? null;
  }
}

export const demoConnector = new DemoConnector();
