import { ScraperType } from "@prisma/client";

import type {
  BrowserAdapter,
  BrowserAdapterConfig,
  BrowserSessionHandle,
  RequestLimiterConfig,
} from "../contracts/browser-adapter.js";
import { playwrightAdapter } from "./playwright-adapter.js";
import { puppeteerAdapter } from "./puppeteer-adapter.js";

export interface BrowserManagerConfig extends BrowserAdapterConfig {
  scraperType: ScraperType;
  requestLimiter?: RequestLimiterConfig | null;
}

function buildUserAgentPool(config: BrowserManagerConfig): string[] {
  return config.userAgent
    ? [config.userAgent]
    : [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      ];
}

export class BrowserManager {
  private readonly adapters = new Map<ScraperType, BrowserAdapter>([
    [ScraperType.PLAYWRIGHT, playwrightAdapter],
    [ScraperType.PUPPETEER, puppeteerAdapter],
  ]);

  public resolveAdapter(scraperType: ScraperType): BrowserAdapter {
    const adapter = this.adapters.get(scraperType);
    if (!adapter) {
      throw new Error(`No BrowserAdapter registered for ${scraperType}.`);
    }

    return adapter;
  }

  public async createSession(config: BrowserManagerConfig): Promise<BrowserSessionHandle> {
    const adapter = this.resolveAdapter(config.scraperType);
    const userAgentPool = buildUserAgentPool(config);
    const selectedUserAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];

    await adapter.initialize({
      ...config,
      userAgent: selectedUserAgent,
    });

    return adapter.createSession();
  }

  public getArchitectureHooks(config: BrowserManagerConfig) {
    return {
      retryAttempts: config.retryAttempts ?? 2,
      timeoutMs: config.timeoutMs ?? 30000,
      requestLimiter: config.requestLimiter ?? null,
      randomDelayRangeMs: {
        min: 150,
        max: 750,
      },
      proxyReady: Boolean(config.proxy),
    };
  }

  public async shutdown(scraperType: ScraperType): Promise<void> {
    const adapter = this.resolveAdapter(scraperType);
    await adapter.shutdown();
  }
}

export const browserManager = new BrowserManager();
