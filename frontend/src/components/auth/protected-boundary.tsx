"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AppLoading, ErrorState } from "@/components/ui/feedback";
import { useAuth, type AuthStatus } from "@/providers/auth-provider";

export function resolveProtectedState(status: AuthStatus) {
  if (status === "loading") return "loading";
  if (status === "unauthenticated") return "redirect";
  return "content";
}

export function ProtectedBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, error, refreshUser } = useAuth();
  const state = resolveProtectedState(status);

  useEffect(() => {
    if (state === "redirect" && !error) router.replace("/login");
  }, [error, router, state]);

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

  return children;
}
