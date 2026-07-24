import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { billingService } from "@/services/billing.service";
import type { DraftSale } from "@/types/billing";
import type { CompletedSale } from "@/types/sales";

import { cashChangePreview, PaymentDialog } from "./payment-dialog";

vi.mock("@/services/billing.service", () => ({
  billingService: { complete: vi.fn() },
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
    unit_price: "6.00",
    tax_rate: "0.00",
    is_tax_inclusive: false,
    tax_amount: "0.00",
    line_subtotal: "12.00",
    line_total: "12.00",
  }],
  subtotal: "12.00",
  tax_total: "0.00",
  discount_total: "0.00",
  grand_total: "12.00",
  notes: "",
  cancelled_at: null,
  cancelled_by: null,
  created_at: "",
  updated_at: "",
};
const completed = {
  ...draft,
  status: "COMPLETED",
  sale_number: "NXP-ABC123-20260724-000001",
  completed_by: draft.created_by,
  payments: [],
  amount_received: "20.00",
  change_due: "8.00",
  completed_at: "",
} as CompletedSale;

describe("PaymentDialog", () => {
  beforeEach(() => {
    service.complete.mockReset();
  });

  it("calculates cash change in integer cents", () => {
    expect(cashChangePreview("12.00", "20.00")).toBe("8.00");
    expect(cashChangePreview("12.00", "10.00")).toBe("-2.00");
  });

  it("rejects cash underpayment before sending a request", async () => {
    render(<PaymentDialog open onOpenChange={vi.fn()} draft={draft} onCompleted={vi.fn()} onInventoryConflict={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Cash received"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    expect(await screen.findByText("Cash received must cover the grand total.")).toBeInTheDocument();
    expect(service.complete).not.toHaveBeenCalled();
  });

  it("submits allocated cash, prevents duplicate submission, and completes", async () => {
    service.complete.mockResolvedValue({ success: true, message: "", data: completed });
    const onCompleted = vi.fn();
    render(<PaymentDialog open onOpenChange={vi.fn()} draft={draft} onCompleted={onCompleted} onInventoryConflict={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Confirm payment" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(service.complete).toHaveBeenCalledOnce());
    expect(service.complete).toHaveBeenCalledWith("draft-id", {
      payments: [{ method: "CASH", amount: "12.00" }],
      amount_received: "12.00",
    });
    expect(onCompleted).toHaveBeenCalledWith(completed);
  });

  it("submits card without sensitive card data", async () => {
    service.complete.mockResolvedValue({ success: true, message: "", data: completed });
    render(<PaymentDialog open onOpenChange={vi.fn()} draft={draft} onCompleted={vi.fn()} onInventoryConflict={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    fireEvent.change(screen.getByLabelText("Terminal reference (optional)"), { target: { value: "TERMINAL-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    await waitFor(() => expect(service.complete).toHaveBeenCalledOnce());
    const payload = service.complete.mock.calls[0][1];
    expect(payload).toEqual({
      payments: [{ method: "CARD", amount: "12.00", reference: "TERMINAL-1" }],
    });
    expect(JSON.stringify(payload)).not.toMatch(/card_number|cvv|expiry/i);
  });

  it("shows inventory conflict and keeps the draft available", async () => {
    service.complete.mockRejectedValue(
      new ApiError("Please check the entered details.", 400, {
        inventory: "Milk: requested 2.000, available 1.000.",
      }),
    );
    const onConflict = vi.fn();
    render(<PaymentDialog open onOpenChange={vi.fn()} draft={draft} onCompleted={vi.fn()} onInventoryConflict={onConflict} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    expect(await screen.findByText("Stock changed before payment. Review the cart quantities and try again.")).toBeInTheDocument();
    expect(onConflict).toHaveBeenCalledOnce();
  });
});
