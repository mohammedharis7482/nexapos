import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type { Product, ProductFilters, ProductInput } from "@/types/product";

export const PRODUCT_ENDPOINT = "/products/";

export function productListPath(filters: ProductFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return `${PRODUCT_ENDPOINT}${query ? `?${query}` : ""}`;
}

export const productService = {
  list(filters: ProductFilters = {}) {
    return apiRequest<PaginatedResponse<Product>>(productListPath(filters));
  },
  create(payload: ProductInput) {
    return apiRequest<ApiSuccess<Product>>(PRODUCT_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(id: string, payload: Partial<ProductInput>) {
    return apiRequest<ApiSuccess<Product>>(`/products/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  barcode(barcode: string) {
    return apiRequest<ApiSuccess<Product>>(
      `/products/barcode/${encodeURIComponent(barcode)}/`,
    );
  },
};
