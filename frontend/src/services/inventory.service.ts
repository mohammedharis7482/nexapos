import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type {
  AdjustmentRequest,
  InventoryFilters,
  InventoryItem,
  InventoryOperationResult,
  InventorySummary,
  OpeningStockRequest,
  StockMovement,
} from "@/types/inventory";

export const INVENTORY_ENDPOINT = "/inventory/";

export function inventoryListPath(filters: InventoryFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return `${INVENTORY_ENDPOINT}${query ? `?${query}` : ""}`;
}

export const inventoryService = {
  list(filters: InventoryFilters = {}) {
    return apiRequest<PaginatedResponse<InventoryItem>>(
      inventoryListPath(filters),
    );
  },
  summary() {
    return apiRequest<ApiSuccess<InventorySummary>>("/inventory/summary/");
  },
  detail(productId: string) {
    return apiRequest<ApiSuccess<InventoryItem>>(`/inventory/${productId}/`);
  },
  updateThreshold(productId: string, lowStockThreshold: string) {
    return apiRequest<ApiSuccess<InventoryItem>>(`/inventory/${productId}/`, {
      method: "PATCH",
      body: JSON.stringify({ low_stock_threshold: lowStockThreshold }),
    });
  },
  openingStock(productId: string, payload: OpeningStockRequest) {
    return apiRequest<ApiSuccess<InventoryOperationResult>>(
      `/inventory/products/${productId}/opening-stock/`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  adjust(productId: string, payload: AdjustmentRequest) {
    return apiRequest<ApiSuccess<InventoryOperationResult>>(
      `/inventory/products/${productId}/adjust/`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  movements(productId: string, page = 1) {
    return apiRequest<PaginatedResponse<StockMovement>>(
      `/inventory/products/${productId}/movements/?page=${page}`,
    );
  },
  lowStock(page = 1) {
    return apiRequest<PaginatedResponse<InventoryItem>>(
      `/inventory/low-stock/?page=${page}`,
    );
  },
  outOfStock(page = 1) {
    return apiRequest<PaginatedResponse<InventoryItem>>(
      `/inventory/out-of-stock/?page=${page}`,
    );
  },
};
