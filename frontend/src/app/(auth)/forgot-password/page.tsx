"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const email = String(new FormData(event.currentTarget).get("email") ?? "");
      const response = await saasService.requestPasswordReset(email);
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicAccountPage eyebrow="Account recovery" title="Reset your password" description="Enter your email. The response is intentionally the same whether or not an account exists." footer={<Link className="font-semibold text-primary" href="/login">Back to sign in</Link>}>
      {message ? <Alert title={message} tone="success" /> : null}
      {error ? <Alert title={error} /> : null}
      <form className="mt-5 space-y-5" onSubmit={submit}>
        <FormField label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></FormField>
        <Button className="w-full" type="submit" loading={busy}>Send reset instructions</Button>
      </form>
    </PublicAccountPage>
  );
}
