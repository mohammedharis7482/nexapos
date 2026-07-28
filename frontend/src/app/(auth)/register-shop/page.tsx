"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { PublicAccountPage } from "@/components/auth/public-account-page";
import { ShopIdDisplay } from "@/components/shops/shop-id-display";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input, PasswordInput, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";
import type { RegistrationResult } from "@/types/saas";

type RegistrationField =
  | "shop_name"
  | "owner_full_name"
  | "owner_email"
  | "owner_username"
  | "password"
  | "password_confirm"
  | "address"
  | "phone";

type FieldErrors = Partial<Record<RegistrationField, string>>;

const registrationFields: RegistrationField[] = [
  "shop_name",
  "owner_full_name",
  "owner_email",
  "owner_username",
  "password",
  "password_confirm",
  "address",
  "phone",
];

function firstError(value: string[] | string): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function parseRegistrationErrors(error: ApiError): {
  fields: FieldErrors;
  summary: string;
} {
  const fields: FieldErrors = {};
  const details: string[] = [];

  for (const [name, value] of Object.entries(error.errors)) {
    const message = firstError(value);
    if (registrationFields.includes(name as RegistrationField)) {
      fields[name as RegistrationField] = message;
    } else if (message) {
      details.push(message);
    }
  }

  return {
    fields,
    summary: details[0] ?? error.message,
  };
}

export default function RegisterShopPage() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [resendPending, setResendPending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (result) {
      successHeadingRef.current?.focus();
    }
  }, [result]);

  async function resendVerification() {
    if (!result || resendPending) return;
    setResendPending(true);
    setResendFeedback(null);
    try {
      const response = await saasService.resendVerification({ email: result.owner_email });
      setResendFeedback(response.message);
    } catch {
      setResendFeedback("Verification email could not be requested. Try again.");
    } finally {
      setResendPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || result) return;

    inFlightRef.current = true;
    setSubmitting(true);
    setResult(null);
    setError(null);
    setFieldErrors({});
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      const response = await saasService.register({
        ...values,
        country: "Qatar",
        timezone: "Asia/Qatar",
        currency: "QAR",
      });
      setError(null);
      setFieldErrors({});
      form.reset();
      setResult(response.data);
    } catch (caught) {
      setResult(null);
      if (caught instanceof ApiError) {
        const parsed = parseRegistrationErrors(caught);
        setFieldErrors(parsed.fields);
        setError(parsed.summary);
        const firstInvalid = registrationFields.find((name) => parsed.fields[name]);
        if (firstInvalid) {
          requestAnimationFrame(() => {
            const control = form.elements.namedItem(firstInvalid);
            if (control instanceof HTMLElement) control.focus();
          });
        }
      } else {
        setFieldErrors({});
        setError("Registration could not be completed. Check your connection and try again.");
      }
    } finally {
      inFlightRef.current = false;
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
      {result ? (
        <section className="mt-5 rounded-[var(--radius-card)] border border-success-border bg-success-soft p-5 text-center" role="status" aria-live="polite">
          <h2 ref={successHeadingRef} tabIndex={-1} className="text-xl font-bold text-success">
            Shop registered
          </h2>
          <p className="mt-2 text-sm text-foreground-secondary">
            <strong>{result.shop.name}</strong> is registered. A verification
            email was created for <strong>{result.owner_email}</strong>.
            Email verification is required before your first sign-in.
          </p>
          <p className="mt-3 text-sm text-foreground-secondary">
            Open the verification link from your email. In local development,
            the message and link appear in the Django server terminal.
          </p>
          <p className="mt-3 text-sm font-medium text-foreground">
            Save this Shop ID. You will use it together with your username and
            password when signing in.
          </p>
          <ShopIdDisplay shopId={result.shop.id} className="mt-4 text-left" />
          {resendFeedback ? <p className="mt-3 text-sm text-foreground-secondary" role="status">{resendFeedback}</p> : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" loading={resendPending} onClick={() => void resendVerification()}>
              Resend Verification Email
            </Button>
            <Link
              href={`/login?shop_id=${encodeURIComponent(result.shop.id)}`}
              className="inline-flex min-h-[var(--control-md)] w-full items-center justify-center rounded-[var(--radius-control)] border border-primary bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            >
              Go to Sign In
            </Link>
          </div>
        </section>
      ) : (
        <>
          {error ? <Alert title={error} /> : null}
          <form onSubmit={submit} className="mt-5 space-y-5">
            <FormField label="Shop name" htmlFor="shop_name" error={fieldErrors.shop_name}><Input id="shop_name" name="shop_name" required /></FormField>
            <FormField label="Owner full name" htmlFor="owner_full_name" error={fieldErrors.owner_full_name}><Input id="owner_full_name" name="owner_full_name" autoComplete="name" required /></FormField>
            <FormField label="Owner email" htmlFor="owner_email" error={fieldErrors.owner_email}><Input id="owner_email" name="owner_email" type="email" autoComplete="email" required /></FormField>
            <FormField label="Owner username" htmlFor="owner_username" error={fieldErrors.owner_username}><Input id="owner_username" name="owner_username" autoComplete="username" required /></FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Password" htmlFor="password" error={fieldErrors.password}><PasswordInput id="password" name="password" autoComplete="new-password" required /></FormField>
              <FormField label="Confirm password" htmlFor="password_confirm" error={fieldErrors.password_confirm}><PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" required /></FormField>
            </div>
            <FormField label="Shop address" htmlFor="address" error={fieldErrors.address}><Textarea id="address" name="address" required /></FormField>
            <FormField label="Phone" htmlFor="phone" error={fieldErrors.phone}><Input id="phone" name="phone" type="tel" required /></FormField>
            <Button className="w-full" type="submit" loading={submitting} disabled={submitting}>Create shop</Button>
          </form>
        </>
      )}
    </PublicAccountPage>
  );
}
