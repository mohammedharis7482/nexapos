"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { Alert, Spinner } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";

export default function VerifyEmailPage() {
  const [state, setState] = useState<{ busy: boolean; message: string; error: boolean }>({ busy: true, message: "Verifying your email…", error: false });
  useEffect(() => {
    void Promise.resolve().then(() => {
      const token = new URLSearchParams(window.location.search).get("token") ?? "";
      if (!token) {
        setState({ busy: false, message: "This verification link is incomplete.", error: true });
        return;
      }
      void saasService.verifyEmail(token).then(
        (response) => setState({ busy: false, message: response.message, error: false }),
        (error) => setState({ busy: false, message: error instanceof ApiError ? error.message : "This verification link could not be used.", error: true }),
      );
    });
  }, []);
  return (
    <PublicAccountPage eyebrow="Email verification" title="Confirm your account" description="Verification protects your shop setup and owner account." footer={<Link className="font-semibold text-primary" href="/login">Continue to sign in</Link>}>
      {state.busy ? <div className="flex items-center gap-3"><Spinner /><p>{state.message}</p></div> : <Alert title={state.message} tone={state.error ? "danger" : "success"} />}
    </PublicAccountPage>
  );
}
