import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SaleItem } from "@/types/billing";

import { CartLine, formatQuantityDisplay, nextQuantity, quantityUnit } from "./cart-line";

const wholeUnitItem: SaleItem = {
  id: "item-id",
  product: {
    id: "product-id",
    name: "Baladna Milk",
    sku: "MILK-001",
    barcode: "123",
    unit: "BOTTLE", image_url: null,
  },
  pricing_mode: "STANDARD",
  packet_size: null,
  quantity: "2.000",
  stock_quantity: "2.000",
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
    expect(onQuantity).toHaveBeenCalledWith("item-id", "3");
    fireEvent.click(screen.getByRole("button", { name: "Decrease Baladna Milk" }));
    expect(onQuantity).toHaveBeenCalledWith("item-id", "1");
  });

  it("steps weight-based products by 0.001 and keeps decimals", () => {
    const onQuantity = vi.fn();
    render(<CartLine item={weightUnitItem} busy={false} onQuantity={onQuantity} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Loose Tomatoes" }));
    expect(onQuantity).toHaveBeenCalledWith("produce-id", "0.751");
    fireEvent.click(screen.getByRole("button", { name: "Decrease Loose Tomatoes" }));
    expect(onQuantity).toHaveBeenCalledWith("produce-id", "0.749");
  });

  it("commits direct typed input and supports remove", () => {
    const onQuantity = vi.fn();
    const onRemove = vi.fn();
    render(<CartLine item={wholeUnitItem} busy={false} onQuantity={onQuantity} onRemove={onRemove} />);
    const input = screen.getByLabelText("Quantity for Baladna Milk");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);
    expect(onQuantity).toHaveBeenCalledWith("item-id", "5");
    fireEvent.click(screen.getByRole("button", { name: "Remove Baladna Milk" }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("item-id");
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

  it("updates in place (not remount) when a server-confirmed quantity prop changes, preserving focus", () => {
    const { rerender } = render(
      <CartLine item={wholeUnitItem} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Quantity for Baladna Milk");
    input.focus();
    expect(input).toHaveFocus();
    const updatedItem = { ...wholeUnitItem, quantity: "3.000" };
    rerender(<CartLine item={updatedItem} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(input).toHaveFocus();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
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

describe("CartLine pricing modes", () => {
  const packetLine: SaleItem = {
    ...wholeUnitItem,
    product: { ...wholeUnitItem.product, name: "Basmati Rice", unit: "KG" },
    pricing_mode: "PACKET",
    packet_size: "0.500",
    quantity: "2.000",
    stock_quantity: "1.000",
    unit_price: "7.50",
  };
  const looseLine: SaleItem = {
    ...wholeUnitItem,
    product: { ...wholeUnitItem.product, name: "Basmati Rice", unit: "KG" },
    pricing_mode: "LOOSE",
    packet_size: null,
    quantity: "0.750",
    stock_quantity: "0.750",
    unit_price: "12.00",
  };

  it("labels a packet line and prices it per packet, not per kilo", () => {
    render(<CartLine item={packetLine} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("0.5 kg packet")).toBeInTheDocument();
    expect(screen.getByText(/\/packet/)).toBeInTheDocument();
  });

  it("labels a loose line and prices it per unit", () => {
    render(<CartLine item={looseLine} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("loose")).toBeInTheDocument();
    expect(screen.getByText(/\/kg/)).toBeInTheDocument();
  });

  it("leaves a standard line unlabelled", () => {
    render(<CartLine item={wholeUnitItem} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByText("loose")).toBeNull();
    expect(screen.queryByText(/packet/)).toBeNull();
  });

  it("counts a packet line in whole packets even for a weight product", () => {
    // quantityUnit() reports PIECE for a packet line, so the field shows "2"
    // rather than the API's "2.000" and steps by one packet.
    render(<CartLine item={packetLine} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText("Quantity for Basmati Rice")).toHaveValue("2");
    expect(nextQuantity(packetLine.quantity, "increase", quantityUnit(packetLine))).toBe("3");
  });

  it("keeps decimal stepping for a loose line", () => {
    render(<CartLine item={looseLine} busy={false} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText("Quantity for Basmati Rice")).toHaveValue("0.750");
    expect(nextQuantity(looseLine.quantity, "increase", quantityUnit(looseLine))).toBe("0.751");
  });
});
