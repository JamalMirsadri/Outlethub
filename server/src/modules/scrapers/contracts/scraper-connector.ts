import type { ScraperSource, ScraperType } from "@prisma/client";

import type { ConnectorObservability } from "../../imports/import-observability.js";
import type { BrowserManager } from "../browser/browser-manager.js";
import type { NormalizedImportProduct } from "../../imports/import-normalizer.js";

export interface RawScraperProduct {
  [key: string]: unknown;
}

export interface ScraperConnectorContext {
  source: ScraperSource;
  browserManager: BrowserManager;
  runId: string;
}

export interface ScraperResult {
  rawProducts: RawScraperProduct[];
  normalizedProducts: NormalizedImportProduct[];
  productsFound: number;
  observability: ConnectorObservability | null;
}

export interface ScraperConnector {
  readonly key: string;
  readonly scraperType: ScraperType;
  initialize(context: ScraperConnectorContext): Promise<void>;
  run(context: ScraperConnectorContext): Promise<RawScraperProduct[]>;
  extractProducts(context: ScraperConnectorContext): Promise<RawScraperProduct[]>;
  normalize(products: RawScraperProduct[], context: ScraperConnectorContext): Promise<NormalizedImportProduct[]>;
  getObservability?(context: ScraperConnectorContext): Promise<ConnectorObservability | null>;
  shutdown(context: ScraperConnectorContext): Promise<void>;
}
