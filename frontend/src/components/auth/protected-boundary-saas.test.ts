import { describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "@/types/auth";

import { resolveSaasRoute } from "./protected-boundary";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user",
    full_name: "Owner",
    username: "owner",
    role: "OWNER",
    is_primary_owner: true,
    shop: {
      id: "shop",
      name: "Shop",
      currency: "QAR",
      timezone: "Asia/Qatar",
      status: "ACTIVE",
      onboarding_completed: true,
    },
    ...overrides,
  };
}

describe("SaaS lifecycle route guards", () => {
  it("routes an onboarding primary owner to setup without looping", () => {
    const onboarding = user({
      shop: { ...user().shop, status: "ONBOARDING", onboarding_completed: false },
    });
    expect(resolveSaasRoute(onboarding, "/dashboard")).toBe("/onboarding");
    expect(resolveSaasRoute(onboarding, "/onboarding")).toBeNull();
  });

  it("requires temporary-password users to change it before business routes", () => {
    const temporary = user({ must_change_password: true });
    expect(resolveSaasRoute(temporary, "/dashboard")).toBe(
      "/account/change-password",
    );
    expect(resolveSaasRoute(temporary, "/account/change-password")).toBeNull();
  });

  it("restricts suspended users to safe account routes", () => {
    const suspended = user({ shop: { ...user().shop, status: "SUSPENDED" } });
    expect(resolveSaasRoute(suspended, "/billing")).toBe("/settings/subscription");
    expect(resolveSaasRoute(suspended, "/settings/subscription")).toBeNull();
  });

  it("keeps cashier users out of team and subscription routes", () => {
    const cashier = user({ role: "CASHIER", is_primary_owner: false });
    expect(resolveSaasRoute(cashier, "/team")).toBe("/dashboard");
    expect(resolveSaasRoute(cashier, "/settings/team")).toBe("/dashboard");
    expect(resolveSaasRoute(cashier, "/settings/data")).toBe("/dashboard");
    expect(resolveSaasRoute(cashier, "/settings/subscription")).toBe("/dashboard");
  });
});
