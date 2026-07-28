import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";

import { ApiError } from "@/lib/api-client";
import VerifyEmailPage from "./page";

const verifyEmail = vi.fn();
vi.mock("@/services/saas.service", () => ({
  saasService: { verifyEmail: (...args: unknown[]) => verifyEmail(...args) },
}));

const shop = {
  id: "02dccdd7-8182-4554-b1db-60bcaa610002",
  name: "Test Grocery",
};

describe("email verification Shop ID handoff", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/verify-email?token=verification-token");
    verifyEmail.mockReset();
    verifyEmail.mockResolvedValue({
      success: true,
      message: "Email verified. You can now sign in.",
      data: { shop },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows the verified shop and passes only its Shop ID to sign-in", async () => {
    render(<VerifyEmailPage />);

    expect(await screen.findByRole("heading", { name: "Account verified" })).toBeInTheDocument();
    expect(screen.getByText(/Test Grocery is ready for sign-in/)).toBeInTheDocument();
    expect(screen.getByText(shop.id)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Sign In" })).toHaveAttribute(
      "href",
      `/login?shop_id=${shop.id}`,
    );
    expect(verifyEmail).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("");
    expect(screen.getByRole("link", { name: "Go to Sign In" }).getAttribute("href")).not.toMatch(
      /token|password|username/,
    );
  });

  it("copies the verified Shop ID", async () => {
    render(<VerifyEmailPage />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Account verified" });
    await user.click(screen.getByRole("button", { name: "Copy Shop ID" }));

    expect(await navigator.clipboard.readText()).toBe(shop.id);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Shop ID copied" })).toBeInTheDocument(),
    );
  });

  it("does not expose shop context for an incomplete verification link", async () => {
    window.history.replaceState({}, "", "/verify-email");
    render(<VerifyEmailPage />);

    expect(await screen.findByText("This verification link is incomplete.")).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(screen.queryByText(shop.id)).not.toBeInTheDocument();
  });

  it("makes one verification request under React Strict Mode", async () => {
    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
    );
    await screen.findByRole("heading", { name: "Account verified" });
    expect(verifyEmail).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid", "This verification link is invalid.", "INVALID_VERIFICATION_TOKEN"],
    ["expired", "This verification link has expired.", "VERIFICATION_TOKEN_EXPIRED"],
    ["used", "This verification link has already been used.", "VERIFICATION_TOKEN_USED"],
  ])("shows the safe %s verification state", async (_state, message, code) => {
    verifyEmail.mockRejectedValue(new ApiError(message, 400, {}, code));
    render(<VerifyEmailPage />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(shop.id)).not.toBeInTheDocument();
  });
});
