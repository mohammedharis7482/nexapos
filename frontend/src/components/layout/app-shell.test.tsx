import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(within(desktop).queryByRole("link", { name: "Current Shift" })).not.toBeInTheDocument();
    expect(within(desktop).queryByRole("link", { name: "Shifts" })).not.toBeInTheDocument();
    expect(within(desktop).queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.getByText("Device online")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New Bill" }).length).toBeGreaterThan(0);
    const mobile = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobile).getByRole("link", { name: "Inventory" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Open user menu")).toBeInTheDocument();
    expect(within(desktop).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(screen.getByRole("dialog", { name: "Account" })).toBeInTheDocument();
  });

  it("opens the dynamically-loaded change password dialog from the account menu", async () => {
    render(<AppShell><p>Page content</p></AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    const accountDialog = screen.getByRole("dialog", { name: "Account" });
    fireEvent.click(within(accountDialog).getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("dialog", { name: "Change password" })).toBeInTheDocument();
  });

  it("marks parent modules active for nested routes", () => {
    mocks.pathname = "/settings/team";
    render(<AppShell><p>Page content</p></AppShell>);
    const desktop = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(desktop).getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps owner-only destinations out of the cashier workspace", () => {
    mocks.user = { ...owner, id: "cashier-id", full_name: "Shop Cashier", role: "CASHIER" };
    render(<AppShell><p>Page content</p></AppShell>);
    const desktop = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(desktop).queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(within(desktop).getByRole("link", { name: "New Bill" })).toBeInTheDocument();
    const mobile = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobile).queryByRole("link", { name: "Inventory" })).not.toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Sales" })).toBeInTheDocument();
  });
});
