"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { FormField, Input, PasswordInput } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";

type Context = { shop_name: string; email: string; role: string; inviter_name: string; expires_at: string };

export default function AcceptInvitationPage() {
  const [token, setToken] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.resolve().then(() => {
      const value = new URLSearchParams(window.location.search).get("token") ?? "";
      setToken(value);
      if (!value) {
        setError("This invitation link is incomplete.");
        setLoading(false);
        return;
      }
      void saasService.invitation(value).then(
        (response) => { setContext(response.data); setLoading(false); },
        (caught) => { setError(caught instanceof ApiError ? caught.message : "This invitation is unavailable."); setLoading(false); },
      );
    });
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try {
      const response = await saasService.acceptInvitation({ ...values, token });
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicAccountPage eyebrow="Team invitation" title={context ? `Join ${context.shop_name}` : "Accept invitation"} description={context ? `${context.inviter_name} invited ${context.email} as ${context.role.toLowerCase()}.` : "Review and accept your secure NexaPOS invitation."} footer={<Link className="font-semibold text-primary" href="/login">Back to sign in</Link>}>
      {loading ? <Skeleton className="h-64 w-full" /> : null}
      {message ? <Alert title={message} tone="success" /> : null}
      {error ? <Alert title={error} /> : null}
      {context && !message ? (
        <form className="mt-5 space-y-5" onSubmit={submit}>
          <FormField label="Full name" htmlFor="full_name"><Input id="full_name" name="full_name" defaultValue="" autoComplete="name" required /></FormField>
          <FormField label="Username" htmlFor="username"><Input id="username" name="username" autoComplete="username" required /></FormField>
          <FormField label="Password" htmlFor="password"><PasswordInput id="password" name="password" autoComplete="new-password" required /></FormField>
          <FormField label="Confirm password" htmlFor="password_confirm"><PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" required /></FormField>
          <Button className="w-full" type="submit" loading={busy}>Join shop</Button>
        </form>
      ) : null}
    </PublicAccountPage>
  );
}
