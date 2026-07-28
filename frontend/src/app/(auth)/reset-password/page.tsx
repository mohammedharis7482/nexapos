"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, PasswordInput } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.resolve().then(() => {
      setToken(new URLSearchParams(window.location.search).get("token") ?? "");
    });
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try {
      const response = await saasService.confirmPasswordReset({ ...values, token });
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This reset link could not be used.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicAccountPage eyebrow="Secure recovery" title="Choose a new password" description="Reset links expire after one hour and can be used once." footer={<Link className="font-semibold text-primary" href="/login">Return to sign in</Link>}>
      {!token ? <Alert title="This reset link is incomplete." /> : null}
      {message ? <Alert title={message} tone="success" /> : null}
      {error ? <Alert title={error} /> : null}
      <form className="mt-5 space-y-5" onSubmit={submit}>
        <FormField label="New password" htmlFor="new_password"><PasswordInput id="new_password" name="new_password" autoComplete="new-password" required /></FormField>
        <FormField label="Confirm password" htmlFor="confirm_password"><PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" required /></FormField>
        <Button className="w-full" type="submit" loading={busy} disabled={!token}>Reset password</Button>
      </form>
    </PublicAccountPage>
  );
}
