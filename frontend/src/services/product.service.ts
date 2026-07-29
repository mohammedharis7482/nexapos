import { apiDownload, apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type {
  DuplicateStrategy,
  Product,
  ProductFilters,
  ProductImport,
  ProductImportDetail,
  ProductInput,
} from "@/types/product";

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
  downloadImportTemplate() {
    return apiDownload("/products/import-template/");
  },
  uploadImport(file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<ApiSuccess<ProductImport>>("/products/imports/", {
      method: "POST",
      body,
    });
  },
  importDetail(
    id: string,
    filters: {
      page?: number;
      severity?: "all" | "error" | "warning";
      column?: string;
      search?: string;
    } = {},
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const query = params.toString();
    return apiRequest<ApiSuccess<ProductImportDetail>>(
      `/products/imports/${id}/${query ? `?${query}` : ""}`,
    );
  },
  importHistory(page = 1) {
    return apiRequest<PaginatedResponse<ProductImport>>(
      `/products/imports/?page=${page}`,
    );
  },
  confirmImport(id: string, duplicateStrategy: DuplicateStrategy) {
    return apiRequest<ApiSuccess<ProductImport>>(
      `/products/imports/${id}/confirm/`,
      {
        method: "POST",
        body: JSON.stringify({
          duplicate_strategy: duplicateStrategy,
          confirmed: true,
        }),
        timeoutMs: 300_000,
      },
    );
  },
  downloadImportErrors(id: string) {
    return apiDownload(`/products/imports/${id}/errors/`);
  },
};
