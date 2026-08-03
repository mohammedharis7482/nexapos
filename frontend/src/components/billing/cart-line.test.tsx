import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SaleItem } from "@/types/billing";

import { CartLine, formatQuantityDisplay, nextQuantity } from "./cart-line";

const wholeUnitItem: SaleItem = {
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

const weightUnitItem: SaleItem = {
  ...wholeUnitItem,
  id: "produce-id",
  product: { ...wholeUnitItem.product, id: "produce-product", name: "Loose Tomatoes", unit: "KG" },
  quantity: "0.750",
};

describe("CartLine", () => {
  it("renders whole-count products as a clean integer, not '2.000'", () => {
    render(<CartLine item={wholeUnitItem} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Baladna Milk")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("2.000")).not.toBeInTheDocument();
    expect(screen.getByText("QAR 12.60")).toBeInTheDocument();
    expect(screen.getByText("5.00% tax")).toBeInTheDocument();
  });

  it("keeps decimal precision visible for weight-based products", () => {
    render(<CartLine item={weightUnitItem} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByDisplayValue("0.750")).toBeInTheDocument();
  });

  it("steps whole-count products by 1 with no decimals", () => {
    const onQuantity = vi.fn();
    render(<CartLine item={wholeUnitItem} busy={false} onQuantity={onQuantity} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Baladna Milk" }));
    expect(onQuantity).toHaveBeenCalledWith("3");
    fireEvent.click(screen.getByRole("button", { name: "Decrease Baladna Milk" }));
    expect(onQuantity).toHaveBeenCalledWith("1");
  });

  it("steps weight-based products by 0.001 and keeps decimals", () => {
    const onQuantity = vi.fn();
    render(<CartLine item={weightUnitItem} busy={false} onQuantity={onQuantity} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Loose Tomatoes" }));
    expect(onQuantity).toHaveBeenCalledWith("0.751");
    fireEvent.click(screen.getByRole("button", { name: "Decrease Loose Tomatoes" }));
    expect(onQuantity).toHaveBeenCalledWith("0.749");
  });

  it("commits direct typed input and supports remove", () => {
    const onQuantity = vi.fn();
    const onRemove = vi.fn();
    render(<CartLine item={wholeUnitItem} busy={false} onQuantity={onQuantity} onRemove={onRemove} />);
    const input = screen.getByLabelText("Quantity for Baladna Milk");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);
    expect(onQuantity).toHaveBeenCalledWith("5");
    fireEvent.click(screen.getByRole("button", { name: "Remove Baladna Milk" }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("does not re-commit on blur when the typed value is numerically unchanged", () => {
    // "2" vs the stored "2.000" must be treated as equal, not a real edit.
    const onQuantity = vi.fn();
    render(<CartLine item={wholeUnitItem} busy={false} onQuantity={onQuantity} onRemove={vi.fn()} />);
    const input = screen.getByLabelText("Quantity for Baladna Milk");
    fireEvent.blur(input);
    expect(onQuantity).not.toHaveBeenCalled();
  });

  it("selects the existing value on focus so typing replaces it", () => {
    render(<CartLine item={weightUnitItem} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    const input = screen.getByLabelText<HTMLInputElement>("Quantity for Loose Tomatoes");
    const selectSpy = vi.spyOn(input, "select");
    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalledOnce();
  });
});

describe("nextQuantity", () => {
  it("uses fractional steps for weighted units and whole steps otherwise", () => {
    expect(nextQuantity("1.000", "increase", "KG")).toBe("1.001");
    expect(nextQuantity("1.000", "decrease", "PIECE")).toBe("1");
    expect(nextQuantity("1", "increase", "PIECE")).toBe("2");
  });

  it("never steps below one unit of precision", () => {
    expect(nextQuantity("1", "decrease", "PIECE")).toBe("1");
    expect(nextQuantity("0.001", "decrease", "KG")).toBe("0.001");
  });
});

describe("formatQuantityDisplay", () => {
  it("shows whole-count quantities as clean integers", () => {
    expect(formatQuantityDisplay("1.000", "PIECE")).toBe("1");
    expect(formatQuantityDisplay("12.000", "BOX")).toBe("12");
  });

  it("preserves decimals for weight and volume units", () => {
    expect(formatQuantityDisplay("0.750", "KG")).toBe("0.750");
    expect(formatQuantityDisplay("1.500", "LITRE")).toBe("1.500");
  });

  it("falls back to the raw value for an unexpected fractional whole-unit quantity", () => {
    expect(formatQuantityDisplay("1.500", "PIECE")).toBe("1.500");
  });
});
