import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type {
  AddItemRequest,
  DraftSale,
  UpdateItemRequest,
} from "@/types/billing";

export const BILLING_DRAFTS_ENDPOINT = "/billing/drafts/";

export const billingService = {
  list(page = 1) {
    return apiRequest<PaginatedResponse<DraftSale>>(
      `${BILLING_DRAFTS_ENDPOINT}?page=${page}`,
    );
  },
  create(notes = "") {
    return apiRequest<ApiSuccess<DraftSale>>(BILLING_DRAFTS_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  },
  detail(saleId: string) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/`,
    );
  },
  addItem(saleId: string, payload: AddItemRequest) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/items/`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  updateItem(saleId: string, itemId: string, payload: UpdateItemRequest) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/items/${itemId}/`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  removeItem(saleId: string, itemId: string) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/items/${itemId}/`,
      { method: "DELETE" },
    );
  },
  cancel(saleId: string) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/cancel/`,
      { method: "POST" },
    );
  },
};
