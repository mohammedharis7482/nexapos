"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { ShopIdDisplay } from "@/components/shops/shop-id-display";
import { Alert, Spinner } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";
import type { VerificationResult } from "@/types/saas";

type VerificationState = {
  busy: boolean;
  message: string;
  error: boolean;
  result: VerificationResult | null;
};

export default function VerifyEmailPage() {
  const startedRef = useRef(false);
  const [state, setState] = useState<VerificationState>({
    busy: true,
    message: "Verifying your email…",
    error: false,
    result: null,
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void Promise.resolve().then(() => {
      const token = new URLSearchParams(window.location.search).get("token") ?? "";
      if (!token) {
        setState({
          busy: false,
          message: "This verification link is incomplete.",
          error: true,
          result: null,
        });
        return;
      }
      void saasService.verifyEmail(token).then(
        (response) =>
          setState({
            busy: false,
            message: response.message,
            error: false,
            result: response.data,
          }),
        (error) =>
          setState({
            busy: false,
            message:
              error instanceof ApiError
                ? error.message
                : "This verification link could not be used.",
            error: true,
            result: null,
          }),
      );
    });
  }, []);

  return (
    <PublicAccountPage
      eyebrow="Email verification"
      title="Confirm your account"
      description="Verification protects your shop setup and owner account."
      footer={
        state.error ? (
          <Link className="font-semibold text-primary" href="/login">
            Continue to sign in
          </Link>
        ) : null
      }
    >
      {state.busy ? (
        <div className="flex items-center gap-3">
          <Spinner />
          <p>{state.message}</p>
        </div>
      ) : state.result ? (
        <section className="rounded-[var(--radius-card)] border border-success-border bg-success-soft p-5 text-center" role="status" aria-live="polite">
          <h2 className="text-xl font-bold text-success">Account verified</h2>
          <p className="mt-2 text-sm text-foreground-secondary">
            {state.result.shop.name} is ready for sign-in.
          </p>
          <ShopIdDisplay shopId={state.result.shop.id} className="mt-4 bg-white text-left" />
          <Link
            href={`/login?shop_id=${encodeURIComponent(state.result.shop.id)}`}
            className="mt-5 inline-flex min-h-[var(--control-md)] w-full items-center justify-center rounded-[var(--radius-control)] border border-primary bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            Go to Sign In
          </Link>
        </section>
      ) : (
        <Alert title={state.message} tone="danger" />
      )}
    </PublicAccountPage>
  );
}
