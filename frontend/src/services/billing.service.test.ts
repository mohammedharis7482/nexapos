import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";

import { billingService } from "./billing.service";

vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);

describe("billing service", () => {
  beforeEach(() => request.mockReset());

  it("uses exact trailing-slash draft URLs", () => {
    billingService.create();
    expect(request).toHaveBeenLastCalledWith(
      "/billing/drafts/",
      expect.objectContaining({ method: "POST" }),
    );
    billingService.detail("sale-id");
    expect(request).toHaveBeenLastCalledWith("/billing/drafts/sale-id/");
    billingService.cancel("sale-id");
    expect(request).toHaveBeenLastCalledWith(
      "/billing/drafts/sale-id/cancel/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends only product identity and positive quantity for additions", () => {
    billingService.addItem("sale-id", {
      barcode: "6281007023412",
      quantity: "1.000",
    });
    expect(request).toHaveBeenLastCalledWith(
      "/billing/drafts/sale-id/items/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          barcode: "6281007023412",
          quantity: "1.000",
        }),
      }),
    );
  });

  it("uses exact update and remove line URLs", () => {
    billingService.updateItem("sale-id", "item-id", { quantity: "2.500" });
    expect(request).toHaveBeenLastCalledWith(
      "/billing/drafts/sale-id/items/item-id/",
      expect.objectContaining({ method: "PATCH" }),
    );
    billingService.removeItem("sale-id", "item-id");
    expect(request).toHaveBeenLastCalledWith(
      "/billing/drafts/sale-id/items/item-id/",
      { method: "DELETE" },
    );
  });
});
