import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InventoryItem } from "@/types/inventory";

import { PricingPanel } from "./pricing-panel";

const rice: InventoryItem = {
  product: {
    id: "rice-id",
    name: "Basmati Rice",
    sku: "RICE-001",
    barcode: null,
    unit: "KG",
    selling_price: "12.00",
    category: null,
    is_active: true,
    image_url: null,
    pricing_mode: "MULTI",
    packets: [
      { id: "p250", size: "0.250", price: "3.50", display_order: 0, is_active: true },
      { id: "p1000", size: "1.000", price: "13.00", display_order: 1, is_active: true },
    ],
  },
  quantity_on_hand: "2.000",
  low_stock_threshold: "0.500",
  stock_status: "IN_STOCK",
  last_movement_at: null,
  is_initialized: true,
};

function renderPanel(item: InventoryItem = rice) {
  const onAdd = vi.fn();
  const onCancel = vi.fn();
  render(<PricingPanel item={item} busy={false} onAdd={onAdd} onCancel={onCancel} />);
  return { onAdd, onCancel };
}

describe("PricingPanel", () => {
  it("defaults to the first packet and adds it as a packet sale", () => {
    const { onAdd } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(onAdd).toHaveBeenCalledWith({
      pricing_mode: "PACKET",
      packet_id: "p250",
      quantity: "1",
    });
  });

  it("offers every packet size as a quick one-press choice", () => {
    renderPanel();
    const sizes = screen.getByRole("group", { name: "Packet size" });
    const options = Array.from(sizes.querySelectorAll("button"));
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(options[1]);
    expect(options[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("switches to a different packet size without extra clicks", () => {
    const { onAdd } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /1 kg/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(onAdd).toHaveBeenCalledWith({
      pricing_mode: "PACKET",
      packet_id: "p1000",
      quantity: "1",
    });
  });

  it("adds a loose weight after switching mode", () => {
    const { onAdd } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Loose" }));
    const weight = screen.getByLabelText("Weight in kg");
    fireEvent.change(weight, { target: { value: "0.750" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(onAdd).toHaveBeenCalledWith({ pricing_mode: "LOOSE", quantity: "0.750" });
  });

  it("selects the weight on focus, matching the cart's quantity field", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Loose" }));
    const weight = screen.getByLabelText("Weight in kg") as HTMLInputElement;
    fireEvent.change(weight, { target: { value: "1.250" } });
    const select = vi.spyOn(weight, "select");
    fireEvent.focus(weight);
    expect(select).toHaveBeenCalled();
  });

  it("rejects a loose weight beyond the shared pool before calling the API", () => {
    const { onAdd } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Loose" }));
    fireEvent.change(screen.getByLabelText("Weight in kg"), { target: { value: "2.500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only 2.000 kg in stock.");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("rejects a packet count whose total exceeds the shared pool", () => {
    const { onAdd } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /1 kg/ }));
    fireEvent.change(screen.getByLabelText("Packets"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only 2.000 kg in stock.");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("rejects a fractional packet count", () => {
    const { onAdd } = renderPanel();
    fireEvent.change(screen.getByLabelText("Packets"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(screen.getByRole("alert")).toHaveTextContent("whole numbers");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("rejects an empty loose weight", () => {
    const { onAdd } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Loose" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(screen.getByRole("alert")).toHaveTextContent("greater than zero");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows the stock a packet selection would consume", () => {
    renderPanel();
    // 4 x the 0.25 kg default packet draws 1 kg from the shared pool.
    fireEvent.change(screen.getByLabelText("Packets"), { target: { value: "4" } });
    const preview = screen.getByLabelText("Packets").closest("div")!;
    expect(preview).toHaveTextContent("= 1 kg");
  });

  it("submits on Enter and cancels on Escape", () => {
    const { onAdd, onCancel } = renderPanel();
    const panel = screen.getByRole("group", { name: /Choose how to sell/ });
    fireEvent.keyDown(panel, { key: "Enter" });
    expect(onAdd).toHaveBeenCalled();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("falls back to loose-only when a product has no packets left", () => {
    const { onAdd } = renderPanel({
      ...rice,
      product: { ...rice.product, packets: [] },
    });
    expect(screen.queryByRole("button", { name: "Packet" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Weight in kg"), { target: { value: "0.500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
    expect(onAdd).toHaveBeenCalledWith({ pricing_mode: "LOOSE", quantity: "0.500" });
  });
});
