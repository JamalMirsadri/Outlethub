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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...restOptions } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...restOptions,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => undefined)) as
    | { message?: string; details?: unknown }
    | undefined;

  if (!response.ok) {
    throw new HttpError(data?.message ?? "Request failed", response.status, data?.details);
  }

  return data as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
