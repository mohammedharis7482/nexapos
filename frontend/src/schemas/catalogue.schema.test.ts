import { describe, expect, it } from "vitest";

import { categorySchema } from "./category.schema";
import { productSchema } from "./product.schema";
import { shopSettingsSchema } from "./shop.schema";

describe("catalogue schemas", () => {
  it("validates Qatar shop settings", () => {
    const valid = {
      name: "Al Noor Grocery",
      legal_name: "",
      phone: "+974 5555 0101",
      email: "",
      address: "Doha",
      city: "Doha",
      country: "Qatar",
      currency: "QAR",
      timezone: "Asia/Qatar",
      primary_language: "ENGLISH",
      secondary_language: "",
      tax_registration_number: "",
      default_tax_rate: "0.00",
      receipt_footer: "",
    };
    expect(shopSettingsSchema.safeParse(valid).success).toBe(true);
    expect(
      shopSettingsSchema.safeParse({ ...valid, currency: "USD" }).success,
    ).toBe(false);
  });

  it("requires a trimmed category name and nonnegative order", () => {
    expect(
      categorySchema.safeParse({
        name: " ",
        description: "",
        display_order: -1,
        is_active: true,
      }).success,
    ).toBe(false);
  });

  it("preserves decimal prices as validated strings", () => {
    const parsed = productSchema.parse({
      secondary_name: "",
      name: "Milk",
      description: "",
      sku: "MILK-001",
      barcode: "",
      unit: "BOTTLE",
      purchase_price: "5.25",
      selling_price: "6.50",
      tax_rate: "0.00",
      is_tax_inclusive: false,
      is_active: true,
      category_id: "",
    });
    expect(parsed.purchase_price).toBe("5.25");
    expect(parsed.selling_price).toBe("6.50");
    expect(
      productSchema.safeParse({ ...parsed, selling_price: "-1.00" }).success,
    ).toBe(false);
  });
});
