import { readFileSync } from "node:fs";

import { ScraperType } from "@prisma/client";

import type { ConnectorObservability } from "../../../imports/import-observability.js";
import { connectorBuilderRuntime } from "../../../connectors/connector-builder.runtime.js";
import type { NormalizedImportProduct } from "../../../imports/import-normalizer.js";
import type {
  RawScraperProduct,
  ScraperConnector,
  ScraperConnectorContext,
} from "../../contracts/scraper-connector.js";

const DEBUG_ENV_PATH = ".dbg/sprinter-import-zero.env";
const DEBUG_SERVER_FALLBACK_URL = "http://127.0.0.1:7777/event";
const DEBUG_SESSION_FALLBACK_ID = "sprinter-import-zero";

function shouldReportSprinterSource(context: ScraperConnectorContext) {
  const sourceName = context.source.name.toLowerCase();
  const website = (context.source.website ?? "").toLowerCase();
  return sourceName.includes("sprinter") || sourceName.includes("sport zone") || website.includes("sprinter");
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

export class DynamicTemplateConnector implements ScraperConnector {
  public readonly key = "dynamic-template";
  public readonly scraperType = ScraperType.PLAYWRIGHT;
  private readonly runCache = new Map<
    string,
    { rawProducts: RawScraperProduct[]; normalizedProducts: NormalizedImportProduct[]; observability: ConnectorObservability }
  >();

  public async initialize(_context: ScraperConnectorContext): Promise<void> {
    return;
  }

  public async run(context: ScraperConnectorContext): Promise<RawScraperProduct[]> {
    const preview = await connectorBuilderRuntime.previewByScraperSourceId(context.source.id);
    this.runCache.set(context.runId, {
      rawProducts: preview.rawRecords,
      normalizedProducts: preview.normalizedProducts,
      observability: preview.observability,
    });
    // #region debug-point C:dynamic-connector-handoff
    if (shouldReportSprinterSource(context)) {
      reportSprinterDebugEvent("C", "dynamic-template.connector:run", "[DEBUG] Dynamic connector cached preview payload for scraper run.", {
        runId: context.runId,
        sourceId: context.source.id,
        sourceName: context.source.name,
        rawRecordCount: preview.rawRecords.length,
        normalizedCount: preview.normalizedProducts.length,
        sampleRaw: preview.rawRecords.slice(0, 5),
        sampleNormalized: preview.normalizedProducts.slice(0, 5).map((product) => ({
          name: product.name,
          sourceUrl: product.sourceUrl,
          price: product.price,
          oldPrice: product.oldPrice,
          imageUrl: product.imageUrl,
          brand: product.brand,
          category: product.category,
        })),
      });
    }
    // #endregion
    return preview.rawRecords;
  }

  public async extractProducts(context: ScraperConnectorContext): Promise<RawScraperProduct[]> {
    return this.run(context);
  }

  public async normalize(
    _products: RawScraperProduct[],
    context: ScraperConnectorContext,
  ): Promise<NormalizedImportProduct[]> {
    const cached = this.runCache.get(context.runId);
    if (cached) {
      return cached.normalizedProducts;
    }

    const preview = await connectorBuilderRuntime.previewByScraperSourceId(context.source.id);
    return preview.normalizedProducts;
  }

  public async getObservability(context: ScraperConnectorContext): Promise<ConnectorObservability | null> {
    const cached = this.runCache.get(context.runId);
    if (cached) {
      return cached.observability;
    }

    const preview = await connectorBuilderRuntime.previewByScraperSourceId(context.source.id);
    return preview.observability;
  }

  public async shutdown(context: ScraperConnectorContext): Promise<void> {
    this.runCache.delete(context.runId);
  }
}

export const dynamicTemplateConnector = new DynamicTemplateConnector();
