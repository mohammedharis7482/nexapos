import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamPage from "./page";

const users = vi.hoisted(() => vi.fn());
const invitations = vi.hoisted(() => vi.fn());

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: {
      id: "owner",
      full_name: "Primary Owner",
      role: "OWNER",
      is_primary_owner: true,
      shop: { id: "shop", name: "Shop", currency: "QAR", timezone: "Asia/Qatar" },
    },
  }),
}));

vi.mock("@/services/saas.service", () => ({
  saasService: {
    users,
    invitations,
    createUser: vi.fn(),
    resetUserPassword: vi.fn(),
    updateUser: vi.fn(),
    changeRole: vi.fn(),
    userAction: vi.fn(),
  },
}));

describe("Team & Access MVP", () => {
  it("shows operational team counts without plan seats or invitations", async () => {
    users.mockResolvedValue({
      success: true,
      message: "",
      data: {
        count: 2,
        next: null,
        previous: null,
        usage: { active_users: 1, max_users: 3, active_products: 0, max_products: 1000 },
        results: [
          {
            id: "owner",
            full_name: "Primary Owner",
            username: "owner",
            email: "",
            role: "OWNER",
            is_primary_owner: true,
            is_active: true,
            must_change_password: false,
            status: "ACTIVE",
            last_login: null,
            date_joined: "",
            created_at: "",
            created_by_name: null,
            available_actions: [],
          },
          {
            id: "cashier",
            full_name: "Former Cashier",
            username: "cashier",
            email: "",
            role: "CASHIER",
            is_primary_owner: false,
            is_active: false,
            must_change_password: false,
            status: "INACTIVE",
            last_login: null,
            date_joined: "",
            created_at: "",
            created_by_name: "Primary Owner",
            available_actions: ["activate"],
          },
        ],
      },
    });

    render(<TeamPage />);

    expect(await screen.findByText("Active Team Members")).toBeInTheDocument();
    expect(screen.getByText("Inactive Accounts")).toBeInTheDocument();
    expect(screen.getByText("System safety limit: 3 active accounts.")).toBeInTheDocument();
    expect(screen.queryByText("Available seats")).not.toBeInTheDocument();
    expect(screen.queryByText("Invitations")).not.toBeInTheDocument();
    expect(invitations).not.toHaveBeenCalled();
  });
});
