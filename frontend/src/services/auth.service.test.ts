import { describe, expect, it } from "vitest";

import { AUTH_ENDPOINTS } from "./auth.service";

describe("authentication endpoint contract", () => {
  it("uses the exact trailing-slash Django routes", () => {
    expect(AUTH_ENDPOINTS).toEqual({
      csrf: "/auth/csrf/",
      login: "/auth/login/",
      logout: "/auth/logout/",
      me: "/auth/me/",
      changePassword: "/auth/change-password/",
    });
  });
});
