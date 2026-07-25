import { describe, expect, it } from "vitest";

import { formatDashboardSaleReference, formatDashboardSaleTime } from "./dashboard-formatters";

describe("dashboard formatters", () => {
  it("creates a stable short reference only for expected NexaPOS sale numbers", () => {
    expect(formatDashboardSaleReference("NXP-209D48-20260724-000008")).toBe("NXP-000008");
    expect(formatDashboardSaleReference("NXP-ABC-20260724-000001")).toBe("NXP-000001");
  });

  it("preserves unexpected and already-short references safely", () => {
    expect(formatDashboardSaleReference("SALE-42")).toBe("SALE-42");
    expect(formatDashboardSaleReference("NXP-000008")).toBe("NXP-000008");
    expect(formatDashboardSaleReference("")).toBe("—");
  });

  it("uses concise shop-local time for today and adds date for older sales", () => {
    const now = new Date("2026-07-25T12:00:00Z");
    expect(formatDashboardSaleTime("2026-07-25T08:48:00Z", "Asia/Qatar", now)).toMatch(/11:48 AM/);
    expect(formatDashboardSaleTime("2026-07-24T11:48:00Z", "Asia/Qatar", now)).toMatch(/Jul 24 · 2:48 PM/);
    expect(formatDashboardSaleTime("invalid", "Asia/Qatar", now)).toBe("—");
  });
});
