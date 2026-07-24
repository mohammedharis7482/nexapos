import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type { DraftCreator } from "@/types/billing";
import type {
  CompletedSale,
  ReceiptData,
  SaleHistoryItem,
  SalesListFilters,
} from "@/types/sales";

export function salesListPath(filters: SalesListFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return `/sales/${query ? `?${query}` : ""}`;
}

export const salesService = {
  list(filters: SalesListFilters = {}) {
    return apiRequest<PaginatedResponse<SaleHistoryItem>>(
      salesListPath(filters),
    );
  },
  detail(saleId: string) {
    return apiRequest<ApiSuccess<CompletedSale>>(`/sales/${saleId}/`);
  },
  receipt(saleId: string) {
    return apiRequest<ApiSuccess<ReceiptData>>(`/sales/${saleId}/receipt/`);
  },
  cashiers() {
    return apiRequest<ApiSuccess<DraftCreator[]>>("/sales/cashiers/");
  },
};
