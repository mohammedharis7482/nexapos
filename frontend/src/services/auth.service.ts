import { apiRequest } from "@/lib/api-client";
import type {
  ChangePasswordRequest,
  CurrentUserResponse,
  EmptySuccessResponse,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";

export const AUTH_ENDPOINTS = {
  csrf: "/auth/csrf/",
  login: "/auth/login/",
  logout: "/auth/logout/",
  me: "/auth/me/",
  changePassword: "/auth/change-password/",
} as const;

export const authService = {
  login(payload: LoginRequest) {
    return apiRequest<LoginResponse>(AUTH_ENDPOINTS.login, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  me() {
    return apiRequest<CurrentUserResponse>(AUTH_ENDPOINTS.me);
  },
  logout() {
    return apiRequest<EmptySuccessResponse>(AUTH_ENDPOINTS.logout, {
      method: "POST",
    });
  },
  changePassword(payload: ChangePasswordRequest) {
    return apiRequest<EmptySuccessResponse>(AUTH_ENDPOINTS.changePassword, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
