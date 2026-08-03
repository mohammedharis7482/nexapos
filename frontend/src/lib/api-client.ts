import { getCsrfToken, setCsrfToken } from "@/lib/csrf";
import type { ApiErrorResponse, ApiSuccess } from "@/types/auth";

export function resolveApiBaseUrl(
  configured: string | undefined,
  environment = process.env.NODE_ENV,
) {
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");
  if (environment === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is required for a production frontend build.",
    );
  }
  return "http://localhost:8000/api/v1";
}

const configuredBaseUrl = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
);
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
    public readonly errors: Record<string, string | string[]> = {},
    public readonly code?: string,
    public readonly structuredErrors: unknown[] = [],
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
    const wireErrors = error?.errors ?? {};
    const simpleErrors = Object.fromEntries(
      Object.entries(wireErrors).filter(
        ([, value]) =>
          typeof value === "string"
          || (Array.isArray(value) && value.every((item) => typeof item === "string")),
      ),
    ) as Record<string, string | string[]>;
    const structuredErrors = Array.isArray(wireErrors.import_errors)
      ? wireErrors.import_errors
      : [];
    const apiError = new ApiError(
      error?.message ??
        (response.status === 401
          ? "Your session has expired. Please sign in again."
          : "NexaPOS could not complete the request."),
      response.status,
      simpleErrors,
      error?.code,
      structuredErrors,
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
  const payload = await parseResponse<ApiSuccess<{ csrf_token: string }>>(response);
  setCsrfToken(payload.data.csrf_token);
}

function isCsrfFailure(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403 && error.message.startsWith("CSRF Failed");
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs, ...requestOptions } = options;
  const method = (options.method ?? "GET").toUpperCase();
  const needsCsrf = unsafeMethods.has(method);

  function buildHeaders(csrfToken: string | null): Headers {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (needsCsrf && csrfToken) headers.set("X-CSRFToken", csrfToken);
    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  }

  async function send(csrfToken: string | null): Promise<T> {
    const response = await fetchWithTimeout(
      joinApiUrl(API_BASE_URL, path),
      {
        ...requestOptions,
        method,
        credentials: "include",
        headers: buildHeaders(csrfToken),
      },
      timeoutMs,
    );
    return await parseResponse<T>(response);
  }

  // The CSRF token is cached in memory (see lib/csrf.ts) rather than read
  // from a cookie, so it survives across requests without depending on
  // the browser storing/sending a cross-site cookie. Only fetch a fresh
  // one when nothing is cached yet.
  if (needsCsrf && !getCsrfToken()) {
    await initializeCsrf();
  }

  try {
    if (needsCsrf && !getCsrfToken()) {
      throw new ApiError(
        "Security verification could not be initialized. Refresh and try again.",
        0,
      );
    }
    return await send(getCsrfToken());
  } catch (error) {
    if (needsCsrf && isCsrfFailure(error)) {
      // The cached token can go stale if the session's CSRF secret
      // rotated since it was issued (e.g. a login or logout elsewhere in
      // the app). Refresh once and retry before surfacing an error.
      setCsrfToken(null);
      await initializeCsrf();
      const refreshedToken = getCsrfToken();
      if (refreshedToken) {
        try {
          return await send(refreshedToken);
        } catch (retryError) {
          if (retryError instanceof ApiError) throw retryError;
          throw new ApiError(
            "NexaPOS cannot reach the server. Check your connection and try again.",
            0,
          );
        }
      }
    }
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
