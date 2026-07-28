import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";
import { ApiError } from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    login: mocks.login,
    status: "unauthenticated",
  }),
}));

vi.mock("@/services/saas.service", () => ({
  saasService: {
    resendVerification: mocks.resendVerification,
  },
}));

const queryShopId = "02dccdd7-8182-4554-b1db-60bcaa610002";
const rememberedShopId = "9a606c22-e57a-4b25-8834-7e4ccbdcbca2";

describe("login Shop ID handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.login.mockReset();
    mocks.replace.mockReset();
    mocks.resendVerification.mockReset();
    window.history.replaceState({}, "", "/login");
  });

  it("prefills a valid query Shop ID without persisting it", async () => {
    window.history.replaceState({}, "", `/login?shop_id=${queryShopId}`);
    render(<LoginPage />);

    expect(await screen.findByLabelText("Shop ID")).toHaveValue(queryShopId);
    expect(screen.getByLabelText("Remember this Shop ID on this device")).not.toBeChecked();
    expect(localStorage.getItem("nexapos.remembered-shop-id")).toBeNull();
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("gives a valid query Shop ID precedence over a remembered value", async () => {
    localStorage.setItem("nexapos.remembered-shop-id", rememberedShopId);
    window.history.replaceState({}, "", `/login?shop_id=${queryShopId}`);
    render(<LoginPage />);

    expect(await screen.findByLabelText("Shop ID")).toHaveValue(queryShopId);
    expect(screen.getByLabelText("Remember this Shop ID on this device")).not.toBeChecked();
  });

  it("rejects a malformed query safely and falls back to a valid remembered value", async () => {
    localStorage.setItem("nexapos.remembered-shop-id", rememberedShopId);
    window.history.replaceState({}, "", "/login?shop_id=not-a-uuid");
    render(<LoginPage />);

    expect(await screen.findByLabelText("Shop ID")).toHaveValue(rememberedShopId);
    expect(screen.getByText("The Shop ID in this sign-in link is invalid.")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("stores the query Shop ID only after successful login with Remember selected", async () => {
    mocks.login.mockResolvedValue(undefined);
    window.history.replaceState({}, "", `/login?shop_id=${queryShopId}`);
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.click(screen.getByLabelText("Remember this Shop ID on this device"));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledOnce());
    expect(localStorage.getItem("nexapos.remembered-shop-id")).toBe(queryShopId);
    expect(window.location.search).toBe(`?shop_id=${queryShopId}`);
  });

  it("shows verification guidance only after valid unverified credentials", async () => {
    mocks.login.mockRejectedValue(
      new ApiError(
        "Verify your email before signing in.",
        403,
        { can_resend_verification: true },
        "EMAIL_NOT_VERIFIED",
      ),
    );
    window.history.replaceState({}, "", `/login?shop_id=${queryShopId}`);
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Verify your email")).toBeInTheDocument();
    expect(screen.getByText(/login details are correct/)).toBeInTheDocument();
    expect(screen.queryByText(/Shop ID, username, or password is incorrect/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Shop ID")).toHaveValue(queryShopId);
    expect(screen.getByLabelText("Username")).toHaveValue("owner");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("resends verification with Shop ID and username using a generic response", async () => {
    mocks.login.mockRejectedValue(
      new ApiError(
        "Verify your email before signing in.",
        403,
        { can_resend_verification: true },
        "EMAIL_NOT_VERIFIED",
      ),
    );
    mocks.resendVerification.mockResolvedValue({
      success: true,
      message: "If an unverified account exists, a verification email has been sent.",
      data: null,
    });
    window.history.replaceState({}, "", `/login?shop_id=${queryShopId}`);
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(await screen.findByRole("button", { name: "Resend Verification Email" }));

    expect(mocks.resendVerification).toHaveBeenCalledWith({
      shop_id: queryShopId,
      username: "owner",
    });
    expect(
      await screen.findByText(/If an unverified account exists/),
    ).toBeInTheDocument();
  });

  it("keeps invalid credentials generic and maps lifecycle and network failures", async () => {
    window.history.replaceState({}, "", `/login?shop_id=${queryShopId}`);
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "wrong");

    mocks.login.mockRejectedValueOnce(
      new ApiError("Invalid shop or credentials.", 401, {}, "INVALID_CREDENTIALS"),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("The Shop ID, username, or password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Password"), "correct");
    mocks.login.mockRejectedValueOnce(
      new ApiError("This shop is not currently active.", 403, {}, "SHOP_SUSPENDED"),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("This shop is not currently active. Contact the shop owner.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Password"), "correct");
    mocks.login.mockRejectedValueOnce(
      new ApiError("This account is inactive.", 403, {}, "USER_INACTIVE"),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("This account is inactive. Ask a shop owner for help.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Password"), "correct");
    mocks.login.mockRejectedValueOnce(
      new ApiError("NexaPOS cannot reach the server.", 0),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("NexaPOS cannot reach the server.")).toBeInTheDocument();
  });
});
