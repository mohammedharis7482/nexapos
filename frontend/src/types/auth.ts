export type UserRole = "OWNER" | "CASHIER";

export interface ShopSummary {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status?:
    | "PENDING_VERIFICATION"
    | "ONBOARDING"
    | "TRIAL"
    | "ACTIVE"
    | "PAST_DUE"
    | "SUSPENDED"
    | "CANCELLED";
  onboarding_completed?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  full_name: string;
  username: string;
  email?: string;
  last_login?: string | null;
  role: UserRole;
  is_primary_owner?: boolean;
  shop: ShopSummary;
  subscription?: {
    status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
    plan_code: string;
    trial_ends_at: string | null;
  } | null;
  capabilities?: {
    manage_team: boolean;
    manage_owners: boolean;
    view_subscription: boolean;
    manage_subscription: boolean;
  };
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
