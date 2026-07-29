"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { FormField, PasswordInput } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/schemas/auth.schema";
import { authService } from "@/services/auth.service";

export default function RequiredPasswordChangePage() {
  const router = useRouter();
  const { refreshUser, logout } = useAuth();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    try {
      await authService.changePassword(values);
      await refreshUser();
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field === "current_password" || field === "new_password" || field === "confirm_password") {
            setError(field, { message: Array.isArray(messages) ? messages[0] : messages });
          }
        });
        setGeneralError(error.message);
      } else {
        setGeneralError("The password could not be changed.");
      }
    }
  });

  return (
    <main className="grid min-h-[75vh] place-items-center p-4">
      <Card className="w-full max-w-lg p-6 sm:p-8">
        <p className="type-eyebrow">Account security</p>
        <h1 className="mt-2 type-page-title">Choose your own password</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Your administrator issued a temporary password. Change it before using NexaPOS.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          {generalError ? <Alert title={generalError} /> : null}
          <FormField label="Current temporary password" htmlFor="current_password" error={errors.current_password?.message}>
            <PasswordInput id="current_password" autoComplete="current-password" {...register("current_password")} />
          </FormField>
          <FormField label="New password" htmlFor="new_password" error={errors.new_password?.message}>
            <PasswordInput id="new_password" autoComplete="new-password" {...register("new_password")} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirm_password" error={errors.confirm_password?.message}>
            <PasswordInput id="confirm_password" autoComplete="new-password" {...register("confirm_password")} />
          </FormField>
          <Button className="w-full" type="submit" loading={isSubmitting}>Change password and continue</Button>
          <Button className="w-full" type="button" variant="ghost" onClick={() => void logout()}>Sign out</Button>
        </form>
      </Card>
    </main>
  );
}
