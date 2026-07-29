import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, API_BASE_URL, apiRequest, joinApiUrl } from "./api-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("API client", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
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

  it("initializes CSRF and sends credentials and the header for login", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => {
        document.cookie = "csrftoken=test-csrf-token; path=/";
        return jsonResponse({
          success: true,
          message: "CSRF cookie initialized.",
          data: null,
        });
      })
      .mockResolvedValueOnce(
        jsonResponse({ success: true, message: "ok", data: null }),
      );

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
  });

  it("parses an invalid-login response without exposing credentials", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => {
        document.cookie = "csrftoken=test-csrf-token; path=/";
        return jsonResponse({ success: true, message: "ok", data: null });
      })
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
    ).rejects.toMatchObject<ApiError>({
      status: 401,
      message: "Invalid shop or credentials.",
      code: "INVALID_CREDENTIALS",
    });
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
    ).rejects.toMatchObject<ApiError>({
      status: 0,
      message: "NexaPOS cannot reach the server. Check your connection and try again.",
    });
  });
});
