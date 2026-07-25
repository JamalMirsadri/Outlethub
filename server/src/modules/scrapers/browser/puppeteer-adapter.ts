import type {
  BrowserAdapter,
  BrowserAdapterConfig,
  BrowserSessionHandle,
} from "../contracts/browser-adapter.js";

export class PuppeteerAdapter implements BrowserAdapter {
  public readonly key = "puppeteer";
  public readonly supportsProxy = true;

  public async initialize(_config: BrowserAdapterConfig): Promise<void> {
    throw new Error("PuppeteerAdapter is not implemented yet.");
  }

  public async createSession(): Promise<BrowserSessionHandle> {
    throw new Error("PuppeteerAdapter is not implemented yet.");
  }

  public async shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export const puppeteerAdapter = new PuppeteerAdapter();
