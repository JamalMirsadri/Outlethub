type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type ErrorType = "FRONTEND" | "API" | "BACKEND";

interface ClientErrorPayload {
  type: ErrorType;
  severity?: Severity;
  message: string;
  stack?: string | null;
  source?: string | null;
  page?: string | null;
  endpoint?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  requestId?: string | null;
}

const REPORT_PATH = "/system-logs/report";
const SESSION_ID_KEY = "outlethub_correlation_id";
const ACCESS_TOKEN_KEY = "outlethub_access_token";

const SENSITIVE_PATTERNS: RegExp[] = [
  /(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;"']+/gi,
  /(x-api-key\s*[:=]\s*)[^\s,;"']+/gi,
  /(password\s*[:=]\s*)[^\s,;"']+/gi,
  /(token\s*[:=]\s*)[^\s,;"']+/gi,
  /(cookie\s*[:=]\s*)[^\s,;"']+/gi,
  /(secret\s*[:=]\s*)[^\s,;"']+/gi,
];

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");
}

function sanitize(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let sanitized = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "$1[REDACTED]");
  }

  return sanitized;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}

function getTokenUser(): { userId: string | null; userEmail: string | null; userRole: string | null } {
  try {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      return { userId: null, userEmail: null, userRole: null };
    }

    const segments = token.split(".");
    if (segments.length < 2) {
      return { userId: null, userEmail: null, userRole: null };
    }

    const encodedPayload = segments[1];
    if (!encodedPayload) {
      return { userId: null, userEmail: null, userRole: null };
    }

    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as {
      sub?: string;
      email?: string;
      role?: string;
    };

    return {
      userId: payload.sub ?? null,
      userEmail: payload.email ?? null,
      userRole: payload.role ?? null,
    };
  } catch {
    return { userId: null, userEmail: null, userRole: null };
  }
}

function getCorrelationId(): string {
  try {
    let id = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_ID_KEY, id);
    }

    return id;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function parseEnvironment(): { browser: string | null; os: string | null; device: string | null } {
  const ua = window.navigator.userAgent;

  let device = "desktop";
  if (/Tablet|iPad/i.test(ua)) {
    device = "tablet";
  } else if (/Mobi|Android|iPhone|iPod|BlackBerry|Opera Mini/i.test(ua)) {
    device = "mobile";
  }

  let os: string | null = null;
  if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  let browser: string | null = null;
  if (/Edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = "Safari";
  }

  return { browser, os, device };
}

const recentReports = new Map<string, number>();
const THROTTLE_WINDOW_MS = 3000;

function shouldSend(fingerprint: string): boolean {
  const now = Date.now();
  const lastSent = recentReports.get(fingerprint) ?? 0;

  if (now - lastSent < THROTTLE_WINDOW_MS) {
    return false;
  }

  recentReports.set(fingerprint, now);
  if (recentReports.size > 200) {
    const oldestKey = recentReports.keys().next().value;
    if (oldestKey) {
      recentReports.delete(oldestKey);
    }
  }

  return true;
}

function send(payload: ClientErrorPayload): void {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const context = parseEnvironment();
    const user = getTokenUser();
    const message = sanitize(payload.message) ?? "Unknown error";

    const finalPayload = {
      type: payload.type,
      severity: payload.severity,
      message,
      stack: sanitize(payload.stack),
      source: sanitize(payload.source),
      page: payload.page ?? `${window.location.pathname}${window.location.search}`,
      endpoint: payload.endpoint ?? null,
      method: payload.method ?? null,
      statusCode: payload.statusCode ?? null,
      durationMs: payload.durationMs ?? null,
      userId: payload.userId ?? user.userId,
      userEmail: payload.userEmail ?? user.userEmail,
      userRole: payload.userRole ?? user.userRole,
      browser: payload.browser ?? context.browser,
      os: payload.os ?? context.os,
      device: payload.device ?? context.device,
      requestId: payload.requestId ?? getCorrelationId(),
    };

    const fingerprint = `${payload.type}:${finalPayload.message}:${finalPayload.page ?? ""}:${finalPayload.endpoint ?? ""}:${finalPayload.statusCode ?? ""}`;
    if (!shouldSend(fingerprint)) {
      return;
    }

    const url = `${getApiBaseUrl()}${REPORT_PATH}`;
    const body = JSON.stringify(finalPayload);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Error reporting must never throw.
  }
}

export function reportFrontendError(input: {
  message: string;
  severity?: Severity;
  stack?: string | null;
  source?: string | null;
}): void {
  send({ type: "FRONTEND", ...input });
}

export function reportApiError(input: {
  message: string;
  endpoint?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  stack?: string | null;
}): void {
  const status = input.statusCode ?? null;
  const severity: Severity =
    status == null ? "HIGH" : status >= 500 ? "HIGH" : status === 401 || status === 403 ? "MEDIUM" : "LOW";

  send({
    type: "API",
    severity,
    message: input.message,
    endpoint: input.endpoint,
    method: input.method,
    statusCode: status,
    durationMs: input.durationMs,
    stack: input.stack,
    source: "HttpError",
  });
}

let initialized = false;

export function initErrorReporter(): void {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;

  window.addEventListener("error", (event) => {
    const error = event.error;
    reportFrontendError({
      message: event.message || (error instanceof Error ? error.message : "Uncaught runtime error"),
      severity: "HIGH",
      stack: error instanceof Error ? error.stack ?? null : null,
      source: error instanceof Error ? error.name : "RuntimeError",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportFrontendError({
      message: reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection"),
      severity: "HIGH",
      stack: reason instanceof Error ? reason.stack ?? null : null,
      source: reason instanceof Error ? reason.name : "UnhandledRejection",
    });
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);

    try {
      const first = args[0];
      if (first instanceof Error) {
        reportFrontendError({
          message: first.message,
          severity: "MEDIUM",
          stack: first.stack ?? null,
          source: first.name,
        });
      } else if (typeof first === "string" && /error|failed|uncaught|exception/i.test(first)) {
        reportFrontendError({
          message: first,
          severity: "LOW",
          source: "ConsoleError",
        });
      }
    } catch {
      // Ignore.
    }
  };
}
