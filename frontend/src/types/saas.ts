import type { ApiSuccess, UserRole } from "@/types/auth";

export interface RegistrationResult {
  shop: PublicShopIdentity;
  owner: { username: string };
  verification_required: boolean;
  owner_email: string;
  registration_status: "PENDING_VERIFICATION" | "ONBOARDING";
  email_delivery:
    | "NOT_REQUIRED"
    | "DEVELOPMENT_CONSOLE"
    | "EMAIL_SENT"
    | "EMAIL_DELIVERY_FAILED";
  next_step: "SIGN_IN" | "VERIFY_EMAIL";
}

export interface PublicShopIdentity {
  id: string;
  name: string;
}

export interface VerificationResult {
  shop: PublicShopIdentity;
}

export interface ManagedUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  is_primary_owner: boolean;
  is_active: boolean;
  must_change_password: boolean;
  status: "ACTIVE" | "INACTIVE" | "PASSWORD_CHANGE_REQUIRED";
  last_login: string | null;
  date_joined: string;
  created_at: string;
  created_by_name: string | null;
  available_actions: Array<"edit" | "change_role" | "reset_password" | "activate" | "deactivate">;
}

export interface Usage {
  active_users: number;
  max_users: number;
  active_products: number;
  max_products: number;
}

export interface Invitation {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  invited_by_name: string;
  expires_at: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  created_at: string;
}

export interface Plan {
  code: string;
  name: string;
  description: string;
  monthly_price: string;
  yearly_price: string;
  currency: string;
  trial_days: number;
  max_users: number;
  max_products: number;
  reports_enabled: boolean;
  advanced_reports_enabled: boolean;
}

export interface Subscription {
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  plan: Plan;
  usage: Usage;
  is_primary_owner: boolean;
}

export interface OnboardingState {
  current_step: number;
  completed_at: string | null;
  status: string;
  name: string;
  legal_name: string;
  address: string;
  city: string;
  phone: string;
  default_tax_rate: string;
  tax_registration_number: string;
  receipt_footer: string;
}

export type TeamResponse = ApiSuccess<{
  results: ManagedUser[];
  usage: Usage;
  count: number;
  next: string | null;
  previous: string | null;
}>;
export interface StaffCreateRequest {
  full_name: string;
  username: string;
  email?: string;
  role: UserRole;
  temporary_password: string;
  temporary_password_confirm: string;
}
export type InvitationsResponse = ApiSuccess<Invitation[]>;
export type SubscriptionResponse = ApiSuccess<Subscription>;
export type OnboardingResponse = ApiSuccess<OnboardingState>;
