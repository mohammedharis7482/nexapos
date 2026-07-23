import { describe, expect, it } from "vitest";

import { changePasswordSchema, loginSchema } from "./auth.schema";

describe("authentication schemas", () => {
  it("validates the real login fields", () => {
    expect(
      loginSchema.safeParse({
        shop_id: "not-a-uuid",
        username: "",
        password: "",
        remember_shop: false,
      }).success,
    ).toBe(false);

    expect(
      loginSchema.safeParse({
        shop_id: "a2d6e62a-e2fa-455f-96bb-3a7fe471ed8a",
        username: "ahmed",
        password: "secure",
        remember_shop: true,
      }).success,
    ).toBe(true);
  });

  it("rejects weak or mismatched password changes", () => {
    expect(
      changePasswordSchema.safeParse({
        current_password: "current",
        new_password: "short",
        confirm_password: "different",
      }).success,
    ).toBe(false);
  });
});
