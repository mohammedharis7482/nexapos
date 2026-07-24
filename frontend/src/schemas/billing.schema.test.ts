import { describe, expect, it } from "vitest";

import {
  addDraftItemSchema,
  billingQuantity,
  updateDraftItemSchema,
} from "./billing.schema";

describe("billing schemas", () => {
  it("accepts positive decimal quantities with three places", () => {
    expect(billingQuantity.parse("1.250")).toBe("1.250");
    expect(billingQuantity.safeParse("0.000").success).toBe(false);
    expect(billingQuantity.safeParse("-1.000").success).toBe(false);
    expect(billingQuantity.safeParse("1.0001").success).toBe(false);
  });

  it("requires exactly one product identity", () => {
    expect(
      addDraftItemSchema.safeParse({
        product_id: "f63de640-e3c2-4db2-92cf-6fe292e94394",
        quantity: "1.000",
      }).success,
    ).toBe(true);
    expect(
      addDraftItemSchema.safeParse({
        product_id: "f63de640-e3c2-4db2-92cf-6fe292e94394",
        barcode: "123",
        quantity: "1.000",
      }).success,
    ).toBe(false);
    expect(updateDraftItemSchema.safeParse({ quantity: "0" }).success).toBe(false);
  });
});
