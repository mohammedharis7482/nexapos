import { readCsrfToken } from "@/lib/csrf";
import type { ApiErrorResponse } from "@/types/auth";

const configuredBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const configuredTimeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? "15000");
const API_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 15000;
export const UNAUTHORIZED_EVENT = "nexapos:unauthorized";

export function joinApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const [pathname, query = ""] = path.trim().split("?", 2);
  const normalizedPath = `/${pathname.replace(/^\/+|\/+$/g, "")}/`;

  if (!normalizedBase || /^https?:\/\//i.test(path)) {
    throw new Error("API paths must be relative to the configured API base URL.");
  }
  if (/^\/api\/v1(?:\/|$)/.test(normalizedPath)) {
    throw new Error("API paths must not duplicate the /api/v1 base path.");
  }

  return `${normalizedBase}${normalizedPath}${query ? `?${query}` : ""}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: ApiErrorResponse["errors"] = {},
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = payload as ApiErrorResponse | null;
    const apiError = new ApiError(
      error?.message ??
        (response.status === 401
          ? "Your session has expired. Please sign in again."
          : "NexaPOS could not complete the request."),
      response.status,
      error?.errors ?? {},
      error?.code,
    );
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw apiError;
  }

  return payload as T;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

export async function initializeCsrf(): Promise<void> {
  const response = await fetchWithTimeout(joinApiUrl(API_BASE_URL, "/auth/csrf/"), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  await parseResponse(response);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs, ...requestOptions } = options;
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (unsafeMethods.has(method)) {
    await initializeCsrf();
    const csrfToken = readCsrfToken();
    if (!csrfToken) {
      throw new ApiError(
        "Security verification could not be initialized. Refresh and try again.",
        0,
      );
    }
    headers.set("X-CSRFToken", csrfToken);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetchWithTimeout(
      joinApiUrl(API_BASE_URL, path),
      {
        ...requestOptions,
        method,
        credentials: "include",
        headers,
      },
      timeoutMs,
    );
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "NexaPOS cannot reach the server. Check your connection and try again.",
      0,
    );
  }
}

export async function apiDownload(path: string): Promise<Blob> {
  try {
    const response = await fetchWithTimeout(joinApiUrl(API_BASE_URL, path), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "text/csv" },
    });
    if (!response.ok) {
      await parseResponse(response);
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "NexaPOS cannot reach the server. Check your connection and try again.",
      0,
    );
  }
}

export { API_BASE_URL };
