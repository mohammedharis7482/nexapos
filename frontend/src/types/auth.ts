export type UserRole = "OWNER" | "CASHIER";

export interface ShopSummary {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface AuthenticatedUser {
  id: string;
  full_name: string;
  username: string;
  role: UserRole;
  shop: ShopSummary;
}

export interface LoginRequest {
  shop_id: string;
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: Record<string, string[] | string> | { detail?: string };
}

export type LoginResponse = ApiSuccess<{ user: AuthenticatedUser }>;
export type CurrentUserResponse = LoginResponse;
export type EmptySuccessResponse = ApiSuccess<null>;
