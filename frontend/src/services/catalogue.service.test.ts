import { describe, expect, it } from "vitest";

import {
  CATEGORY_ENDPOINT,
  categoryListPath,
} from "./category.service";
import { PRODUCT_ENDPOINT, productListPath } from "./product.service";
import { SHOP_SETTINGS_ENDPOINT } from "./shop.service";

describe("catalogue service URLs", () => {
  it("uses exact trailing-slash API routes", () => {
    expect(SHOP_SETTINGS_ENDPOINT).toBe("/shop/settings/");
    expect(CATEGORY_ENDPOINT).toBe("/categories/");
    expect(PRODUCT_ENDPOINT).toBe("/products/");
  });

  it("builds category and product filters without changing endpoint slashes", () => {
    expect(categoryListPath("dairy", "true")).toBe(
      "/categories/?search=dairy&is_active=true",
    );
    expect(
      productListPath({
        search: "milk",
        category: "category-id",
        unit: "BOTTLE",
        is_active: "true",
        page: 2,
      }),
    ).toBe(
      "/products/?search=milk&category=category-id&unit=BOTTLE&is_active=true&page=2",
    );
  });
});
