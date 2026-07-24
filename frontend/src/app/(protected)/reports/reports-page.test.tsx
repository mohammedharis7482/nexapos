import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { categoryService } from "@/services/category.service";
import { reportsService } from "@/services/reports.service";
import { salesService } from "@/services/sales.service";
import type { ReportsData } from "@/types/reports";

import ReportsPage, { defaultReportFilters } from "./page";

vi.mock("@/services/reports.service", () => ({ reportsService: { get: vi.fn() } }));
vi.mock("@/services/sales.service", () => ({ salesService: { cashiers: vi.fn() } }));
vi.mock("@/services/category.service", () => ({ categoryService: { list: vi.fn() } }));
const reports = vi.mocked(reportsService);
const sales = vi.mocked(salesService);
const categories = vi.mocked(categoryService);

const data: ReportsData = {
  currency: "QAR",
  timezone: "Asia/Qatar",
  generated_at: "2026-07-24T09:00:00Z",
  filters: { date_from: "2026-07-18", date_to: "2026-07-24", cashier: null, category: null, payment_method: null },
  sales: {
    gross_sales: "125.00", completed_sales_count: 5, average_sale_value: "25.00",
    items_sold: "12.500", tax_total: "0.00", discount_total: "0.00",
    daily: [{ date: "2026-07-24", sales_total: "125.00", sales_count: 5 }],
  },
  products: [{ rank: 1, product_id: "product-id", product_name: "Milk", sku: "MILK", unit: "BOTTLE", quantity_sold: "4.000", sales_total: "24.00", sales_count: 2 }],
  inventory: {
    active_products: 3, in_stock: 1, low_stock: 1, out_of_stock: 1,
    not_initialized: 0, quantity_on_hand: "7.000",
    items: [{ product_id: "product-id", product_name: "Milk", sku: "MILK", category: "Dairy", unit: "BOTTLE", quantity_on_hand: "2.000", low_stock_threshold: "3.000", stock_status: "LOW_STOCK" }],
  },
  payments: [{ method: "CASH", amount: "125.00", payment_count: 5, sale_count: 5, percentage: "100.00" }],
  cashiers: [{ cashier_id: "cashier-id", cashier_name: "Cashier One", sales_total: "125.00", completed_sales_count: 5, average_sale_value: "25.00", items_sold: "12.500" }],
};

describe("ReportsPage", () => {
  beforeEach(() => {
    reports.get.mockReset();
    sales.cashiers.mockResolvedValue({ success: true, message: "", data: [{ id: "cashier-id", full_name: "Cashier One", role: "CASHIER" }] });
    categories.list.mockResolvedValue({ success: true, message: "", data: { count: 1, next: null, previous: null, results: [{ id: "category-id", name: "Dairy", description: "", display_order: 0, is_active: true, created_at: "", updated_at: "" }] } });
  });

  it("creates a seven-day default inclusive range", () => {
    expect(defaultReportFilters(new Date("2026-07-24T12:00:00Z"))).toMatchObject({
      date_from: "2026-07-18", date_to: "2026-07-24",
    });
  });

  it("renders loading state then real sales data", async () => {
    let resolve!: (value: { success: true; message: string; data: ReportsData }) => void;
    reports.get.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ReportsPage />);
    expect(screen.getByLabelText("Loading reports")).toBeInTheDocument();
    resolve({ success: true, message: "", data });
    expect(await screen.findByText("Gross sales")).toBeInTheDocument();
    expect(screen.getByText("Sales by day")).toBeInTheDocument();
  });

  it("switches among all report datasets without another API request", async () => {
    reports.get.mockResolvedValue({ success: true, message: "", data });
    render(<ReportsPage />);
    await screen.findByText("Gross sales");
    fireEvent.click(screen.getByRole("tab", { name: /Products/ }));
    expect(screen.getByText("Milk")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Inventory/ }));
    expect(screen.getByText("Active products")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Payments/ }));
    expect(screen.getByText("Allocated payments")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Cashiers/ }));
    expect(screen.getAllByText("Cashier One")).toHaveLength(2);
    expect(reports.get).toHaveBeenCalledOnce();
  });

  it("applies shared filters and reloads once", async () => {
    reports.get.mockResolvedValue({ success: true, message: "", data });
    render(<ReportsPage />);
    await screen.findByText("Gross sales");
    fireEvent.change(screen.getByLabelText("Report cashier"), { target: { value: "cashier-id" } });
    fireEvent.change(screen.getByLabelText("Report category"), { target: { value: "category-id" } });
    fireEvent.change(screen.getByLabelText("Report payment method"), { target: { value: "CARD" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(reports.get).toHaveBeenCalledTimes(2));
    expect(reports.get).toHaveBeenLastCalledWith(expect.objectContaining({
      cashier: "cashier-id", category: "category-id", payment_method: "CARD",
    }));
  });

  it("offers clear date presets without applying them prematurely", async () => {
    reports.get.mockResolvedValue({ success: true, message: "", data });
    render(<ReportsPage />);
    await screen.findByText("Gross sales");
    const preset = screen.getByRole("button", { name: "30 days" });
    fireEvent.click(preset);
    expect(preset).toHaveAttribute("aria-pressed", "true");
    expect(reports.get).toHaveBeenCalledOnce();
  });

  it("provides responsive linked inventory rows", async () => {
    reports.get.mockResolvedValue({ success: true, message: "", data });
    render(<ReportsPage />);
    await screen.findByText("Gross sales");
    fireEvent.click(screen.getByRole("tab", { name: /Inventory/ }));
    expect(screen.getByText("Milk").closest("a")).toHaveAttribute("href", "/inventory/product-id");
  });
});
