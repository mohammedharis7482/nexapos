import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SaleItem } from "@/types/billing";

import { CartLine, nextQuantity } from "./cart-line";

const item: SaleItem = {
  id: "item-id",
  product: {
    id: "product-id",
    name: "Baladna Milk",
    sku: "MILK-001",
    barcode: "123",
    unit: "BOTTLE",
  },
  quantity: "2.000",
  unit_price: "6.00",
  tax_rate: "5.00",
  is_tax_inclusive: false,
  tax_amount: "0.60",
  line_subtotal: "12.00",
  line_total: "12.60",
};

describe("CartLine", () => {
  it("renders snapshot price, quantity, tax, and API line total", () => {
    render(<CartLine item={item} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Baladna Milk")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2.000")).toBeInTheDocument();
    expect(screen.getByText("QAR 12.60")).toBeInTheDocument();
    expect(screen.getByText("5.00% tax")).toBeInTheDocument();
  });

  it("supports increase, decrease, direct decimal input, and remove", () => {
    const onQuantity = vi.fn();
    const onRemove = vi.fn();
    render(<CartLine item={item} busy={false} onQuantity={onQuantity} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Baladna Milk" }));
    expect(onQuantity).toHaveBeenCalledWith("3.000");
    fireEvent.click(screen.getByRole("button", { name: "Decrease Baladna Milk" }));
    expect(onQuantity).toHaveBeenCalledWith("1.000");
    const input = screen.getByLabelText("Quantity for Baladna Milk");
    fireEvent.change(input, { target: { value: "1.250" } });
    fireEvent.blur(input);
    expect(onQuantity).toHaveBeenCalledWith("1.250");
    fireEvent.click(screen.getByRole("button", { name: "Remove Baladna Milk" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("uses fractional steps for weighted units", () => {
    expect(nextQuantity("1.000", "increase", "KG")).toBe("1.001");
    expect(nextQuantity("1.000", "decrease", "PIECE")).toBe("1.000");
  });
});
