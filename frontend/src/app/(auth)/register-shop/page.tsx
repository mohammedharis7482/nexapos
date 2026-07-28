"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input, PasswordInput, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";

export default function RegisterShopPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try {
      const response = await saasService.register({
        ...values,
        country: "Qatar",
        timezone: "Asia/Qatar",
        currency: "QAR",
      });
      setMessage(response.message);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Registration could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicAccountPage
      eyebrow="Create your workspace"
      title="Register your grocery shop"
      description="Start a secure NexaPOS trial. Verify your email before signing in."
      footer={<span>Already registered? <Link className="font-semibold text-primary" href="/login">Sign in</Link></span>}
    >
      {message ? <Alert title={message} tone="success" /> : null}
      {error ? <Alert title={error} /> : null}
      <form onSubmit={submit} className="mt-5 space-y-5">
        <FormField label="Shop name" htmlFor="shop_name"><Input id="shop_name" name="shop_name" required /></FormField>
        <FormField label="Owner full name" htmlFor="owner_full_name"><Input id="owner_full_name" name="owner_full_name" autoComplete="name" required /></FormField>
        <FormField label="Owner email" htmlFor="owner_email"><Input id="owner_email" name="owner_email" type="email" autoComplete="email" required /></FormField>
        <FormField label="Owner username" htmlFor="owner_username"><Input id="owner_username" name="owner_username" autoComplete="username" required /></FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Password" htmlFor="password"><PasswordInput id="password" name="password" autoComplete="new-password" required /></FormField>
          <FormField label="Confirm password" htmlFor="password_confirm"><PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" required /></FormField>
        </div>
        <FormField label="Shop address" htmlFor="address"><Textarea id="address" name="address" required /></FormField>
        <FormField label="Phone" htmlFor="phone"><Input id="phone" name="phone" type="tel" required /></FormField>
        <Button className="w-full" type="submit" loading={submitting}>Create shop</Button>
      </form>
    </PublicAccountPage>
  );
}
