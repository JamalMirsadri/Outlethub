export interface BrowserLaunchProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface RequestLimiterConfig {
  maxRequestsPerMinute?: number;
  maxConcurrentPages?: number;
}

export interface BrowserAdapterConfig {
  headless?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
  userAgent?: string;
  stealth?: boolean;
  proxy?: BrowserLaunchProxyConfig | null;
  requestLimiter?: RequestLimiterConfig | null;
}

export interface BrowserCapturedNetworkEntry {
  url: string;
  method: string;
  resourceType: string;
  status: number | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  postData: string | null;
  responseBody: string | null;
}

export interface BrowserPageHandle {
  goto?(url: string): Promise<{ status: number | null; url: string; headers?: Record<string, string> }>;
  setContent?(content: string): Promise<void>;
  content?(): Promise<string>;
  text?(): Promise<string>;
  queryXPath?(expression: string): Promise<string[]>;
  networkEntries?(): Promise<BrowserCapturedNetworkEntry[]>;
  screenshot?(): Promise<Buffer>;
  close(): Promise<void>;
}

export interface BrowserSessionHandle {
  newPage(): Promise<BrowserPageHandle>;
  close(): Promise<void>;
}

export interface BrowserAdapter {
  readonly key: string;
  readonly supportsProxy: boolean;
  initialize(config: BrowserAdapterConfig): Promise<void>;
  createSession(): Promise<BrowserSessionHandle>;
  shutdown(): Promise<void>;
}
