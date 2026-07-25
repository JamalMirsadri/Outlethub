import { ApiError } from "../../utils/api-error.js";
import type { ScraperConnector, ScraperConnectorContext, ScraperResult } from "./contracts/scraper-connector.js";
import { demoConnector } from "./connectors/demo/demo.connector.js";
import { dynamicTemplateConnector } from "./connectors/dynamic/dynamic-template.connector.js";
import { nikeOutletConnector } from "./connectors/nike/nike-outlet.connector.js";

export class ScraperRegistry {
  private readonly connectors = new Map<string, ScraperConnector>();

  public constructor(connectors: ScraperConnector[] = []) {
    connectors.forEach((connector) => this.registerConnector(connector));
  }

  public registerConnector(connector: ScraperConnector): void {
    this.connectors.set(connector.key, connector);
  }

  public getConnector(key: string): ScraperConnector {
    const connector = this.connectors.get(key);
    if (!connector) {
      throw new ApiError(404, `Scraper connector "${key}" is not registered.`);
    }

    return connector;
  }

  public async executeConnector(key: string, context: ScraperConnectorContext): Promise<ScraperResult> {
    const connector = this.getConnector(key);

    await connector.initialize(context);

    try {
      const rawProducts = await connector.run(context);
      const normalizedProducts = await connector.normalize(rawProducts, context);
      const observability = connector.getObservability ? await connector.getObservability(context) : null;

      return {
        rawProducts,
        normalizedProducts,
        productsFound: rawProducts.length,
        observability,
      };
    } finally {
      await connector.shutdown(context);
    }
  }
}

export const scraperRegistry = new ScraperRegistry([demoConnector, dynamicTemplateConnector, nikeOutletConnector]);
