import { apiRequest } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/auth";
import type { CashierShift, CurrentShiftResponse } from "@/types/shift";
import type { PaginatedResponse } from "@/types/api";

export const SHIFT_ENDPOINTS = {
  current: "/shifts/current/",
  open: "/shifts/open/",
  list: "/shifts/",
} as const;

export const shiftService = {
  current() {
    return apiRequest<CurrentShiftResponse>(SHIFT_ENDPOINTS.current);
  },
  open(openingCash: string, openingNote = "") {
    return apiRequest<ApiSuccess<CashierShift>>(SHIFT_ENDPOINTS.open, {
      method: "POST",
      body: JSON.stringify({ opening_cash: openingCash, opening_note: openingNote }),
    });
  },
  close(id: string, countedCash: string, closingNote = "") {
    return apiRequest<ApiSuccess<CashierShift>>(`/shifts/${id}/close/`, {
      method: "POST",
      body: JSON.stringify({
        counted_closing_cash: countedCash,
        closing_note: closingNote,
      }),
    });
  },
  list() {
    return apiRequest<PaginatedResponse<CashierShift>>(SHIFT_ENDPOINTS.list);
  },
};
