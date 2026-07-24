import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";

import { reportsPath, reportsService } from "./reports.service";

vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);

describe("reports service", () => {
  beforeEach(() => request.mockReset());

  it("builds the exact consolidated report URL with shared filters", () => {
    const filters = {
      date_from: "2026-07-01",
      date_to: "2026-07-24",
      cashier: "cashier-id",
      category: "category-id",
      payment_method: "CARD" as const,
    };
    expect(reportsPath(filters)).toBe(
      "/reports/?date_from=2026-07-01&date_to=2026-07-24&cashier=cashier-id&category=category-id&payment_method=CARD",
    );
    reportsService.get(filters);
    expect(request).toHaveBeenCalledWith(reportsPath(filters));
  });
});
