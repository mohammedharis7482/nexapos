import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";

import { salesListPath, salesService } from "./sales.service";

vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);

describe("sales service", () => {
  beforeEach(() => request.mockReset());

  it("builds history filters and exact trailing-slash URLs", () => {
    expect(
      salesListPath({
        search: "000001",
        payment_method: "CARD",
        page: 2,
      }),
    ).toBe("/sales/?search=000001&payment_method=CARD&page=2");
    salesService.detail("sale-id");
    expect(request).toHaveBeenLastCalledWith("/sales/sale-id/");
    salesService.receipt("sale-id");
    expect(request).toHaveBeenLastCalledWith("/sales/sale-id/receipt/");
    salesService.cashiers();
    expect(request).toHaveBeenLastCalledWith("/sales/cashiers/");
  });
});
