import { describe, expect, it } from "vitest";

import { SAAS_ENDPOINTS } from "./saas.service";

describe("SaaS endpoint contract", () => {
  it("uses exact trailing-slash routes", () => {
    expect(SAAS_ENDPOINTS).toEqual({
      register: "/saas/register/",
      verifyEmail: "/auth/email-verification/verify/",
      resendVerification: "/auth/email-verification/resend/",
      requestPasswordReset: "/auth/password-reset/request/",
      confirmPasswordReset: "/auth/password-reset/confirm/",
      invitationAccept: "/invitations/accept/",
      users: "/team/users/",
      invitations: "/users/invitations/",
      onboarding: "/saas/onboarding/",
      onboardingComplete: "/saas/onboarding/complete/",
      subscription: "/saas/subscription/",
      plans: "/saas/plans/",
    });
  });
});
