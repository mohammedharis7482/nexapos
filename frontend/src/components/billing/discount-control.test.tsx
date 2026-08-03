import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { billingService } from "@/services/billing.service";
import type { DraftSale } from "@/types/billing";

import { clampDiscountInput, DiscountControl } from "./discount-control";

vi.mock("@/services/billing.service", () => ({
  billingService: { setDiscount: vi.fn() },
}));
const service = vi.mocked(billingService);

const draft: DraftSale = {
  id: "draft-id",
  status: "DRAFT",
  currency: "QAR",
  created_by: { id: "user-id", full_name: "Cashier", role: "CASHIER" },
  items: [{
    id: "item-id",
    product: { id: "product-id", name: "Milk", sku: "MILK", barcode: null, unit: "BOTTLE" },
    quantity: "2.000",
    unit_price: "10.00",
    tax_rate: "0.00",
    is_tax_inclusive: false,
    tax_amount: "0.00",
    line_subtotal: "20.00",
    line_total: "20.00",
  }],
  subtotal: "20.00",
  tax_total: "0.00",
  discount_type: "NONE",
  discount_value: "0.00",
  discount_total: "0.00",
  grand_total: "20.00",
  notes: "",
  cancelled_at: null,
  cancelled_by: null,
  created_at: "",
  updated_at: "",
  held_at: null,
  shift: null,
};

describe("clampDiscountInput", () => {
  it("passes through a value under the ceiling untouched", () => {
    expect(clampDiscountInput("PERCENTAGE", "10", "20.00")).toEqual({ value: "10", clamped: false });
    expect(clampDiscountInput("FIXED", "5", "20.00")).toEqual({ value: "5", clamped: false });
  });

  it("clamps a percentage discount to 100", () => {
    expect(clampDiscountInput("PERCENTAGE", "150", "20.00")).toEqual({ value: "100.00", clamped: true });
  });

  it("clamps a fixed discount to the subtotal", () => {
    expect(clampDiscountInput("FIXED", "999", "20.00")).toEqual({ value: "20.00", clamped: true });
  });

  it("leaves an empty or partial value alone", () => {
    expect(clampDiscountInput("FIXED", "", "20.00")).toEqual({ value: "", clamped: false });
    expect(clampDiscountInput("FIXED", "0", "20.00")).toEqual({ value: "0", clamped: false });
  });
});

describe("DiscountControl", () => {
  it("defaults to percentage mode and sends the typed value after debounce", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    service.setDiscount.mockResolvedValue({
      success: true, message: "",
      data: { ...draft, discount_type: "PERCENTAGE", discount_value: "10.00", discount_total: "2.00", grand_total: "18.00" },
    });
    const onUpdated = vi.fn();
    render(<DiscountControl draft={draft} onUpdated={onUpdated} />);

    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "10" } });
    vi.advanceTimersByTime(300);

    await waitFor(() => expect(service.setDiscount).toHaveBeenCalledWith("draft-id", {
      discount_type: "PERCENTAGE",
      discount_value: "10",
    }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ discount_total: "2.00" })));
    vi.useRealTimers();
  });

  it("clamps a fixed discount above the subtotal and shows an inline notice", () => {
    render(<DiscountControl draft={draft} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "QAR" }));
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "999" } });
    expect(input).toHaveValue("20.00");
    expect(screen.getByText(/can't exceed the subtotal/)).toBeInTheDocument();
  });

  it("sends NONE when the value is cleared", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    service.setDiscount.mockResolvedValue({ success: true, message: "", data: draft });
    render(<DiscountControl draft={{ ...draft, discount_type: "FIXED", discount_value: "5.00" }} onUpdated={vi.fn()} />);
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "" } });
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(service.setDiscount).toHaveBeenCalledWith("draft-id", {
      discount_type: "NONE",
      discount_value: "0.00",
    }));
    vi.useRealTimers();
  });

  it("shows an error notice when the request fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    service.setDiscount.mockRejectedValue(new ApiError("Discount rejected.", 400));
    render(<DiscountControl draft={draft} onUpdated={vi.fn()} />);
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "5" } });
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(screen.getByText("Discount rejected.")).toBeInTheDocument());
    vi.useRealTimers();
  });
});
