import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";

import { dashboardService } from "./dashboard.service";

vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);

describe("dashboard service", () => {
  beforeEach(() => request.mockReset());

  it("uses the consolidated trailing-slash endpoint and supported period", () => {
    dashboardService.get();
    expect(request).toHaveBeenLastCalledWith("/dashboard/?period=today");
    dashboardService.get("7d");
    expect(request).toHaveBeenLastCalledWith("/dashboard/?period=7d");
  });
});
