import { reportApiError } from "@/services/error-reporter";

export class HttpError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  public constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");

function isErrorReportingPath(path: string): boolean {
  return path.includes("/system-logs");
}

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...restOptions } = options;
  const method = (restOptions.method ?? "GET").toString().toUpperCase();
  const startedAt = Date.now();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("outlethub:auth-activity"));
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...restOptions,
    });
  } catch (networkError) {
    if (!isErrorReportingPath(path)) {
      try {
        reportApiError({
          message: networkError instanceof Error ? networkError.message : "Network request failed",
          endpoint: path,
          method,
          statusCode: null,
          durationMs: Date.now() - startedAt,
        });
      } catch {
        // Ignore reporting failures.
      }
    }

    throw networkError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => undefined)) as
    | { message?: string; details?: unknown; issues?: unknown }
    | undefined;

  if (!response.ok) {
    if (!isErrorReportingPath(path)) {
      try {
        reportApiError({
          message: data?.message ?? "Request failed",
          endpoint: path,
          method,
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
        });
      } catch {
        // Ignore reporting failures.
      }
    }

    throw new HttpError(data?.message ?? "Request failed", response.status, data?.details ?? data?.issues ?? data);
  }

  return data as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
