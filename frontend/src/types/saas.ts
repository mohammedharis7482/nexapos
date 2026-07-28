import type { ApiSuccess, UserRole } from "@/types/auth";

export interface RegistrationResult {
  shop: PublicShopIdentity;
  verification_required: true;
  owner_email: string;
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
  status: "ACTIVE" | "INACTIVE";
  last_login: string | null;
  date_joined: string;
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

export type TeamResponse = ApiSuccess<{ results: ManagedUser[]; usage: Usage }>;
export type InvitationsResponse = ApiSuccess<Invitation[]>;
export type SubscriptionResponse = ApiSuccess<Subscription>;
export type OnboardingResponse = ApiSuccess<OnboardingState>;
