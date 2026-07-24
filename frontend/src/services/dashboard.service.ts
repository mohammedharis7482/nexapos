import { apiRequest } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/auth";
import type { DashboardData } from "@/types/dashboard";

export const dashboardService = {
  get(period: "today" | "7d" = "today") {
    return apiRequest<ApiSuccess<DashboardData>>(
      `/dashboard/?period=${period}`,
    );
  },
};
