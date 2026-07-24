import { apiRequest } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/auth";
import type { ReportFilters, ReportsData } from "@/types/reports";

export function reportsPath(filters: ReportFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `/reports/?${params.toString()}`;
}

export const reportsService = {
  get(filters: ReportFilters) {
    return apiRequest<ApiSuccess<ReportsData>>(reportsPath(filters));
  },
};
