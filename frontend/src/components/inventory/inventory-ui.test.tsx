import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { inventoryService } from "@/services/inventory.service";

import { AdjustmentDialog, expectedQuantity } from "./adjustment-dialog";
import { OpeningStockDialog } from "./opening-stock-dialog";
import { stockStatusLabels, StockStatusBadge } from "./stock-status";

vi.mock("@/services/inventory.service", () => ({
  inventoryService: {
    openingStock: vi.fn(),
    adjust: vi.fn(),
  },
}));
const service = vi.mocked(inventoryService);

describe("inventory UI foundations", () => {
  beforeEach(() => {
    service.openingStock.mockReset();
    service.adjust.mockReset();
  });

  it("renders every stock status with explicit text", () => {
    for (const [status, label] of Object.entries(stockStatusLabels)) {
      const { unmount } = render(
        <StockStatusBadge status={status as keyof typeof stockStatusLabels} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("calculates increase and decrease previews", () => {
    expect(expectedQuantity("10.000", "2.500", "STOCK_IN")).toBe("12.500");
    expect(expectedQuantity("10.000", "2.500", "DAMAGE")).toBe("7.500");
  });

  it("successfully configures opening stock and refreshes data", async () => {
    service.openingStock.mockResolvedValue({} as never);
    const onSaved = vi.fn();
    render(
      <OpeningStockDialog
        open
        onOpenChange={vi.fn()}
        productId="product-id"
        productName="Milk"
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Opening quantity"), {
      target: { value: "4.500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Configure stock" }));
    await waitFor(() => expect(service.openingStock).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("submits an adjustment and refreshes movement data", async () => {
    service.adjust.mockResolvedValue({} as never);
    const onSaved = vi.fn();
    render(
      <AdjustmentDialog
        open
        onOpenChange={vi.fn()}
        productId="product-id"
        productName="Milk"
        currentQuantity="10.000"
        unit="BOTTLE"
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2.000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() => expect(service.adjust).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("displays insufficient-stock backend errors without retrying", async () => {
    service.adjust.mockRejectedValue(
      new ApiError("Please check the entered details.", 400, {
        quantity: ["Insufficient stock for this adjustment."],
      }),
    );
    render(
      <AdjustmentDialog
        open
        onOpenChange={vi.fn()}
        productId="product-id"
        productName="Milk"
        currentQuantity="10.000"
        unit="BOTTLE"
        onSaved={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2.000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    expect(
      await screen.findByText("Insufficient stock for this adjustment."),
    ).toBeInTheDocument();
    expect(service.adjust).toHaveBeenCalledOnce();
  });
});
