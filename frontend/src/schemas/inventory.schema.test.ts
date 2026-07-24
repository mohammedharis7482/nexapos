import { describe, expect, it } from "vitest";

import {
  adjustmentSchema,
  openingStockSchema,
  positiveQuantity,
  unsignedQuantity,
} from "./inventory.schema";

describe("inventory schemas", () => {
  it("accepts decimal quantities with up to three places", () => {
    expect(unsignedQuantity.parse("15.500")).toBe("15.500");
    expect(unsignedQuantity.safeParse("1.2345").success).toBe(false);
    expect(unsignedQuantity.safeParse("-1.000").success).toBe(false);
  });

  it("allows zero opening stock but rejects invalid thresholds", () => {
    expect(
      openingStockSchema.safeParse({
        quantity: "0.000",
        low_stock_threshold: "10.000",
        reason: "",
      }).success,
    ).toBe(true);
    expect(
      openingStockSchema.safeParse({
        quantity: "1.000",
        low_stock_threshold: "-1.000",
        reason: "",
      }).success,
    ).toBe(false);
  });

  it("requires a positive unsigned adjustment quantity", () => {
    expect(positiveQuantity.safeParse("0.000").success).toBe(false);
    expect(positiveQuantity.safeParse("-2.000").success).toBe(false);
    const parsed = adjustmentSchema.parse({
      movement_type: "DAMAGE",
      quantity: "2.250",
      reason: "Damaged pack",
      reference: "",
    });
    expect(parsed.quantity).toBe("2.250");
  });
});
