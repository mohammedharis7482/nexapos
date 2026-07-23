"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, PasswordInput } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/schemas/auth.schema";
import { authService } from "@/services/auth.service";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [success, setSuccess] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    setSuccess(false);
    try {
      await authService.changePassword(values);
      reset();
      setSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (
            field === "current_password" ||
            field === "new_password" ||
            field === "confirm_password"
          ) {
            setError(field, {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
        setGeneralError(error.message);
      } else {
        setGeneralError("The password could not be changed.");
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setSuccess(false);
          setGeneralError(null);
        }
        onOpenChange(next);
      }}
      title="Change password"
      description="Use a strong password you do not use elsewhere."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {success ? (
          <Alert title="Password changed" tone="success">
            Your current session remains active.
          </Alert>
        ) : null}
        {generalError ? <Alert title={generalError} /> : null}
        <FormField
          label="Current password"
          htmlFor="current_password"
          error={errors.current_password?.message}
        >
          <PasswordInput
            id="current_password"
            autoComplete="current-password"
            invalid={Boolean(errors.current_password)}
            {...register("current_password")}
          />
        </FormField>
        <FormField
          label="New password"
          htmlFor="new_password"
          error={errors.new_password?.message}
        >
          <PasswordInput
            id="new_password"
            autoComplete="new-password"
            invalid={Boolean(errors.new_password)}
            {...register("new_password")}
          />
        </FormField>
        <FormField
          label="Confirm password"
          htmlFor="confirm_password"
          error={errors.confirm_password?.message}
        >
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            invalid={Boolean(errors.confirm_password)}
            {...register("confirm_password")}
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
