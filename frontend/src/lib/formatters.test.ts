import { describe, expect, it } from "vitest";

import { formatDateTime, formatMoney, formatPercentage, formatQuantity } from "./formatters";

describe("design-system formatters", () => {
  it("formats QAR with two decimals and no truncation", () => {
    expect(formatMoney("843.5")).toMatch(/QAR.*843\.50|843\.50.*QAR/);
  });

  it("removes unnecessary quantity zeros while preserving precision", () => {
    expect(formatQuantity("12.000")).toBe("12");
    expect(formatQuantity("1.250")).toBe("1.25");
  });

  it("formats percentages predictably", () => {
    expect(formatPercentage("60")).toBe("60.0%");
  });

  it("formats valid dates and safely handles invalid values", () => {
    expect(formatDateTime("2026-07-24T09:00:00Z")).not.toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });
});
