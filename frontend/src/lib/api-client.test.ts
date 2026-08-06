import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  API_BASE_URL,
  apiRequest,
  joinApiUrl,
  resolveApiBaseUrl,
} from "./api-client";
import { getCsrfToken, setCsrfToken } from "./csrf";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function csrfResponse(token: string) {
  return jsonResponse({ success: true, message: "CSRF token issued.", data: { csrf_token: token } });
}

describe("API client", () => {
  beforeEach(() => {
    // The token lives in module memory (never a cookie - see lib/csrf.ts),
    // so tests must reset it explicitly rather than relying on
    // document.cookie, which the client no longer reads at all.
    setCsrfToken(null);
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  it("requires an explicit API URL in production", () => {
    expect(resolveApiBaseUrl(undefined, "development")).toBe(
      "http://localhost:8000/api/v1",
    );
    expect(() => resolveApiBaseUrl(undefined, "production")).toThrow(
      "NEXT_PUBLIC_API_BASE_URL is required",
    );
    expect(
      resolveApiBaseUrl("https://api.example.test/api/v1/", "production"),
    ).toBe("https://api.example.test/api/v1");
  });

  it("always includes browser credentials", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ success: true, message: "ok", data: null }),
      );

    await apiRequest("/auth/me/");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/auth/me/",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("joins URLs without missing, duplicated, or redirected slashes", () => {
    expect(joinApiUrl("http://localhost:8000/api/v1/", "auth/me")).toBe(
      "http://localhost:8000/api/v1/auth/me/",
    );
    expect(joinApiUrl(API_BASE_URL, "/auth/login/")).toBe(
      "http://localhost:8000/api/v1/auth/login/",
    );
    expect(joinApiUrl(API_BASE_URL, "/products/?search=milk&page=2")).toBe(
      "http://localhost:8000/api/v1/products/?search=milk&page=2",
    );
    expect(() => joinApiUrl(API_BASE_URL, "/api/v1/auth/me/")).toThrow(
      "must not duplicate",
    );
  });

  it("initializes CSRF from the response body (not a cookie) and sends it as a header", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => csrfResponse("test-csrf-token"))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, message: "ok", data: null }),
      );

    // No cookie exists anywhere - the deployment this token flow exists
    // for is exactly the case where the browser drops it.
    expect(document.cookie).not.toContain("csrftoken");

    await apiRequest("/auth/login/", {
      method: "POST",
      body: JSON.stringify({
        shop_id: "a2d6e62a-e2fa-455f-96bb-3a7fe471ed8a",
        username: "owner",
        password: "not-logged",
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/api/v1/auth/csrf/",
    );
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://localhost:8000/api/v1/auth/login/",
    );
    expect(request.credentials).toBe("include");
    expect(new Headers(request.headers).get("X-CSRFToken")).toBe(
      "test-csrf-token",
    );
    expect(getCsrfToken()).toBe("test-csrf-token");
  });

  it("reuses the cached token across requests instead of re-fetching every time", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => csrfResponse("cached-token"))
      .mockImplementation(async () =>
        jsonResponse({ success: true, message: "ok", data: null }),
      );

    await apiRequest("/billing/drafts/", { method: "POST", body: "{}" });
    await apiRequest("/billing/drafts/1/hold/", { method: "POST" });

    const csrfCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === "http://localhost:8000/api/v1/auth/csrf/",
    );
    expect(csrfCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes a stale cached token once and retries after a CSRF rejection", async () => {
    setCsrfToken("stale-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, message: "CSRF Failed: CSRF token incorrect.", errors: {} },
          403,
        ),
      )
      .mockImplementationOnce(async () => csrfResponse("fresh-token"))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, message: "ok", data: null }),
      );

    const result = await apiRequest("/billing/drafts/", { method: "POST", body: "{}" });

    expect(result).toEqual({ success: true, message: "ok", data: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryRequest = fetchMock.mock.calls[2][1] as RequestInit;
    expect(new Headers(retryRequest.headers).get("X-CSRFToken")).toBe("fresh-token");
    expect(getCsrfToken()).toBe("fresh-token");
  });

  it("surfaces a non-CSRF 403 without retrying", async () => {
    setCsrfToken("valid-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(
        { success: false, message: "Owner access is required.", errors: {} },
        403,
      ),
    );

    await expect(
      apiRequest("/products/", { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({ status: 403, message: "Owner access is required." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses an invalid-login response without exposing credentials", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => csrfResponse("test-csrf-token"))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            message: "Invalid shop or credentials.",
            code: "INVALID_CREDENTIALS",
            errors: { detail: "Invalid shop or credentials." },
          },
          401,
        ),
      );

    await expect(
      apiRequest("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ shop_id: "id", username: "user", password: "x" }),
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid shop or credentials.",
      code: "INVALID_CREDENTIALS",
    } satisfies Partial<ApiError>);
  });

  it("signals expired sessions for 401 but not permission-only 403 responses", async () => {
    const unauthorized = vi.fn();
    window.addEventListener("nexapos:unauthorized", unauthorized);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, message: "Expired", errors: {} }, 401),
    );
    await expect(apiRequest("/auth/me/")).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, message: "Denied", errors: {} }, 403),
    );
    await expect(apiRequest("/reports/")).rejects.toMatchObject({ status: 403 });
    expect(unauthorized).toHaveBeenCalledOnce();
    window.removeEventListener("nexapos:unauthorized", unauthorized);
  });

  it("preserves structured import validation issues and HTTP status", async () => {
    const issue = {
      row_number: 1,
      column: "Unit",
      value: "Bottlee",
      error_code: "INVALID_UNIT",
      human_message: "Unit 'Bottlee' is not supported.",
      suggested_fix: "Use 'Bottle'.",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          message: "The CSV contains validation errors.",
          code: "PRODUCT_IMPORT_INVALID",
          errors: { import_errors: [issue] },
        },
        422,
      ),
    );

    await expect(apiRequest("/products/imports/")).rejects.toMatchObject({
      status: 422,
      code: "PRODUCT_IMPORT_INVALID",
      structuredErrors: [issue],
    });
  });

  it("turns an aborted request into a controlled network failure", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("Aborted", "AbortError"),
    );

    await expect(
      apiRequest("/products/", { signal: controller.signal }),
    ).rejects.toMatchObject({
      status: 0,
      message: "NexaPOS cannot reach the server. Check your connection and try again.",
    } satisfies Partial<ApiError>);
  });
});
