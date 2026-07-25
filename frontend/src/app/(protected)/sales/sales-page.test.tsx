import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { salesService } from "@/services/sales.service";

import SalesPage from "./page";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: {
      id: "owner",
      full_name: "Shop Owner",
      username: "owner",
      role: "OWNER",
      shop: { id: "shop", name: "Doha Grocery", currency: "QAR", timezone: "Asia/Qatar" },
    },
  }),
}));
vi.mock("@/services/sales.service", () => ({
  salesService: { list: vi.fn(), cashiers: vi.fn() },
}));

describe("SalesPage regression", () => {
  it("preserves the complete management table, filters, full reference, payment, total, and detail link", async () => {
    vi.mocked(salesService.cashiers).mockResolvedValue({ success: true, message: "", data: [] });
    vi.mocked(salesService.list).mockResolvedValue({
      success: true,
      message: "",
      data: { count: 1, next: null, previous: null, results: [{
        id: "sale-id",
        sale_number: "NXP-209D48-20260724-000008",
        status: "COMPLETED",
        currency: "QAR",
        cashier: { id: "cashier", full_name: "Cashier One", role: "CASHIER" },
        item_count: 3,
        payment_methods: ["CARD"],
        grand_total: "220.00",
        completed_at: "2026-07-24T11:48:00Z",
      }] },
    });
    render(<SalesPage />);
    expect((await screen.findAllByText("NXP-209D48-20260724-000008")).length).toBeGreaterThan(0);
    for (const heading of ["Sale", "Date", "Cashier", "Items", "Payment", "Total"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Search sale number")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment method filter")).toBeInTheDocument();
    expect(screen.getAllByText("CARD").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/220\.00/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/sales/sale-id");
  });
});
