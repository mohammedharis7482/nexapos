import { apiRequest } from "@/lib/api-client";
import type { ApiSuccess, EmptySuccessResponse } from "@/types/auth";
import type {
  Invitation,
  InvitationsResponse,
  OnboardingResponse,
  Plan,
  RegistrationResult,
  SubscriptionResponse,
  TeamResponse,
} from "@/types/saas";

export const SAAS_ENDPOINTS = {
  register: "/saas/register/",
  verifyEmail: "/auth/email-verification/verify/",
  resendVerification: "/auth/email-verification/resend/",
  requestPasswordReset: "/auth/password-reset/request/",
  confirmPasswordReset: "/auth/password-reset/confirm/",
  invitationAccept: "/invitations/accept/",
  users: "/users/",
  invitations: "/users/invitations/",
  onboarding: "/saas/onboarding/",
  onboardingComplete: "/saas/onboarding/complete/",
  subscription: "/saas/subscription/",
  plans: "/saas/plans/",
} as const;

export const saasService = {
  register(payload: Record<string, string>) {
    return apiRequest<ApiSuccess<RegistrationResult>>(
      SAAS_ENDPOINTS.register,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  verifyEmail(token: string) {
    return apiRequest<EmptySuccessResponse>(SAAS_ENDPOINTS.verifyEmail, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  resendVerification(email: string) {
    return apiRequest<EmptySuccessResponse>(SAAS_ENDPOINTS.resendVerification, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  requestPasswordReset(email: string) {
    return apiRequest<EmptySuccessResponse>(SAAS_ENDPOINTS.requestPasswordReset, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  confirmPasswordReset(payload: Record<string, string>) {
    return apiRequest<EmptySuccessResponse>(SAAS_ENDPOINTS.confirmPasswordReset, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  invitation(token: string) {
    return apiRequest<ApiSuccess<{
      shop_name: string;
      email: string;
      role: string;
      inviter_name: string;
      expires_at: string;
    }>>(`${SAAS_ENDPOINTS.invitationAccept}?token=${encodeURIComponent(token)}`);
  },
  acceptInvitation(payload: Record<string, string>) {
    return apiRequest<ApiSuccess<{ shop_id: string }>>(SAAS_ENDPOINTS.invitationAccept, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  users() {
    return apiRequest<TeamResponse>(SAAS_ENDPOINTS.users);
  },
  updateUser(id: string, payload: Record<string, string>) {
    return apiRequest<ApiSuccess<unknown>>(`/users/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  userAction(id: string, action: "activate" | "deactivate", payload?: never) {
    return apiRequest<ApiSuccess<unknown>>(`/users/${id}/${action}/`, {
      method: "POST",
      body: payload,
    });
  },
  changeRole(id: string, role: string) {
    return apiRequest<ApiSuccess<unknown>>(`/users/${id}/change-role/`, {
      method: "POST",
      body: JSON.stringify({ role }),
    });
  },
  invitations() {
    return apiRequest<InvitationsResponse>(SAAS_ENDPOINTS.invitations);
  },
  invite(payload: { email: string; role: string; full_name?: string }) {
    return apiRequest<ApiSuccess<Invitation>>(SAAS_ENDPOINTS.invitations, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  invitationAction(id: string, action: "resend" | "revoke") {
    return apiRequest<ApiSuccess<Invitation>>(
      `/users/invitations/${id}/${action}/`,
      { method: "POST" },
    );
  },
  onboarding() {
    return apiRequest<OnboardingResponse>(SAAS_ENDPOINTS.onboarding);
  },
  saveOnboarding(payload: Record<string, string | number>) {
    return apiRequest<OnboardingResponse>(SAAS_ENDPOINTS.onboarding, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  completeOnboarding() {
    return apiRequest<ApiSuccess<{ status: string; completed_at: string }>>(
      SAAS_ENDPOINTS.onboardingComplete,
      { method: "POST" },
    );
  },
  subscription() {
    return apiRequest<SubscriptionResponse>(SAAS_ENDPOINTS.subscription);
  },
  plans() {
    return apiRequest<ApiSuccess<Plan[]>>(SAAS_ENDPOINTS.plans);
  },
};
