import { createElement, StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { authService } from "@/services/auth.service";
import type { AuthenticatedUser } from "@/types/auth";

import {
  AuthProvider,
  authReducer,
  clearUserScopedBrowserState,
  initialAuthState,
  useAuth,
} from "./auth-provider";

vi.mock("@/services/auth.service", () => ({
  authService: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const user: AuthenticatedUser = {
  id: "a2d6e62a-e2fa-455f-96bb-3a7fe471ed8a",
  full_name: "Ahmed Kareem",
  username: "ahmed",
  role: "OWNER",
  shop: {
    secondary_language: "",
    id: "ba031a8a-ed3d-4ed6-b1be-444a812010f8",
    name: "Al Noor Grocery",
    currency: "QAR",
    timezone: "Asia/Qatar",
  },
};

const mockedService = vi.mocked(authService);

function StatusProbe() {
  const { status, user: currentUser, error } = useAuth();
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "status" }, status),
    createElement("span", { "data-testid": "user" }, currentUser?.username ?? ""),
    createElement("span", { "data-testid": "error" }, error ?? ""),
  );
}

function LoginProbe() {
  const { login, user: currentUser } = useAuth();
  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        onClick: () =>
          void login({
            shop_id: user.shop.id,
            username: user.username,
            password: "not-logged",
          }),
      },
      "Login",
    ),
    createElement("span", { "data-testid": "user" }, currentUser?.username ?? ""),
  );
}

describe("authentication state", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedService.me.mockReset();
    mockedService.login.mockReset();
    mockedService.logout.mockReset();
  });

  it("starts in initial authentication loading", () => {
    expect(initialAuthState.status).toBe("loading");
    expect(initialAuthState.user).toBeNull();
  });

  it("stores a successful login in memory", () => {
    const state = authReducer(initialAuthState, {
      type: "AUTHENTICATED",
      user,
    });
    expect(state.status).toBe("authenticated");
    expect(state.user).toEqual(user);
  });

  it("clears the user after logout", () => {
    const authenticated = authReducer(initialAuthState, {
      type: "AUTHENTICATED",
      user,
    });
    expect(authReducer(authenticated, { type: "LOGGED_OUT" }).user).toBeNull();
  });

  it("requests me once under Strict Mode and authenticates the user", async () => {
    mockedService.me.mockResolvedValue({
      success: true,
      message: "Current user retrieved.",
      data: { user },
    });

    render(
      createElement(
        StrictMode,
        null,
        createElement(AuthProvider, null, createElement(StatusProbe)),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(mockedService.me).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user")).toHaveTextContent("ahmed");
  });

  it("sets a 401 to unauthenticated without retrying me", async () => {
    mockedService.me.mockRejectedValue(
      new ApiError("Authentication credentials were not provided.", 401),
    );

    render(createElement(AuthProvider, null, createElement(StatusProbe)));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(mockedService.me).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("error")).toBeEmptyDOMElement();
  });

  it("reports one network error without repeatedly requesting me", async () => {
    mockedService.me.mockRejectedValue(
      new ApiError("NexaPOS cannot reach the server.", 0),
    );

    render(
      createElement(
        StrictMode,
        null,
        createElement(AuthProvider, null, createElement(StatusProbe)),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "NexaPOS cannot reach the server.",
      ),
    );
    expect(mockedService.me).toHaveBeenCalledTimes(1);
  });

  it("stores the authenticated user after successful login", async () => {
    mockedService.me.mockRejectedValue(new ApiError("Unauthenticated", 401));
    mockedService.login.mockResolvedValue({
      success: true,
      message: "Login successful.",
      data: { user },
    });

    render(createElement(AuthProvider, null, createElement(LoginProbe)));
    await waitFor(() => expect(mockedService.me).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("ahmed"),
    );
  });

  it("clears only user-scoped browser state", () => {
    localStorage.setItem("nexapos.activeDraftId", "draft-id");
    localStorage.setItem("nexapos.remembered-shop-id", user.shop.id);

    clearUserScopedBrowserState();

    expect(localStorage.getItem("nexapos.activeDraftId")).toBeNull();
    expect(localStorage.getItem("nexapos.remembered-shop-id")).toBe(user.shop.id);
  });

  it("clears authenticated state when the API reports an expired session", async () => {
    mockedService.me.mockResolvedValue({
      success: true,
      message: "Current user retrieved.",
      data: { user },
    });
    localStorage.setItem("nexapos.activeDraftId", "draft-id");
    render(createElement(AuthProvider, null, createElement(StatusProbe)));
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    window.dispatchEvent(new Event("nexapos:unauthorized"));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(localStorage.getItem("nexapos.activeDraftId")).toBeNull();
  });
});
