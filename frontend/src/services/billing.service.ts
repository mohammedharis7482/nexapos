import { apiRequest } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type { ApiSuccess } from "@/types/auth";
import type {
  AddItemRequest,
  DraftSale,
  UpdateDiscountRequest,
  UpdateItemRequest,
} from "@/types/billing";
import type { CompleteSaleRequest } from "@/types/payment";
import type { CompletedSale } from "@/types/sales";

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
  setDiscount(saleId: string, payload: UpdateDiscountRequest) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/discount/`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
  },
  cancel(saleId: string) {
    return apiRequest<ApiSuccess<DraftSale>>(
      `/billing/drafts/${saleId}/cancel/`,
      { method: "POST" },
    );
  },
  hold(saleId: string, note = "") {
    return apiRequest<ApiSuccess<DraftSale>>(`/billing/drafts/${saleId}/hold/`, {
      method: "POST", body: JSON.stringify({ note }),
    });
  },
  resume(saleId: string) {
    return apiRequest<ApiSuccess<DraftSale>>(`/billing/drafts/${saleId}/resume/`, {
      method: "POST",
    });
  },
  complete(saleId: string, payload: CompleteSaleRequest) {
    return apiRequest<ApiSuccess<CompletedSale>>(
      `/billing/drafts/${saleId}/complete/`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
};
