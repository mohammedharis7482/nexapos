import { describe, expect, it } from "vitest";

import { packetLabel, packetStockDraw, saleItemDescription, saleItemModeLabel } from "./pricing";
import type { SaleItem } from "@/types/billing";

function line(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: "item-id",
    product: {
      secondary_name: "",
      id: "product-id",
      name: "Basmati Rice",
      sku: "RICE-001",
      barcode: null,
      unit: "KG",
      image_url: null,
    },
    pricing_mode: "STANDARD",
    packet_size: null,
    quantity: "1.000",
    stock_quantity: "1.000",
    unit_price: "12.00",
    tax_rate: "0.00",
    is_tax_inclusive: false,
    tax_amount: "0.00",
    line_subtotal: "12.00",
    line_total: "12.00",
    ...overrides,
  };
}

describe("packetLabel", () => {
  it("renders the size in the product's own unit", () => {
    expect(packetLabel("0.250", "KG")).toBe("0.25 kg");
    expect(packetLabel("1.000", "KG")).toBe("1 kg");
    expect(packetLabel("500.000", "GRAM")).toBe("500 gram");
  });
});

describe("saleItemModeLabel", () => {
  it("labels a packet line from its own snapshot", () => {
    expect(
      saleItemModeLabel(line({ pricing_mode: "PACKET", packet_size: "0.500" })),
    ).toBe("0.5 kg packet");
  });

  it("labels a loose line", () => {
    expect(saleItemModeLabel(line({ pricing_mode: "LOOSE" }))).toBe("loose");
  });

  it("leaves a standard line unlabelled", () => {
    expect(saleItemModeLabel(line())).toBeNull();
  });

  it("falls back to no label if a packet line somehow lost its size", () => {
    expect(saleItemModeLabel(line({ pricing_mode: "PACKET" }))).toBeNull();
  });
});

describe("saleItemDescription", () => {
  it("distinguishes packet from loose unambiguously", () => {
    expect(
      saleItemDescription(
        line({ pricing_mode: "PACKET", packet_size: "0.500", quantity: "2.000" }),
      ),
    ).toBe("Basmati Rice (0.5 kg packet)");
    expect(
      saleItemDescription(line({ pricing_mode: "LOOSE", quantity: "0.750" })),
    ).toBe("Basmati Rice - 0.75 kg loose");
    expect(saleItemDescription(line())).toBe("Basmati Rice");
  });
});

describe("packetStockDraw", () => {
  it("multiplies packet count by size, mirroring the server", () => {
    const packet = {
      id: "p", size: "0.250", price: "3.50", display_order: 0, is_active: true,
    };
    expect(packetStockDraw(packet, "2")).toBeCloseTo(0.5);
    expect(packetStockDraw(packet, "4")).toBeCloseTo(1);
    expect(packetStockDraw(packet, "")).toBeNaN();
    expect(packetStockDraw(packet, "abc")).toBeNaN();
  });
});
