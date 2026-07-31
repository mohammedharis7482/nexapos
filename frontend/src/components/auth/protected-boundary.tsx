"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppLoading, ErrorState } from "@/components/ui/feedback";
import { useAuth, type AuthStatus } from "@/providers/auth-provider";
import type { AuthenticatedUser } from "@/types/auth";

export function resolveProtectedState(status: AuthStatus) {
  if (status === "loading") return "loading";
  if (status === "unauthenticated") return "redirect";
  return "content";
}

// The onboarding screen explicitly invites the owner to complete catalogue
// and team setup "in their full workspaces" — these routes must stay
// reachable while onboarding is in progress, matching that promise and the
// backend's tenant_access_allowed(), which already treats ONBOARDING as a
// fully write-eligible shop lifecycle state.
const ONBOARDING_ACCESSIBLE_ROUTES = ["/products", "/inventory", "/team", "/settings/team"];

function isOnboardingAccessibleRoute(pathname: string) {
  return ONBOARDING_ACCESSIBLE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function resolveSaasRoute(user: AuthenticatedUser, pathname: string) {
  if (
    user.must_change_password &&
    pathname !== "/account/change-password"
  ) return "/account/change-password";
  if (
    !user.must_change_password &&
    pathname === "/account/change-password"
  ) return user.shop.onboarding_completed === false && user.is_primary_owner
    ? "/onboarding"
    : "/dashboard";
  if (
    user.shop.status === "ONBOARDING" &&
    user.is_primary_owner &&
    pathname !== "/onboarding" &&
    !isOnboardingAccessibleRoute(pathname)
  ) return "/onboarding";
  if (
    user.shop.status === "SUSPENDED" &&
    !["/settings/subscription", "/account"].includes(pathname)
  ) return user.role === "OWNER" ? "/settings/subscription" : "/account";
  if (
    (
      pathname === "/team"
      || pathname.startsWith("/settings/team")
      || pathname.startsWith("/settings/data")
      || pathname.startsWith("/settings/subscription")
    ) &&
    user.role !== "OWNER"
  ) return "/dashboard";
  return null;
}

export function ProtectedBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, error, refreshUser, user } = useAuth();
  const state = resolveProtectedState(status);

  useEffect(() => {
    if (state === "redirect" && !error) router.replace("/login");
    if (state !== "content" || !user) return;
    const destination = resolveSaasRoute(user, pathname);
    if (destination) router.replace(destination);
  }, [error, pathname, router, state, user]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md">
          <ErrorState
            title="Backend unavailable"
            description={error}
            onRetry={() => void refreshUser()}
          />
        </div>
      </main>
    );
  }

  if (state === "loading" || state === "redirect") {
    return <AppLoading message="Checking your secure session…" />;
  }

  const redirectingForLifecycle = user ? resolveSaasRoute(user, pathname) : null;
  if (redirectingForLifecycle) {
    return <AppLoading message="Preparing your permitted workspace…" />;
  }

  return children;
}
