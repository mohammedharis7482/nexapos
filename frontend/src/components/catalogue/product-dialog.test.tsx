import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { productService } from "@/services/product.service";
import type { Product } from "@/types/product";

import { ProductDialog } from "./product-dialog";

vi.mock("@/services/product.service", () => ({
  productService: {
    create: vi.fn(),
    update: vi.fn(),
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
  },
}));

// resizeImage needs a real browser decoder; identity keeps the assertions on
// the dialog's sequencing rather than on canvas behaviour.
vi.mock("@/lib/image-resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image-resize")>()),
  resizeImage: vi.fn(async (file: File) => file),
}));

const created: Product = {
  secondary_name: "",
  id: "product-id", name: "Bananas", description: "", sku: "BANANA-KG",
  barcode: null, unit: "KG", purchase_price: "2.00", selling_price: "3.50",
  tax_rate: "0.00", is_tax_inclusive: false, is_active: true,
  category: null, image_url: null, pricing_mode: "STANDARD", packets: [],
  created_at: "", updated_at: "",
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

  describe("optional product image", () => {
    const withImage: Product = { ...created, image_url: "http://localhost/media/p.jpg" };
    const bananasJpg = () => new File([new Uint8Array(32)], "bananas.jpg", { type: "image/jpeg" });

    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => "blob:preview");
      URL.revokeObjectURL = vi.fn();
    });

    it("saves without touching the image endpoints when no file is chosen", async () => {
      const onSaved = vi.fn();
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={onSaved} />);
      fillProduct();
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, false));
      expect(productService.uploadImage).not.toHaveBeenCalled();
      expect(productService.removeImage).not.toHaveBeenCalled();
    });

    it("uploads the image after the product is created and reports the updated product", async () => {
      vi.mocked(productService.uploadImage).mockResolvedValue({
        success: true, message: "", data: withImage,
      });
      const onSaved = vi.fn();
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={onSaved} />);
      fillProduct();
      const file = bananasJpg();
      fireEvent.change(screen.getByLabelText("Product image"), { target: { files: [file] } });
      await screen.findByText("bananas.jpg");
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(productService.uploadImage).toHaveBeenCalledWith("product-id", file));
      expect(vi.mocked(productService.create).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(productService.uploadImage).mock.invocationCallOrder[0],
      );
      expect(onSaved).toHaveBeenCalledWith(withImage, false);
    });

    it("keeps the saved product when only the image upload fails", async () => {
      vi.mocked(productService.uploadImage).mockRejectedValue(new Error("network"));
      const onSaved = vi.fn();
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={onSaved} />);
      fillProduct();
      fireEvent.change(screen.getByLabelText("Product image"), { target: { files: [bananasJpg()] } });
      await screen.findByText("bananas.jpg");
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, false));
      expect(await screen.findByRole("alert")).toHaveTextContent("The product was saved.");
    });

    it("clears an existing image when the owner removes it", async () => {
      vi.mocked(productService.update).mockResolvedValue({ success: true, message: "", data: withImage });
      vi.mocked(productService.removeImage).mockResolvedValue({ success: true, message: "", data: created });
      const onSaved = vi.fn();
      render(<ProductDialog open onOpenChange={vi.fn()} product={withImage} categories={[]} onSaved={onSaved} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(productService.removeImage).toHaveBeenCalledWith("product-id"));
      expect(productService.uploadImage).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith(created, false);
    });
  });

  describe("multi-pricing packets", () => {
    const multi: Product = {
      ...created,
      pricing_mode: "MULTI",
      packets: [
        { id: "p250", size: "0.250", price: "3.50", display_order: 0, is_active: true },
      ],
    };

    it("posts STANDARD with no packets when the toggle is untouched", async () => {
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
      fillProduct();
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(productService.create).toHaveBeenCalledOnce());
      const payload = vi.mocked(productService.create).mock.calls[0][0];
      expect(payload.pricing_mode).toBe("STANDARD");
      expect(payload.packets).toBeUndefined();
    });

    it("reveals a first blank packet row when multi-pricing is enabled", () => {
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
      expect(screen.queryByLabelText("Size")).toBeNull();
      fireEvent.click(screen.getByLabelText("Sell as packets and loose"));
      expect(screen.getByLabelText("Size")).toBeInTheDocument();
      expect(screen.getByLabelText("Packet price")).toBeInTheDocument();
    });

    it("posts the defined packet sizes", async () => {
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
      fillProduct();
      fireEvent.click(screen.getByLabelText("Sell as packets and loose"));
      fireEvent.change(screen.getByLabelText("Size"), { target: { value: "0.250" } });
      fireEvent.change(screen.getByLabelText("Packet price"), { target: { value: "3.50" } });
      fireEvent.click(screen.getByRole("button", { name: "Add packet size" }));
      const sizes = screen.getAllByLabelText("Size");
      const prices = screen.getAllByLabelText("Packet price");
      fireEvent.change(sizes[1], { target: { value: "1.000" } });
      fireEvent.change(prices[1], { target: { value: "13.00" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(productService.create).toHaveBeenCalledOnce());
      expect(vi.mocked(productService.create).mock.calls[0][0].packets).toEqual([
        { size: "0.250", price: "3.50" },
        { size: "1.000", price: "13.00" },
      ]);
    });

    it("blocks saving a multi-pricing product with no packet size", async () => {
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
      fillProduct();
      fireEvent.click(screen.getByLabelText("Sell as packets and loose"));
      fireEvent.click(screen.getByRole("button", { name: /Remove packet size/ }));
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("at least one packet size");
      expect(productService.create).not.toHaveBeenCalled();
    });

    it("blocks a duplicate packet size before it reaches the server", async () => {
      render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
      fillProduct();
      fireEvent.click(screen.getByLabelText("Sell as packets and loose"));
      fireEvent.change(screen.getByLabelText("Size"), { target: { value: "0.500" } });
      fireEvent.change(screen.getByLabelText("Packet price"), { target: { value: "2.75" } });
      fireEvent.click(screen.getByRole("button", { name: "Add packet size" }));
      const sizes = screen.getAllByLabelText("Size");
      const prices = screen.getAllByLabelText("Packet price");
      fireEvent.change(sizes[1], { target: { value: "0.500" } });
      fireEvent.change(prices[1], { target: { value: "3.00" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("only be defined once");
      expect(productService.create).not.toHaveBeenCalled();
    });

    it("loads an existing product's packets for editing", () => {
      render(<ProductDialog open onOpenChange={vi.fn()} product={multi} categories={[]} onSaved={vi.fn()} />);
      expect(screen.getByLabelText("Sell as packets and loose")).toBeChecked();
      expect(screen.getByLabelText("Size")).toHaveValue("0.250");
      expect(screen.getByLabelText("Packet price")).toHaveValue("3.50");
    });

    it("posts STANDARD when multi-pricing is switched back off", async () => {
      vi.mocked(productService.update).mockResolvedValue({ success: true, message: "", data: created });
      render(<ProductDialog open onOpenChange={vi.fn()} product={multi} categories={[]} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByLabelText("Sell as packets and loose"));
      fireEvent.click(screen.getByRole("button", { name: "Save Product" }));
      await waitFor(() => expect(productService.update).toHaveBeenCalledOnce());
      expect(vi.mocked(productService.update).mock.calls[0][1].pricing_mode).toBe("STANDARD");
    });
  });

  it("scanner Enter in optional barcode does not submit the form", () => {
    render(<ProductDialog open onOpenChange={vi.fn()} product={null} categories={[]} onSaved={vi.fn()} />);
    fillProduct();
    fireEvent.keyDown(screen.getByLabelText("Barcode (optional)"), { key: "Enter" });
    expect(productService.create).not.toHaveBeenCalled();
  });
});
