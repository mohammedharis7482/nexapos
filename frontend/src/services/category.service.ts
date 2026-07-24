import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type { CategoryInput, ProductCategory } from "@/types/category";

export const CATEGORY_ENDPOINT = "/categories/";

export function categoryListPath(search = "", isActive = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (isActive) params.set("is_active", isActive);
  const query = params.toString();
  return `${CATEGORY_ENDPOINT}${query ? `?${query}` : ""}`;
}

export const categoryService = {
  list(search = "", isActive = "") {
    return apiRequest<PaginatedResponse<ProductCategory>>(
      categoryListPath(search, isActive),
    );
  },
  create(payload: CategoryInput) {
    return apiRequest<ApiSuccess<ProductCategory>>(CATEGORY_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(id: string, payload: Partial<CategoryInput>) {
    return apiRequest<ApiSuccess<ProductCategory>>(`/categories/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};
