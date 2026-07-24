import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedUser } from "@/types/auth";

import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  user: null as AuthenticatedUser | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: vi.fn(),
    isLoggingOut: false,
  }),
}));

const owner: AuthenticatedUser = {
  id: "owner-id",
  full_name: "Shop Owner",
  username: "owner",
  role: "OWNER",
  shop: {
    id: "shop-id",
    name: "Doha Grocery",
    currency: "QAR",
    timezone: "Asia/Qatar",
  },
};

describe("premium application shell", () => {
  beforeEach(() => {
    mocks.pathname = "/dashboard";
    mocks.user = owner;
  });

  it("renders owner navigation, status context, and mobile billing access", () => {
    render(<AppShell><p>Page content</p></AppShell>);
    const desktop = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(desktop).getByRole("link", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText("Network online")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New Bill" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
  });

  it("keeps owner-only destinations out of the cashier workspace", () => {
    mocks.user = { ...owner, id: "cashier-id", full_name: "Shop Cashier", role: "CASHIER" };
    render(<AppShell><p>Page content</p></AppShell>);
    const desktop = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(desktop).queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(within(desktop).getByRole("link", { name: "New Bill" })).toBeInTheDocument();
  });
});
