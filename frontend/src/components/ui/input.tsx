"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-[var(--control-height)] w-full rounded-[var(--radius-control)] border bg-surface px-3.5 py-2.5 text-base text-text-primary shadow-sm outline-none placeholder:text-text-muted transition-colors focus:border-primary focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-secondary disabled:text-disabled",
        invalid ? "border-danger focus:border-danger focus:ring-red-100" : "border-input-border",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <select
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "min-h-[var(--control-height)] w-full rounded-[var(--radius-control)] border bg-surface px-3.5 py-2.5 text-base text-text-primary outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-[var(--focus-ring)] disabled:bg-surface-secondary disabled:text-disabled",
      invalid ? "border-danger" : "border-input-border",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "min-h-24 w-full resize-y rounded-[var(--radius-control)] border bg-surface px-3.5 py-2.5 text-base text-text-primary outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-[var(--focus-ring)] disabled:bg-surface-secondary disabled:text-disabled",
      invalid ? "border-danger" : "border-input-border",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-1 inline-flex w-11 items-center justify-center rounded-lg text-text-muted hover:text-text-primary"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
