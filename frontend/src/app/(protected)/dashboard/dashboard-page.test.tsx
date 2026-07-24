import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardService } from "@/services/dashboard.service";
import type { DashboardData } from "@/types/dashboard";

import DashboardPage from "./page";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "user-id",
      full_name: "Shop Owner",
      username: "owner",
      role: "OWNER",
      shop: { id: "shop-id", name: "Doha Grocery", currency: "QAR", timezone: "Asia/Qatar" },
    },
  })),
}));
vi.mock("@/services/dashboard.service", () => ({
  dashboardService: { get: vi.fn() },
}));
const service = vi.mocked(dashboardService);

const base: DashboardData = {
  role: "OWNER",
  currency: "QAR",
  timezone: "Asia/Qatar",
  generated_at: "2026-07-24T09:00:00Z",
  top_products_period: "today",
  summary: {
    sales_total_today: "125.00",
    completed_sales_count_today: 5,
    average_sale_value_today: "25.00",
    items_sold_today: "12.500",
    cash_sales_total_today: "75.00",
    card_sales_total_today: "50.00",
    split_sales_total_today: "20.00",
    low_stock_count: 1,
    out_of_stock_count: 1,
    inventory_not_initialized_count: 1,
    active_product_count: 10,
  },
  recent_sales: [{
    id: "sale-id",
    sale_number: "NXP-ABC-20260724-000001",
    completed_at: "2026-07-24T08:00:00Z",
    cashier_name: "Cashier One",
    item_count: 2,
    payment_methods: ["CASH"],
    grand_total: "25.00",
  }],
  inventory_alerts: {
    low_stock: [{ product_id: "product-id", product_name: "Milk", sku: "MILK", category: "Dairy", unit: "BOTTLE", quantity_on_hand: "2.000", low_stock_threshold: "3.000", stock_status: "LOW_STOCK" }],
    out_of_stock: [],
    not_initialized: [],
  },
  top_products: [{ rank: 1, product_id: "product-id", product_name: "Milk", sku: "MILK", quantity_sold: "4.000", sales_total: "24.00" }],
  sales_trend: Array.from({ length: 7 }, (_, index) => ({ date: `2026-07-${18 + index}`, sales_total: index === 6 ? "125.00" : "0.00", completed_sales_count: index === 6 ? 5 : 0 })),
  payment_breakdown: [
    { method: "CASH", amount: "75.00", percentage: "60.00" },
    { method: "CARD", amount: "50.00", percentage: "40.00" },
  ],
};

describe("DashboardPage", () => {
  beforeEach(() => service.get.mockReset());

  it("shows a loading structure before data resolves", async () => {
    let resolveRequest!: (value: { success: true; message: string; data: DashboardData }) => void;
    service.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<DashboardPage />);
    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
    resolveRequest({ success: true, message: "", data: base });
    expect(await screen.findByText("Today’s sales")).toBeInTheDocument();
  });

  it("renders owner metrics, operational sections, and real links", async () => {
    service.get.mockResolvedValue({ success: true, message: "", data: base });
    render(<DashboardPage />);
    expect(await screen.findByText("Today’s sales")).toBeInTheDocument();
    expect(screen.getByText("Payments today")).toBeInTheDocument();
    expect(screen.getByText("Top products today")).toBeInTheDocument();
    expect(screen.getByText("NXP-ABC-20260724-000001").closest("a")).toHaveAttribute("href", "/sales/sale-id");
    expect(screen.getAllByText("Milk")[0].closest("a")).toHaveAttribute("href", "/inventory/product-id");
    expect(screen.getByText("View all sales")).toHaveAttribute("href", "/sales");
    expect(screen.queryByText(/up \\d+%/i)).not.toBeInTheDocument();
  });

  it("renders the role-limited cashier dashboard", async () => {
    const cashier: DashboardData = {
      ...base,
      role: "CASHIER",
      summary: {
        my_sales_total_today: "25.00",
        my_completed_sales_count_today: 1,
        my_average_sale_value_today: "25.00",
        my_items_sold_today: "2.000",
      },
    };
    service.get.mockResolvedValue({ success: true, message: "", data: cashier });
    render(<DashboardPage />);
    expect(await screen.findByText("My sales today")).toBeInTheDocument();
    expect(screen.getByText("My completed bills")).toBeInTheDocument();
    expect(screen.queryByText("Payments today")).not.toBeInTheDocument();
    expect(screen.queryByText("Top products today")).not.toBeInTheDocument();
  });

  it("supports controlled manual refresh", async () => {
    service.get.mockResolvedValue({ success: true, message: "", data: base });
    render(<DashboardPage />);
    await screen.findByText("Today’s sales");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(service.get).toHaveBeenCalledTimes(2));
  });

});
