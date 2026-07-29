import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { billingService } from "@/services/billing.service";
import { categoryService } from "@/services/category.service";
import { inventoryService } from "@/services/inventory.service";
import { shiftService } from "@/services/shift.service";
import type { DraftSale } from "@/types/billing";
import type { InventoryItem } from "@/types/inventory";

import BillingPage, {
  availableForDraft,
  billingWorkspaceState,
} from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/services/billing.service", () => ({
  billingService: {
    create: vi.fn(),
    detail: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    cancel: vi.fn(),
    list: vi.fn(),
    hold: vi.fn(),
    resume: vi.fn(),
  },
}));
vi.mock("@/services/category.service", () => ({
  categoryService: { list: vi.fn() },
}));
vi.mock("@/services/inventory.service", () => ({
  inventoryService: { list: vi.fn() },
}));
vi.mock("@/services/shift.service", () => ({
  shiftService: { current: vi.fn() },
}));

const draft: DraftSale = {
  id: "draft-id",
  status: "DRAFT",
  currency: "QAR",
  created_by: { id: "user-id", full_name: "Cashier", role: "CASHIER" },
  items: [],
  subtotal: "12.00",
  tax_total: "0.60",
  discount_total: "0.00",
  grand_total: "12.60",
  notes: "",
  cancelled_at: null,
  cancelled_by: null,
  created_at: "",
  updated_at: "",
  held_at: null,
  shift: null,
};
const inventoryItem: InventoryItem = {
  product: {
    id: "product-id",
    name: "Baladna Milk",
    sku: "MILK-001",
    barcode: "6281007023412",
    unit: "BOTTLE",
    selling_price: "6.00",
    category: null,
    is_active: true,
  },
  quantity_on_hand: "10.000",
  low_stock_threshold: "2.000",
  stock_status: "IN_STOCK",
  last_movement_at: null,
  is_initialized: true,
};

const billing = vi.mocked(billingService);
const categories = vi.mocked(categoryService);
const inventory = vi.mocked(inventoryService);
const shifts = vi.mocked(shiftService);

describe("BillingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    billing.create.mockResolvedValue({ success: true, message: "", data: draft });
    billing.detail.mockResolvedValue({ success: true, message: "", data: draft });
    billing.addItem.mockResolvedValue({ success: true, message: "", data: draft });
    billing.cancel.mockResolvedValue({ success: true, message: "", data: { ...draft, status: "CANCELLED" } });
    billing.list.mockResolvedValue({
      success: true, message: "",
      data: { count: 0, next: null, previous: null, results: [] },
    });
    shifts.current.mockResolvedValue({
      success: true, message: "", data: {
        id: "shift-id", status: "OPEN", cashier: draft.created_by,
        opened_at: "", closed_at: null, opening_cash: "0.00",
        expected_closing_cash: "0.00", counted_closing_cash: null,
        cash_difference: null, opening_note: "", closing_note: "",
        summary: {
          opening_cash: "0.00", completed_bills: 0, gross_sales: "0.00",
          cash_sales: "0.00", card_sales: "0.00", split_payment_count: 0,
          expected_closing_cash: "0.00", counted_closing_cash: null,
          cash_difference: null, items_sold: "0.000", opened_at: "", closed_at: null,
        },
      },
    });
    categories.list.mockResolvedValue({
      success: true,
      message: "",
      data: { count: 0, next: null, previous: null, results: [] },
    });
    inventory.list.mockResolvedValue({
      success: true,
      message: "",
      data: { count: 1, next: null, previous: null, results: [inventoryItem] },
    });
  });

  it("covers loading, empty, error, and ready states", () => {
    expect(billingWorkspaceState(true, null, null)).toBe("loading");
    expect(billingWorkspaceState(false, null, "Failed")).toBe("error");
    expect(billingWorkspaceState(false, null, null)).toBe("empty");
    expect(billingWorkspaceState(false, draft, null)).toBe("ready");
    expect(availableForDraft(inventoryItem)).toBe(true);
    expect(availableForDraft({ ...inventoryItem, stock_status: "OUT_OF_STOCK", quantity_on_hand: "0.000" })).toBe(false);
  });

  it("reloads a saved draft and renders API totals and empty cart", async () => {
    localStorage.setItem("nexapos.activeDraftId", "draft-id");
    render(<BillingPage />);
    expect(await screen.findByText("Cart is empty")).toBeInTheDocument();
    expect(billing.detail).toHaveBeenCalledWith("draft-id");
    expect(screen.getAllByText("QAR 12.60")).not.toHaveLength(0);
    expect(billing.create).not.toHaveBeenCalled();
  });

  it("adds an exact barcode match on Enter", async () => {
    render(<BillingPage />);
    const search = await screen.findByLabelText("Product or barcode search");
    fireEvent.change(search, { target: { value: "6281007023412" } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() =>
      expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
        product_id: "product-id",
        quantity: "1.000",
      }),
    );
  });

  it("confirms cancellation and prepares a fresh draft", async () => {
    billing.create
      .mockResolvedValueOnce({ success: true, message: "", data: draft })
      .mockResolvedValueOnce({
        success: true,
        message: "",
        data: { ...draft, id: "fresh-id" },
      });
    render(<BillingPage />);
    await screen.findByText("Cart is empty");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Cancel this draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    await waitFor(() => expect(billing.cancel).toHaveBeenCalledWith("draft-id"));
    expect(localStorage.getItem("nexapos.activeDraftId")).toBe("fresh-id");
  });
});
