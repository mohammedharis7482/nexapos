import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardService } from "@/services/dashboard.service";
import type { DashboardData, OwnerDashboardSummary } from "@/types/dashboard";

import DashboardPage from "./page";

const auth = vi.hoisted(() => ({
  user: {
    id: "user-id",
    full_name: "Shop Owner",
    username: "owner",
    role: "OWNER" as "OWNER" | "CASHIER",
    shop: { id: "shop-id", name: "Doha Grocery", currency: "QAR", timezone: "Asia/Qatar" },
  },
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(() => ({ user: auth.user })),
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
  beforeEach(() => {
    service.get.mockReset();
    auth.user.full_name = "Shop Owner";
    auth.user.role = "OWNER";
  });

  it("shows a loading structure before data resolves", async () => {
    let resolveRequest!: (value: { success: true; message: string; data: DashboardData }) => void;
    service.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<DashboardPage />);
    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
    resolveRequest({ success: true, message: "", data: base });
    expect(await screen.findByText("Today’s Sales")).toBeInTheDocument();
  });

  it("renders the owner header, command strip, four metrics, and primary actions", async () => {
    service.get.mockResolvedValue({ success: true, message: "", data: base });
    render(<DashboardPage />);
    expect(await screen.findByText("Today’s Sales")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Shop/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Start New Bill/ })[0]).toHaveAttribute("href", "/billing");
    expect(screen.getByText("Bills Today")).toBeInTheDocument();
    expect(screen.getByText("Average Bill")).toBeInTheDocument();
    expect(screen.getByText("Items Sold")).toBeInTheDocument();
    expect(screen.queryByText("Low stock", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByText("Payments Today")).toBeInTheDocument();
    expect(screen.getByText("Top Products")).toBeInTheDocument();
    expect(screen.getAllByText("20260724-000001")[0].closest("a")).toHaveAttribute("href", "/sales/sale-id");
    expect(screen.getAllByText("Milk")[0].closest("a")).toHaveAttribute("href", "/inventory/product-id");
    expect(screen.getByText("View All Sales")).toHaveAttribute("href", "/sales");
    expect(screen.queryByText(/up \\d+%/i)).not.toBeInTheDocument();
    expect(screen.getByText("Keep today's work moving")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Seven-day sales chart/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("...");
  });

  it("renders the role-limited cashier dashboard and personal metrics", async () => {
    auth.user.full_name = "Cashier One";
    auth.user.role = "CASHIER";
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
    expect(await screen.findByText("My Sales Today")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Cashier/ })).toBeInTheDocument();
    expect(screen.getByText("My Bills Today")).toBeInTheDocument();
    expect(screen.getByText("My Average Bill")).toBeInTheDocument();
    expect(screen.getByText("My Items Sold")).toBeInTheDocument();
    expect(screen.getByText("Search Products")).toBeInTheDocument();
    expect(screen.getByText("View My Sales")).toBeInTheDocument();
    expect(screen.queryByText("Payments Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Inventory Attention")).not.toBeInTheDocument();
    expect(screen.queryByText("Top Products")).not.toBeInTheDocument();
  });

  it("supports controlled manual refresh", async () => {
    service.get.mockResolvedValue({ success: true, message: "", data: base });
    render(<DashboardPage />);
    await screen.findByText("Today’s Sales");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(service.get).toHaveBeenCalledTimes(2));
  });

  it("renders chart totals, current-day emphasis, payment reconciliation, and sale details", async () => {
    service.get.mockResolvedValue({ success: true, message: "", data: base });
    render(<DashboardPage />);
    expect(await screen.findByText("Seven-day total")).toBeInTheDocument();
    expect(screen.getAllByText("Completed bills").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/current day/)).toBeInTheDocument();
    expect(screen.getByText("Total collected")).toBeInTheDocument();
    expect(screen.getAllByText(/125\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 items").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cash").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cashier One").length).toBeGreaterThan(0);
    expect(screen.getByTestId("recent-sales-cards")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders compact zero and healthy states without inventing values", async () => {
    const empty: DashboardData = {
      ...base,
      summary: { ...(base.summary as OwnerDashboardSummary), sales_total_today: "0.00", completed_sales_count_today: 0, average_sale_value_today: "0.00", items_sold_today: "0.000" },
      recent_sales: [],
      payment_breakdown: [],
      inventory_alerts: { low_stock: [], out_of_stock: [], not_initialized: [] },
      top_products: [],
      sales_trend: base.sales_trend.map((point) => ({ ...point, sales_total: "0.00", completed_sales_count: 0 })),
    };
    service.get.mockResolvedValue({ success: true, message: "", data: empty });
    render(<DashboardPage />);
    expect(await screen.findByText("No payments today")).toBeInTheDocument();
    expect(screen.getByText("No completed sales yet")).toBeInTheDocument();
    expect(screen.getByText("Inventory looks healthy")).toBeInTheDocument();
    expect(screen.getByText("No product sales today")).toBeInTheDocument();
    expect(screen.getByText("No completed sales in this period")).toBeInTheDocument();
  });

  it("renders inventory statuses and weighted product quantities", async () => {
    const alerts = {
      ...base.inventory_alerts,
      out_of_stock: [{ ...base.inventory_alerts.low_stock[0], product_id: "out", stock_status: "OUT_OF_STOCK" as const, quantity_on_hand: "0.000" }],
      not_initialized: [{ ...base.inventory_alerts.low_stock[0], product_id: "new", stock_status: "NOT_INITIALIZED" as const, quantity_on_hand: null }],
    };
    service.get.mockResolvedValue({ success: true, message: "", data: { ...base, inventory_alerts: alerts } });
    render(<DashboardPage />);
    expect(await screen.findByText("Low stock")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("Not initialized")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "4 sold")).toBeInTheDocument();
  });

  it("shows a plain-language error and supports retry", async () => {
    service.get.mockRejectedValueOnce(new Error("raw failure")).mockResolvedValueOnce({ success: true, message: "", data: base });
    render(<DashboardPage />);
    expect(await screen.findByText("Dashboard unavailable")).toBeInTheDocument();
    expect(screen.queryByText("raw failure")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Today’s Sales")).toBeInTheDocument();
  });
});
