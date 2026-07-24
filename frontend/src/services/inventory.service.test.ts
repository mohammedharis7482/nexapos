import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";

import { inventoryListPath, inventoryService } from "./inventory.service";

vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);

describe("inventory service", () => {
  beforeEach(() => request.mockReset());

  it("builds exact trailing-slash inventory URLs", () => {
    expect(
      inventoryListPath({
        search: "milk",
        stock_status: "LOW_STOCK",
        page: 2,
      }),
    ).toBe("/inventory/?search=milk&stock_status=LOW_STOCK&page=2");
    inventoryService.detail("product-id");
    expect(request).toHaveBeenLastCalledWith("/inventory/product-id/");
    inventoryService.movements("product-id", 3);
    expect(request).toHaveBeenLastCalledWith(
      "/inventory/products/product-id/movements/?page=3",
    );
  });

  it("submits positive quantities without signing them in the frontend", () => {
    inventoryService.adjust("product-id", {
      movement_type: "STOCK_OUT",
      quantity: "2.000",
      reason: "Count correction",
      reference: "COUNT-1",
    });
    expect(request).toHaveBeenLastCalledWith(
      "/inventory/products/product-id/adjust/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"quantity":"2.000"'),
      }),
    );
  });

  it("uses the opening, summary, and low-stock endpoints", () => {
    inventoryService.openingStock("product-id", {
      quantity: "0.000",
      low_stock_threshold: "2.000",
      reason: "",
    });
    expect(request).toHaveBeenLastCalledWith(
      "/inventory/products/product-id/opening-stock/",
      expect.objectContaining({ method: "POST" }),
    );
    inventoryService.summary();
    expect(request).toHaveBeenLastCalledWith("/inventory/summary/");
    inventoryService.lowStock();
    expect(request).toHaveBeenLastCalledWith("/inventory/low-stock/?page=1");
  });
});
