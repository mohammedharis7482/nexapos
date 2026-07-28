import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
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

const queryShopId = "02dccdd7-8182-4554-b1db-60bcaa610002";
const rememberedShopId = "9a606c22-e57a-4b25-8834-7e4ccbdcbca2";

describe("login Shop ID handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.login.mockReset();
    mocks.replace.mockReset();
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
});
