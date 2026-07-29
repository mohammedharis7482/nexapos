import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { productService } from "@/services/product.service";
import type { Product } from "@/types/product";

import { ProductDialog } from "./product-dialog";

vi.mock("@/services/product.service", () => ({
  productService: { create: vi.fn(), update: vi.fn() },
}));

const created: Product = {
  id: "product-id", name: "Bananas", description: "", sku: "BANANA-KG",
  barcode: null, unit: "KG", purchase_price: "2.00", selling_price: "3.50",
  tax_rate: "0.00", is_tax_inclusive: false, is_active: true,
  category: null, created_at: "", updated_at: "",
};

function fillProduct() {
  fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Bananas" } });
  fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "BANANA-KG" } });
  fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "KG" } });
  fireEvent.change(screen.getByLabelText("Selling price"), { target: { value: "3.50" } });
}

describe("ProductDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productService.create).mockResolvedValue({
      success: true, message: "", data: created,
    });
  });

  it("creates once and reports the opening-stock handoff", async () => {
    const onSaved = vi.fn();
    render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={onSaved} />);
    expect(screen.getByLabelText("Barcode (optional)")).toHaveValue("");
    fillProduct();
    fireEvent.click(screen.getByRole("button", { name: "Save & Add Stock" }));
    await waitFor(() => expect(productService.create).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledWith(created, true);
  });

  it("save product creates once without initializing stock", async () => {
    const onSaved = vi.fn();
    render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={onSaved} />);
    fillProduct();
    fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
    await waitFor(() => expect(productService.create).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledWith(created, false);
  });

  it("scanner Enter in optional barcode does not submit the form", () => {
    render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
    fillProduct();
    fireEvent.keyDown(screen.getByLabelText("Barcode (optional)"), { key: "Enter" });
    expect(productService.create).not.toHaveBeenCalled();
  });
});
