import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

import type {
  BrowserAdapter,
  BrowserAdapterConfig,
  BrowserCapturedNetworkEntry,
  BrowserPageHandle,
  BrowserSessionHandle,
} from "../contracts/browser-adapter.js";

class PlaywrightPageHandle implements BrowserPageHandle {
  private readonly capturedNetworkEntries = new Map<string, BrowserCapturedNetworkEntry>();

  public constructor(private readonly page: Page) {}

  public async attachNetworkCapture(): Promise<void> {
    this.page.on("response", async (response) => {
      const request = response.request();
      const resourceType = request.resourceType();
      const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
      const isGraphQl = /graphql/i.test(request.url()) || /graphql/i.test(request.postData() ?? "");
      const shouldCapture =
        resourceType === "xhr" ||
        resourceType === "fetch" ||
        isGraphQl ||
        contentType.includes("application/json");

      if (!shouldCapture) {
        return;
      }

      const key = `${request.method()}::${request.url()}::${request.postData() ?? ""}`;
      const nextEntry: BrowserCapturedNetworkEntry = {
        url: request.url(),
        method: request.method(),
        resourceType: isGraphQl ? "graphql" : resourceType,
        status: response.status(),
        requestHeaders: await request.allHeaders().catch(() => ({})),
        responseHeaders: await response.allHeaders().catch(() => ({})),
        postData: request.postData() ?? null,
        responseBody: null,
      };

      try {
        const bodyText = await response.text();
        nextEntry.responseBody = bodyText.length <= 200_000 ? bodyText : bodyText.slice(0, 200_000);
      } catch {
        nextEntry.responseBody = null;
      }

      this.capturedNetworkEntries.set(key, nextEntry);
    });
  }

  public async goto(url: string): Promise<{ status: number | null; url: string; headers?: Record<string, string> }> {
    const response = await this.page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    await this.page.waitForLoadState("networkidle").catch(() => undefined);

    return {
      status: response?.status() ?? null,
      url: this.page.url(),
      headers: response ? await response.allHeaders() : undefined,
    };
  }

  public async setContent(content: string): Promise<void> {
    await this.page.setContent(content);
  }

  public async content(): Promise<string> {
    return this.page.content();
  }

  public async text(): Promise<string> {
    return this.page.locator("body").innerText().catch(() => "");
  }

  public async queryXPath(expression: string): Promise<string[]> {
    return this.page
      .locator(`xpath=${expression}`)
      .evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const record = node as {
              textContent?: string | null;
              innerText?: string;
              getAttribute?: (name: string) => string | null;
            };
            return (
              record.innerText?.trim() ||
              record.textContent?.trim() ||
              record.getAttribute?.("content")?.trim() ||
              record.getAttribute?.("value")?.trim() ||
              ""
            );
          })
          .filter((value): value is string => Boolean(value)),
      )
      .catch(() => []);
  }

  public async networkEntries(): Promise<BrowserCapturedNetworkEntry[]> {
    return Array.from(this.capturedNetworkEntries.values());
  }

  public async screenshot(): Promise<Buffer> {
    return this.page.screenshot({
      fullPage: true,
      type: "png",
    });
  }

  public async close(): Promise<void> {
    await this.page.close();
  }
}

class PlaywrightSessionHandle implements BrowserSessionHandle {
  public constructor(private readonly context: BrowserContext) {}

  public async newPage(): Promise<BrowserPageHandle> {
    const page = await this.context.newPage();
    const handle = new PlaywrightPageHandle(page);
    await handle.attachNetworkCapture();
    return handle;
  }

  public async close(): Promise<void> {
    await this.context.close();
  }
}

export class PlaywrightAdapter implements BrowserAdapter {
  public readonly key = "playwright";
  public readonly supportsProxy = true;
  private browser: Browser | null = null;
  private config: BrowserAdapterConfig = {};
  private launchKey: string | null = null;

  private buildLaunchKey(config: BrowserAdapterConfig): string {
    return JSON.stringify({
      headless: config.headless ?? true,
      proxy: config.proxy ?? null,
      stealth: config.stealth ?? false,
    });
  }

  public async initialize(config: BrowserAdapterConfig): Promise<void> {
    this.config = config;
    const nextLaunchKey = this.buildLaunchKey(config);

    if (this.browser && this.launchKey !== nextLaunchKey) {
      await this.browser.close();
      this.browser = null;
      this.launchKey = null;
    }

    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: config.headless ?? true,
        proxy: config.proxy
          ? {
              server: config.proxy.server,
              username: config.proxy.username,
              password: config.proxy.password,
            }
          : undefined,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      });
      this.launchKey = nextLaunchKey;
    }
  }

  public async createSession(): Promise<BrowserSessionHandle> {
    if (!this.browser) {
      await this.initialize(this.config);
    }

    if (!this.browser) {
      throw new Error("Playwright browser failed to initialize.");
    }

    const context = await this.browser.newContext({
      userAgent: this.config.userAgent,
      locale: "pt-PT",
      timezoneId: "Europe/Lisbon",
      viewport: {
        width: 1440,
        height: 900,
      },
      extraHTTPHeaders: {
        "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (this.config.stealth) {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
        Object.defineProperty(navigator, "languages", {
          get: () => ["pt-PT", "pt", "en-US", "en"],
        });
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, "platform", {
          get: () => "Win32",
        });
      });
    }

    context.setDefaultTimeout(this.config.timeoutMs ?? 30000);
    context.setDefaultNavigationTimeout(this.config.timeoutMs ?? 30000);
    return new PlaywrightSessionHandle(context);
  }

  public async shutdown(): Promise<void> {
    if (!this.browser) {
      return;
    }

    await this.browser.close();
    this.browser = null;
    this.launchKey = null;
  }
}

export const playwrightAdapter = new PlaywrightAdapter();
